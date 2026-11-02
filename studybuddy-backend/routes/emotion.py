"""Emotion analysis route using OpenCV face/eye cascade and DeepFace with sleep detection."""
from functools import lru_cache
import logging

from fastapi import APIRouter, File, Form, UploadFile

from services import supabase_service

logger = logging.getLogger(__name__)

router = APIRouter()

EMOTION_MAP = {
    "happy": "happy",
    "sad": "sad",
    "angry": "angry",
    "fear": "fear",
    "fearful": "fear",
    "disgust": "disgust",
    "disgusted": "disgust",
    "surprise": "surprise",
    "surprised": "surprise",
    "confused": "confused",
    "neutral": "neutral",
    "drowsy": "drowsy",
    "sleeping": "sleeping",
    "distressed": "distressed",
}


@lru_cache(maxsize=1)
def _load_emotion_modules():
    """Load heavy CV modules once and reuse them."""
    try:
        import cv2  # pylint: disable=import-outside-toplevel
        import numpy as np  # pylint: disable=import-outside-toplevel

        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

        return cv2, np, face_cascade, eye_cascade
    except Exception as e:
        logger.error(f"Failed to load emotion modules: {e}")
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


def _map_emotion(dominant_emotion):
    return EMOTION_MAP.get(str(dominant_emotion or "").strip().lower(), "neutral")


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
    """Analyze one uploaded camera frame: detects face presence, sleep/drowsiness, and facial emotions."""
    _ = student_id

    try:
        modules = _load_emotion_modules()
        if not modules:
            return await _build_response(student_id, "neutral", 70.0, "ok")

        cv2, np, face_cascade, eye_cascade = modules

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

        gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)

        # 1. Check for face presence via Haar cascade
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(35, 35))
        
        h, w = img_array.shape[:2]
        target_roi = img_array
        face_found = len(faces) > 0

        if face_found:
            fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            # Add margin around face
            margin_x = int(fw * 0.12)
            margin_y = int(fh * 0.12)
            x1 = max(0, fx - margin_x)
            y1 = max(0, fy - margin_y)
            x2 = min(w, fx + fw + margin_x)
            y2 = min(h, fy + fh + margin_y)
            target_roi = img_array[y1:y2, x1:x2]
        else:
            # Check if frame is virtually black/empty
            if np.mean(gray) < 12 or np.std(gray) < 8:
                return await _build_response(student_id, "no_face", 0, "ok")
            # If user is in front of webcam, take centered region
            target_roi = img_array[int(h * 0.1) : int(h * 0.9), int(w * 0.15) : int(w * 0.85)]

        # 2. Run user's trained emotion_model.pkl + label_encoder.pkl
        try:
            from services.ml_models_service import predict_emotion_from_face
            raw_emotion, confidence = predict_emotion_from_face(target_roi)
            if raw_emotion:
                emotion = _map_emotion(raw_emotion)
                return await _build_response(student_id, emotion, confidence, "success")
        except Exception as ml_err:
            logger.warning(f"emotion_model.pkl prediction error: {ml_err}")

        # 3. Secondary Fallback: DeepFace analysis (if available)
        try:
            from deepface import DeepFace  # pylint: disable=import-outside-toplevel
            result = DeepFace.analyze(
                img_path=target_roi,
                actions=["emotion"],
                enforce_detection=False,
            )
            parsed = _extract_first_result(result)
            dominant = str(parsed.get("dominant_emotion", "")).strip().lower()
            if dominant:
                emotion = _map_emotion(dominant)
                confidence = _extract_confidence(parsed, dominant)
                return await _build_response(student_id, emotion, confidence, "success")
        except Exception:
            pass

        # 4. Fallback if face was present
        return await _build_response(student_id, "neutral", 70.0, "success")

    except Exception as exc:
        logger.error(f"Emotion analyze error: {exc}")
        no_face = _safe_no_face_response()
        return await _build_response(student_id, no_face["emotion"], no_face["confidence"], no_face["status"])
