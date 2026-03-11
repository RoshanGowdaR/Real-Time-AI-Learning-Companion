const ORGANIZATION_SESSION_KEY = 'studybuddy_organization_session'

export function getOrganizationSession() {
  try {
    const raw = localStorage.getItem(ORGANIZATION_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.org_id) return null
    return parsed
  } catch {
    return null
  }
}

export function setOrganizationSession(session) {
  localStorage.setItem(ORGANIZATION_SESSION_KEY, JSON.stringify(session || {}))
}

export function clearOrganizationSession() {
  localStorage.removeItem(ORGANIZATION_SESSION_KEY)
}

export { ORGANIZATION_SESSION_KEY }
