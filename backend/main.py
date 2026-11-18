"""
DermaSwine AI inference service.

Deploy this FastAPI app with a trained YOLOv8 model at MODEL_PATH
(default: backend/models/best.pt). The model can be either a classification
export (YOLOv8-cls) or a detection export (YOLOv8 detect); both are handled.

Endpoint:
    POST /predict   multipart field `file` -> ranked class probabilities
    GET  /health    -> {"status": "ok", "model_loaded": true}

The response uses the app's class ids:
    healthy, exudative_epidermitis, sarcoptic_mange, swine_pox
"""

import io
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

MODEL_PATH = os.getenv(
    "MODEL_PATH",
    str(Path(__file__).parent / "models" / "best.pt"),
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

CLASS_IDS = {
    "healthy": "healthy",
    "healthy_skin": "healthy",
    "exudative_epidermitis": "exudative_epidermitis",
    "greasy_pig_disease": "exudative_epidermitis",
    "sarcoptic_mange": "sarcoptic_mange",
    "scabies": "sarcoptic_mange",
    "swine_pox": "swine_pox",
}

model = None
model_error = None


def load_model():
    global model, model_error
    try:
        from ultralytics import YOLO

        if not os.path.isfile(MODEL_PATH):
            model_error = f"No model file found at {MODEL_PATH}."
            return
        model = YOLO(MODEL_PATH)
    except Exception as exc:  # pragma: no cover - startup diagnostics
        model_error = str(exc)
        model = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()
    yield


app = FastAPI(title="DermaSwine AI Inference API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def normalize_label(raw_label: str):
    key = re.sub(r"[\s-]+", "_", str(raw_label or "").strip().lower())
    if key in CLASS_IDS:
        return CLASS_IDS[key]
    if "healthy" in key:
        return "healthy"
    if "exudative" in key or "greasy" in key:
        return "exudative_epidermitis"
    if "mange" in key or "scabies" in key:
        return "sarcoptic_mange"
    if "pox" in key:
        return "swine_pox"
    return None


def class_name(names, index: int) -> str:
    if isinstance(names, dict):
        return str(names.get(index, index))
    try:
        return str(names[index])
    except (IndexError, TypeError):
        return str(index)


def rank_from_probs(result):
    """YOLOv8 classification output."""
    probs = result.probs
    if probs is None:
        return []
    data = probs.data.tolist()
    ranked = sorted(enumerate(data), key=lambda item: item[1], reverse=True)
    output = []
    for index, score in ranked[:4]:
        label = normalize_label(class_name(result.names, index))
        if label:
            output.append({"label": label, "confidence": round(float(score), 4)})
    # Keep one row per app class, highest score first.
    deduped = {}
    for item in output:
        deduped.setdefault(item["label"], item)
    return list(deduped.values())


def rank_from_boxes(result, width, height):
    """YOLOv8 detection output."""
    boxes = result.boxes
    if boxes is None or len(boxes) == 0:
        return []
    best = {}
    for box in boxes:
        label = normalize_label(class_name(result.names, int(box.cls[0])))
        if not label:
            continue
        confidence = float(box.conf[0])
        x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
        entry = {
            "label": label,
            "confidence": round(confidence, 4),
            "box": {
                "x1": round(x1 / width, 4),
                "y1": round(y1 / height, 4),
                "x2": round(x2 / width, 4),
                "y2": round(y2 / height, 4),
            },
        }
        if label not in best or confidence > best[label]["confidence"]:
            best[label] = entry
    return sorted(best.values(), key=lambda item: item["confidence"], reverse=True)


@app.get("/health")
async def health():
    return {
        "status": "ok" if model is not None else "degraded",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
        "detail": model_error,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=model_error or "The model is not loaded on this server.",
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type.")

    image_data = await file.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="Empty image.")
    if len(image_data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image is larger than 10 MB.")

    try:
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the image file.")

    try:
        results = model(image, verbose=False)
        result = results[0]
        ranked = rank_from_probs(result)
        if not ranked:
            ranked = rank_from_boxes(result, image.width, image.height)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    if not ranked:
        raise HTTPException(
            status_code=422,
            detail="No skin condition could be identified. Fill the frame and retake the photo.",
        )

    top = ranked[0]
    return {
        "status": "ok",
        "image_width": image.width,
        "image_height": image.height,
        "top_label": top["label"],
        "top_confidence": top["confidence"],
        "detections": ranked,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
