"""Test POST /api/student/register"""
import requests

from _test_utils import BASE_URL, save_state

try:
    r = requests.post(
        f"{BASE_URL}/api/student/register",
        json={"name": "Test User", "email": "test@test.com"},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    student_id = data.get("student_id")
    print(f"student_id: {student_id}")
    if student_id:
        save_state({"student_id": student_id})
        print("PASS")
    else:
        print("FAIL: no student_id in response")
except Exception as e:
    print(f"FAIL: {e}")
