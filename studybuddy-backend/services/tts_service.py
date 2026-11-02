"""TTS service - Groq text-to-speech with seamless Edge-TTS neural fallback"""
import asyncio
import logging
import httpx

from config import get_next_groq_api_key

logger = logging.getLogger(__name__)

# Groq OpenAI-compatible speech endpoint.
TTS_URL = "https://api.groq.com/openai/v1/audio/speech"
TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE = "autumn"
MAX_TTS_CHARS = 1200
FALLBACK_VOICE = "en-US-AriaNeural"


async def _generate_edge_tts(text: str) -> bytes:
    """Generate high quality speech using edge-tts (free, neural, zero terms/keys needed)."""
    import edge_tts
    comm = edge_tts.Communicate(text, FALLBACK_VOICE)
    data = b""
    async for chunk in comm.stream():
        if chunk.get("type") == "audio":
            data += chunk["data"]
    return data


async def text_to_speech_async(text: str) -> tuple[bytes, str]:
    """
    Convert text to speech asynchronously.
    Returns (audio_bytes, media_type).
    Tries Groq Orpheus first; if terms required or failed, falls back to edge-tts.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("TTS text is empty")

    if len(cleaned) > MAX_TTS_CHARS:
        cleaned = cleaned[:MAX_TTS_CHARS]

    # Try Groq Orpheus first
    groq_key = get_next_groq_api_key()
    if groq_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    TTS_URL,
                    json={
                        "model": TTS_MODEL,
                        "input": cleaned,
                        "voice": TTS_VOICE,
                        "response_format": "wav",
                    },
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                    },
                )
                if res.status_code == 200 and len(res.content) > 100:
                    return res.content, "audio/wav"
                else:
                    logger.info(f"Groq TTS unavailable ({res.status_code}: {res.text[:80]}), using Edge-TTS neural fallback")
        except Exception as e:
            logger.info(f"Groq TTS exception ({e}), falling back to Edge-TTS")

    # Seamless Edge-TTS neural fallback
    try:
        audio_bytes = await _generate_edge_tts(cleaned)
        if audio_bytes:
            return audio_bytes, "audio/mpeg"
    except Exception as exc:
        logger.error(f"Edge-TTS fallback error: {exc}")
        raise RuntimeError("Failed to generate speech with all available TTS providers") from exc

    raise RuntimeError("No audio generated")


def text_to_speech(text: str) -> bytes:
    """Synchronous compatibility wrapper for text_to_speech."""
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("TTS text is empty")
    return asyncio.run(text_to_speech_async(text))[0]
