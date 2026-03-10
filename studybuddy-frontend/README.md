# StudyBuddy Frontend: React Learning Workspace

A modern, high-performance web interface for AI-assisted study, built with React 18 and Vite.

## TECHNICAL ARCHITECTURE

### State Management & Communication
- **API Strategy**: Centralized `apiService.js` using Axios for asynchronous backend synchronization.
- **Real-time UX**: React Hooks (useState/useEffect) for managing dynamic workspace states (Notebook, Chat, Flashcards).

### Design Foundation
- **Styling**: Tailwind CSS v4 featuring native CSS variables and high-performance JIT compilation.
- **UI Paradigm**: Focused "A4 Workspace" design intended to mimic physical study environments with digital enhancements.

## CORE MODULES
| Module | Responsibility |
|:---|:---|
| **Dashboard** | Overview of study performance and motivation goals. |
| **WorkspaceView** | Central interaction point for RAG-based note generation. |
| **VoiceOrb** | Logic container for STT/TTS interaction and low-latency feedback. |
| **Sensei** | Contextual chatbot interface with student session memory. |

## DEVELOPMENT WORKFLOW

### Environment Setup
```bash
# Install Dependencies
npm install

# Dev Server (Vite)
npm run dev

# Production Build
npm run build
```

### Integration Points
- **Supabase Integration**: Synchronizes student profiles and interactions.
- **RAG Pipeline**: Proxies PDF notes and search queries to the Python backend for synthesis.

