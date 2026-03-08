# StudyBuddy Backend: FastAPI RAG Middleware

High-performance asynchronous API designed for document intelligence, vector retrieval, and LLM orchestration.

## CORE TECHNOLOGIES
- **Framework**: FastAPI (Pydantic v2)
- **Intelligence**: LangChain, Groq (Llama-3.3-70b-versatile)
- **Storage**: Supabase (PostgreSQL), Local FAISS (Vector Store)
- **Processing**: PyMuPDF (PDF Extraction), Whisper (Audio)

## DATA MODELS (SCHEMAS)
| Schema | Use Case |
|:---|:---|
| `StudentBase` | Identity management and login |
| `ChatRequest` | Contextual RAG prompting |
| `NotesRequest` | Multi-mode (Web/Research/PDF) synthesis |
| `FlashcardResponse` | AI-generated study aids |

## SYSTEM WORKFLOW (RAG)
1. **Document Loading**: `PyMuPDFLoader` parses raw PDF data.
2. **Text Splitting**: `RecursiveCharacterTextSplitter` ensures chunk size is optimized for LLM context windows.
3. **Embeddings**: Utilizes high-dimensional vector representations for semantic search.
4. **Context Injection**: Retrieves top-k relevant fragments to ground LLM responses, preventing hallucination.

## INSTALLATION & EXECUTION
```bash
# Environment
python -m venv .venv
.\.venv\Scripts\activate

# Dependencies
pip install -r requirements.txt

# Environment Configuration (.env)
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Production Server
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
```

## FEATURE SET & ENDPOINTS
- **Student API**: Management of profiles and session persistence.
- **RAG API**: PDF ingestion and semantic querying.
- **Notes API**: Multi-strategy synthesis (PDF/Research/Web).
- **Voice API**: Real-time STT/TTS processing.

| POST | /api/flashcards | Create flashcard |
| PATCH | /api/flashcards/{student_id}/{flashcard_id} | Update flashcard |
| DELETE | /api/flashcards/{student_id}/{flashcard_id} | Delete flashcard |
| GET | /api/flashcards/{student_id}/review-stats | Get review streak/history |
| POST | /api/flashcards/{student_id}/review-stats/increment | Increment daily review count |
| GET | /api/schedule/{student_id} | List custom schedule events |
| POST | /api/schedule | Create schedule event |
| DELETE | /api/schedule/{student_id}/{event_id} | Delete schedule event |
| GET | /api/workspaces/{student_id} | List workspaces |
| POST | /api/workspaces | Create workspace |
| DELETE | /api/workspaces/{student_id}/{workspace_id} | Delete workspace |
| GET | /api/workspaces/{student_id}/documents | List workspace-resource links |
| POST | /api/workspaces/{student_id}/{workspace_id}/documents/{document_id} | Assign resource to workspace |
| DELETE | /api/workspaces/{student_id}/{workspace_id}/documents/{document_id} | Remove resource from workspace |
| POST | /api/notes/generate | Generate notes from PDF |
| POST | /api/voice/stt | Speech-to-text (transcribe audio) |
| POST | /api/voice/tts | Text-to-speech |
| GET | /api/memory/{student_id} | Get greeting and recent sessions |
| POST | /api/memory/session | Save study session |

## cURL Examples

Set values first in PowerShell:

```powershell
$BASE = "http://localhost:8000"
$STUDENT_ID = "<student-uuid>"
$DOC_ID = "<document-uuid>"
$TALK_ID = "<talk-uuid>"
$FLASHCARD_ID = "<flashcard-uuid>"
$EVENT_ID = "<schedule-event-uuid>"
$WORKSPACE_ID = "<workspace-uuid>"
```

Register:

```powershell
curl.exe -X POST "$BASE/api/student/register" -H "Content-Type: application/json" -d "{\"name\":\"Asha\",\"email\":\"asha@example.com\"}"
```

Upload PDF (insert resource):

```powershell
curl.exe -X POST "$BASE/api/upload" -F "student_id=$STUDENT_ID" -F "file=@C:/path/to/notes.pdf"
```

List resources:

```powershell
curl.exe "$BASE/api/documents/$STUDENT_ID"
```

Update resource metadata:

```powershell
curl.exe -X PUT "$BASE/api/documents/$STUDENT_ID/$DOC_ID" -H "Content-Type: application/json" -d "{\"summary\":\"Updated summary from cURL\"}"
```

Delete resource:

```powershell
curl.exe -X DELETE "$BASE/api/documents/$STUDENT_ID/$DOC_ID"
```

Create talk (chat text):

```powershell
curl.exe -X POST "$BASE/api/chat" -H "Content-Type: application/json" -d "{\"student_id\":\"$STUDENT_ID\",\"question\":\"Summarize my PDF\",\"source\":\"text\"}"
```

List talks:

```powershell
curl.exe "$BASE/api/talks/$STUDENT_ID?limit=50"
```

Delete one talk:

```powershell
curl.exe -X DELETE "$BASE/api/talks/$STUDENT_ID/$TALK_ID"
```

Delete all talks:

```powershell
curl.exe -X DELETE "$BASE/api/talks/$STUDENT_ID"
```

Create flashcard:

```powershell
curl.exe -X POST "$BASE/api/flashcards" -H "Content-Type: application/json" -d "{\"student_id\":\"$STUDENT_ID\",\"subject\":\"DSA\",\"question\":\"What is BFS?\",\"answer\":\"Breadth-first graph traversal\"}"
```

List flashcards:

```powershell
curl.exe "$BASE/api/flashcards/$STUDENT_ID"
```

Update flashcard (mastered=true):

```powershell
curl.exe -X PATCH "$BASE/api/flashcards/$STUDENT_ID/$FLASHCARD_ID" -H "Content-Type: application/json" -d "{\"mastered\":true}"
```

Increment review stats:

```powershell
curl.exe -X POST "$BASE/api/flashcards/$STUDENT_ID/review-stats/increment"
```

Create schedule event:

```powershell
curl.exe -X POST "$BASE/api/schedule" -H "Content-Type: application/json" -d "{\"student_id\":\"$STUDENT_ID\",\"title\":\"Graphs Revision\",\"subject\":\"DSA\",\"date\":\"2026-03-10\",\"start_time\":\"18:00\",\"end_time\":\"19:00\",\"priority\":\"high\"}"
```

List schedule events:

```powershell
curl.exe "$BASE/api/schedule/$STUDENT_ID"
```

Delete schedule event:

```powershell
curl.exe -X DELETE "$BASE/api/schedule/$STUDENT_ID/$EVENT_ID"
```

Create workspace:

```powershell
curl.exe -X POST "$BASE/api/workspaces" -H "Content-Type: application/json" -d "{\"student_id\":\"$STUDENT_ID\",\"name\":\"Linear Algebra\"}"
```

Assign resource to workspace:

```powershell
curl.exe -X POST "$BASE/api/workspaces/$STUDENT_ID/$WORKSPACE_ID/documents/$DOC_ID"
```

List workspace-resource links:

```powershell
curl.exe "$BASE/api/workspaces/$STUDENT_ID/documents"
```
