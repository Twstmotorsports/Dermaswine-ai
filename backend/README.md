# DermaSwine AI inference service

FastAPI wrapper around the trained YOLOv8 model. The mobile app uses the
Hugging Face Gradio Space by default; this backend is an optional self-hosted
alternative. Set `EXPO_PUBLIC_INFERENCE_URL` to use it instead.

The mobile/web app calls:

```http
POST {EXPO_PUBLIC_INFERENCE_URL}
Content-Type: multipart/form-data

file=@skin.jpg
```

Response:

```json
{
  "status": "ok",
  "top_label": "sarcoptic_mange",
  "top_confidence": 0.91,
  "detections": [
    { "label": "sarcoptic_mange", "confidence": 0.91 },
    { "label": "swine_pox", "confidence": 0.04 }
  ]
}
```

## Add the model

Put the trained weights in `backend/models/best.pt`:

```bash
cd backend
mkdir -p models
copy best.pt models\best.pt
```

The service supports both YOLOv8 classification (`yolo classify`) and
YOLOv8 detection (`yolo detect`) exports.

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open <http://localhost:8000/health> to confirm `model_loaded: true`.

## Deploy

The included `Dockerfile` works on Render, Railway, Fly.io, Google Cloud Run,
or any container host:

```bash
docker build -t dermaswine-inference ./backend
docker run -p 8000:8000 -v "%cd%/backend/models:/app/models" dermaswine-inference
```

Set `MODEL_PATH` if the weights live somewhere else, and `ALLOWED_ORIGINS`
to your web app origin in production (comma-separated).

## Connect the app

In the project root `.env`:

```env
EXPO_PUBLIC_INFERENCE_URL=https://your-service.example.com/predict
```

Restart Expo with `npx expo start -c`. The app will now use real model
inference; remove the URL to fall back to the labelled placeholder classifier.
