import sys

from gradio_client import Client, handle_file

SPACE = "johnnysins123/DermaAI"

if len(sys.argv) < 2:
    raise SystemExit("Usage: python test_space.py path/to/image.jpg")

client = Client(SPACE)
annotated_path, verdict, details = client.predict(
    handle_file(sys.argv[1]),
    0.5,
    api_name="/detect",
)
print(verdict)
print("Details:", details)
print("Annotated image saved at:", annotated_path)