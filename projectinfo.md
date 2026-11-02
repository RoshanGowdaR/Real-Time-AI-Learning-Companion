# StudyBuddy Project Info

## 1) Project Idea
StudyBuddy is an AI-powered study ecosystem that turns static academic content into interactive learning experiences. It combines Retrieval-Augmented Generation (RAG), chat, voice, flashcards, schedules, and workspaces so students can learn from their own materials with context-aware responses.

## 2) What the Project Does (Feature Set)

### 2.1 User Accounts and Sessions
- Student registration and login.
- Persistent profile and study session tracking.
- Session memory that can be used to personalize interactions.

How it works:
- Frontend sends login/register requests to the backend.
- Backend stores user profiles in Supabase.
- Session-related data is retrieved on app load to hydrate the UI.

### 2.2 PDF Upload and RAG Knowledge Base
- Upload PDFs to build a personal knowledge base.
- Automatic text extraction, chunking, and embedding.
- FAISS vector indexes stored per student for semantic retrieval.

How it works:
- Frontend uploads PDF files to the backend.
- Backend extracts text, splits into chunks, generates embeddings, and stores them in a local FAISS index keyed by `student_id`.
- Queries use semantic search to retrieve the most relevant chunks and inject them into LLM prompts.

### 2.3 Contextual Chat (Sensei)
- Chat interface grounded in the student’s uploaded materials.
- Query history saved for continuity.

How it works:
- Frontend sends chat requests to the backend.
- Backend runs RAG retrieval and uses the LLM to generate a response.
- Results are stored in Supabase and returned to the client.

### 2.4 Notes Generation (Multi-Mode)
- Generate study notes from:
  - Uploaded PDFs
  - Web search mode
  - Research mode

How it works:
- Frontend selects a mode and sends a notes request.
- Backend uses RAG for PDF mode and LLM synthesis for other modes.
- Notes are returned to the client and stored as needed.

### 2.5 Voice Interaction (STT/TTS)
- Voice-first Q/A with low-latency responses.
- Speech-to-text for input and text-to-speech for output.

How it works:
- Frontend captures audio and sends it to the backend STT endpoint.
- Backend transcribes audio and processes it like a chat request.
- TTS endpoint converts the response text back to audio.

### 2.6 Flashcards and Review Streaks
- Create, edit, delete, and review flashcards.
- AI-assisted answer generation from RAG context.
- Daily review statistics and streak tracking.

How it works:
- Flashcard data is stored in Supabase.
- AI generation uses RAG retrieval to draft an answer before saving.
- Review stats are incremented through dedicated endpoints.

### 2.7 Schedule and Study Planning
- Create and manage study events.
- Weekly timeline and monthly agenda views.

How it works:
- Events are stored in Supabase.
- Backend validates inputs (for example, start and end times cannot be the same).
- Frontend renders events with priority and timeline logic.

### 2.8 Workspaces and Resource Linking
- Create multiple workspaces for different subjects.
- Link documents to workspaces.
- Ensure at least one workspace always exists.

How it works:
- Workspace records are stored in Supabase.
- Linking tables connect documents to workspaces.
- Backend enforces minimum workspace rules.

## 3) End-to-End Flow (High Level)
1. User logs in.
2. App loads user data, documents, workspaces, flashcards, schedule, and memory.
3. User uploads PDFs to build a personal knowledge base.
4. User chats, generates notes, or uses voice to get answers grounded in uploaded content.
5. User creates flashcards and schedules study sessions for review.

## 4) Technologies Used

### Frontend
- React 18
- Vite
- Tailwind CSS v4
- Axios (centralized API client)

### Backend
- FastAPI (Python 3.10+)
- Pydantic v2
- LangChain
- FAISS (vector similarity search)

### Data and Services
- Supabase (PostgreSQL)
- Groq LLM (Llama 3.3 70B)
- STT/TTS services (Groq Whisper + optional ElevenLabs)

## 5) Project Structure (Top Level)
- `studybuddy-frontend/`: React UI, pages, components, services.
- `studybuddy-backend/`: FastAPI server, routes, services, schema SQL, tests.
- `vectorstore/`: Local FAISS indices per student.

## 6) Key Backend APIs (Representative)
- `/api/student/register` and `/api/student/login`
- `/api/upload` for PDF ingestion
- `/api/chat` for contextual chat
- `/api/notes/generate` for notes in PDF/Web/Research modes
- `/api/voice/stt` and `/api/voice/tts` for voice workflows
- `/api/flashcards` CRUD and review stats
- `/api/schedule` for study planning
- `/api/workspaces` for workspace management and links

## 7) Data Model Highlights
- `students`: user profiles
- `documents`: uploaded PDFs and metadata
- `talks`: chat and voice history
- `flashcards`: study cards and review stats
- `schedule_events`: study planning
- `workspaces`: subject-based groupings
- `workspace_documents`: links between workspaces and documents

## 8) What Makes This Project Unique
- Combines RAG with full study workflows (chat, notes, flashcards, schedule).
- Supports both text and voice interactions.
- Keeps learning context grounded in user-owned resources.
- Provides a single workspace UX for academic focus.
