"""RAG service - PDF processing and retrieval"""
from pathlib import Path

import fitz
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

from config import VECTORSTORE_DIR
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

_embeddings = None
_text_splitter = None


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    return _embeddings


def _get_text_splitter():
    global _text_splitter
    if _text_splitter is None:
        _text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
        )
    return _text_splitter


# Backward compatibility handles
class _LazyEmbeddings:
    def __getattr__(self, name):
        return getattr(_get_embeddings(), name)


embeddings = _LazyEmbeddings()



def extract_pdf_text(file_path: str) -> str:
    """Extract plain text from a PDF file."""
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def get_document_text(file_path: Path, student_id: str | None = None) -> str:
    """Extract plain text from PDF. If scanned or empty, retrieve cached text, DB summary, or synthesized study notes."""
    text = extract_pdf_text(str(file_path))
    if text.strip():
        return text.strip()

    # Check local cache file
    cache_dir = VECTORSTORE_DIR / "_doc_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{file_path.stem}.txt"
    if cache_file.exists():
        try:
            cached = cache_file.read_text(encoding="utf-8")
            if cached.strip():
                return cached.strip()
        except Exception:
            pass

    # Check database summary or notes
    filename = file_path.name
    if student_id:
        try:
            from services import supabase_service
            docs = supabase_service.get_documents(student_id)
            for d in docs:
                if d.get("filename", "").lower() == filename.lower() and d.get("summary"):
                    text = str(d.get("summary")).strip()
                    if text:
                        return text
        except Exception:
            pass

    # Synthesize study notes from title as fallback for image-only scans
    clean_title = file_path.stem.replace("_", " ").strip()
    try:
        from services.llm_service import search_and_synthesize
        synthesized = search_and_synthesize(clean_title, "research")
        if synthesized.strip():
            try:
                cache_file.write_text(synthesized.strip(), encoding="utf-8")
            except Exception:
                pass
            return synthesized.strip()
    except Exception as e:
        print(f"[RAG] Fallback synthesis error for {filename}: {e}")

    return ""


def process_pdf(file_path: str, student_id: str) -> str:
    """Extract text from PDF, chunk, save FAISS index, return first 300 chars as summary."""
    p = Path(file_path)
    text = get_document_text(p, student_id)

    if not text.strip():
        return ""

    summary = text.strip()[:300]

    chunks = _get_text_splitter().create_documents([text])
    if not chunks:
        return summary

    student_dir = VECTORSTORE_DIR / student_id
    student_dir.mkdir(parents=True, exist_ok=True)
    index_path = student_dir / "index.faiss"

    if index_path.exists():
        vectorstore = FAISS.load_local(
            str(student_dir), _get_embeddings(), allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(chunks)
    else:
        vectorstore = FAISS.from_documents(chunks, _get_embeddings())

    vectorstore.save_local(str(student_dir))
    return summary


def rebuild_student_index(student_id: str, file_paths: list[str]) -> None:
    """Rebuild a student's FAISS index from remaining PDF files."""
    student_dir = VECTORSTORE_DIR / student_id
    student_dir.mkdir(parents=True, exist_ok=True)

    documents = []
    for raw_path in file_paths:
        file_path = Path(raw_path)
        if not file_path.exists():
            continue

        text = get_document_text(file_path, student_id)
        if not text:
            continue

        documents.extend(_get_text_splitter().create_documents([text]))

    index_file = student_dir / "index.faiss"
    pickle_file = student_dir / "index.pkl"

    if not documents:
        if index_file.exists():
            index_file.unlink()
        if pickle_file.exists():
            pickle_file.unlink()
        return

    vectorstore = FAISS.from_documents(documents, _get_embeddings())
    vectorstore.save_local(str(student_dir))


def query_rag(
    question: str,
    student_id: str | None = None,
    document_name: str | None = None,
    active_notes: str | None = None,
) -> str:
    """
    Load FAISS index, perform similarity search on cleaned query,
    and return joined top chunks. Never leaks cross-student indexes.
    """
    import re
    from config import UPLOADS_DIR

    student_dir = VECTORSTORE_DIR / student_id if student_id else None
    target_dir = None

    # 1. Check student-specific vectorstore directory
    if student_dir and (student_dir / "index.faiss").exists():
        target_dir = student_dir
    else:
        # Check if student has documents in database and auto-rebuild index
        if student_id:
            try:
                from services import supabase_service
                student_docs = supabase_service.get_documents(student_id)
                if student_docs:
                    pdf_paths = [
                        str(UPLOADS_DIR / d["filename"])
                        for d in student_docs
                        if d.get("filename") and (UPLOADS_DIR / d["filename"]).exists()
                    ]
                    if pdf_paths:
                        rebuild_student_index(student_id, pdf_paths)
                        if (student_dir / "index.faiss").exists():
                            target_dir = student_dir
            except Exception as rebuild_err:
                print(f"[RAG] Rebuild error: {rebuild_err}")

    # If student index is still missing, check if specific document exists in uploads
    if not target_dir and document_name:
        doc_path = UPLOADS_DIR / document_name
        if doc_path.exists():
            try:
                temp_id = student_id or "temp_doc"
                process_pdf(str(doc_path), temp_id)
                temp_dir = VECTORSTORE_DIR / temp_id
                if (temp_dir / "index.faiss").exists():
                    target_dir = temp_dir
            except Exception as doc_err:
                print(f"[RAG] Document index error: {doc_err}")

    # If no target directory, check if active_notes was provided
    if not target_dir or not (target_dir / "index.faiss").exists():
        if active_notes and active_notes.strip():
            # Return active notes directly as context
            return active_notes.strip()[:3000]
        return ""

    try:
        vectorstore = FAISS.load_local(
            str(target_dir), _get_embeddings(), allow_dangerous_deserialization=True
        )

        # Normalize query: strip RAG prompt directives so similarity matches the actual topic
        clean_q = question
        patterns = [
            r"according to the pdf",
            r"according to pdf",
            r"from the pdf",
            r"from the notes",
            r"in the pdf",
            r"using the pdf",
            r"just use the pdf to (give|find|tell) answers?",
            r"just use the pdf",
            r"only use the pdf",
            r"tell me from the pdf",
            r"explain according to the pdf",
            r"based on the pdf",
            r"from my uploaded (resources|files?|notes?|documents?)",
            r"based on the uploaded (resources|files?|notes?|documents?)",
        ]
        for pat in patterns:
            clean_q = re.sub(pat, "", clean_q, flags=re.IGNORECASE).strip()

        if not clean_q or len(clean_q) < 3:
            clean_q = question

        # Similarity search with clean query (k=4) + raw question (k=2)
        docs_clean = vectorstore.similarity_search(clean_q, k=4)
        docs_raw = vectorstore.similarity_search(question, k=2) if clean_q != question else []

        seen_chunks = set()
        chunks = []
        for d in docs_clean + docs_raw:
            text = (d.page_content or "").strip()
            if text and text not in seen_chunks:
                seen_chunks.add(text)
                chunks.append(text)

        return "\n\n".join(chunks[:6])
    except Exception as exc:
        print(f"[RAG] Retrieval error: {exc}")
        return ""
