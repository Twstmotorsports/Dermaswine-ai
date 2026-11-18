import os
import sys
import time

import numpy as np
import gradio as gr
from ultralytics import YOLO

MODEL_PATH = "best.pt"  # must be in the same folder as this file

# The 4 classes the model was trained on
EXPECTED_CLASSES = ["Exudative Epidermitis", "Healthy", "Sarcoptic Mange", "Swine Pox"]

DEFAULT_THRESHOLD = 0.50  # a detection below this confidence is NOT accepted -> "Unspecified"
LOW_CONF = 0.10           # used only to show a "closest guess" when nothing is accepted
UNSPECIFIED = "Unspecified"

model = None
load_error = None


def _norm(text):
    return "".join(ch for ch in str(text).lower() if ch.isalnum())


def _pretty(name):
    return str(name).replace("_", " ").strip()


def load_model():
    """Load the model once. Never raises, so the app can always start."""
    global model, load_error
    if not os.path.exists(MODEL_PATH):
        load_error = f"{MODEL_PATH} not found. Upload it to the Files tab of this Space."
        return
    try:
        model = YOLO(MODEL_PATH)
        load_error = None
    except Exception as e:  # noqa: BLE001
        model = None
        load_error = f"Could not load {MODEL_PATH}: {e}"


def _extract(result):
    """Return [(class_name, confidence), ...] sorted by confidence (works for box and OBB models)."""
    boxes = result.obb if getattr(result, "obb", None) is not None else result.boxes
    items = []
    if boxes is not None and len(boxes) > 0:
        for cls_id, score in zip(boxes.cls.tolist(), boxes.conf.tolist()):
            items.append((_pretty(model.names[int(cls_id)]), float(score)))
    items.sort(key=lambda x: x[1], reverse=True)
    return items


def run_inference(rgb_image, threshold):
    """Run the model on an RGB numpy image.
    Returns (annotated_rgb, accepted_detections, closest_low_confidence_guess)."""
    # Gradio gives RGB; Ultralytics expects BGR for numpy arrays
    bgr = np.ascontiguousarray(rgb_image[:, :, ::-1])
    result = model(bgr, conf=float(threshold), verbose=False)[0]
    annotated_rgb = np.ascontiguousarray(result.plot()[:, :, ::-1])
    accepted = _extract(result)

    closest = None
    if not accepted:
        low = model(bgr, conf=LOW_CONF, verbose=False)[0]
        candidates = _extract(low)
        closest = candidates[0] if candidates else None
    return annotated_rgb, accepted, closest


def build_verdict(accepted, closest, threshold):
    class_list = ", ".join(_pretty(n) for n in model.names.values())
    if accepted:
        top_name, top_conf = accepted[0]
        verdict = f"## Result: {top_name} ({top_conf:.0%})"
        others = sorted({n for n, _ in accepted if n != top_name})
        if others:
            verdict += f"\n\nAlso detected: {', '.join(others)}"
        return verdict

    verdict = (
        f"## Result: {UNSPECIFIED}\n\n"
        f"No class reached {threshold:.0%} confidence, so this image is not matched to: {class_list}."
    )
    if closest:
        verdict += f"\n\nClosest guess (low confidence, not reliable): {closest[0]} ({closest[1]:.0%})"
    return verdict


def detect(image, threshold):
    """Returns (annotated_image, verdict_markdown, details_text)."""
    if model is None:
        return None, f"## Error\n\n{load_error}", ""
    if image is None:
        return None, "Please upload an image or take a photo.", ""
    try:
        if image.ndim == 2:  # grayscale -> 3 channels
            image = np.stack([image] * 3, axis=-1)
        image = image[:, :, :3]  # drop alpha channel if present

        annotated, accepted, closest = run_inference(image, threshold)
        verdict = build_verdict(accepted, closest, float(threshold))
        if accepted:
            details = "\n".join(f"{name}: {score:.2f}" for name, score in accepted)
        else:
            details = "No detections above the minimum confidence."
        return annotated, verdict, details
    except Exception as e:  # noqa: BLE001
        return None, f"## Error\n\n{e}", ""


def run_self_test():
    """Checks everything the app needs. Never raises; returns a text report."""
    lines = []
    ok = True

    def step(name, passed, detail="", critical=True):
        nonlocal ok
        if not passed and critical:
            ok = False
        tag = "PASS" if passed else ("FAIL" if critical else "WARN")
        lines.append(f"[{tag}] {name}" + (f" - {detail}" if detail else ""))

    try:
        # 1. Libraries
        try:
            import torch
            import ultralytics
            step("Libraries", True,
                 f"python {sys.version.split()[0]}, gradio {gr.__version__}, "
                 f"ultralytics {ultralytics.__version__}, torch {torch.__version__}")
        except Exception as e:  # noqa: BLE001
            step("Libraries", False, str(e))

        # 2. Weights file
        if os.path.exists(MODEL_PATH):
            mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
            step("best.pt found", True, f"{mb:.1f} MB")
        else:
            step("best.pt found", False, "upload best.pt to the Files tab")

        # 3. Model loaded
        if model is not None:
            names = [_pretty(n) for n in model.names.values()]
            trained_size = getattr(model, "overrides", {}).get("imgsz", "?")
            step("Model loaded", True,
                 f"task={getattr(model, 'task', '?')}, trained image size={trained_size}, "
                 f"{len(names)} classes: {', '.join(names)}")

            # 4. Class names match the 4 expected classes
            missing = sorted(set(map(_norm, EXPECTED_CLASSES)) - set(map(_norm, names)))
            if missing:
                step("Class names match the expected 4 classes", False,
                     "model classes differ from EXPECTED_CLASSES at the top of app.py", critical=False)
            else:
                step("Class names match the expected 4 classes", True)
        else:
            step("Model loaded", False, load_error or "unknown error")

        # 5. Dummy inference through the same code path as the Detect tab
        if model is not None:
            dummy = np.full((640, 640, 3), 127, dtype=np.uint8)
            t0 = time.time()
            annotated, accepted, closest = run_inference(dummy, DEFAULT_THRESHOLD)
            dt = time.time() - t0
            step("Inference on a test image", annotated is not None and annotated.shape[2] == 3,
                 f"{dt:.2f}s, output {annotated.shape}")

            out = detect(dummy, DEFAULT_THRESHOLD)
            step("Detect function end-to-end",
                 len(out) == 3 and isinstance(out[1], str) and "Result" in out[1],
                 out[1].splitlines()[0] if isinstance(out[1], str) else "")
        else:
            step("Inference on a test image", False, "skipped, model not loaded")
    except Exception as e:  # noqa: BLE001
        step("Self-test crashed", False, str(e))

    lines.append("")
    lines.append("ALL TESTS PASSED" if ok else "SOME TESTS FAILED - read the FAIL lines above")
    return "\n".join(lines)


# Load the model and run the self-test at startup (the report also shows in the Space Logs)
load_model()
STARTUP_REPORT = run_self_test()
print("=== SELF-TEST AT STARTUP ===\n" + STARTUP_REPORT, flush=True)


with gr.Blocks(title="Derma AI") as demo:
    gr.Markdown(
        "# Derma AI - Pig Skin Condition Detection (YOLOv8)\n"
        "Classes: **Exudative Epidermitis, Healthy, Sarcoptic Mange, Swine Pox**. "
        "If the model is not confident enough, the result is **Unspecified**.\n\n"
        "**For learning and research only. Not a veterinary diagnosis. "
        "Please consult a veterinarian.**"
    )
    with gr.Tabs():
        with gr.Tab("Detect"):
            with gr.Row():
                with gr.Column():
                    inp = gr.Image(type="numpy", sources=["upload", "webcam"], label="Image")
                    thr = gr.Slider(0.20, 0.95, value=DEFAULT_THRESHOLD, step=0.05,
                                    label="Minimum confidence (below this = Unspecified)")
                    btn = gr.Button("Detect", variant="primary")
                with gr.Column():
                    out_img = gr.Image(type="numpy", label="Detections")
                    out_verdict = gr.Markdown("The result will appear here.")
                    out_txt = gr.Textbox(label="Accepted detections", lines=5)
            btn.click(detect, inputs=[inp, thr], outputs=[out_img, out_verdict, out_txt])

        with gr.Tab("Self-Test"):
            gr.Markdown("Checks the libraries, `best.pt`, the class names, and a test inference.")
            test_btn = gr.Button("Run self-test")
            test_out = gr.Textbox(label="Self-test report", value=STARTUP_REPORT, lines=14)
            test_btn.click(run_self_test, inputs=None, outputs=test_out)

if __name__ == "__main__":
    demo.launch()