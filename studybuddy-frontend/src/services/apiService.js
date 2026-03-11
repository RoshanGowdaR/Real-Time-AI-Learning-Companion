const API_BASE = "http://127.0.0.1:8000/api";

export const apiService = {
  // Student Auth
  register: async (name, email) => {
    const res = await fetch(`${API_BASE}/student/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) throw new Error("Registration failed");
    return res.json();
  },

  // PDF Upload
  upload: async (studentId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("student_id", studentId);

    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  // Chat
  sendMessage: async (studentId, question) => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, question }),
    });
    if (!res.ok) throw new Error("Chat failed");
    return res.json();
  },

  // Notes
  generateNotes: async (studentId, documentId) => {
    const res = await fetch(`${API_BASE}/notes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, document_id: documentId }),
    });
    if (!res.ok) throw new Error("Notes generation failed");
    return res.json();
  },

  // Memory/Greeting
  getGreeting: async (studentId) => {
    const res = await fetch(`${API_BASE}/memory/${studentId}`);
    if (!res.ok) throw new Error("Failed to fetch memory");
    return res.json();
  },

  // TTS
  getSpeech: async (text) => {
    const res = await fetch(`${API_BASE}/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("TTS failed");
    return res.blob();
  }
};
