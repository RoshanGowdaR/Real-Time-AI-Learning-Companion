import json
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
STATE_PATH = Path(__file__).with_name(".test_state.json")


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(updates: dict) -> dict:
    state = load_state()
    state.update(updates)
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    return state


def require_state(key: str) -> str:
    state = load_state()
    val = state.get(key)
    if not val:
        raise KeyError(
            f"Missing required state '{key}'. Run tests in order starting with test_student.py."
        )
    return str(val)

