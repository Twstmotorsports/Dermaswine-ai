/**
 * Native Firebase Auth setup.
 *
 * React Native has no localStorage, so the session is persisted with
 * AsyncStorage. Metro picks `authPersistence.web.js` for web builds.
 */
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

export const createAuth = (app) => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    // Fast Refresh can re-run this module after Auth is already initialized.
    return getAuth(app);
  }
};

export default createAuth;
