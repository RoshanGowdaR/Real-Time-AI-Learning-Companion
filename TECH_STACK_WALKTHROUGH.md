# StudyBuddy Tech Stack Walkthrough (Implemented Only)

This file lists only technologies that are currently implemented in this codebase.

## Group 1 - Core Language and Server (Backend)

| Technology | Role in project | Evidence in code |
|---|---|---|
| Python | Backend language | `studybuddy-backend/` source tree |
| FastAPI | REST API framework and routing | `studybuddy-backend/main.py`, `studybuddy-backend/routes/` |
| Uvicorn | ASGI server to run FastAPI | backend run command `uvicorn main:app` |
| Pydantic | Request/response models | `studybuddy-backend/models/schemas.py`, `studybuddy-backend/routes/exam.py`, `studybuddy-backend/routes/org.py` |
| python-multipart | File and form upload handling | `studybuddy-backend/routes/upload.py`, `studybuddy-backend/routes/voice.py`, `studybuddy-backend/routes/emotion.py` |
| python-dotenv | Loads .env into runtime config | `studybuddy-backend/config.py` |

## Group 2 - AI and LLM Layer

| Technology | Role in project | Evidence in code |
|---|---|---|
| LangChain | LLM/RAG orchestration base | `studybuddy-backend/services/llm_service.py`, `studybuddy-backend/services/rag_service.py` |
| langchain-groq | Groq connector for LLM calls | `studybuddy-backend/services/llm_service.py` |
| langchain-community | FAISS and embedding integrations | `studybuddy-backend/services/rag_service.py` |
| langchain-text-splitters | Chunking PDF text for RAG | `studybuddy-backend/services/rag_service.py` |
| httpx | HTTP client for model/audio API calls | `studybuddy-backend/services/stt_service.py`, `studybuddy-backend/services/tts_service.py` |

## Group 3 - Vector Search and Embeddings

| Technology | Role in project | Evidence in code |
|---|---|---|
| FAISS | Local vector index for retrieval | `studybuddy-backend/services/rag_service.py` |
| sentence-transformers | Embedding model package | `studybuddy-backend/services/rag_service.py` (`all-MiniLM-L6-v2`) |

## Group 4 - PDF Processing

| Technology | Role in project | Evidence in code |
|---|---|---|
| PyMuPDF (fitz) | Extract text from uploaded PDFs | `studybuddy-backend/services/rag_service.py` |

## Group 5 - Emotion Detection

| Technology | Role in project | Evidence in code |
|---|---|---|
| DeepFace | Emotion analysis from image frames | `studybuddy-backend/routes/emotion.py` |
| OpenCV (opencv-python-headless) | Decode and preprocess uploaded frames | `studybuddy-backend/routes/emotion.py` |
| tf-keras | DeepFace runtime dependency | listed in `studybuddy-backend/requirements.txt` |

## Group 6 - Database

| Technology | Role in project | Evidence in code |
|---|---|---|
| Supabase Python Client | Backend database access layer | `studybuddy-backend/services/supabase_service.py` |

## Group 7 - External APIs Called From Backend

| Service | Role in project | Evidence in code |
|---|---|---|
| Groq API (LLM) | Chat and content generation | `studybuddy-backend/services/llm_service.py` |
| Groq API (STT) | Whisper transcription | `studybuddy-backend/services/stt_service.py` |
| Groq API (TTS) | Speech synthesis | `studybuddy-backend/services/tts_service.py` |
| HuggingFace Hub (indirect) | Model download used by sentence-transformers | triggered by embedding init in `studybuddy-backend/services/rag_service.py` |

## Group 8 - Frontend Layer

| Technology | Role in project | Evidence in code |
|---|---|---|
| React | UI framework | `studybuddy-frontend/src/` |
| Vite | Build tool and dev server | `studybuddy-frontend/vite.config.js`, `studybuddy-frontend/package.json` scripts |
| Tailwind CSS | Utility CSS styling | `studybuddy-frontend/src/index.css`, `studybuddy-frontend/postcss.config.js` |
| React Router DOM | Routing and guarded routes | `studybuddy-frontend/src/App.jsx` |
| Supabase JS Client | Frontend OAuth/auth session integration | `studybuddy-frontend/src/lib/supabase.js`, `studybuddy-frontend/src/pages/Landing.jsx`, `studybuddy-frontend/src/pages/AuthCallback.jsx` |

## Group 9 - Authentication and Security

| Technology | Role in project | Evidence in code |
|---|---|---|
| Supabase Auth (Google OAuth) | Student Google login flow | `studybuddy-frontend/src/pages/Landing.jsx`, `studybuddy-frontend/src/pages/AuthCallback.jsx` |
| hashlib (SHA-256) | Hashing org/teacher passwords | `studybuddy-backend/routes/org.py` |

## Group 10 - Background Jobs and Email

| Technology | Role in project | Evidence in code |
|---|---|---|
| asyncio | Background scheduler loop | `studybuddy-backend/services/scheduler_job.py` |
| smtplib | SMTP email sending | `studybuddy-backend/services/email_service.py` |
| email.mime | HTML email formatting | `studybuddy-backend/services/email_service.py` |

Implementation note: scheduler check interval is 300 seconds (5 minutes) and sends reminders for events around 30 minutes ahead.

## Group 11 - Developer Tools Used in This Repo

| Technology | Role in project | Evidence in code/config |
|---|---|---|
| GitHub/Git | Version control and PR workflow | `.git/` repo and remotes |
| Swagger UI (FastAPI docs) | API inspection and testing at runtime | FastAPI app in `studybuddy-backend/main.py` (available at `/docs`) |
| npm | Frontend package management and scripts | `studybuddy-frontend/package.json` |
| pip | Backend package management | `studybuddy-backend/requirements.txt` |
| requests | Integration test HTTP client | `studybuddy-backend/tests/` |

