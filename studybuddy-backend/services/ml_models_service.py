"""ML Models Service
Integrates the user's trained machine learning models:
1. emotion_model.pkl + label_encoder.pkl: HOG + LBP + pixel intensity (942 features) emotion detector
2. rf_model.pkl: VotingClassifier (TF-IDF + RF + LR + LinearSVC) for student intent / depth
3. feedback.xlsx: Excel file storing session ratings & feedback
4. hypothesis.json: Find-S concept learning hypothesis
"""
import datetime
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import joblib
import numpy as np
import pandas as pd
from skimage.feature import local_binary_pattern

from config import BASE_DIR

logger = logging.getLogger(__name__)

# Locate models directory
_candidate_dirs = [
    BASE_DIR.parent / "models",
    BASE_DIR / "models",
    Path(r"c:\Users\gowda\OneDrive\Desktop\Study_Buddy\StudyBudy\models"),
]
MODELS_DIR = Path(r"c:\Users\gowda\OneDrive\Desktop\Study_Buddy\StudyBudy\models")
for d in _candidate_dirs:
    if d.exists() and d.is_dir():
        MODELS_DIR = d
        break

EMOTION_MODEL_PATH = MODELS_DIR / "emotion_model.pkl"
LABEL_ENCODER_PATH = MODELS_DIR / "label_encoder.pkl"
RF_MODEL_PATH = MODELS_DIR / "rf_model.pkl"
FEEDBACK_EXCEL_PATH = MODELS_DIR / "feedback.xlsx"
HYPOTHESIS_PATH = MODELS_DIR / "hypothesis.json"

_emotion_model = None
_label_encoder = None
_rf_model = None
_models_loaded = False


def load_ml_models():
    """Load trained models into memory once."""
    global _emotion_model, _label_encoder, _rf_model, _models_loaded
    if _models_loaded:
        return True

    try:
        if EMOTION_MODEL_PATH.exists():
            _emotion_model = joblib.load(str(EMOTION_MODEL_PATH))
            logger.info("Loaded emotion_model.pkl successfully")

        if LABEL_ENCODER_PATH.exists():
            _label_encoder = joblib.load(str(LABEL_ENCODER_PATH))
            logger.info("Loaded label_encoder.pkl successfully")

        if RF_MODEL_PATH.exists():
            _rf_model = joblib.load(str(RF_MODEL_PATH))
            logger.info("Loaded rf_model.pkl successfully")

        _models_loaded = True
        return True
    except Exception as exc:
        logger.error(f"Error loading models from {MODELS_DIR}: {exc}")
        return False


# Auto-load on import
load_ml_models()


def extract_hog_features(image: np.ndarray) -> np.ndarray:
    """
    Combined HOG + LBP + pixel histogram features.
    Matches training specification:
    HOG=900, LBP=10, pixel_hist=32 -> total=942 features.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    resized = cv2.resize(gray, (48, 48))

    # HOG features -> 900 values
    hog = cv2.HOGDescriptor(
        _winSize=(48, 48),
        _blockSize=(16, 16),
        _blockStride=(8, 8),
        _cellSize=(8, 8),
        _nbins=9,
    )
    hog_features = hog.compute(resized).flatten()

    # LBP features -> 10 values
    lbp = local_binary_pattern(resized, P=8, R=1, method="uniform")
    lbp_hist, _ = np.histogram(lbp.ravel(), bins=np.arange(0, 11), range=(0, 10))
    lbp_hist = lbp_hist.astype("float")
    lbp_hist /= lbp_hist.sum() + 1e-6

    # Pixel intensity histogram -> 32 values
    pixel_hist, _ = np.histogram(resized.ravel(), bins=32, range=(0, 256))
    pixel_hist = pixel_hist.astype("float")
    pixel_hist /= pixel_hist.sum() + 1e-6

    return np.concatenate([hog_features, lbp_hist, pixel_hist])


def predict_emotion_from_face(face_img: np.ndarray) -> Tuple[str, float]:
    """
    Extracts 942 HOG+LBP features from face image, runs emotion_model.pkl,
    and returns (emotion_label, confidence_percentage).
    """
    load_ml_models()
    if _emotion_model is None or _label_encoder is None:
        return "neutral", 70.0

    try:
        features = extract_hog_features(face_img)
        pred_enc = _emotion_model.predict([features])[0]
        emotion = str(_label_encoder.inverse_transform([pred_enc])[0]).strip().lower()

        confidence = 80.0
        if hasattr(_emotion_model, "predict_proba"):
            probs = _emotion_model.predict_proba([features])[0]
            confidence = round(float(probs.max()) * 100, 1)

        return emotion, confidence
    except Exception as exc:
        logger.warning(f"Error predicting emotion with emotion_model.pkl: {exc}")
        return "neutral", 70.0


def predict_student_intent(text: str) -> str:
    """
    Predicts student intent level using rf_model.pkl (VotingClassifier).
    Returns one of: 'advanced', 'confused', 'on-track'.
    """
    load_ml_models()
    if _rf_model is None or not text or not text.strip():
        return "on-track"

    try:
        pred = _rf_model.predict([text.strip()])[0]
        return str(pred).strip().lower()
    except Exception as exc:
        logger.warning(f"Error predicting intent with rf_model.pkl: {exc}")
        return "on-track"


def load_find_s_hypothesis() -> Dict[str, Any]:
    """Load hypothesis from hypothesis.json."""
    default_h = {
        "intent": "?",
        "emotion": "?",
        "response_depth": "?",
        "used_examples": "True",
        "positive_examples_seen": 0,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "description": "Initial hypothesis",
    }
    if not HYPOTHESIS_PATH.exists():
        return default_h

    try:
        with open(HYPOTHESIS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        logger.warning(f"Error reading {HYPOTHESIS_PATH}: {exc}")
        return default_h


def save_find_s_hypothesis(h: Dict[str, Any]) -> None:
    """Save updated hypothesis to hypothesis.json."""
    try:
        HYPOTHESIS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(HYPOTHESIS_PATH, "w", encoding="utf-8") as f:
            json.dump(h, f, indent=4)
        logger.info(f"Saved hypothesis to {HYPOTHESIS_PATH}")
    except Exception as exc:
        logger.error(f"Error saving hypothesis to {HYPOTHESIS_PATH}: {exc}")


def run_find_s(feedback_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Find-S concept learning algorithm.
    Finds the most specific consistent hypothesis from positive sessions (rating >= 4 or satisfied=True).
    Attributes: intent, emotion, response_depth, used_examples
    """
    hypothesis: Dict[str, Any] = {
        "intent": None,
        "emotion": None,
        "response_depth": None,
        "used_examples": None,
    }
    positive_count = 0

    for record in feedback_records:
        satisfied = bool(record.get("satisfied")) or (int(record.get("rating", 0) or 0) >= 4)
        if satisfied:
            positive_count += 1
            for attr in ["intent", "emotion", "response_depth", "used_examples"]:
                val = str(record.get(attr, "?"))
                if hypothesis[attr] is None:
                    hypothesis[attr] = val
                elif hypothesis[attr] != val:
                    hypothesis[attr] = "?"

    # Any remaining None gets generalized to '?'
    for attr in ["intent", "emotion", "response_depth", "used_examples"]:
        if hypothesis[attr] is None:
            hypothesis[attr] = "?"

    hypothesis["positive_examples_seen"] = positive_count
    hypothesis["timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    hypothesis["description"] = (
        f"Most specific consistent hypothesis from {positive_count} positive examples"
        if positive_count > 0
        else "No positive examples yet - hypothesis is empty"
    )
    return hypothesis


def append_feedback_to_excel(
    rating: int,
    feedback_text: str = "",
    intent: str = "on-track",
    emotion: str = "neutral",
    response_depth: str = "",
    used_examples: str = "True",
) -> Dict[str, Any]:
    """
    Appends a new feedback record to feedback.xlsx and updates hypothesis.json using Find-S.
    """
    satisfied = rating >= 4
    depth = response_depth or intent or "on-track"

    now_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    new_record = {
        "session_id": session_id,
        "intent": intent,
        "emotion": emotion,
        "response_depth": depth,
        "used_examples": str(used_examples),
        "rating": int(rating),
        "satisfied": int(1 if satisfied else 0),
        "timestamp": now_ts,
    }

    FEEDBACK_EXCEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        if FEEDBACK_EXCEL_PATH.exists():
            existing_df = pd.read_excel(str(FEEDBACK_EXCEL_PATH))
            updated_df = pd.concat([existing_df, pd.DataFrame([new_record])], ignore_index=True)
        else:
            updated_df = pd.DataFrame([new_record])

        updated_df.to_excel(str(FEEDBACK_EXCEL_PATH), index=False)
        logger.info(f"Appended feedback to {FEEDBACK_EXCEL_PATH} (total {len(updated_df)} records)")

        # Re-run Find-S on all records
        all_records = updated_df.to_dict(orient="records")
        updated_hypothesis = run_find_s(all_records)
        save_find_s_hypothesis(updated_hypothesis)

        return {
            "status": "success",
            "saved_to_excel": True,
            "excel_path": str(FEEDBACK_EXCEL_PATH),
            "record": new_record,
            "hypothesis": updated_hypothesis,
        }
    except Exception as exc:
        logger.error(f"Error updating feedback.xlsx: {exc}")
        # Still update hypothesis in memory if possible
        curr_h = load_find_s_hypothesis()
        return {
            "status": "warning",
            "error": str(exc),
            "hypothesis": curr_h,
        }
