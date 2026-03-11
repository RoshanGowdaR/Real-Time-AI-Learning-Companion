function resolveRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000"
  }

  const host = window.location.hostname
  const protocol = window.location.protocol || "http:"
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1"

  if (isLocal || !host) {
    // Use IPv4 explicitly to avoid localhost resolving to ::1 while backend listens on 127.0.0.1.
    return "http://127.0.0.1:8000"
  }

  return `${protocol}//${host}:8000`
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || resolveRuntimeApiBaseUrl()
const LOCAL_BASE_FALLBACKS = ["http://127.0.0.1:8000", "http://localhost:8000"]

async function fetchWithLocalFallback(path, init) {
  const primaryUrl = `${BASE_URL}${path}`

  try {
    return await fetch(primaryUrl, init)
  } catch {
    const remainingBases = LOCAL_BASE_FALLBACKS.filter((base) => base !== BASE_URL)

    for (const fallbackBase of remainingBases) {
      try {
        return await fetch(`${fallbackBase}${path}`, init)
      } catch {
        // Continue trying fallbacks.
      }
    }

    throw new Error(
      `Failed to reach backend API. Checked ${BASE_URL} and local fallbacks. ` +
      "Ensure backend is running on port 8000 or set VITE_API_BASE_URL correctly."
    )
  }
}

function normalizeKnownErrorMessage(rawMessage) {
  const message = String(rawMessage || "").trim()
  const lowered = message.toLowerCase()

  const missingTableError = lowered.includes("pgrst205") || lowered.includes("could not find the table")
  if (!missingTableError) {
    return message
  }

  const tableMatch = lowered.match(/public\.([a-z_][a-z0-9_]*)/)
  const tableName = tableMatch?.[1]

  if (tableName === "schedule_events") {
    return "Schedule storage is not set up yet. Run studybuddy-backend/supabase_schema.sql in Supabase SQL Editor once (recommended), or run studybuddy-backend/supabase_patch_schedule_events.sql, then retry."
  }

  if (tableName === "flashcards" || tableName === "flashcard_review_days") {
    return "Flashcards storage is not set up yet. Run studybuddy-backend/supabase_schema.sql in Supabase SQL Editor once (recommended), or run studybuddy-backend/supabase_patch_flashcards.sql, then retry."
  }

  if (tableName) {
    return `Database table public.${tableName} is not set up yet. Run studybuddy-backend/supabase_schema.sql in Supabase SQL Editor, then retry.`
  }

  return message
}

function toErrorMessage(payload, fallbackMessage) {
  const candidate = payload?.detail ?? payload?.error ?? payload?.message ?? payload

  if (!candidate) return fallbackMessage

  if (typeof candidate === "string") {
    return normalizeKnownErrorMessage(candidate) || fallbackMessage
  }

  if (Array.isArray(candidate)) {
    const joined = candidate
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item.msg === "string") return item.msg
        if (item && typeof item.message === "string") return item.message
        return ""
      })
      .filter(Boolean)
      .join("; ")

    return joined || fallbackMessage
  }

  if (typeof candidate === "object") {
    const objectMessage = candidate.message || candidate.detail
    if (typeof objectMessage === "string") {
      return normalizeKnownErrorMessage(objectMessage) || fallbackMessage
    }
  }

  return fallbackMessage
}

async function parseError(res, fallbackMessage) {
  try {
    const data = await res.json()
    return new Error(toErrorMessage(data, fallbackMessage))
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

  generateFlashcardAnswer: async (student_id, payload) => {
    const res = await fetch(`${BASE_URL}/api/flashcards/${student_id}/generate-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: payload.subject,
        question: payload.question,
      }),
    })
    if (!res.ok) throw await parseError(res, "Failed to generate flashcard answer")
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

  analyzeEmotion: async (imageBlob, student_id) => {
    const formData = new FormData()
    formData.append("file", imageBlob, "frame.jpg")
    formData.append("student_id", student_id)

    const res = await fetch(`${BASE_URL}/api/emotion/analyze`, {
      method: "POST",
      body: formData,
    })
    if (!res.ok) throw await parseError(res, "Emotion analysis failed")
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
  },

  createOrg: async (name, description = "") => {
    const res = await fetch(`${BASE_URL}/api/org/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create organization")
    return res.json()
  },

  orgAdminRegister: async ({ name, description = "", email, password }) => {
    const res = await fetchWithLocalFallback('/api/org/admin/register', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, email, password }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create organization admin account")
    return res.json()
  },

  orgAdminLogin: async (email, password) => {
    const res = await fetchWithLocalFallback('/api/org/admin/login', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw await parseError(res, "Organization login failed")
    return res.json()
  },

  registerTeacher: async ({ org_id, email, full_name, password, subject_name }) => {
    const res = await fetch(`${BASE_URL}/api/org/register-teacher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id, email, full_name, password, subject_name }),
    })
    if (!res.ok) throw await parseError(res, "Failed to register teacher")
    return res.json()
  },

  teacherLogin: async (email, password) => {
    const res = await fetch(`${BASE_URL}/api/org/teacher/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw await parseError(res, "Teacher login failed")
    return res.json()
  },

  deleteTeacher: async (org_id, teacher_id) => {
    const res = await fetch(`${BASE_URL}/api/org/teacher/${teacher_id}?org_id=${encodeURIComponent(org_id)}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete teacher")
    return res.json()
  },

  joinSubject: async (subject_code, student_id) => {
    const res = await fetch(`${BASE_URL}/api/subject/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_code, student_id }),
    })
    if (!res.ok) throw await parseError(res, "Failed to request subject join")
    return res.json()
  },

  getStudentSubjects: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/subject/student/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch student subjects")
    return res.json()
  },

  getSubjectPending: async (subject_id) => {
    const res = await fetch(`${BASE_URL}/api/subject/${subject_id}/pending`)
    if (!res.ok) throw await parseError(res, "Failed to fetch subject pending requests")
    return res.json()
  },

  updateSubjectEnrollmentStatus: async (enrollment_id, status) => {
    const res = await fetch(`${BASE_URL}/api/subject/enrollment/${enrollment_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw await parseError(res, "Failed to update enrollment status")
    return res.json()
  },

  joinOrg: async (invite_code, student_id) => {
    const res = await fetch(`${BASE_URL}/api/org/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code, student_id }),
    })
    if (!res.ok) throw await parseError(res, "Failed to join organization")
    return res.json()
  },

  getOrgPending: async (org_id) => {
    const res = await fetch(`${BASE_URL}/api/org/${org_id}/pending`)
    if (!res.ok) throw await parseError(res, "Failed to fetch pending members")
    return res.json()
  },

  updateOrgMemberStatus: async (member_id, status) => {
    const res = await fetch(`${BASE_URL}/api/org/member/${member_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw await parseError(res, "Failed to update member status")
    return res.json()
  },

  getStudentOrgs: async (student_id) => {
    const res = await fetch(`${BASE_URL}/api/org/student/${student_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch student organizations")
    return res.json()
  },

  getOrgSubjects: async (org_id) => {
    const res = await fetch(`${BASE_URL}/api/org/${org_id}/subjects`)
    if (!res.ok) throw await parseError(res, "Failed to fetch organization subjects")
    return res.json()
  },

  getOrgById: async (org_id) => {
    const res = await fetch(`${BASE_URL}/api/org/${org_id}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch organization")
    return res.json()
  },

  getAnnouncements: async (subjectId) => {
    const res = await fetch(`${BASE_URL}/api/announcements/${subjectId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch announcements")
    return res.json()
  },

  getAssignments: async (subjectId) => {
    const res = await fetch(`${BASE_URL}/api/assignments/${subjectId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch assignments")
    return res.json()
  },

  createAnnouncement: async ({ teacher_id, subject_id, title, body = "", tag = "General" }) => {
    const res = await fetch(`${BASE_URL}/api/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id, subject_id, title, body, tag }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create announcement")
    return res.json()
  },

  createAssignment: async ({ teacher_id, subject_id, title, description = "", due_date = null, max_score = 100 }) => {
    const res = await fetch(`${BASE_URL}/api/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id, subject_id, title, description, due_date, max_score }),
    })
    if (!res.ok) throw await parseError(res, "Failed to create assignment")
    return res.json()
  },

  getSubjectStudents: async (subjectId) => {
    const res = await fetch(`${BASE_URL}/api/org/subject/${subjectId}/students`)
    if (!res.ok) throw await parseError(res, "Failed to fetch subject students")
    return res.json()
  },

  // ─── Exam Management ──────────────────────────────────

  createExam: async (data) => {
    const res = await fetch(`${BASE_URL}/api/exam/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to create exam")
    return res.json()
  },

  getSubjectExams: async (subjectId) => {
    const res = await fetch(`${BASE_URL}/api/exam/subject/${subjectId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch exams")
    return res.json()
  },

  getExamDetails: async (examId) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch exam details")
    return res.json()
  },

  updateExamStatus: async (examId, status) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw await parseError(res, "Failed to update exam status")
    return res.json()
  },

  deleteExam: async (examId) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete exam")
    return res.json()
  },

  // ─── Questions ─────────────────────────────────────────

  addMCQQuestion: async (examId, data) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}/mcq/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to add question")
    return res.json()
  },

  addMCQQuestionsBulk: async (examId, questions) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}/mcq/questions/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    })
    if (!res.ok) throw await parseError(res, "Failed to add questions")
    return res.json()
  },

  generateMCQWithAI: async (examId, data) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}/mcq/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to generate questions")
    return res.json()
  },

  deleteMCQQuestion: async (questionId) => {
    const res = await fetch(`${BASE_URL}/api/exam/mcq/question/${questionId}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete question")
    return res.json()
  },

  addWrittenQuestion: async (examId, data) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}/written/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to add question")
    return res.json()
  },

  deleteWrittenQuestion: async (questionId) => {
    const res = await fetch(`${BASE_URL}/api/exam/written/question/${questionId}`, {
      method: "DELETE",
    })
    if (!res.ok) throw await parseError(res, "Failed to delete question")
    return res.json()
  },

  // ─── Student Exam ─────────────────────────────────────

  getAvailableExams: async (studentId) => {
    const res = await fetch(`${BASE_URL}/api/exam/student/${studentId}/available`)
    if (!res.ok) throw await parseError(res, "Failed to fetch available exams")
    return res.json()
  },

  submitMCQExam: async (data) => {
    const res = await fetch(`${BASE_URL}/api/exam/submit/mcq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to submit exam")
    return res.json()
  },

  submitWrittenExam: async (data) => {
    const res = await fetch(`${BASE_URL}/api/exam/submit/written`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to submit exam")
    return res.json()
  },

  getExamResult: async (studentId, examId) => {
    const res = await fetch(`${BASE_URL}/api/exam/student/${studentId}/result/${examId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch result")
    return res.json()
  },

  // ─── Teacher Grading ──────────────────────────────────

  getExamSubmissions: async (examId) => {
    const res = await fetch(`${BASE_URL}/api/exam/${examId}/submissions`)
    if (!res.ok) throw await parseError(res, "Failed to fetch submissions")
    return res.json()
  },

  getSubmissionDetail: async (submissionId) => {
    const res = await fetch(`${BASE_URL}/api/exam/submission/${submissionId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch submission detail")
    return res.json()
  },

  gradeSubmission: async (submissionId, data) => {
    const res = await fetch(`${BASE_URL}/api/exam/submission/${submissionId}/grade`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw await parseError(res, "Failed to submit grades")
    return res.json()
  },

  // ─── Leaderboard ──────────────────────────────────────

  getExamLeaderboard: async (examId) => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/exam/${examId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch leaderboard")
    return res.json()
  },

  getSubjectLeaderboard: async (subjectId) => {
    const res = await fetch(`${BASE_URL}/api/leaderboard/subject/${subjectId}`)
    if (!res.ok) throw await parseError(res, "Failed to fetch leaderboard")
    return res.json()
  },
}
