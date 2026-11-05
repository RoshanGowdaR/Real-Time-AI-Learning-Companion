import os
import cv2
import numpy as np
import joblib
from skimage.feature import local_binary_pattern

MODELS_DIR = r"c:\Users\gowda\OneDrive\Desktop\Study_Buddy\StudyBudy\models"
p_em = os.path.join(MODELS_DIR, "emotion_model.pkl")
p_le = os.path.join(MODELS_DIR, "label_encoder.pkl")

print("Loading emotion_model and label_encoder...")
emotion_model = joblib.load(p_em)
label_encoder = joblib.load(p_le)
print("Classes in label_encoder:", label_encoder.classes_)

def extract_hog_features(image):
    """
    Combined HOG + LBP + pixel histogram features.
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
        _nbins=9
    )
    hog_features = hog.compute(resized).flatten()

    # LBP features -> 10 values
    lbp = local_binary_pattern(resized, P=8, R=1, method='uniform')
    lbp_hist, _ = np.histogram(lbp.ravel(), bins=np.arange(0, 11), range=(0, 10))
    lbp_hist = lbp_hist.astype("float")
    lbp_hist /= (lbp_hist.sum() + 1e-6)

    # Pixel intensity histogram -> 32 values
    pixel_hist, _ = np.histogram(resized.ravel(), bins=32, range=(0, 256))
    pixel_hist = pixel_hist.astype("float")
    pixel_hist /= (pixel_hist.sum() + 1e-6)

    return np.concatenate([hog_features, lbp_hist, pixel_hist])

# Create a test face image
test_img = np.zeros((100, 100, 3), dtype=np.uint8) + 128
cv2.circle(test_img, (50, 50), 30, (200, 200, 200), -1)

feats = extract_hog_features(test_img)
print("Extracted feature shape:", feats.shape)

pred_enc = emotion_model.predict([feats])[0]
proba = emotion_model.predict_proba([feats])[0]
confidence = round(float(proba.max()) * 100, 1)
pred_emotion = label_encoder.inverse_transform([pred_enc])[0]
print(f"Prediction successful! Emotion: {pred_emotion}, Confidence: {confidence}%, Proba: {proba}")
