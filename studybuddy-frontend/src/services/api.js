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

  generateNotes: async (student_id, document_id, filename) => {
    const res = await fetch(`${BASE_URL}/api/notes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, document_id, filename }),
    })
    if (!res.ok) throw await parseError(res, "Notes generation failed")
    return res.json()
  },

  chatQuery: async (student_id, question) => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, question }),
    })
    if (!res.ok) throw await parseError(res, "Chat query failed")
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
