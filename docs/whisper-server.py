"""
Minimal OpenAI-compatible transcription server backed by faster-whisper.

Exposes POST /v1/audio/transcriptions with the same multipart contract as
OpenAI's endpoint, so the ingestion pipeline only needs a base URL change — no
new client, no new response shape.

Runs large-v3 quantized to int8_float16: same model as fp16, ~4.7GB instead of
~10GB, which is what makes it fit the 6GB RTX 3060 alongside Ollama.
"""
import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "large-v3")
DEVICE = os.environ.get("WHISPER_DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8_float16")

app = FastAPI(title="whisper-server")
_model: WhisperModel | None = None
_cpu_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    """Loads the model on first use, then keeps it resident.

    Cold start pulls ~1.5GB and takes a while; every later request reuses the
    loaded weights, so the first transcription is not representative of latency.
    """
    global _model
    if _model is None:
        print(f"[whisper] loading {MODEL_SIZE} on {DEVICE} ({COMPUTE_TYPE})...", flush=True)
        _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        print("[whisper] model ready", flush=True)
    return _model


def get_cpu_model() -> WhisperModel:
    """The fallback for when the GPU has no room left.

    This 6GB card is shared with Ollama's embedding model and other projects, so
    CUDA runs out of memory intermittently. Failing the request would lose the
    speech entirely; CPU is slower but always available, and a background
    pipeline can afford the wait.
    """
    global _cpu_model
    if _cpu_model is None:
        print("[whisper] loading CPU fallback...", flush=True)
        _cpu_model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
        print("[whisper] CPU fallback ready", flush=True)
    return _cpu_model


def transcribe_with_fallback(path: str, language):
    """Tries the GPU, then CPU. Only a real transcription failure propagates."""
    try:
        return get_model().transcribe(path, language=language, vad_filter=True, beam_size=5)
    except Exception as exc:
        print(f"[whisper] GPU transcription failed ({exc}); retrying on CPU", flush=True)
        return get_cpu_model().transcribe(path, language=language, vad_filter=True, beam_size=5)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE, "compute_type": COMPUTE_TYPE}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL_SIZE),
    language: str | None = Form(default=None),
    response_format: str = Form(default="json"),
):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="empty audio file")

    suffix = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(payload)
        tmp_path = tmp.name

    try:
        # `language=None` lets Whisper detect it, which is what mixed es/en
        # content needs — forcing a language degrades the other one.
        segments, info = transcribe_with_fallback(tmp_path, language)
        text = "".join(segment.text for segment in segments).strip()
    except Exception as exc:  # surfaced to the caller rather than returning empty text
        raise HTTPException(status_code=500, detail=f"transcription failed: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    if response_format == "text":
        return JSONResponse(content=text)

    return {
        "text": text,
        "language": info.language,
        "language_probability": round(info.language_probability, 4),
        "duration": round(info.duration, 2),
    }
