"""Test POST /api/upload"""
import os
import requests

from _test_utils import BASE_URL, require_state, save_state

script_dir = os.path.dirname(os.path.abspath(__file__))
sample_pdf = os.path.join(script_dir, "sample.pdf")

try:
    STUDENT_ID = require_state("student_id")
    if not os.path.exists(sample_pdf):
        print(f"FAIL: sample.pdf not found at {sample_pdf}")
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
            document_id = data.get("document_id")
            filename = data.get("filename") or "sample.pdf"
            if document_id:
                save_state({"document_id": document_id, "filename": filename})
            print("PASS")
        else:
            print("FAIL: status not success")
except Exception as e:
    print(f"FAIL: {e}")
