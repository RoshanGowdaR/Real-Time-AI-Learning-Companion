"""RAG service - PDF processing and retrieval"""
from pathlib import Path

import fitz
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

VECTORSTORE_DIR = Path("vectorstore")
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
)


def process_pdf(file_path: str, student_id: str) -> str:
    """Extract text from PDF, chunk, save FAISS index, return first 300 chars as summary."""
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()

    if not text.strip():
        return ""

    summary = text.strip()[:300]

    chunks = text_splitter.create_documents([text])
    if not chunks:
        return summary

    student_dir = VECTORSTORE_DIR / student_id
    student_dir.mkdir(parents=True, exist_ok=True)
    index_path = student_dir / "index.faiss"

    if index_path.exists():
        vectorstore = FAISS.load_local(
            str(student_dir), embeddings, allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(chunks)
    else:
        vectorstore = FAISS.from_documents(chunks, embeddings)

    vectorstore.save_local(str(student_dir))
    return summary


def query_rag(question: str, student_id: str) -> str:
    """Load FAISS index, similarity search, return top 3 chunks joined. If no index, return empty string."""
    student_dir = VECTORSTORE_DIR / student_id
    index_path = student_dir / "index.faiss"

    if not index_path.exists():
        return ""

    vectorstore = FAISS.load_local(str(student_dir), embeddings, allow_dangerous_deserialization=True)
    docs = vectorstore.similarity_search(question, k=3)
    return "\n\n".join(d.page_content for d in docs)
