"""Emotion analysis route using DeepFace on uploaded camera frames."""
from functools import lru_cache

from fastapi import APIRouter, File, Form, UploadFile

from services import supabase_service

router = APIRouter()

EMOTION_MAP = {
    "happy": "happy",
    "sad": "distressed",
    "angry": "distressed",
    "fearful": "distressed",
    "fear": "distressed",
    "disgusted": "distressed",
    "disgust": "distressed",
    "surprise": "confused",
    "surprised": "confused",
    "confused": "confused",
    "neutral": "neutral",
}


@lru_cache(maxsize=1)
def _load_emotion_modules():
    """Load heavy CV/deep learning modules once and reuse them."""
    try:
        import cv2  # pylint: disable=import-outside-toplevel
        import numpy as np  # pylint: disable=import-outside-toplevel
        from deepface import DeepFace  # pylint: disable=import-outside-toplevel

        return cv2, np, DeepFace
    except Exception:
        return None


def _safe_no_face_response():
    return {
        "emotion": "no_face",
        "confidence": 0,
        "status": "ok",
    }


async def _build_response(student_id: str | None, emotion: str, confidence: float, status: str):
    if student_id:
        try:
            await supabase_service.log_emotion(
                student_id=student_id,
                emotion=emotion,
                confidence=confidence,
            )
        except Exception:
            # Logging failures should never interrupt realtime analysis responses.
            pass

    return {
        "emotion": emotion,
        "confidence": confidence,
        "status": status,
    }


def _extract_first_result(raw_result):
    if isinstance(raw_result, list):
        return raw_result[0] if raw_result else {}
    return raw_result or {}


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _has_no_detected_face(result):
    face_confidence = result.get("face_confidence")
    if face_confidence is not None and _to_float(face_confidence, 0.0) <= 0:
        return True

    region = result.get("region") or {}
    width = _to_float(region.get("w"), 1)
    height = _to_float(region.get("h"), 1)
    if width <= 0 or height <= 0:
        return True

    return False


def _map_emotion(dominant_emotion):
    return EMOTION_MAP.get(str(dominant_emotion or "").strip().lower(), "no_face")


def _extract_confidence(result, dominant_emotion):
    emotions = result.get("emotion")
    if isinstance(emotions, dict):
        confidence = _to_float(emotions.get(dominant_emotion), 0.0)
    else:
        confidence = _to_float(result.get("face_confidence"), 0.0) * 100

    # Keep confidence between 0 and 100 for stable frontend rendering.
    return round(max(0.0, min(100.0, confidence)), 1)


@router.post("/emotion/analyze")
async def analyze_emotion(
    student_id: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
    file: UploadFile | None = File(default=None),
):
    """Analyze one uploaded image frame and return simplified emotion labels."""
    # Keep accepted shape explicit even when currently unused by analysis.
    _ = student_id

    try:
        modules = _load_emotion_modules()
        if not modules:
            return await _build_response(student_id, "no_face", 0, "ok")

        cv2, np, DeepFace = modules

        frame_file = image or file
        if frame_file is None:
            return await _build_response(student_id, "no_face", 0, "ok")

        image_bytes = await frame_file.read()
        if not image_bytes:
            return await _build_response(student_id, "no_face", 0, "ok")

        np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        img_array = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
        if img_array is None:
            return await _build_response(student_id, "no_face", 0, "ok")

        result = DeepFace.analyze(
            img_path=img_array,
            actions=["emotion"],
            enforce_detection=False,
        )
        parsed = _extract_first_result(result)

        if _has_no_detected_face(parsed):
            return await _build_response(student_id, "no_face", 0, "ok")

        dominant_emotion = str(parsed.get("dominant_emotion", "")).strip().lower()
        simplified_emotion = _map_emotion(dominant_emotion)

        if simplified_emotion == "no_face":
            return await _build_response(student_id, "no_face", 0, "ok")

        confidence = _extract_confidence(parsed, dominant_emotion)

        return await _build_response(student_id, simplified_emotion, confidence, "success")
    except Exception:
        # Endpoint is intentionally fail-safe for realtime frontend polling.
        no_face = _safe_no_face_response()
        return await _build_response(student_id, no_face["emotion"], no_face["confidence"], no_face["status"])
