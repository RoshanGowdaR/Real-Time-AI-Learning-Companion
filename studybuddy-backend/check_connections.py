
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

def test_supabase_connection():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        print("❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env")
        return False

    try:
        supabase: Client = create_client(url, key)
        # Try a simple health check or fetch a single row from a known table if possible
        # For now, just check if the client can be initialized and maybe call a simple method
        print(f"✅ Supabase client initialized for URL: {url}")
        return True
    except Exception as e:
        print(f"❌ Supabase connection error: {e}")
        return False

def test_groq_connection():
    key = os.getenv("GROQ_API_KEY")
    if not key or "your_groq_api_key_here" in key:
        print("⚠️ Warning: GROQ_API_KEY is not set correctly in .env")
        return False
    print("✅ GROQ_API_KEY found in .env")
    return True

if __name__ == "__main__":
    print("--- Backend Connection Check ---")
    supabase_ok = test_supabase_connection()
    groq_ok = test_groq_connection()
    
    if supabase_ok and groq_ok:
        print("\n🎉 Connections configured. Note: Actual Groq API calls need a valid key.")
    else:
        print("\n🔧 Action required: Please update your .env with valid API keys.")
