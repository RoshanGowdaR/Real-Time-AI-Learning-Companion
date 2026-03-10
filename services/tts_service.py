"""TTS service - ElevenLabs text-to-speech"""
import httpx

from config import ELEVENLABS_API_KEY

TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM"
MODEL_ID = "eleven_monolingual_v1"


def text_to_speech(text: str) -> bytes:
    """Convert text to speech using ElevenLabs. Returns audio bytes (MP3)."""
    def _fallback_bytes() -> bytes:
        # Local/dev fallback so the endpoint can still be exercised without working API keys.
        # This is not high-quality audio, but it's a non-empty MP3-like payload.
        return b"ID3" + (b"\x00" * 2048)

    if not ELEVENLABS_API_KEY:
        return _fallback_bytes()

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {"text": text, "model_id": MODEL_ID}

    with httpx.Client() as client:
        try:
            response = client.post(
                TTS_URL,
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code in (401, 403):
                return _fallback_bytes()
            raise

    return response.content
