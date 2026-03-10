"""TTS service - ElevenLabs text-to-speech"""
import httpx

from config import ELEVENLABS_API_KEY

TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"
MODEL_ID = "eleven_monolingual_v1"


def text_to_speech(text: str) -> bytes:
    """Convert text to speech using ElevenLabs. Returns audio bytes (MP3)."""
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {"text": text, "model_id": MODEL_ID}

    with httpx.Client() as client:
        response = client.post(
            TTS_URL,
            json=payload,
            headers=headers,
            timeout=30.0,
        )
        response.raise_for_status()

    return response.content
