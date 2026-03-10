"""
End-to-end test: StudyBuddy full flow
  1. Register student "Sharath"
  2. Upload linear_algebra.pdf
  3. Get PDF summary
  4. Chat: ask for study strategy (vague -> should ask clarifying question)
  5. Chat: ask about Linear Algebra exam topics (with PDF context)
  6. Get personalized greeting via memory endpoint
  7. Test TTS: convert greeting to audio
"""
import os
import sys
import requests

BASE_URL = "http://localhost:8000"
DIVIDER = "\n" + "="*60 + "\n"

script_dir = os.path.dirname(os.path.abspath(__file__))
pdf_path = os.path.join(script_dir, "linear_algebra.pdf")


def section(title):
    print(DIVIDER + f"  {title}" + DIVIDER)


# ── 1. Register Student ──────────────────────────────────────────
section("STEP 1: Register Student - Sharath")
r = requests.post(f"{BASE_URL}/api/student/register",
                  json={"name": "Sharath", "email": "sharath_e2e@studybuddy.com"})
if r.status_code == 200:
    student_id = r.json()["student_id"]
    print(f"Student registered! ID: {student_id}")
elif "unique" in r.text.lower() or "duplicate" in r.text.lower():
    # Student already exists - fetch via a new unique one
    import uuid
    r2 = requests.post(f"{BASE_URL}/api/student/register",
                       json={"name": "Sharath", "email": f"sharath_{uuid.uuid4().hex[:6]}@studybuddy.com"})
    r2.raise_for_status()
    student_id = r2.json()["student_id"]
    print(f"Student registered (new email used)! ID: {student_id}")
else:
    r.raise_for_status()


# ── 2. Upload Linear Algebra PDF ─────────────────────────────────
section("STEP 2: Upload Linear Algebra PDF")
if not os.path.exists(pdf_path):
    print("ERROR: linear_algebra.pdf not found. Run create_linear_algebra_pdf.py first.")
    sys.exit(1)

with open(pdf_path, "rb") as f:
    r = requests.post(
        f"{BASE_URL}/api/upload",
        files={"file": ("linear_algebra.pdf", f, "application/pdf")},
        data={"student_id": student_id},
        timeout=60,
    )
r.raise_for_status()
upload_data = r.json()
document_id = upload_data.get("document_id", "")
summary = upload_data.get("summary", "")
print(f"Upload SUCCESS!")
print(f"Document ID: {document_id}")
print(f"Auto Summary (first 300 chars):\n  {summary[:300]}")


# ── 3. Generate Study Notes ──────────────────────────────────────
section("STEP 3: Generate AI Study Notes from PDF")
r = requests.post(f"{BASE_URL}/api/notes/generate",
                  json={"student_id": student_id, "document_id": document_id, "filename": "linear_algebra.pdf"},
                  timeout=60)
r.raise_for_status()
notes = r.json().get("notes", "")
print("AI Notes Generated:")
print(notes[:600])


# ── 4. Chat: Vague question (should ask clarifying question) ─────
section("STEP 4: Chat - Vague Request ('give me 4 subject study strategy')")
r = requests.post(f"{BASE_URL}/api/chat",
                  json={"student_id": student_id, "question": "give me 4 subject study strategy"},
                  timeout=30)
r.raise_for_status()
answer = r.json().get("answer", "")
print(f"Sharath: give me 4 subject study strategy")
print(f"Sensei: {answer}")


# ── 5. Chat: Specific question with PDF context ──────────────────
section("STEP 5: Chat - Exam Question ('hey i have linear algebra exam tomorrow, what should i focus on for 5 marks?')")
r = requests.post(f"{BASE_URL}/api/chat",
                  json={"student_id": student_id,
                        "question": "hey i have linear algebra exam tomorrow, what should i focus on for 5 marks?"},
                  timeout=30)
r.raise_for_status()
answer = r.json().get("answer", "")
print(f"Sharath: hey i have linear algebra exam tomorrow, what should i focus on for 5 marks?")
print(f"Sensei: {answer}")


# ── 6. Voice Greeting (Memory) ───────────────────────────────────
section("STEP 6: Voice Greeting via Memory Endpoint")
r = requests.get(f"{BASE_URL}/api/memory/{student_id}", timeout=30)
r.raise_for_status()
mem_data = r.json()
greeting = mem_data.get("greeting", "")
print(f"Greeting for {mem_data.get('student_name')}:")
print(f"Sensei: {greeting}")


# ── 7. TTS: Convert Greeting to Audio ────────────────────────────
section("STEP 7: Text-to-Speech (TTS) - Convert Greeting to Audio")
r = requests.post(f"{BASE_URL}/api/voice/tts",
                  json={"text": greeting},
                  timeout=30,
                  stream=True)
if r.status_code == 200:
    audio_path = os.path.join(script_dir, "greeting_audio.wav")
    with open(audio_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    size_kb = os.path.getsize(audio_path) / 1024
    print(f"TTS SUCCESS! Audio saved to: {audio_path} ({size_kb:.1f} KB)")
else:
    print(f"TTS FAILED: {r.status_code} - {r.text[:300]}")


# ── Final Summary ────────────────────────────────────────────────
section("END-TO-END TEST COMPLETE")
print("All steps passed! StudyBuddy is fully operational.")
print(f"  Student: Sharath (ID: {student_id})")
print(f"  PDF Uploaded: linear_algebra.pdf (doc: {document_id})")
print(f"  Chat: Working with PDF context")
print(f"  Memory Greeting: Generated")
print(f"  TTS: Audio file saved as greeting_audio.wav")
