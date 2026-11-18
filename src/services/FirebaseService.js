/**
 * Firebase service for DermaSwine AI.
 *
 * Centralizes Firebase initialization and every app data operation:
 * - Authentication (sign in/up/out, session subscription)
 * - Detection history (create/read/update/delete/subscribe/clear)
 * - Contact messages (create, with explicit handling for restricted operations)
 * - Optional Firebase Storage uploads
 *
 * Configuration is read from EXPO_PUBLIC_FIREBASE_* env vars with safe defaults
 * for the current dermaswine-ai project so local/dev builds work out of the box.
 *
 * History backend:
 * - local (default): AsyncStorage, works offline/rule-free for guests and users
 * - firestore: Cloud Firestore, requires deployed rules and authenticated access
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
} from 'firebase/analytics';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { createAuth } from './authPersistence';

/* ------------------------------------------------------------------ */
/* Configuration & initialization                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBKzKoMljDGU5ELbKPzskP2bJxBNLd8_QE',
  authDomain: 'dermaswine-ai.firebaseapp.com',
  projectId: 'dermaswine-ai',
  storageBucket: 'dermaswine-ai.firebasestorage.app',
  messagingSenderId: '853604686653',
  appId: '1:853604686653:web:a44da5df30354196ca4354',
  measurementId: 'G-SYLXBWYP25',
};

const env = (key, fallback = '') =>
  String(process.env[key] ?? fallback ?? '').trim();

// Firebase app configuration (env-first, project defaults as fallback).
export const firebaseConfig = {
  apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY', DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: env(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    DEFAULT_FIREBASE_CONFIG.authDomain
  ),
  projectId: env(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    DEFAULT_FIREBASE_CONFIG.projectId
  ),
  storageBucket: env(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    DEFAULT_FIREBASE_CONFIG.storageBucket
  ),
  messagingSenderId: env(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    DEFAULT_FIREBASE_CONFIG.messagingSenderId
  ),
  appId: env('EXPO_PUBLIC_FIREBASE_APP_ID', DEFAULT_FIREBASE_CONFIG.appId),
  measurementId: env(
    'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
    DEFAULT_FIREBASE_CONFIG.measurementId
  ),
};

export const isImageStorageEnabled =
  env('EXPO_PUBLIC_ENABLE_IMAGE_STORAGE') === 'true';

const hasCoreFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);

// Storage is optional while image uploads are disabled.
export const isFirebaseConfigured = Boolean(
  hasCoreFirebaseConfig && (!isImageStorageEnabled || firebaseConfig.storageBucket)
);

export let app = null;
export let auth = null;
export let db = null;
export let storage = null;
export let analytics = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = createAuth(app);
  db = getFirestore(app);
  storage = firebaseConfig.storageBucket ? getStorage(app) : null;

  // Analytics is supported on web and some environments; never block app init.
  void isAnalyticsSupported()
    .then((supported) => {
      if (!supported || !app) return;
      try {
        analytics = getAnalytics(app);
      } catch (error) {
        console.warn('Firebase Analytics unavailable:', error?.message || error);
      }
    })
    .catch(() => {
      analytics = null;
    });
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const ok = (data = {}) => ({ success: true, ...data });
const fail = (error, extra = {}) => ({
  success: false,
  error:
    typeof error === 'string'
      ? error
      : error?.message || 'Something went wrong. Please try again.',
  code: typeof error === 'string' ? undefined : error?.code,
  ...extra,
});

const isPermissionDenied = (error) =>
  error?.code === 'permission-denied' ||
  /insufficient permissions|missing or insufficient permissions/i.test(
    String(error?.message || '')
  );

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByCreatedAtDesc = (items = []) =>
  [...items].sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));

const clampConfidence = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
};

const normalizeAlternatives = (alternatives) =>
  (Array.isArray(alternatives) ? alternatives : [])
    .slice(0, 3)
    .map((item) => ({
      label: String(item?.label || '').trim(),
      confidence: clampConfidence(item?.confidence),
    }))
    .filter((item) => item.label);

const currentUid = () => auth?.currentUser?.uid || 'anonymous';
const isSignedIn = () => Boolean(auth?.currentUser);

const requireConfigured = () => {
  if (!isFirebaseConfigured || !app) {
    return fail('Firebase is not configured. Check your EXPO_PUBLIC_FIREBASE_* settings.');
  }
  return null;
};

const requireAuth = (action = 'perform this action') => {
  if (!auth?.currentUser) {
    return fail(`You must be signed in to ${action}.`);
  }
  return null;
};

const requireFirestore = (action = 'use cloud data') => {
  if (!db) return fail(`Cloud database is unavailable. Cannot ${action}.`);
  return null;
};

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

export const signIn = async (email, password) => {
  const configError = requireConfigured();
  if (configError) return configError;
  if (!auth) return fail('Authentication is unavailable.');
  if (!String(email || '').trim() || !String(password || '').trim()) {
    return fail('Email and password are required.');
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      String(email).trim(),
      String(password)
    );
    return ok({ user: credential.user });
  } catch (error) {
    console.error('Sign-in failed:', error);
    return fail(error);
  }
};

export const signUp = async (email, password, { displayName, imageUri } = {}) => {
  const configError = requireConfigured();
  if (configError) return configError;
  if (!auth) return fail('Authentication is unavailable.');
  if (!String(email || '').trim() || !String(password || '').trim()) {
    return fail('Email and password are required.');
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      String(email).trim(),
      String(password)
    );

    let photoURL = null;
    if (imageUri && isImageStorageEnabled) {
      const uploaded = await uploadImage(imageUri, `users/${credential.user.uid}`);
      if (uploaded.success) photoURL = uploaded.url;
    }

    const safeName = String(displayName || '').trim() || null;
    await updateProfile(credential.user, { displayName: safeName, photoURL });

    return ok({ user: auth.currentUser || credential.user, photoURL });
  } catch (error) {
    console.error('Sign-up failed:', error);
    return fail(error);
  }
};

export const logOut = async () => {
  if (!auth) return ok();
  try {
    await signOut(auth);
    return ok();
  } catch (error) {
    console.error('Sign-out failed:', error);
    return fail(error);
  }
};

export const getCurrentUser = () => auth?.currentUser || null;

export const subscribeToAuth = (callback) => {
  if (!auth) {
    try {
      callback(null);
    } catch (error) {
      console.error('Auth callback error:', error);
    }
    return () => {};
  }
  return onAuthStateChanged(auth, callback, (error) => {
    console.error('Auth listener error:', error);
    callback(null);
  });
};

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const uriToBlob = (uri) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Could not read the selected image (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new TypeError('Could not read the selected image.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

const storageContentType = (extension) => {
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
};

export const uploadImage = async (uri, folder = 'detection_images') => {
  if (!storage) {
    return fail(
      'Firebase Storage is not configured. Enable image storage after provisioning a bucket.'
    );
  }
  if (!uri) return fail('An image URI is required for upload.');

  try {
    const blob = await uriToBlob(uri);
    const rawExtension = String(uri).split('?')[0].split('.').pop().toLowerCase();
    const extension = ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(rawExtension)
      ? rawExtension === 'jpeg'
        ? 'jpg'
        : rawExtension
      : 'jpg';
    const path = `${String(folder).replace(/^\/+|\/+$/g, '')}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: storageContentType(extension) });
    const url = await getDownloadURL(storageRef);
    return ok({ url, path });
  } catch (error) {
    console.error('Image upload failed:', error);
    return fail(error);
  }
};

export const deleteStorageFile = async (path) => {
  if (!storage) return fail('Firebase Storage is not configured.');
  if (!path) return fail('A storage path is required.');
  try {
    await deleteObject(ref(storage, String(path)));
    return ok();
  } catch (error) {
    console.error('Storage delete failed:', error);
    return fail(error);
  }
};

/* ------------------------------------------------------------------ */
/* Detection history (local + Firestore)                               */
/* ------------------------------------------------------------------ */

export const historyBackend =
  env('EXPO_PUBLIC_HISTORY_BACKEND') === 'firestore' ? 'firestore' : 'local';
const isFirestoreHistory = historyBackend === 'firestore';

const LOCAL_HISTORY_PREFIX = '@dermaswine/detections';
const localHistoryListeners = new Map();
const localHistoryKey = (uid = currentUid()) => `${LOCAL_HISTORY_PREFIX}/${uid}`;

const readLocalHistory = async (key = localHistoryKey()) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortByCreatedAtDesc(parsed) : [];
  } catch (error) {
    console.error('Error reading local detection history:', error);
    return [];
  }
};

const writeLocalHistory = async (records, key = localHistoryKey()) => {
  const sorted = sortByCreatedAtDesc(records);
  await AsyncStorage.setItem(key, JSON.stringify(sorted));
  localHistoryListeners.get(key)?.forEach((listener) => {
    try {
      listener(sorted);
    } catch (error) {
      console.error('Local history listener error:', error);
    }
  });
  return sorted;
};

const subscribeToLocalHistory = (callback) => {
  const key = localHistoryKey();
  if (!localHistoryListeners.has(key)) {
    localHistoryListeners.set(key, new Set());
  }
  localHistoryListeners.get(key).add(callback);

  let active = true;
  void readLocalHistory(key).then((records) => {
    if (active) callback(records);
  });

  return () => {
    active = false;
    const listeners = localHistoryListeners.get(key);
    listeners?.delete(callback);
    if (listeners && listeners.size === 0) {
      localHistoryListeners.delete(key);
    }
  };
};

const normalizeDetectionInput = ({
  imageUri,
  label,
  confidence,
  diseaseName,
  alternatives = [],
  recommendation = null,
  imageUrl = '',
} = {}) => {
  const normalizedLabel = String(label || '').trim();
  if (!normalizedLabel) {
    return { error: 'A detection label is required.' };
  }

  return {
    value: {
      userId: currentUid(),
      label: normalizedLabel,
      diseaseName: String(diseaseName || normalizedLabel).trim() || normalizedLabel,
      confidence: clampConfidence(confidence),
      alternatives: normalizeAlternatives(alternatives),
      recommendation:
        recommendation && typeof recommendation === 'object' ? recommendation : null,
      imageUri: imageUri ? String(imageUri) : '',
      imageUrl: imageUrl ? String(imageUrl) : '',
    },
  };
};

const detectionDocRef = (id) => doc(db, 'detections', String(id));

const mapDetectionSnapshot = (snapshot) => {
  const detections = [];
  snapshot.forEach((document) => {
    detections.push({ id: document.id, ...document.data() });
  });
  return sortByCreatedAtDesc(detections);
};

export const addDetection = async (input = {}) => {
  const { value, error } = normalizeDetectionInput(input);
  if (error) return fail(error);

  if (!isFirestoreHistory) {
    const key = localHistoryKey();
    const record = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      backend: 'local',
    };
    try {
      const existing = await readLocalHistory(key);
      await writeLocalHistory([record, ...existing], key);
      return ok({ id: record.id, detection: record, local: true });
    } catch (writeError) {
      console.error('Error adding local detection:', writeError);
      return fail(writeError);
    }
  }

  const dbError = requireFirestore('save detection history');
  if (dbError) return dbError;
  if (!isSignedIn()) {
    return fail(
      'Sign in to sync detection history to Firestore, or use local history mode.'
    );
  }

  try {
    const record = { ...value, imageUri: '' };
    if (record.imageUrl === '' && input.imageUri && isImageStorageEnabled) {
      const uploaded = await uploadImage(input.imageUri, `detections/${currentUid()}`);
      if (uploaded.success) {
        record.imageUrl = uploaded.url;
        record.imagePath = uploaded.path || '';
      }
    }

    const docRef = await addDoc(collection(db, 'detections'), {
      ...record,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ok({ id: docRef.id });
  } catch (writeError) {
    console.error('Error adding detection:', writeError);
    return fail(writeError);
  }
};

export const getDetections = async ({ limitCount } = {}) => {
  if (!isFirestoreHistory) {
    const detections = await readLocalHistory();
    const limited =
      Number.isInteger(limitCount) && limitCount > 0
        ? detections.slice(0, limitCount)
        : detections;
    return ok({ detections: limited, local: true });
  }

  const dbError = requireFirestore('read detection history');
  if (dbError) return dbError;
  if (!isSignedIn()) return fail('You must be signed in to read cloud detection history.');

  try {
    const constraints = [
      collection(db, 'detections'),
      where('userId', '==', currentUid()),
    ];
    const snapshot = await getDocs(query(...constraints));
    let detections = mapDetectionSnapshot(snapshot);
    if (Number.isInteger(limitCount) && limitCount > 0) {
      detections = detections.slice(0, limitCount);
    }
    return ok({ detections });
  } catch (error) {
    console.error('Error getting detections:', error);
    return fail(error);
  }
};

export const getDetection = async (id) => {
  if (!id) return fail('A detection ID is required.');

  if (!isFirestoreHistory) {
    const detections = await readLocalHistory();
    const detection = detections.find((item) => item.id === id) || null;
    return detection ? ok({ detection, local: true }) : fail('Detection not found.', { notFound: true });
  }

  const dbError = requireFirestore('read detection history');
  if (dbError) return dbError;
  if (!isSignedIn()) return fail('You must be signed in to read cloud detection history.');

  try {
    const snapshot = await getDoc(detectionDocRef(id));
    if (!snapshot.exists()) return fail('Detection not found.', { notFound: true });
    const detection = { id: snapshot.id, ...snapshot.data() };
    if (detection.userId !== currentUid()) {
      return fail('You do not have access to this detection.', { forbidden: true });
    }
    return ok({ detection });
  } catch (error) {
    console.error('Error getting detection:', error);
    return fail(error);
  }
};

/**
 * Real-time detection history subscription.
 * Local mode emits from AsyncStorage; Firestore mode uses onSnapshot.
 * Callback signature is preserved: callback(detectionsArray).
 */
export const subscribeToDetections = (callback) => {
  const safeCallback = typeof callback === 'function' ? callback : () => {};

  if (!isFirestoreHistory) {
    return subscribeToLocalHistory(safeCallback);
  }

  if (!db || !isSignedIn()) {
    safeCallback([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'detections'), where('userId', '==', currentUid()));
    return onSnapshot(
      q,
      (snapshot) => safeCallback(mapDetectionSnapshot(snapshot)),
      (error) => {
        console.error('Detection listener error:', error);
        safeCallback([]);
      }
    );
  } catch (error) {
    console.error('Detection subscription failed:', error);
    safeCallback([]);
    return () => {};
  }
};

export const updateDetection = async (id, updates = {}) => {
  if (!id) return fail('A detection ID is required.');
  if (!updates || typeof updates !== 'object') return fail('Update data is required.');

  const allowed = {};
  if (updates.label != null) allowed.label = String(updates.label).trim();
  if (updates.diseaseName != null) allowed.diseaseName = String(updates.diseaseName).trim();
  if (updates.confidence != null) allowed.confidence = clampConfidence(updates.confidence);
  if (updates.alternatives != null) allowed.alternatives = normalizeAlternatives(updates.alternatives);
  if (updates.recommendation !== undefined) {
    allowed.recommendation =
      updates.recommendation && typeof updates.recommendation === 'object'
        ? updates.recommendation
        : null;
  }
  if (updates.imageUrl != null) allowed.imageUrl = String(updates.imageUrl);
  if (updates.imagePath != null) allowed.imagePath = String(updates.imagePath);

  if (!Object.keys(allowed).length) {
    return fail('No valid detection fields were provided for update.');
  }

  if (!isFirestoreHistory) {
    const key = localHistoryKey();
    try {
      const existing = await readLocalHistory(key);
      const index = existing.findIndex((item) => item.id === id);
      if (index === -1) return fail('Detection not found.', { notFound: true });
      const updated = {
        ...existing[index],
        ...allowed,
        updatedAt: Date.now(),
      };
      const next = [...existing];
      next[index] = updated;
      await writeLocalHistory(next, key);
      return ok({ id, detection: updated, local: true });
    } catch (error) {
      console.error('Error updating local detection:', error);
      return fail(error);
    }
  }

  const dbError = requireFirestore('update detection history');
  if (dbError) return dbError;
  const authError = requireAuth('update detection history');
  if (authError) return authError;

  try {
    await updateDoc(detectionDocRef(id), {
      ...allowed,
      updatedAt: serverTimestamp(),
    });
    return ok({ id });
  } catch (error) {
    console.error('Error updating detection:', error);
    if (isPermissionDenied(error)) {
      return fail(
        'Updating this detection is not permitted. Check Firestore rules and ownership.',
        { code: error.code }
      );
    }
    return fail(error);
  }
};

export const deleteDetection = async (id) => {
  if (!id) return fail('A detection ID is required.');

  if (!isFirestoreHistory) {
    const key = localHistoryKey();
    try {
      const existing = await readLocalHistory(key);
      const next = existing.filter((item) => item.id !== id);
      if (next.length === existing.length) {
        return fail('Detection not found.', { notFound: true });
      }
      await writeLocalHistory(next, key);
      return ok({ id, local: true });
    } catch (error) {
      console.error('Error deleting local detection:', error);
      return fail(error);
    }
  }

  const dbError = requireFirestore('delete detection history');
  if (dbError) return dbError;
  const authError = requireAuth('delete detection history');
  if (authError) return authError;

  try {
    await deleteDoc(detectionDocRef(id));
    return ok({ id });
  } catch (error) {
    console.error('Error deleting detection:', error);
    if (isPermissionDenied(error)) {
      return fail(
        'Deleting this detection is not permitted. Check Firestore rules and ownership.',
        { code: error.code }
      );
    }
    return fail(error);
  }
};

export const clearDetections = async () => {
  if (!isFirestoreHistory) {
    const key = localHistoryKey();
    try {
      await writeLocalHistory([], key);
      return ok({ cleared: true, local: true });
    } catch (error) {
      console.error('Error clearing local detections:', error);
      return fail(error);
    }
  }

  const dbError = requireFirestore('clear detection history');
  if (dbError) return dbError;
  const authError = requireAuth('clear detection history');
  if (authError) return authError;

  try {
    const snapshot = await getDocs(
      query(collection(db, 'detections'), where('userId', '==', currentUid()))
    );
    if (snapshot.empty) return ok({ cleared: true, count: 0 });

    const docs = snapshot.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deleted += Math.min(450, docs.length - i);
    }
    return ok({ cleared: true, count: deleted });
  } catch (error) {
    console.error('Error clearing detections:', error);
    return fail(error);
  }
};

/* ------------------------------------------------------------------ */
/* Contact messages                                                    */
/* ------------------------------------------------------------------ */

const normalizeMessageInput = ({ name, email, message, userId } = {}) => {
  const payload = {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    message: String(message || '').trim(),
    userId: userId != null ? String(userId) : currentUid(),
  };

  if (!payload.name) return { error: 'Your name is required.' };
  if (!payload.message) return { error: 'A message is required.' };
  if (payload.name.length > 120) return { error: 'Name is too long.' };
  if (payload.email.length > 200) return { error: 'Email is too long.' };
  if (payload.message.length > 5000) return { error: 'Message is too long.' };

  return { value: payload };
};

export const sendMessage = async (input = {}) => {
  const dbError = requireFirestore('send a contact message');
  if (dbError) return dbError;

  const { value, error } = normalizeMessageInput(input);
  if (error) return fail(error);

  try {
    const docRef = await addDoc(collection(db, 'messages'), {
      ...value,
      createdAt: serverTimestamp(),
    });
    return ok({ id: docRef.id });
  } catch (writeError) {
    console.error('Error sending message:', writeError);
    if (isPermissionDenied(writeError)) {
      return fail(
        'Sending this message is not permitted by the current Firestore rules.',
        { code: writeError.code }
      );
    }
    return fail(writeError);
  }
};

export const getMessages = async () => {
  // Contact messages are write-only from the client by security design.
  return fail(
    'Reading contact messages is restricted. Use the Firebase console or a trusted backend.',
    { restricted: true }
  );
};

export const updateMessage = async () => {
  return fail('Updating contact messages is not permitted.', { restricted: true });
};

export const deleteMessage = async () => {
  return fail('Deleting contact messages is not permitted.', { restricted: true });
};

/* ------------------------------------------------------------------ */
/* Extended data model: users, farms, pigs, screenings, reports        */
/* ------------------------------------------------------------------ */

const LOCAL_FARMS_PREFIX = '@dermaswine/farms';
const LOCAL_PIGS_PREFIX = '@dermaswine/pigs';
const LOCAL_SCREENINGS_PREFIX = '@dermaswine/screenings';
const LOCAL_REPORTS_PREFIX = '@dermaswine/reports';
const localStores = new Map();

const localStoreKey = (prefix, uid = currentUid()) => `${prefix}/${uid}`;

const readLocalStore = async (prefix, uid = currentUid()) => {
  const key = localStoreKey(prefix, uid);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortByCreatedAtDesc(parsed) : [];
  } catch (error) {
    console.error(`Error reading local store ${prefix}:`, error);
    return [];
  }
};

const writeLocalStore = async (prefix, records, uid = currentUid()) => {
  const key = localStoreKey(prefix, uid);
  const sorted = sortByCreatedAtDesc(records);
  await AsyncStorage.setItem(key, JSON.stringify(sorted));
  localStores.get(key)?.forEach((listener) => {
    try {
      listener(sorted);
    } catch (error) {
      console.error(`Local store listener error ${prefix}:`, error);
    }
  });
  return sorted;
};

const subscribeToLocalStore = (prefix, callback, uid = currentUid()) => {
  const key = localStoreKey(prefix, uid);
  if (!localStores.has(key)) localStores.set(key, new Set());
  const safeCallback = typeof callback === 'function' ? callback : () => {};
  localStores.get(key).add(safeCallback);

  let active = true;
  void readLocalStore(prefix, uid).then((items) => {
    if (active) safeCallback(items);
  });

  return () => {
    active = false;
    const listeners = localStores.get(key);
    listeners?.delete(safeCallback);
    if (listeners && listeners.size === 0) localStores.delete(key);
  };
};

const generateScreeningId = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SCR-${y}${m}${d}-${rand}`;
};

const normalizeLabelKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export const getPigHealthStatusFromPrediction = (predictedDisease) => {
  const key = normalizeLabelKey(predictedDisease);
  if (!key) return 'Unknown';
  if (key === 'healthy' || key.includes('healthy')) return 'Healthy';
  return 'Suspected condition';
};

const localNow = () => Date.now();

const mapSnapshotDocs = (snapshot) => {
  const items = [];
  snapshot.forEach((document) => items.push({ id: document.id, ...document.data() }));
  return sortByCreatedAtDesc(items);
};

const canUseCloud = () => isFirebaseConfigured && Boolean(db) && isSignedIn();

/* ----------------------------- Users -------------------------------- */

export const ensureUserProfile = async (user = getCurrentUser(), extra = {}) => {
  const target = user || getCurrentUser();
  if (!target?.uid) return fail('No authenticated user to sync.');
  if (!canUseCloud()) return ok({ local: true, skipped: true });

  const refUser = doc(db, 'users', target.uid);
  const payload = {
    uid: target.uid,
    email: target.email || '',
    displayName: target.displayName || extra.displayName || '',
    photoURL: target.photoURL || '',
    farmIdentification: String(extra.farmIdentification || '').trim(),
    updatedAt: serverTimestamp(),
  };

  try {
    const existing = await getDoc(refUser);
    if (!existing.exists()) {
      await setDoc(refUser, { ...payload, createdAt: serverTimestamp() }, { merge: true });
    } else {
      await setDoc(refUser, payload, { merge: true });
    }
    return ok({ id: target.uid });
  } catch (error) {
    console.error('Error syncing user profile:', error);
    return fail(error);
  }
};

export const getUserProfile = async (uid = currentUid()) => {
  if (!canUseCloud()) return ok({ profile: null, local: true });
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    return ok({ profile: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return fail(error);
  }
};

export const updateUserProfile = async (updates = {}) => {
  if (!isSignedIn()) return fail('You must be signed in to update your profile.');
  if (!canUseCloud()) return fail('Cloud database is unavailable.');
  try {
    await setDoc(
      doc(db, 'users', currentUid()),
      {
        ...updates,
        uid: currentUid(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return ok({ id: currentUid() });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return fail(error);
  }
};

let lastSyncedUserId = null;
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user?.uid && user.uid !== lastSyncedUserId) {
      lastSyncedUserId = user.uid;
      void ensureUserProfile(user);
    }
    if (!user) lastSyncedUserId = null;
  });
}

/* ----------------------------- Farms -------------------------------- */

const normalizeFarmInput = (input = {}) => {
  const name = String(input.name || '').trim();
  if (!name) return { error: 'Farm name is required.' };
  return {
    value: {
      ownerId: currentUid(),
      name,
      farmIdentification: String(input.farmIdentification || input.identification || '').trim(),
      location: String(input.location || '').trim(),
      contact: String(input.contact || '').trim(),
      notes: String(input.notes || '').trim(),
    },
  };
};

export const saveFarm = async (input = {}) => {
  const { value, error } = normalizeFarmInput(input);
  if (error) return fail(error);
  const existingId = input.id || null;

  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_FARMS_PREFIX);
    const record = existingId
      ? { ...items.find((i) => i.id === existingId), ...value, id: existingId, updatedAt: localNow() }
      : { id: `farm-${localNow()}-${Math.random().toString(36).slice(2, 6)}`, ...value, createdAt: localNow(), updatedAt: localNow() };
    const next = existingId ? items.map((i) => (i.id === existingId ? record : i)) : [record, ...items];
    await writeLocalStore(LOCAL_FARMS_PREFIX, next);
    return ok({ id: record.id, farm: record, local: true });
  }

  try {
    if (existingId) {
      await setDoc(
        doc(db, 'farms', existingId),
        { ...value, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return ok({ id: existingId });
    }
    const refDoc = await addDoc(collection(db, 'farms'), {
      ...value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ok({ id: refDoc.id });
  } catch (writeError) {
    console.error('Error saving farm:', writeError);
    return fail(writeError);
  }
};

export const getFarms = async () => {
  if (!canUseCloud()) return ok({ farms: await readLocalStore(LOCAL_FARMS_PREFIX), local: true });
  try {
    const snapshot = await getDocs(query(collection(db, 'farms'), where('ownerId', '==', currentUid())));
    return ok({ farms: mapSnapshotDocs(snapshot) });
  } catch (error) {
    console.error('Error getting farms:', error);
    return fail(error);
  }
};

export const subscribeToFarms = (callback) => {
  const safe = typeof callback === 'function' ? callback : () => {};
  if (!canUseCloud()) return subscribeToLocalStore(LOCAL_FARMS_PREFIX, safe);
  const q = query(collection(db, 'farms'), where('ownerId', '==', currentUid()));
  return onSnapshot(q, (snap) => safe(mapSnapshotDocs(snap)), (err) => { console.error(err); safe([]); });
};

export const deleteFarm = async (id) => {
  if (!id) return fail('Farm ID is required.');
  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_FARMS_PREFIX);
    await writeLocalStore(LOCAL_FARMS_PREFIX, items.filter((i) => i.id !== id));
    // also detach pigs locally
    const pigs = await readLocalStore(LOCAL_PIGS_PREFIX);
    await writeLocalStore(LOCAL_PIGS_PREFIX, pigs.filter((p) => p.farmId !== id));
    return ok({ id, local: true });
  }
  try {
    await deleteDoc(doc(db, 'farms', id));
    return ok({ id });
  } catch (error) {
    console.error('Error deleting farm:', error);
    return fail(error);
  }
};

/* ------------------------------ Pigs -------------------------------- */

const normalizePigInput = (input = {}) => {
  const pigId = String(input.pigId || input.tag || '').trim();
  const farmId = String(input.farmId || '').trim();
  if (!pigId) return { error: 'Pig ID is required.' };
  if (!farmId) return { error: 'Farm selection is required.' };
  return {
    value: {
      ownerId: currentUid(),
      farmId,
      farmName: String(input.farmName || '').trim(),
      pigId,
      breed: String(input.breed || '').trim(),
      age: String(input.age || '').trim(),
      gender: String(input.gender || '').trim(),
      weight: String(input.weight || '').trim(),
      healthStatus: String(input.healthStatus || 'Healthy').trim() || 'Healthy',
      notes: String(input.notes || '').trim(),
    },
  };
};

export const savePig = async (input = {}) => {
  const { value, error } = normalizePigInput(input);
  if (error) return fail(error);
  const existingId = input.id || null;

  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_PIGS_PREFIX);
    const record = existingId
      ? { ...items.find((i) => i.id === existingId), ...value, id: existingId, updatedAt: localNow() }
      : { id: `pig-${localNow()}-${Math.random().toString(36).slice(2, 6)}`, ...value, createdAt: localNow(), updatedAt: localNow() };
    const next = existingId ? items.map((i) => (i.id === existingId ? record : i)) : [record, ...items];
    await writeLocalStore(LOCAL_PIGS_PREFIX, next);
    return ok({ id: record.id, pig: record, local: true });
  }

  try {
    if (existingId) {
      await setDoc(doc(db, 'pigs', existingId), { ...value, updatedAt: serverTimestamp() }, { merge: true });
      return ok({ id: existingId });
    }
    const refDoc = await addDoc(collection(db, 'pigs'), {
      ...value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ok({ id: refDoc.id });
  } catch (writeError) {
    console.error('Error saving pig:', writeError);
    return fail(writeError);
  }
};

export const getPigs = async ({ farmId } = {}) => {
  if (!canUseCloud()) {
    let pigs = await readLocalStore(LOCAL_PIGS_PREFIX);
    if (farmId) pigs = pigs.filter((p) => p.farmId === farmId);
    return ok({ pigs, local: true });
  }
  try {
    const q = query(collection(db, 'pigs'), where('ownerId', '==', currentUid()));
    const snapshot = await getDocs(q);
    let pigs = mapSnapshotDocs(snapshot);
    if (farmId) pigs = pigs.filter((p) => p.farmId === farmId);
    return ok({ pigs });
  } catch (error) {
    console.error('Error getting pigs:', error);
    return fail(error);
  }
};

export const subscribeToPigs = (callback, { farmId } = {}) => {
  const safe = typeof callback === 'function' ? callback : () => {};
  const filterFarm = (items) => (farmId ? items.filter((p) => p.farmId === farmId) : items);
  if (!canUseCloud()) return subscribeToLocalStore(LOCAL_PIGS_PREFIX, (items) => safe(filterFarm(items)));
  const q = query(collection(db, 'pigs'), where('ownerId', '==', currentUid()));
  return onSnapshot(q, (snap) => safe(filterFarm(mapSnapshotDocs(snap))), (err) => { console.error(err); safe([]); });
};

export const updatePigHealthStatus = async (pigDocId, healthStatus, extra = {}) => {
  if (!pigDocId) return fail('Pig record ID is required.');
  const status = String(healthStatus || '').trim() || 'Unknown';
  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_PIGS_PREFIX);
    const idx = items.findIndex((p) => p.id === pigDocId);
    if (idx === -1) return fail('Pig not found.', { notFound: true });
    const updated = { ...items[idx], ...extra, healthStatus: status, updatedAt: localNow() };
    const next = [...items];
    next[idx] = updated;
    await writeLocalStore(LOCAL_PIGS_PREFIX, next);
    return ok({ id: pigDocId, pig: updated, local: true });
  }
  try {
    await setDoc(doc(db, 'pigs', pigDocId), { ...extra, healthStatus: status, updatedAt: serverTimestamp() }, { merge: true });
    return ok({ id: pigDocId });
  } catch (error) {
    console.error('Error updating pig health status:', error);
    return fail(error);
  }
};

export const deletePig = async (id) => {
  if (!id) return fail('Pig ID is required.');
  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_PIGS_PREFIX);
    await writeLocalStore(LOCAL_PIGS_PREFIX, items.filter((i) => i.id !== id));
    return ok({ id, local: true });
  }
  try {
    await deleteDoc(doc(db, 'pigs', id));
    return ok({ id });
  } catch (error) {
    console.error('Error deleting pig:', error);
    return fail(error);
  }
};

/* --------------------------- Screenings ----------------------------- */

const normalizeScreeningInput = (input = {}) => {
  const predictedDisease = String(input.predictedDisease || input.label || '').trim();
  if (!predictedDisease) return { error: 'Predicted disease is required.' };
  const screeningId = String(input.screeningId || generateScreeningId()).trim();
  const screeningDate = input.screeningDate || localNow();
  const status = String(input.screeningStatus || input.status || 'Completed').trim() || 'Completed';
  return {
    value: {
      ownerId: currentUid(),
      screeningId,
      screeningDate,
      screeningStatus: status,
      farmId: String(input.farmId || '').trim(),
      farmName: String(input.farmName || '').trim(),
      farmIdentification: String(input.farmIdentification || '').trim(),
      pigDocId: String(input.pigDocId || '').trim(),
      pigId: String(input.pigId || '').trim(),
      pigTag: String(input.pigTag || input.pigId || '').trim(),
      predictedDisease,
      diseaseTitle: String(input.diseaseTitle || predictedDisease).trim(),
      confidence: clampConfidence(input.confidence),
      alternatives: normalizeAlternatives(input.alternatives),
      recommendation:
        input.recommendation && typeof input.recommendation === 'object'
          ? input.recommendation
          : null,
      imageUri: input.imageUri ? String(input.imageUri) : '',
      annotatedImageUrl: input.annotatedImageUrl ? String(input.annotatedImageUrl) : '',
      uploadedImageUrl: input.uploadedImageUrl ? String(input.uploadedImageUrl) : '',
      uploadedImagePath: input.uploadedImagePath ? String(input.uploadedImagePath) : '',
      imageSource: String(input.imageSource || '').trim(), // captured | uploaded
      userDisplayName: String(input.userDisplayName || getCurrentUser()?.displayName || '').trim(),
      userEmail: String(input.userEmail || getCurrentUser()?.email || '').trim(),
      notes: String(input.notes || '').trim(),
    },
  };
};

export const saveScreeningRecord = async (input = {}) => {
  const { value, error } = normalizeScreeningInput(input);
  if (error) return fail(error);

  // Upload image securely when enabled and signed in
  let uploadedImageUrl = value.uploadedImageUrl;
  let uploadedImagePath = value.uploadedImagePath;
  if (!uploadedImageUrl && value.imageUri && isImageStorageEnabled && storage && isSignedIn()) {
    const folder = `screenings/${currentUid()}/${value.screeningId}`;
    const uploaded = await uploadImage(value.imageUri, folder);
    if (uploaded.success) {
      uploadedImageUrl = uploaded.url;
      uploadedImagePath = uploaded.path || '';
    }
  }

  const recordBase = {
    ...value,
    uploadedImageUrl: uploadedImageUrl || '',
    uploadedImagePath: uploadedImagePath || '',
  };

  let screeningResult;
  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_SCREENINGS_PREFIX);
    const record = {
      id: `scr-${localNow()}-${Math.random().toString(36).slice(2, 6)}`,
      ...recordBase,
      imageUri: value.imageUri || '', // keep local device URI for on-device history
      createdAt: localNow(),
      updatedAt: localNow(),
      backend: 'local',
    };
    await writeLocalStore(LOCAL_SCREENINGS_PREFIX, [record, ...items]);
    screeningResult = ok({ id: record.id, screening: record, local: true });
  } else {
    try {
      const refDoc = await addDoc(collection(db, 'screenings'), {
        ...recordBase,
        imageUri: '', // do not persist local device URIs to cloud
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      screeningResult = ok({ id: refDoc.id });
    } catch (writeError) {
      console.error('Error saving screening:', writeError);
      return fail(writeError);
    }
  }

  // Automatically update pig health status after screening
  if (value.pigDocId) {
    const nextStatus = getPigHealthStatusFromPrediction(value.predictedDisease);
    await updatePigHealthStatus(value.pigDocId, nextStatus, {
      lastScreeningId: value.screeningId,
      lastScreeningDisease: value.predictedDisease,
      lastScreeningAt: screeningResult?.screening?.createdAt || localNow(),
    });
  }

  // Keep legacy detection history in sync for existing screens
  try {
    await addDetection({
      imageUri: value.imageUri || '',
      label: value.predictedDisease,
      confidence: value.confidence,
      diseaseName: value.diseaseTitle || value.predictedDisease,
      alternatives: value.alternatives,
      recommendation: value.recommendation,
    });
  } catch {
    // non-fatal
  }

  // Best-effort report snapshot for cloud users
  if (canUseCloud()) {
    try {
      await addDoc(collection(db, 'reports'), {
        ownerId: currentUid(),
        type: 'screening',
        screeningId: value.screeningId,
        predictedDisease: value.predictedDisease,
        confidence: value.confidence,
        farmId: value.farmId,
        pigId: value.pigId,
        status: value.screeningStatus,
        createdAt: serverTimestamp(),
      });
    } catch {
      // non-fatal
    }
  }

  return screeningResult;
};

export const getScreenings = async ({ farmId, pigDocId } = {}) => {
  if (!canUseCloud()) {
    let screenings = await readLocalStore(LOCAL_SCREENINGS_PREFIX);
    if (farmId) screenings = screenings.filter((s) => s.farmId === farmId);
    if (pigDocId) screenings = screenings.filter((s) => s.pigDocId === pigDocId);
    return ok({ screenings, local: true });
  }
  try {
    const snapshot = await getDocs(query(collection(db, 'screenings'), where('ownerId', '==', currentUid())));
    let screenings = mapSnapshotDocs(snapshot);
    if (farmId) screenings = screenings.filter((s) => s.farmId === farmId);
    if (pigDocId) screenings = screenings.filter((s) => s.pigDocId === pigDocId);
    return ok({ screenings });
  } catch (error) {
    console.error('Error getting screenings:', error);
    return fail(error);
  }
};

export const subscribeToScreenings = (callback, { farmId, pigDocId } = {}) => {
  const safe = typeof callback === 'function' ? callback : () => {};
  const filter = (items) => items.filter((s) => (!farmId || s.farmId === farmId) && (!pigDocId || s.pigDocId === pigDocId));
  if (!canUseCloud()) return subscribeToLocalStore(LOCAL_SCREENINGS_PREFIX, (items) => safe(filter(items)));
  const q = query(collection(db, 'screenings'), where('ownerId', '==', currentUid()));
  return onSnapshot(q, (snap) => safe(filter(mapSnapshotDocs(snap))), (err) => { console.error(err); safe([]); });
};

export const deleteScreening = async (id) => {
  if (!id) return fail('Screening ID is required.');
  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_SCREENINGS_PREFIX);
    await writeLocalStore(LOCAL_SCREENINGS_PREFIX, items.filter((i) => i.id !== id));
    return ok({ id, local: true });
  }
  try {
    await deleteDoc(doc(db, 'screenings', id));
    return ok({ id });
  } catch (error) {
    console.error('Error deleting screening:', error);
    return fail(error);
  }
};

/* ----------------------------- Reports ------------------------------ */

export const getReports = async () => {
  if (!canUseCloud()) return ok({ reports: await readLocalStore(LOCAL_REPORTS_PREFIX), local: true });
  try {
    const snapshot = await getDocs(query(collection(db, 'reports'), where('ownerId', '==', currentUid())));
    return ok({ reports: mapSnapshotDocs(snapshot) });
  } catch (error) {
    console.error('Error getting reports:', error);
    return fail(error);
  }
};

export const createReport = async (input = {}) => {
  const payload = {
    ownerId: currentUid(),
    type: String(input.type || 'summary'),
    title: String(input.title || 'Report').trim(),
    data: input.data && typeof input.data === 'object' ? input.data : {},
  };
  if (!canUseCloud()) {
    const items = await readLocalStore(LOCAL_REPORTS_PREFIX);
    const record = { id: `report-${localNow()}`, ...payload, createdAt: localNow(), updatedAt: localNow() };
    await writeLocalStore(LOCAL_REPORTS_PREFIX, [record, ...items]);
    return ok({ id: record.id, report: record, local: true });
  }
  try {
    const refDoc = await addDoc(collection(db, 'reports'), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return ok({ id: refDoc.id });
  } catch (error) {
    console.error('Error creating report:', error);
    return fail(error);
  }
};

/* ---------------------------- Analytics ----------------------------- */

export const getScreeningAnalytics = (screenings = [], pigs = []) => {
  const totalScreenings = screenings.length;
  const byDisease = {};
  screenings.forEach((s) => {
    const key = String(s.predictedDisease || s.label || 'Unknown');
    byDisease[key] = (byDisease[key] || 0) + 1;
  });

  const suspectedKeys = new Set(['exudative_epidermitis', 'sarcoptic_mange', 'swine_pox']);
  const suspectedCases = screenings.filter((s) => suspectedKeys.has(normalizeLabelKey(s.predictedDisease || s.label))).length;
  const healthyScreenings = screenings.filter((s) => normalizeLabelKey(s.predictedDisease || s.label) === 'healthy').length;

  const healthyPigs = pigs.filter((p) => normalizeLabelKey(p.healthStatus) === 'healthy').length;
  const suspectedPigs = pigs.filter((p) => {
    const k = normalizeLabelKey(p.healthStatus);
    return k && k !== 'healthy' && k !== 'unknown';
  }).length;

  const trendsMap = {};
  screenings.forEach((s) => {
    const date = new Date(toMillis(s.screeningDate || s.createdAt) || Date.now());
    if (Number.isNaN(date.getTime())) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    trendsMap[key] = (trendsMap[key] || 0) + 1;
  });
  const monthlyTrends = Object.keys(trendsMap)
    .sort()
    .map((month) => ({ month, count: trendsMap[month] }));

  return {
    totalScreenings,
    healthyScreenings,
    suspectedCases,
    healthyPigs,
    suspectedPigs,
    diseaseDistribution: Object.entries(byDisease).map(([label, count]) => ({ label, count })),
    monthlyTrends,
  };
};
