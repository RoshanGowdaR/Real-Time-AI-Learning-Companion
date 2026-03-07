# StudyBuddy: Your AI-Powered Personal Learning Companion

StudyBuddy is a full-stack AI platform designed to help students learn faster and more effectively by transforming static study materials into interactive, intelligent conversations.

## 🚀 Features

- **📄 Smart PDF Summarization**: Upload your notes and get instant, structured study summaries.
- **🧠 AI Sensei Assistant**: A conversational tutor that answers questions based on your specific study materials.
- **🎙️ Voice Interaction**: Talk to Sensei directly with low-latency speech-to-text and text-to-speech.
- **💾 Study Memory**: Sensei remembers your past sessions and greets you personally with motivational goals.
- **✨ Premium UI**: A modern, dark-themed dashboard with a focused A4 workspace for deep study.

## 🏗️ Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework.
- **Groq API**: Powering LLM (Llama 3.3 70B) and TTS (Orpheus).
- **LangChain & FAISS**: RAG (Retrieval Augmented Generation) for document intelligence.
- **Supabase**: Cloud database for student profiles and study history.

### Frontend
- **React + Vite**: Fast, modern frontend architecture.
- **Tailwind CSS v4**: Sleek, modern styling with glassmorphism effects.
- **React Router**: Seamless navigation between landing and study pages.

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js (LTS)
- Groq API Key
- Supabase Account

### 1. Backend Setup
```bash
cd studybuddy-backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
# Create .env based on .env.example
uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
cd studybuddy-frontend
npm install
npm run dev
```

## 📜 License
MIT
