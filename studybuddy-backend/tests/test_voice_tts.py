"""Test POST /api/voice/tts"""
import os
import requests

BASE_URL = "http://localhost:8000"
OUTPUT_FILE = "test_output.mp3"

try:
    r = requests.post(
        f"{BASE_URL}/api/voice/tts",
        json={"text": "Hello, welcome to StudyBuddy"},
        timeout=30,
        stream=True,
    )
    r.raise_for_status()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, OUTPUT_FILE)
    with open(output_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        print(f"PASS ✅ (saved to {output_path})")
    else:
        print("FAIL ❌ file not saved or empty")
except Exception as e:
    print(f"FAIL ❌ {e}")
