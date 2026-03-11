"""STT service - Groq Whisper transcription"""
from pathlib import Path

import httpx

from config import GROQ_API_KEY

# Groq OpenAI-compatible Whisper endpoint.
WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MODEL = "whisper-large-v3"


def transcribe_audio(file_path: str) -> str:
    """Transcribe audio file using Groq Whisper API. Returns transcribed text."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    with open(file_path, "rb") as f:
        files = {"file": (path.name, f, "audio/webm")}
        data = {"model": MODEL}
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}

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
    if not isinstance(text, str):
        raise ValueError("Unexpected transcription response format")
    return text.strip()
