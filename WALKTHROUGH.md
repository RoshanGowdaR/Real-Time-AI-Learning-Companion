# StudyBuddy Walkthrough

Hey hi, I am Copilot. This document gives a full walkthrough of the StudyBuddy project: what was updated, what is working, and how the app works end-to-end.

## 1) Project Overview

StudyBuddy is a full-stack AI study platform with:
- A React frontend (`studybuddy-frontend`) for workspace, flashcards, schedule, library, and voice interaction.
- A FastAPI backend (`studybuddy-backend`) for auth, upload, notes generation, chat, memory, voice, flashcards, schedule, and workspace APIs.
- Supabase (PostgreSQL) for relational persistence.
- Local FAISS vector store for retrieval-augmented generation (RAG) context.

## 2) Repo Structure

- `studybuddy-backend/`: API server, routes, services, schema SQL, integration tests.
- `studybuddy-frontend/`: React app (Vite), API client, UI components.
- `README.md`: high-level project summary.

## 3) Prerequisites

- Python 3.10+ (project currently tested via local `.venv`).
- Node.js 18+.
- Supabase project.
- API keys configured in backend `.env`.

Backend env variables required:
- `GROQ_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ELEVENLABS_API_KEY` (for TTS if using ElevenLabs)

## 4) One-Time Setup

### 4.1 Backend setup (PowerShell)

```powershell
Set-Location studybuddy-backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
```

### 4.2 Supabase schema setup

Run `studybuddy-backend/supabase_schema.sql` in Supabase SQL Editor.

If only partial setup is needed:
- `studybuddy-backend/supabase_patch_flashcards.sql`
- `studybuddy-backend/supabase_patch_schedule_events.sql`

These scripts include `select pg_notify('pgrst', 'reload schema');` so PostgREST picks up table changes immediately.

### 4.3 Frontend setup (PowerShell)

```powershell
Set-Location studybuddy-frontend
npm install
```

## 5) Run Locally

### 5.1 Start backend

```powershell
Set-Location studybuddy-backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Health check:

```powershell
curl.exe http://localhost:8000/
```

Expected:

```json
{"status":"ok","message":"StudyBuddy API Running"}
```

### 5.2 Start frontend

```powershell
Set-Location studybuddy-frontend
npm run dev
```

Frontend API base defaults to `http://localhost:8000` unless `VITE_API_BASE_URL` is set.

## 6) End-to-End Product Walkthrough

### Step 1: Register or log in

Frontend calls:
- `POST /api/student/register`
- `POST /api/student/login`

Backend route: `studybuddy-backend/routes/student.py`

### Step 2: Initial app hydration

After login, `MainApp` fetches in parallel:
- memory greeting and sessions
- documents
- workspaces
- workspace-document links
- flashcards
- review stats
- schedule events
- talk history

Frontend file: `studybuddy-frontend/src/pages/MainApp.jsx`

### Step 3: Upload PDF resources

Frontend uploads PDF with form-data:
- `POST /api/upload`

Backend processes and stores:
- document metadata in Supabase
- vector index in local `studybuddy-backend/vectorstore/<student_id>/`

### Step 4: Generate notes

Frontend calls:
- `POST /api/notes/generate`

Modes supported include PDF context and search modes (web/research based on request payload).

### Step 5: Chat with Sensei

Frontend calls:
- `POST /api/chat`

Backend can use RAG context from uploaded resources. Chat history is persisted via backend services.

### Step 6: Voice interaction

Frontend VoiceOrb uses:
- `POST /api/voice/stt`
- `POST /api/voice/tts`

Voice Q/A is reflected in chat history state.

### Step 7: Flashcards workflow

APIs:
- `GET /api/flashcards/{student_id}`
- `POST /api/flashcards`
- `PATCH /api/flashcards/{student_id}/{flashcard_id}`
- `DELETE /api/flashcards/{student_id}/{flashcard_id}`
- `GET /api/flashcards/{student_id}/review-stats`
- `POST /api/flashcards/{student_id}/review-stats/increment`

New AI answer generation flow:
- `POST /api/flashcards/{student_id}/generate-answer`
- Backend retrieves context with `query_rag()` and generates answer with `generate_flashcard_answer()`.
- Frontend fills generated answer into create-card form before save.

### Step 8: Schedule workflow

APIs:
- `GET /api/schedule/{student_id}`
- `POST /api/schedule`
- `DELETE /api/schedule/{student_id}/{event_id}`

Validation:
- start and end time cannot be the same.
- overnight spans are represented in frontend timeline logic.

### Step 9: Workspaces and resource links

APIs:
- `GET /api/workspaces/{student_id}`
- `POST /api/workspaces`
- `DELETE /api/workspaces/{student_id}/{workspace_id}`
- `GET /api/workspaces/{student_id}/documents`
- `POST /api/workspaces/{student_id}/{workspace_id}/documents/{document_id}`
- `DELETE /api/workspaces/{student_id}/{workspace_id}/documents/{document_id}`

Behavior:
- backend ensures at least one workspace remains.
- frontend filters workspace resources from global library documents.

## 7) Recent Updates Included In This Branch

Backend updates:
- Added `FlashcardGenerateAnswerRequest` schema.
- Added flashcard AI answer generation endpoint.
- Added actionable Supabase table-missing error mapping (`PGRST205` -> clear setup guidance).
- Added schedule validation for equal start/end time.
- Added `generate_flashcard_answer()` in `llm_service.py`.
- Added PostgREST schema reload notify in SQL.        
- Added flashcards and schedule patch SQL scripts.

Frontend updates:
- `api.js` now normalizes backend errors with clearer user messages.
- `api.js` now supports `generateFlashcardAnswer()`.
- `MainApp.jsx` wires AI answer generation callback into flashcards view.
- `FlashcardsView.jsx` redesign:
  - AI Generate Answer button
  - front/back toggle controls
  - deck list and quick card selection
  - dynamic daily goal target
- `ScheduleView.jsx` redesign:
  - improved mission-control layout
  - weekly timeline board + monthly agenda
  - richer event visual states and delete controls

## 8) Verified Working Status

Validation snapshot performed locally:
- Backend integration scripts: `6/7` passing using `.venv`.
- Frontend production build: passing (`npm run build`).
- Editor diagnostic check: no immediate code errors.

Passing backend scripts:
- `test_student.py`
- `test_upload.py`
- `test_chat.py`
- `test_memory.py`
- `test_notes.py`
- `test_voice_tts.py`

Known failing script:
- `test_e2e.py`

Reason:
- It can fail at registration if the email already exists and its fallback condition does not match the current `409` message (`"Email already registered. Please log in."`).

## 9) Troubleshooting Guide

- Problem: `python -m uvicorn ...` says module not found.
  - Fix: use project interpreter: `.\.venv\Scripts\python.exe -m uvicorn main:app ...`

- Problem: API returns table-not-found (`PGRST205`).
  - Fix: run `studybuddy-backend/supabase_schema.sql` (recommended) or the patch SQL scripts.

- Problem: integration tests fail with connection refused.
  - Fix: wait until backend startup is complete, then verify `GET /` before running tests.

- Problem: `pytest` missing.
  - Note: this repo primarily uses script-based tests in `studybuddy-backend/tests/`.

## 10) Useful Test Commands

Run all backend integration scripts:

```powershell
Set-Location studybuddy-backend
.\.venv\Scripts\python.exe tests\run_all_tests.py
```

Run frontend build check:

```powershell
Set-Location studybuddy-frontend
npm run build
```

## 11) Hand-off Summary

Current state is stable for core workflows:
- auth, upload, notes, chat, memory, voice, flashcards, schedule, workspace links.
- new flashcard AI answer generation is wired backend + frontend.
- one end-to-end test script needs duplicate-email handling refinement.
