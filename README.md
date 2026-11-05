# StudyBuddy: Advanced AI-Powered RAG Learning Ecosystem

StudyBuddy is a high-performance, full-stack learning platform that leverages Retrieval-Augmented Generation (RAG) and low-latency LLM orchestration to transform static academic documents into interactive, context-aware digital tutors.

## SYSTEM ARCHITECTURE

| Component | Technology | Role |
|:---|:---|:---|
| **Frontend** | React 18, Vite, Tailwind CSS v4 | High-fidelity UI & Client-side State |
| **Backend** | FastAPI, Python 3.10+ | Asynchronous RESTful API Middleware |
| **Vector Engine** | FAISS, LangChain | Localized Vector Embeddings & Similarity Search |
| **Primary LLM** | Llama 3.3 70B (via Groq) | Contextual Reasoning & Synthesis |
| **Database** | Supabase (PostgreSQL) | Relational Persistence & Identity Management |
| **Voice Ops** | STT/TTS (Groq Whispher/Llama) | Low-latency Audio Processing |

---

## PROJECT STRUCTURE

```text
StudyBudy/
├── studybuddy-backend/      # FastAPI Server, RAG Services, LLM Logic
├── studybuddy-frontend/     # React Client, Vite Build System, UI Components
├── vectorstore/             # Persistent FAISS indices per user
└── README.md                # Root Documentation (this file)
```

---

## CORE TECHNICAL WORKFLOWS

### 1. RAG-Based Knowledge Extraction
- **Ingestion**: PDF documents are uploaded via `/api/upload`.
- **Segmentation**: LangChain's `RecursiveCharacterTextSplitter` breaks down text into optimized chunks.
- **Vectorization**: Chunks are embedded and stored in a local FAISS index uniquely keyed to the `student_id`.
- **Retrieval**: User queries trigger a semantic similarity search across the vector store to fetch relevant context before passing it to the LLM.

### 2. Multi-Mode Search & Synthesis
The platform supports three distinct intelligence modes:
- **PDF Core**: Extraction and summarization directly from uploaded academic materials.
- **Web Intelligence**: Real-time synthesis of external academic concepts using LLM search patterns.
- **Fast Research**: Rapid-fire document analysis for immediate study extraction.

### 3. Voice-First Interaction
Utilizing Groq's low-latency inference, the application provides a "Voice Orb" interface:
- **STT (Speech-to-Text)**: High-accuracy intent capture.
- **TTS (Text-to-Speech)**: Natural-sounding response streaming to reduce cognitive load.

---

## DATABASE SCHEMA (SUPABASE)

| Table | Purpose |
|:---|:---|
| `students` | Core user profiles, authentication, and hash-based identification. |
| `documents` | Metadata for uploaded PDFs including storage paths and processing status. |
| `talks` | Historical record of chat and voice interactions for session memory. |
| `flashcards` | AI-generated repetitive learning units linked to document contexts. |

---

## API REFERENCE (SELECTED ENDPOINTS)

```http
POST /api/chat
Content-Type: application/json
{
  "student_id": "uuid",
  "message": "Explain backpropagation."
}

POST /api/notes/generate
Content-Type: application/json
{
  "student_id": "uuid",
  "query": "Linear Algebra",
  "search_type": "web" | "research" | "pdf"
}
```

---

## SETUP & DEPLOYMENT

### Prerequisites
- Python 3.10+ & Node.js 18+
- API Keys: `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### 1. Backend Initialization
```bash
cd studybuddy-backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Initialization
```bash
cd studybuddy-frontend
npm install
npm run dev
```

## 📜 License
MIT
