/**
 * YOLOv8 inference service for DermaSwine AI.
 *
 * Default path: the Hugging Face Gradio Space configured with
 * EXPO_PUBLIC_HF_SPACE_URL. The Space exposes /detect, which accepts an image
 * and a confidence threshold and returns an annotated image, a verdict, and
 * per-class confidence lines.
 *
 * Optional paths:
 *   - Hosted FastAPI backend via EXPO_PUBLIC_INFERENCE_URL (takes precedence).
 *   - On-device ONNX Runtime adapter (see the commented block in detect()).
 *
 * The model is trained with 4 classes:
 *   healthy, exudative_epidermitis, sarcoptic_mange, swine_pox
 *
 * There is no local mock/placeholder classifier. If no inference service is
 * configured, `detect()` throws a configuration error.
 */

import { Platform } from 'react-native';

export const CLASS_NAMES = [
  'healthy',
  'exudative_epidermitis',
  'sarcoptic_mange',
  'swine_pox',
];

/**
 * Optional self-hosted FastAPI service exposing POST /predict. When set, it
 * takes precedence over the Hugging Face Space.
 */
const INFERENCE_URL = (process.env.EXPO_PUBLIC_INFERENCE_URL || '').trim();

/**
 * Hugging Face Gradio Space used for object detection by default. Accepts
 * either the Space page URL or its direct *.hf.space URL.
 */
const normalizeSpaceUrl = (value) => {
  const raw = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!raw) return 'https://johnnysins123-ddermaai.hf.space';
  const pageMatch = raw.match(/huggingface\.co\/spaces\/([^/]+)\/([^/?#]+)/i);
  if (pageMatch) {
    return `https://${pageMatch[1].toLowerCase()}-${pageMatch[2].toLowerCase()}.hf.space`;
  }
  return raw;
};

const HF_SPACE_URL = normalizeSpaceUrl(process.env.EXPO_PUBLIC_HF_SPACE_URL);
const thresholdValue = Number(process.env.EXPO_PUBLIC_HF_THRESHOLD);
const HF_THRESHOLD =
  Number.isFinite(thresholdValue) && thresholdValue > 0
    ? Math.min(0.95, Math.max(0.2, thresholdValue))
    : 0.5;

export const isRemoteInferenceEnabled = Boolean(INFERENCE_URL || HF_SPACE_URL);
export const isHuggingFaceInferenceEnabled = Boolean(HF_SPACE_URL);

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export const normalizeClassLabel = (value) => {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (CLASS_NAMES.includes(key)) return key;
  if (key.includes('healthy')) return 'healthy';
  if (key.includes('exudative') || key.includes('greasy')) {
    return 'exudative_epidermitis';
  }
  if (key.includes('mange') || key.includes('scabies')) return 'sarcoptic_mange';
  if (key.includes('pox')) return 'swine_pox';
  return null;
};

const fileMeta = (uri) => {
  const extension = (String(uri).split('?')[0].split('.').pop() || '').toLowerCase();
  if (['png', 'webp', 'heic'].includes(extension)) {
    return { extension, type: `image/${extension === 'heic' ? 'heic' : extension}` };
  }
  return { extension: 'jpg', type: 'image/jpeg' };
};

const appendImage = async (formData, uri, fieldName = 'file') => {
  const { extension, type } = fileMeta(uri);
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, `skin.${extension}`);
    return;
  }
  formData.append(fieldName, {
    uri,
    name: `skin.${extension}`,
    type,
  });
};

/**
 * Send multipart form data.
 *
 * Expo SDK 58 installs `expo/fetch` as the global fetch. That implementation
 * only accepts Blob/File parts, not React Native's `{ uri, name, type }`
 * file parts, so native uploads go through XMLHttpRequest instead. Web keeps
 * using fetch because the image is appended as a Blob there.
 */
const postMultipart = async (url, formData, signal) => {
  if (Platform.OS === 'web') {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    };
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        // The request may already be closed.
      }
    };

    xhr.open('POST', url);
    xhr.timeout = 180000;
    xhr.onload = () => {
      finish(resolve, {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body: xhr.responseText,
      });
    };
    xhr.onerror = () => {
      finish(reject, new Error('Network request failed. Check your connection.'));
    };
    xhr.ontimeout = () => {
      finish(reject, Object.assign(new Error('Request timed out.'), { name: 'AbortError' }));
    };
    xhr.onabort = () => {
      finish(reject, Object.assign(new Error('Request aborted.'), { name: 'AbortError' }));
    };

    if (signal) {
      if (signal.aborted) {
        finish(reject, Object.assign(new Error('Request aborted.'), { name: 'AbortError' }));
        return;
      }
      signal.addEventListener('abort', onAbort);
    }

    try {
      xhr.send(formData);
    } catch {
      finish(reject, new Error('Could not start the upload.'));
    }
  });
};

const parseSseEvents = (text) => {
  const events = [];
  const blocks = String(text || '').split(/\r?\n\r?\n/);

  blocks.forEach((block) => {
    let event = 'message';
    const dataLines = [];

    block.split(/\r?\n/).forEach((line) => {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    });

    if (dataLines.length) {
      events.push({ event, data: dataLines.join('\n') });
    }
  });

  return events;
};

const parseGradioDetections = (details, verdict) => {
  const byLabel = new Map();

  const add = (rawLabel, rawConfidence) => {
    const label = normalizeClassLabel(rawLabel);
    const confidence = clamp01(rawConfidence);
    if (!label || confidence <= 0) return;
    const existing = byLabel.get(label);
    if (!existing || confidence > existing.confidence) {
      byLabel.set(label, { label, confidence });
    }
  };

  String(details || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^\s*([^:]+?)\s*:\s*([0-9]*\.?[0-9]+)\s*$/);
      if (match) add(match[1], Number(match[2]));
    });

  // Fallback for a response that only includes the markdown verdict.
  if (byLabel.size === 0) {
    const topMatch = String(verdict || '').match(
      /Result:\s*([^(\n]+?)\s*\((\d+(?:\.\d+)?)%\)/i
    );
    if (topMatch) add(topMatch[1], Number(topMatch[2]) / 100);
  }

  return [...byLabel.values()].sort((a, b) => b.confidence - a.confidence);
};

const getAnnotatedImageUrl = (file) => {
  if (!file) return null;
  if (typeof file === 'string') return file.startsWith('http') ? file : null;
  if (file.url) {
    if (file.url.startsWith('http') || file.url.startsWith('data:')) {
      return file.url;
    }
    return `${HF_SPACE_URL}/${String(file.url).replace(/^\/+/, '')}`;
  }
  if (file.path) {
    const path = String(file.path);
    return `${HF_SPACE_URL}/gradio_api/file=${path.startsWith('/') ? path : `/${path}`}`;
  }
  return null;
};

const callHuggingFaceSpace = async (imageUri) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    // 1. Upload the local image to the Space and get its temporary path.
    const uploadForm = new FormData();
    await appendImage(uploadForm, imageUri, 'files');
    const uploadResponse = await postMultipart(
      `${HF_SPACE_URL}/gradio_api/upload`,
      uploadForm,
      controller.signal
    );

    if (!uploadResponse.ok) {
      const detail = uploadResponse.body || '';
      throw new Error(
        `The AI service could not accept the image (${uploadResponse.status})${
          detail ? `: ${detail.slice(0, 140)}` : ''
        }`
      );
    }

    let uploadPayload;
    try {
      uploadPayload = JSON.parse(uploadResponse.body);
    } catch {
      throw new Error('The AI service returned an unreadable upload response.');
    }
    const uploadedPath = Array.isArray(uploadPayload)
      ? uploadPayload[0]
      : uploadPayload?.files?.[0] || uploadPayload?.path;

    if (!uploadedPath) {
      throw new Error('The AI service did not return an uploaded image path.');
    }

    // 2. Start the /detect job.
    const startResponse = await fetch(
      `${HF_SPACE_URL}/gradio_api/call/v2/detect`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: {
            path: uploadedPath,
            meta: { _type: 'gradio.FileData' },
          },
          threshold: HF_THRESHOLD,
        }),
        signal: controller.signal,
      }
    );

    if (!startResponse.ok) {
      const detail = await startResponse.text().catch(() => '');
      throw new Error(
        `The AI service could not start detection (${startResponse.status})${
          detail ? `: ${detail.slice(0, 140)}` : ''
        }`
      );
    }

    const startPayload = await startResponse.json();
    const eventId = startPayload?.event_id;
    if (!eventId) {
      throw new Error('The AI service did not return a detection job id.');
    }

    // 3. Read the result event stream.
    const streamResponse = await fetch(
      `${HF_SPACE_URL}/gradio_api/call/detect/${eventId}`,
      { signal: controller.signal }
    );

    if (!streamResponse.ok) {
      const detail = await streamResponse.text().catch(() => '');
      throw new Error(
        `The AI service returned ${streamResponse.status}${
          detail ? `: ${detail.slice(0, 140)}` : ''
        }`
      );
    }

    const events = parseSseEvents(await streamResponse.text());
    const errorEvent = events.find((event) => event.event === 'error');
    if (errorEvent) {
      let detail = errorEvent.data;
      try {
        detail = JSON.parse(detail);
      } catch {
        // Keep the raw error text.
      }
      throw new Error(
        `The AI service returned an error${
          detail ? `: ${String(detail).slice(0, 160)}` : ''
        }`
      );
    }

    const completeEvent = events.find((event) => event.event === 'complete');
    if (!completeEvent) {
      throw new Error('The AI service did not return a detection result.');
    }

    let payload;
    try {
      payload = JSON.parse(completeEvent.data);
    } catch {
      throw new Error('The AI service returned an unreadable detection result.');
    }

    if (!Array.isArray(payload)) {
      throw new Error('The AI service returned an unexpected detection result.');
    }

    const annotatedImage = payload[0];
    const verdict = typeof payload[1] === 'string' ? payload[1] : '';
    const details = typeof payload[2] === 'string' ? payload[2] : '';
    const ranked = parseGradioDetections(details, verdict);

    if (!ranked.length) {
      const closest = verdict.match(
        /Closest guess[^:]*:\s*([^\n(]+?)\s*\((\d+)%\)/i
      );
      const hint = closest
        ? ` The closest low-confidence guess was ${closest[1].trim()} (${closest[2]}%), but it is not reliable.`
        : '';
      throw new Error(
        `The model could not confidently identify a skin condition.${hint} Fill the frame with the affected skin in good light and try again.`
      );
    }

    const top = ranked[0];
    return {
      label: top.label,
      confidence: top.confidence,
      bbox: [0.18, 0.22, 0.82, 0.78],
      alternatives: ranked.slice(1, 3),
      annotatedImageUrl: getAnnotatedImageUrl(annotatedImage),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'The AI service timed out. Check your connection and try again.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const callFastApiInference = async (imageUri) => {
  const formData = new FormData();
  await appendImage(formData, imageUri);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await postMultipart(
      INFERENCE_URL,
      formData,
      controller.signal
    );

    if (!response.ok) {
      const detail = response.body || '';
      throw new Error(
        `The inference service returned ${response.status}${
          detail ? `: ${detail.slice(0, 140)}` : ''
        }`
      );
    }

    let payload;
    try {
      payload = JSON.parse(response.body);
    } catch {
      throw new Error('The inference service returned an unreadable response.');
    }
    const ranked = (Array.isArray(payload.detections) ? payload.detections : [])
      .map((detection) => ({
        label: normalizeClassLabel(detection.label),
        confidence: clamp01(detection.confidence),
        box: detection.box,
      }))
      .filter((detection) => detection.label)
      .sort((a, b) => b.confidence - a.confidence);

    const fallbackTop = {
      label: normalizeClassLabel(payload.top_label),
      confidence: clamp01(payload.top_confidence),
      box: null,
    };
    const top = ranked[0] || fallbackTop;

    if (!top.label) {
      throw new Error(
        'The model could not identify a skin condition. Fill the frame with the affected area and try again.'
      );
    }

    return {
      label: top.label,
      confidence: top.confidence,
      bbox: top.box
        ? [top.box.x1, top.box.y1, top.box.x2, top.box.y2]
        : [0.18, 0.22, 0.82, 0.78],
      alternatives: ranked
        .filter((detection) => detection.label !== top.label)
        .slice(0, 2)
        .map((detection) => ({
          label: detection.label,
          confidence: detection.confidence,
        })),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The inference service timed out. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// const INPUT_SIZE = 640;
// let ort = null;
// let session = null;

export const initYOLOv8 = async () => {
  // REAL INFERENCE (uncomment after adding onnxruntime-react-native):
  //
  // if (session) return session;
  // ort = require('onnxruntime-react-native');
  // const { Asset } = require('expo-asset');
  // const asset = Asset.fromModule(require('../../assets/models/best.onnx'));
  // await asset.downloadAsync();
  // session = await ort.InferenceSession.create(asset.localUri, {
  //   executionProviders: ['cpu'],
  // });
  // return session;
  return null;
};

/**
 * Run detection on an image.
 *
 * @param {string} imageUri local file uri from the camera or gallery
 * @returns {Promise<{
 *   label: string,
 *   confidence: number,
 *   bbox: number[],
 *   alternatives: Array<{label: string, confidence: number}>,
 *   annotatedImageUrl: string | null
 * }>}
 */
export const detect = async (imageUri) => {
  // Self-hosted FastAPI service, when configured, takes precedence.
  if (INFERENCE_URL) {
    return callFastApiInference(imageUri);
  }

  // Default production path: Hugging Face Gradio Space object detection.
  if (HF_SPACE_URL) {
    return callHuggingFaceSpace(imageUri);
  }

  // ON-DEVICE INFERENCE (uncomment after adding the trained model and a
  // custom development build):
  //
  // const { ImageManipulator, SaveFormat } = require('expo-image-manipulator');
  // const context = ImageManipulator.manipulate(imageUri, {
  //   maxWidth: INPUT_SIZE,
  //   maxHeight: INPUT_SIZE,
  // });
  // context.resize({ width: INPUT_SIZE, height: INPUT_SIZE });
  // const rendered = await context.renderAsync();
  // const { base64 } = await rendered.saveAsync({
  //   format: SaveFormat.JPEG,
  //   base64: true,
  //   compress: 0.9,
  // });
  // const pixels = decodeJpegToCHW(base64); // jpeg-js decode + ImageNet normalize
  // const tensor = new ort.Tensor('float32', pixels, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  // const outputs = await session.run({ images: tensor });
  // return parseYoloOutput(outputs); // top-k softmax + class probabilities
  //
  // parseYoloOutput maps the output tensor to per-class probabilities. For a
  // YOLOv8-cls export the output is [1, num_classes]; for a YOLOv8 detect
  // export it is [1, 4 + num_classes, anchors] and boxes need NMS. Either way,
  // return the highest-scoring class plus the next two as alternatives.
  // Add `jpeg-js` and `expo-image-manipulator` with `npx expo install`.

  throw new Error(
    'No inference service is configured. Set EXPO_PUBLIC_HF_SPACE_URL or EXPO_PUBLIC_INFERENCE_URL.'
  );
};

/* ------------------------------------------------------------------ */
/* Disease knowledge base                                              */
/* ------------------------------------------------------------------ */

export const DISEASE_INFO = {
  healthy: {
    id: 'healthy',
    title: 'Healthy Skin',
    shortName: 'Healthy',
    severity: 'none',
    summary:
      'No signs of the screened skin diseases were detected. Continue routine monitoring and farm biosecurity.',
    treatment: 'No treatment required.',
    management:
      'Maintain clean, dry pens, adequate ventilation, and routine skin checks at every growth stage.',
    biosecurity:
      'Keep visitor and vehicle protocols, disinfect shared equipment, and quarantine new stock for 14-21 days.',
  },
  exudative_epidermitis: {
    id: 'exudative_epidermitis',
    title: 'Exudative Epidermitis',
    shortName: 'Greasy Pig Disease',
    severity: 'high',
    summary:
      'Bacterial skin infection caused by Staphylococcus hyicus, most common in weaned piglets. Presents as greasy exudate, crusting, and dark lesions.',
    treatment:
      'Antibiotic therapy prescribed by a veterinarian (e.g. penicillin or tetracycline), topical antiseptics, and supportive fluids for severe cases.',
    management:
      'Reduce stress at weaning, avoid mixing litters, control humidity, disinfect pens, and correct nutritional deficiencies such as zinc.',
    biosecurity:
      'Isolate affected pigs, disinfect equipment between pens, restrict visitor access, and screen incoming piglets before introduction.',
  },
  sarcoptic_mange: {
    id: 'sarcoptic_mange',
    title: 'Sarcoptic Mange',
    shortName: 'Scabies',
    severity: 'high',
    summary:
      'Highly contagious parasitic skin disease caused by Sarcoptes scabiei mites. Causes intense itching, redness, thickened skin, and crusts around the ears and flanks.',
    treatment:
      'Ivermectin or moxidectin under veterinary supervision, repeated per label interval; treat all in-contact animals, not only affected ones.',
    management:
      'Treat the whole herd, clean and disinfect housing, replace bedding, and re-check sentinel animals after treatment.',
    biosecurity:
      'Quarantine and treat incoming animals, avoid sharing equipment with untested farms, and maintain rodent and wildlife control.',
  },
  swine_pox: {
    id: 'swine_pox',
    title: 'Swine Pox',
    shortName: 'Swine Pox',
    severity: 'medium',
    summary:
      'Viral skin disease producing vesicles, papules, and scabs, usually mild but economically important in young pigs. Spreads by contact and biting arthropods.',
    treatment:
      'No specific antiviral treatment. Provide supportive care and treat secondary bacterial infections under veterinary advice.',
    management:
      'Isolate affected pigs, keep bedding clean and dry, reduce mixing, and support recovery with adequate nutrition and water.',
    biosecurity:
      'Control lice, flies, and rodents, quarantine new animals, disinfect premises, and consider vaccination where endemic.',
  },
};

export const getRecommendations = (disease) => {
  const key = String(disease || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const info = DISEASE_INFO[key];
  if (!info) {
    return {
      id: 'unknown',
      title: 'Unrecognized Result',
      shortName: 'Unknown',
      severity: 'unknown',
      summary: 'The image could not be matched to a known class.',
      treatment: 'Consult a veterinarian for an in-person diagnosis.',
      management: 'Apply general hygiene and monitoring.',
      biosecurity: 'Maintain standard farm biosecurity protocols.',
    };
  }
  return info;
};

export const FEATURED_CONDITIONS = Object.values(DISEASE_INFO);

/**
 * Compact snapshot stored with a detection so the History screen can show the
 * guidance that belonged to that result even if the knowledge base changes.
 */
export const getRecommendationSnapshot = (disease) => {
  const info = getRecommendations(disease);
  return {
    summary: info.summary,
    treatment: info.treatment,
    management: info.management,
    biosecurity: info.biosecurity,
  };
};

export default {
  CLASS_NAMES,
  DISEASE_INFO,
  FEATURED_CONDITIONS,
  detect,
  getRecommendations,
  getRecommendationSnapshot,
  initYOLOv8,
  isHuggingFaceInferenceEnabled,
  isRemoteInferenceEnabled,
  normalizeClassLabel,
};
