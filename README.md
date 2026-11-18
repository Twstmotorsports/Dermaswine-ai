# DermaSwine AI

Mobile screening app for swine skin diseases, built with **Expo / React Native** and a **YOLOv8** computer-vision model. DermaSwine AI classifies an image of swine skin as **Healthy**, **Exudative Epidermitis**, **Sarcoptic Mange**, or **Swine Pox**, then returns a confidence score, alternative possibilities, and disease-specific treatment, management, and biosecurity guidance.

> DermaSwine AI is a screening aid. It does not replace a licensed veterinarian.

## Features

- **Landing / Home tab** - hero section, call-to-action buttons, key benefits, how-it-works preview, featured skin conditions, recent scans, and footer.
- **Mobile navbar** - Home, Detection, Diseases, How It Works, Contact, plus **Detection History** and **Login / Register** in the top header.
- **Consent gate** - explicit consent is required before the live camera opens or an uploaded image is analyzed.
- **Two screening modes** - an automatic live-camera scan or a gallery photo upload. The camera captures a frame every few seconds, analyzes it, and updates the result without a shutter press.
- **Explainable result** - top detected condition, confidence score, alternative possibilities, and the detector's annotated image when available.
- **Disease information** - overview, treatment, management, and biosecurity guidance for every screened class.
- **Firebase** - Email/Password authentication, optional Firestore detection sync, Storage image uploads when enabled, and a contact form.
- **Persistent sessions** - Firebase auth is stored in AsyncStorage on Android/iOS and localStorage on web.
- **Detection History screen** - every saved scan keeps its classification, confidence, alternatives, annotated image when available, and the treatment, management, and biosecurity guidance shown at the time.
- **Real-time history** - Home updates immediately from on-device storage, with optional Firestore sync when `EXPO_PUBLIC_HISTORY_BACKEND=firestore`.
- **Deployment-ready config** - Firebase security rules, a Dockerized FastAPI inference service, EAS build profiles, web hosting config, Android package and iOS bundle identifier.

## Tech stack

- Expo SDK 58 / React Native 0.88
- Expo Router (file-based routing in `src/app`)
- Firebase JS SDK v13 (Auth, Firestore, Storage)
- YOLOv8 object detection via the Hugging Face Gradio Space (default), a hosted FastAPI service, or the ONNX Runtime React Native adapter in `src/services/YOLOService.js`

## Brand palette

| Token | Color |
| --- | --- |
| Primary | `#166534` |
| Accent | `#22C55E` |
| Soft / mint | `#DCFCE7` |
| Background | `#F8FAF7` |

Design tokens live in `src/theme.js`.

## Run locally

```bash
npm install
npx expo start -c
```

This workspace already includes a filled `.env` for the `derma-ai-5c558`
Firebase project. Make sure Email/Password auth, Firestore, and Storage are
enabled for that project before testing accounts, history, and image uploads.
The `.env` file is git-ignored. Firebase credentials are required; the app does
not run in a demo or offline mode.

Scan the QR code with Expo Go.

```bash
npm run web                 # browser preview
npm run typecheck
npm run lint
```

## Firebase setup

1. Create a Firebase project and add a Web app.
2. Enable **Authentication > Sign-in method > Email/Password**.
3. Create a **Firestore** database.
4. Create a **Storage** bucket (`Storage > Get started`) and copy its exact
   bucket name into `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`. Storage requires the
   Blaze plan (the Always Free tier is available in US regions). Image uploads
   are disabled by default; after creating the bucket, set
   `EXPO_PUBLIC_ENABLE_IMAGE_STORAGE=true` in `.env` and in the EAS build env.
   Without it, detection history saves as text-only records.
5. Set the `EXPO_PUBLIC_FIREBASE_*` values in `.env` from **Project settings >
   General > Your apps > SDK setup and configuration**: API key, auth domain,
   project ID, storage bucket, messaging sender ID, and app ID.

6. Deploy the included security rules:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,storage
```

If Storage is not enabled yet, deploy only `--only firestore:rules` now and run
`npx firebase-tools deploy --only storage` after creating the bucket.

The included `.firebaserc` already points the Firebase CLI at
`derma-ai-5c558`, so `npx firebase-tools use derma-ai-5c558` is optional.

Rules:

- `firestore.rules` - users can read/delete only their own `detections`; contact `messages` can be created but not read from the client.
- `storage.rules` - users can read/write only `detections/{uid}/...` and `users/{uid}/...`, with image and size limits.

Detection history is stored on the device with AsyncStorage by default, so the
app works before the Firestore rules are deployed. To sync history across
devices, deploy the rules above, then set
`EXPO_PUBLIC_HISTORY_BACKEND=firestore` in `.env` and the EAS build environment.

The app never requires a login to screen an image. With the default local
history backend, saved results stay on the device and also work for guests.
With `EXPO_PUBLIC_HISTORY_BACKEND=firestore`, sign in is required so Firestore
security rules can enforce ownership. Images are only uploaded when Firebase
Storage is enabled. Contact messages require the Firestore rules above.

## Hugging Face Space inference

The camera and photo-upload flows call the Gradio Space at
`https://huggingface.co/spaces/johnnysins123/DdermaAI` by default. The app
normalizes that page URL to `https://johnnysins123-ddermaai.hf.space` for
the Gradio API calls. It runs the YOLOv8 object detector and returns an
annotated image, the detected classes, and confidence values. The live camera
auto-captures a frame about every three seconds, sends it to the same endpoint,
and pauses while a request is in flight. Use **Pause** on the camera screen to
stop automatic scanning.

Configure it in `.env`:

```env
EXPO_PUBLIC_HF_SPACE_URL=https://huggingface.co/spaces/johnnysins123/DdermaAI
EXPO_PUBLIC_HF_THRESHOLD=0.5
```

- `EXPO_PUBLIC_HF_THRESHOLD` is the minimum confidence. Raise it to reduce
  false positives; lower it to surface more low-confidence detections.
- `EXPO_PUBLIC_INFERENCE_URL` overrides the Space when set.
- The public Space may sleep. The first request after idleness can take
  up to about two minutes; the app allows three minutes before timing out.
- The annotated image is displayed on the Results screen when available.
- Native camera/gallery uploads use `XMLHttpRequest` in
  `src/services/YOLOService.js`. Expo SDK 58 installs `expo/fetch` as the
  global fetch, and that implementation rejects React Native file parts
  (`{ uri, name, type }`) with `Unsupported FormDataPart implementation`.

The same values are already set in the EAS development, preview, and
production profiles in `eas.json`.

## Connect your own YOLOv8 model

The UI, consent flow, optional Storage upload, local/Firestore history,
confidence display, and recommendations are complete. The default inference
path is the Hugging Face Space above. To use your own copy, choose one of the
options below.

### Option A - self-hosted model

The `backend/` folder contains a Dockerized FastAPI service that accepts a multipart image upload and returns the top prediction plus ranked alternatives. It works with Expo Go, the browser build, and store builds.

1. Put the trained weights at `backend/models/best.pt`.
2. Run locally or deploy the container (see `backend/README.md`).
3. Add the endpoint to `.env`:

   ```env
   EXPO_PUBLIC_INFERENCE_URL=https://your-service.example.com/predict
   ```

4. Restart Expo with `npx expo start -c`.

If neither the Space nor `EXPO_PUBLIC_INFERENCE_URL` is configured, `detect()` throws a configuration error. There is no mock or placeholder classifier.

### Option B - on-device ONNX

1. Train YOLOv8 on four classes:

   ```text
   healthy
   exudative_epidermitis
   sarcoptic_mange
   swine_pox
   ```

2. Export the model:

   ```bash
   yolo export model=best.pt format=onnx imgsz=640
   ```

3. Put the exported file at `assets/models/best.onnx`.

4. Install the native inference and preprocessing packages:

   ```bash
   npx expo install onnxruntime-react-native expo-image-manipulator expo-asset
   npm install jpeg-js
   ```

5. Open `src/services/YOLOService.js`, uncomment the **REAL INFERENCE** blocks, and implement `decodeJpegToCHW` plus `parseYoloOutput` for your export format (`[1, num_classes]` for YOLOv8-cls, or `[1, 4 + num_classes, anchors]` for YOLOv8 detect).

6. Rebuild the app. `onnxruntime-react-native` contains native code, so it **does not run in Expo Go**:

   ```bash
   npx expo run:android
   # or
   npx eas-cli@latest build --profile development
   ```

The service returns:

```js
{
  label: 'sarcoptic_mange',
  confidence: 0.91,
  bbox: [...],
  alternatives: [
    { label: 'exudative_epidermitis', confidence: 0.31 },
    { label: 'swine_pox', confidence: 0.12 }
  ]
}
```

## Deployment with EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # links the project and writes extra.eas.projectId
npx eas-cli@latest build --profile preview      # internal APK
npx eas-cli@latest build --profile production   # store-ready build
npx eas-cli@latest submit --profile production
```

`eas.json` includes:

- `preview` - internal distribution, Android APK.
- `production` - Android App Bundle with automatic version increment.

Before the first store submission:

- Review the generated brand artwork (`assets/icon.png`, `assets/splash-icon.png`, and the adaptive icon files) and adjust if needed.
- Confirm the Android package (`com.dermaswine.ai`) and iOS bundle identifier (`com.dermaswine.ai`) or change them in `app.json`.
- Update `CONTACT_EMAIL` in `src/app/(tabs)/contact.js` to your real support address.
- Add the Firebase environment variables to the EAS build environment (or use EAS secrets) so production builds connect to Firebase.

## Web deployment

Expo Router is configured for a static web export (`web.output: "static"`), so the same app can be hosted as a PWA-style site.

```bash
npm run export:web                  # writes dist/
npx firebase-tools deploy --only hosting
# or
npm run deploy:web                  # export + Firebase Hosting
```

`firebase.json` serves `dist/` with SPA rewrites. Point Vercel, Netlify, or
Cloudflare Pages at `dist/` if you prefer another host. Camera access on the
web requires HTTPS (localhost is exempt).

## Validation

```bash
npm run lint
npm run typecheck
npx expo-doctor
npm run export:android
npm run export:web
```

## Project structure

```text
backend/
  main.py                    FastAPI YOLOv8 inference service
  requirements.txt
  Dockerfile
  README.md                  Model placement + deployment guide
src/
  app/
    _layout.tsx              Root stack (tabs, auth, camera, results, disease detail)
    (tabs)/
      _layout.js             Bottom navbar + brand header
      index.js               Home / landing page
      detect.js              Consent, upload, live-camera entry, analysis
      diseases.js            Disease information list
      how-it-works.js        Pipeline and model explanation
      contact.js             Contact form (Firestore)
    Auth/index.js            Login / register
    Camera/index.js          Live camera screening
    Results/index.js         Prediction, confidence, alternatives, guidance
    disease/[id].js          Disease detail
  components/
    AppHeader.js             Brand + live camera + Login/Register header
    Logo.js                  DermaSwine AI mark
  services/
    FirebaseService.js       Auth, local/Firestore history, Storage, messages
    authPersistence.js       Native AsyncStorage session persistence
    authPersistence.web.js   Browser localStorage session persistence
    YOLOService.js           Hosted/on-device classifier adapter + knowledge base
    consent.js               Session consent gate
  theme.js                   Colors, spacing, radius, shadows
```

## Disclaimer

DermaSwine AI provides AI-assisted preliminary classifications only. Always confirm findings with a licensed veterinarian before applying treatment or changing farm biosecurity protocols.
