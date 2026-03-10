const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"

async function parseError(res, fallbackMessage) {
  try {
    const data = await res.json()
    return new Error(data.detail || data.error || fallbackMessage)
  } catch {
    return new Error(fallbackMessage)
  }
}

export const api = {
  registerStudent: async (name, email) => {
    const res = await fetch(`${BASE_URL}/api/student/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    })
    if (!res.ok) throw await parseError(res, "Registration failed")
    return res.json()
  },

  loginStudent: async (email) => {
    const res = await fetch(`${BASE_URL}/api/student/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) throw await parseError(res, "Login failed")
    return res.json()
  },

  getMemory: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/memory/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch memory")
    return res.json()
  },

  uploadPDF: async (file, student_id) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("student_id", student_id)
    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    })
    if (!res.ok) throw await parseError(res, "Upload failed")
    return res.json()
  },

  getDocuments: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/documents/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch documents")
    return res.json()
  },

  updateDocument: async (student_id, document_id, updates) => {
    const res = await fetch(`${BASE_URL}/api/documents/${student_id}/${document_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw await parseError(res, "Failed to update document")
    return res.json()
  },

  deleteDocument: async (student_id, document_id) => {
    const res = await fetch(`${BASE_URL}/api/documents/${student_id}/${document_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete document")
    return res.json()
  },

  generateNotes: async (student_id, document_id, filename, options = {}) => {
    const { query, search_type } = options
    const res = await fetch(`${BASE_URL}/api/notes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, document_id, filename, query, search_type }),
    })
    if (!res.ok) throw await parseError(res, "Notes generation failed")
    return res.json()
  },

  chatQuery: async (student_id, question, source = "text") => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, question, source }),
    })
    if (!res.ok) throw await parseError(res, "Chat query failed")
    return res.json()
  },

  getTalks: async (student_id, limit = 100) => {
    const res = await fetch(`${BASE_URL}/api/talks/${student_id}?limit=${limit}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch talks")
    return res.json()
  },

  deleteTalk: async (student_id, talk_id) => {
    const res = await fetch(`${BASE_URL}/api/talks/${student_id}/${talk_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete talk")
    return res.json()
  },

  clearTalks: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/talks/${student_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to clear talks")
    return res.json()
  },

  getFlashcards: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/flashcards/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch flashcards")
    return res.json()
  },

  createFlashcard: async (student_id, payload) => {
    const res = await fetch(`${BASE_URL}/api/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, ...payload }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create flashcard")
    return res.json()
  },

  updateFlashcard: async (student_id, flashcard_id, updates) => {
    const res = await fetch(`${BASE_URL}/api/flashcards/${student_id}/${flashcard_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw await parseError(res, "Failed to update flashcard")
    return res.json()
  },

  deleteFlashcard: async (student_id, flashcard_id) => {
    const res = await fetch(`${BASE_URL}/api/flashcards/${student_id}/${flashcard_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete flashcard")
    return res.json()
  },

  getFlashcardReviewStats: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/flashcards/${student_id}/review-stats`)
    if (!res.ok) throw await parseError(res, "Failed to fetch review stats")
    return res.json()
  },

  incrementFlashcardReviewStats: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/flashcards/${student_id}/review-stats/increment`, {
      method: "POST",
    })
    if (!res.ok) throw await parseError(res, "Failed to update review stats")
    return res.json()
  },

  getScheduleEvents: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/schedule/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch schedule")
    return res.json()
  },

  createScheduleEvent: async (student_id, event) => {
    const res = await fetch(`${BASE_URL}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id,
        title: event.title,
        subject: event.subject,
        date: event.date,
        start_time: event.startTime,
        end_time: event.endTime,
        priority: event.priority,
      }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create schedule event")
    return res.json()
  },

  deleteScheduleEvent: async (student_id, event_id) => {
    const res = await fetch(`${BASE_URL}/api/schedule/${student_id}/${event_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete schedule event")
    return res.json()
  },

  getWorkspaces: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/workspaces/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch workspaces")
    return res.json()
  },

  createWorkspace: async (student_id, name, workspace_id) => {
    const res = await fetch(`${BASE_URL}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, name, workspace_id }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create workspace")
    return res.json()
  },

  deleteWorkspace: async (student_id, workspace_id) => {
    const res = await fetch(`${BASE_URL}/api/workspaces/${student_id}/${workspace_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete workspace")
    return res.json()
  },

  getWorkspaceDocumentLinks: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/workspaces/${student_id}/documents`)
    if (!res.ok) throw await parseError(res, "Failed to fetch workspace resource links")
    return res.json()
  },

  assignDocumentToWorkspace: async (student_id, workspace_id, document_id) => {
    const res = await fetch(`${BASE_URL}/api/workspaces/${student_id}/${workspace_id}/documents/${document_id}`, {
      method: "POST",
    })
    if (!res.ok) throw await parseError(res, "Failed to assign resource to workspace")
    return res.json()
  },

  removeDocumentFromWorkspace: async (student_id, workspace_id, document_id) => {
    const res = await fetch(`${BASE_URL}/api/workspaces/${student_id}/${workspace_id}/documents/${document_id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to unassign resource from workspace")
    return res.json()
  },

  speechToText: async (audioBlob) => {
    const formData = new FormData()
    formData.append("file", audioBlob, "audio.webm")
    const res = await fetch(`${BASE_URL}/api/voice/stt`, {
      method: "POST",
      body: formData,
    })
    if (!res.ok) throw await parseError(res, "STT failed")
    return res.json()
  },

  textToSpeech: async (text) => {
    const res = await fetch(`${BASE_URL}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw await parseError(res, "TTS failed")
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  saveSession: async (student_id, topics_covered, goals, duration_mins) => {
    const res = await fetch(`${BASE_URL}/api/memory/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, topics_covered, goals, duration_mins }),
    })
    if (!res.ok) throw await parseError(res, "Session save failed")
    return res.json()
  }
}
