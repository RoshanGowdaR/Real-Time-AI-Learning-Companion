"""Check which required tables exist in Supabase and report missing ones."""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

REQUIRED_TABLES = [
    "students",
    "documents",
    "sessions",
    "chat_messages",
    "flashcards",
    "flashcard_review_days",
    "schedule_events",
    "emotion_logs",
    "workspaces",
    "workspace_documents",
    "organizations",
    "teachers",
    "subjects",
    "org_members",
    "subject_enrollments",
    "announcements",
    "assignments",
]

def main():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        print("ERROR: SUPABASE_URL or SUPABASE_ANON_KEY not set in .env")
        return

    supabase: Client = create_client(url, key)
    print(f"Connected to Supabase: {url}\n")

    found = []
    missing = []

    for table in REQUIRED_TABLES:
        try:
            result = supabase.table(table).select("id").limit(1).execute()
            found.append(table)
            print(f"  [OK]      {table}")
        except Exception as e:
            msg = str(e)
            if "relation" in msg and "does not exist" in msg:
                missing.append(table)
                print(f"  [MISSING] {table}")
            elif "permission denied" in msg.lower():
                found.append(table)
                print(f"  [EXISTS - permission denied, RLS on] {table}")
            else:
                print(f"  [ERROR]   {table} -> {msg[:120]}")

    print(f"\n--- Summary ---")
    print(f"Found  : {len(found)} tables")
    print(f"Missing: {len(missing)} tables")

    if missing:
        print(f"\nMissing tables: {missing}")
        print("\nRun supabase_schema.sql in your Supabase SQL Editor to create them.")
        print(f"File: studybuddy-backend/supabase_schema.sql")
    else:
        print("\nAll required tables are present!")

if __name__ == "__main__":
    main()
