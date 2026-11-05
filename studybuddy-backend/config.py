import os
import threading
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
VECTORSTORE_DIR = BASE_DIR / "vectorstore"
DATA_DIR = BASE_DIR / "data"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Raw single key
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Key pool for round-robin rotation
raw_keys = os.getenv("GROQ_API_KEYS", "")
if raw_keys:
    GROQ_API_KEYS = [k.strip() for k in raw_keys.split(",") if k.strip()]
else:
    GROQ_API_KEYS = [GROQ_API_KEY] if GROQ_API_KEY else []


ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

_key_idx = 0
_key_lock = threading.Lock()


def get_next_groq_api_key() -> str:
    """Return next Groq API key using round-robin distribution."""
    global _key_idx
    with _key_lock:
        if not GROQ_API_KEYS:
            return GROQ_API_KEY
        key = GROQ_API_KEYS[_key_idx % len(GROQ_API_KEYS)]
        _key_idx = (_key_idx + 1) % len(GROQ_API_KEYS)
        return key


def get_all_groq_keys() -> list:
    """Return full list of configured Groq keys."""
    return list(GROQ_API_KEYS)

