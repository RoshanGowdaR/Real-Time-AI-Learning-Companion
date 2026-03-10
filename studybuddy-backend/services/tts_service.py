"""TTS service - Groq text-to-speech using Canopy Labs Orpheus"""
import httpx

from config import GROQ_API_KEY

TTS_URL = "https://api.groq.com/openai/v1/audio/speech"
TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE = "autumn"  # Valid voices: autumn, diana, hannah, austin, daniel, ...


def text_to_speech(text: str) -> bytes:
    """Convert text to speech using Groq Orpheus TTS. Returns WAV audio bytes."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": TTS_MODEL,
        "input": text,
        "voice": TTS_VOICE,
        "response_format": "wav",
    }

    with httpx.Client() as client:
        response = client.post(
            TTS_URL,
            json=payload,
            headers=headers,
            timeout=30.0,
        )
        response.raise_for_status()

    return response.content
