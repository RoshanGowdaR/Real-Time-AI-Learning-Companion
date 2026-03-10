# StudyBuddy REST API

## Setup

Create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Add a `.env` file with your keys (copy from `.env.example`):

```
GROQ_API_KEY=your_groq_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Run

```bash
uvicorn main:app --reload
```

## Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | / | Health check |
| POST | /api/student/register | Register new student |
| GET | /api/student/{student_id} | Get student by ID |
| POST | /api/upload | Upload PDF, process with RAG |
| POST | /api/chat | Chat with RAG context |
| POST | /api/notes/generate | Generate notes from PDF |
| POST | /api/voice/stt | Speech-to-text (transcribe audio) |
| POST | /api/voice/tts | Text-to-speech |
| GET | /api/memory/{student_id} | Get greeting and recent sessions |
| POST | /api/memory/session | Save study session |
