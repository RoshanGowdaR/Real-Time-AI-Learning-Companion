"""STT service - Groq Whisper transcription"""
from pathlib import Path

import httpx

from config import get_next_groq_api_key, get_all_groq_keys

# Groq OpenAI-compatible Whisper endpoint.
WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MODEL = "whisper-large-v3"


def transcribe_audio(file_path: str) -> str:
    """Transcribe audio file using Groq Whisper API with round-robin key rotation and fallback."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    available_keys = get_all_groq_keys()
    start_key = get_next_groq_api_key()
    rotated_keys = [start_key] + [k for k in available_keys if k != start_key]

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    last_error = None
    for key in rotated_keys:
        try:
            files = {"file": (path.name, file_bytes, "audio/webm")}
            data = {"model": MODEL}
            headers = {"Authorization": f"Bearer {key}"}

            with httpx.Client() as client:
                response = client.post(
                    WHISPER_URL,
                    files=files,
                    data=data,
                    headers=headers,
                    timeout=60.0,
                )
                response.raise_for_status()

            result = response.json()
            text = result.get("text", "")
            if isinstance(text, str):
                return text.strip()
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise last_error
    return ""
