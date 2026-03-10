"""Voice routes - STT and TTS"""
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from models.schemas import TTSRequest
from services.stt_service import transcribe_audio
from services.tts_service import text_to_speech

router = APIRouter()
UPLOADS_DIR = Path("uploads")
TEMP_AUDIO_PATH = UPLOADS_DIR / "temp_audio.webm"


@router.post("/voice/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribe uploaded audio file."""
    try:
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        contents = await file.read()
        TEMP_AUDIO_PATH.write_bytes(contents)
        text = transcribe_audio(str(TEMP_AUDIO_PATH))
        TEMP_AUDIO_PATH.unlink(missing_ok=True)
        return {"text": text, "status": "success"}
    except Exception as e:
        TEMP_AUDIO_PATH.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice/tts")
async def text_to_speech_endpoint(body: TTSRequest):
    """Convert text to speech, return audio stream."""
    try:
        audio_bytes = text_to_speech(body.text)
        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
