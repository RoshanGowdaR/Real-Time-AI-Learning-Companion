"""Test POST /api/upload"""
import os
import requests

BASE_URL = "http://localhost:8000"
STUDENT_ID = "00000000-0000-0000-0000-000000000000"  # Replace with real UUID from test_student

script_dir = os.path.dirname(os.path.abspath(__file__))
sample_pdf = os.path.join(script_dir, "sample.pdf")

try:
    if not os.path.exists(sample_pdf):
        print(f"FAIL ❌ sample.pdf not found at {sample_pdf}")
    else:
        with open(sample_pdf, "rb") as f:
            r = requests.post(
                f"{BASE_URL}/api/upload",
                files={"file": ("sample.pdf", f, "application/pdf")},
                data={"student_id": STUDENT_ID},
                timeout=60,
            )
        r.raise_for_status()
        data = r.json()
        summary = data.get("summary", "")
        print(f"summary: {summary[:200]}..." if len(summary) > 200 else f"summary: {summary}")
        if data.get("status") == "success":
            print("PASS ✅")
        else:
            print("FAIL ❌ status not success")
except Exception as e:
    print(f"FAIL ❌ {e}")
