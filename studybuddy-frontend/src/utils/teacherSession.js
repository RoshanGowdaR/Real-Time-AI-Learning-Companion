const TEACHER_SESSION_KEY = 'studybuddy_teacher_session'

function normalizeTeacherSession(raw) {
  if (!raw || !raw.teacher_id || !raw.org_id) return null

  const subjects = Array.isArray(raw.subjects)
    ? raw.subjects
    : (raw.subject ? [raw.subject] : [])
  const activeSubjectId = raw.active_subject_id || (subjects[0] ? String(subjects[0].id) : null)

  return {
    ...raw,
    subjects,
    active_subject_id: activeSubjectId,
  }
}

export function getTeacherSession() {
  try {
    const raw = localStorage.getItem(TEACHER_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return normalizeTeacherSession(parsed)
  } catch {
    return null
  }
}

export function setTeacherSession(session) {
  const normalized = normalizeTeacherSession(session || {})
  localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(normalized || {}))
}

export function setTeacherActiveSubject(subjectId) {
  const session = getTeacherSession()
  if (!session) return

  setTeacherSession({
    ...session,
    active_subject_id: subjectId ? String(subjectId) : null,
  })
}

export function clearTeacherSession() {
  localStorage.removeItem(TEACHER_SESSION_KEY)
}

export { TEACHER_SESSION_KEY }
