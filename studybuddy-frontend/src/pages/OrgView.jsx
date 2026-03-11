import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { clearOrganizationSession, getOrganizationSession } from '../utils/organizationSession'

const MEDAL_COLORS = ['text-yellow-400', 'text-gray-300', 'text-amber-600']

function relationFirst(value) {
  if (Array.isArray(value)) return value[0] || null
  if (value && typeof value === 'object') return value
  return null
}

function normalizeSubjectRow(row) {
  const subject = row?.subject || {}
  const teacher = row?.teacher || {}
  const organization = row?.organization || {}

  return {
    enrollmentId: String(row?.enrollment_id || row?.id || ''),
    status: String(row?.status || 'pending').toLowerCase(),
    requestedAt: row?.requested_at || '',
    subject: {
      id: String(subject?.id || ''),
      name: String(subject?.name || 'Subject'),
      subject_code: String(subject?.subject_code || ''),
    },
    teacher: {
      id: String(teacher?.id || ''),
      full_name: String(teacher?.full_name || 'Unknown'),
      email: String(teacher?.email || ''),
    },
    organization: {
      id: String(organization?.id || ''),
      name: String(organization?.name || 'Organization'),
    },
  }
}

function getTagClasses(tag) {
  const normalized = String(tag || 'General').toLowerCase()
  if (normalized === 'assignment') return 'bg-blue-900/40 text-blue-300'
  if (normalized === 'important') return 'bg-rose-900/40 text-rose-300'
  return 'bg-gray-700 text-gray-200'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function OrgView() {
  const navigate = useNavigate()
  const { subjectId } = useParams()

  const studentId = localStorage.getItem('student_id')
  const studentName = localStorage.getItem('student_name') || 'Student'

  const [subjectRow, setSubjectRow] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [exams, setExams] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingContext, setLoadingContext] = useState(true)
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [loadingExams, setLoadingExams] = useState(false)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [activeTab, setActiveTab] = useState('announcements')
  const [error, setError] = useState('')

  const loadContext = useCallback(async () => {
    if (!studentId || !subjectId) return

    setLoadingContext(true)
    setError('')
    try {
      const res = await api.getStudentSubjects(studentId)
      const rows = Array.isArray(res?.subjects) ? res.subjects : []
      const current = rows.find((row) => String(row?.subject?.id || '') === String(subjectId))

      if (!current) {
        setSubjectRow(null)
        setError('Class not found in your enrollments.')
        return
      }

      setSubjectRow(normalizeSubjectRow(current))
    } catch (err) {
      setError(err.message || 'Failed to load class details.')
      setSubjectRow(null)
    } finally {
      setLoadingContext(false)
    }
  }, [studentId, subjectId])

  const loadAnnouncements = useCallback(async (currentSubjectId) => {
    if (!currentSubjectId) {
      setAnnouncements([])
      return
    }

    setLoadingAnnouncements(true)
    try {
      const res = await api.getAnnouncements(currentSubjectId)
      setAnnouncements(Array.isArray(res?.announcements) ? res.announcements : [])
    } catch {
      setAnnouncements([])
    } finally {
      setLoadingAnnouncements(false)
    }
  }, [])

  const loadExams = useCallback(async (currentSubjectId) => {
    if (!currentSubjectId) {
      setExams([])
      return
    }

    setLoadingExams(true)
    try {
      const res = await api.getAvailableExams(studentId)
      const all = Array.isArray(res?.exams) ? res.exams : []
      setExams(all.filter((e) => String(e.subject_id) === String(currentSubjectId)))
    } catch {
      setExams([])
    } finally {
      setLoadingExams(false)
    }
  }, [studentId])

  const loadLeaderboard = useCallback(async (currentSubjectId) => {
    if (!currentSubjectId) {
      setLeaderboard([])
      return
    }

    setLoadingLeaderboard(true)
    try {
      const res = await api.getSubjectLeaderboard(currentSubjectId)
      setLeaderboard(Array.isArray(res?.leaderboard) ? res.leaderboard : [])
    } catch {
      setLeaderboard([])
    } finally {
      setLoadingLeaderboard(false)
    }
  }, [])

  useEffect(() => {
    if (!studentId) {
      navigate('/', { replace: true })
      return
    }

    loadContext()
  }, [studentId, navigate, loadContext])

  useEffect(() => {
    const currentSubjectId = subjectRow?.subject?.id
    const isApproved = subjectRow?.status === 'approved'

    if (!currentSubjectId || !isApproved) {
      setAnnouncements([])
      setExams([])
      setLeaderboard([])
      return
    }

    loadAnnouncements(currentSubjectId)
    loadExams(currentSubjectId)
    loadLeaderboard(currentSubjectId)
  }, [subjectRow, loadAnnouncements, loadExams, loadLeaderboard])

  if (loadingContext) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
      </div>
    )
  }

  if (!subjectRow) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#2a2d44] bg-[#101426] p-6 text-center">
          <p className="text-sm text-slate-300">{error || 'Class not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/app/organizations')}
            className="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500"
          >
            Back to Classes
          </button>
        </div>
      </div>
    )
  }

  const isApproved = subjectRow.status === 'approved'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-20 h-14 border-b border-[#1e1e2e] bg-[#111118] px-4 md:px-6">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/app/organizations')}
            className="rounded-lg bg-gray-800 px-3 py-1 text-xs text-gray-400 transition-all hover:bg-gray-700 hover:text-white"
          >
            Back to Classes
          </button>

          <p className="text-sm font-semibold text-white">{subjectRow.organization.name}</p>

          <div className="rounded-full border border-[#2c2d42] bg-[#161726] px-3 py-1 text-sm text-gray-300">
            {studentName}
          </div>
        </div>
      </header>

      <section className="border-b border-gray-800 bg-gray-900 p-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{subjectRow.subject.name}</h2>
              <p className="text-sm text-indigo-300 mt-0.5">{subjectRow.subject.subject_code}</p>
              <p className="text-xs text-gray-400 mt-1">Teacher: {subjectRow.teacher.full_name}</p>
            </div>
            <div>
              <span className={`rounded-full px-2 py-1 text-xs ${subjectRow.status === 'approved' ? 'bg-emerald-900/30 text-emerald-300' : subjectRow.status === 'rejected' ? 'bg-rose-900/25 text-rose-300' : 'bg-amber-900/25 text-amber-300'}`}>
                {subjectRow.status}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 border-b border-gray-800/70">
            <button
              type="button"
              onClick={() => setActiveTab('announcements')}
              className={`pb-2 text-sm ${activeTab === 'announcements' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Announcements
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('exams')}
              className={`pb-2 text-sm ${activeTab === 'exams' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Exams
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`pb-2 text-sm ${activeTab === 'leaderboard' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Leaderboard
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {!isApproved ? (
          <div className="rounded-xl border border-[#2a2d44] bg-[#101426] p-6 text-center">
            <p className="text-sm text-slate-300">
              Access to class content is available after your enrollment request is approved.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'announcements' && (
              <div>
                {loadingAnnouncements ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
                  </div>
                ) : announcements.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">No announcements yet.</p>
                ) : (
                  announcements.map((item) => {
                    const tag = String(item.tag || 'General')
                    return (
                      <article key={item.id} className="mb-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${getTagClasses(tag)}`}>
                            {tag}
                          </span>
                          <span className="text-xs text-gray-400">{timeAgo(item.created_at || new Date().toISOString())}</span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-white">{item.title || 'Announcement'}</h3>
                        <p className="mt-1 text-sm text-gray-300">{item.body || ''}</p>
                        <p className="mt-3 text-xs text-gray-500">Posted by {item.teacher_name || subjectRow.teacher.full_name}</p>
                      </article>
                    )
                  })
                )}
              </div>
            )}

            {activeTab === 'exams' && (
              <div>
                {loadingExams ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
                  </div>
                ) : exams.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">No active exams available.</p>
                ) : (
                  exams.map((ex) => (
                    <article key={ex.id} className="mb-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-white">{ex.title}</h3>
                          <p className="mt-1 text-sm text-gray-300">{ex.description || ''}</p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                            <span>Type: {ex.exam_type?.toUpperCase()}</span>
                            <span>Duration: {ex.duration_mins} mins</span>
                            <span>Total: {ex.total_marks} marks</span>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300">Active</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => navigate(`/app/exam/${ex.id}/${ex.exam_type}`)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
                        >
                          Start Exam
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div>
                {loadingLeaderboard ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
                  </div>
                ) : leaderboard.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">No leaderboard data yet. Complete an exam to see rankings!</p>
                ) : (
                  <>
                    {/* Podium */}
                    <div className="flex items-end justify-center gap-4 mb-6 pt-4">
                      {[1, 0, 2].map((idx) => {
                        const entry = leaderboard[idx]
                        if (!entry) return <div key={idx} className="w-28" />
                        const height = idx === 0 ? 'h-28' : idx === 1 ? 'h-20' : 'h-16'
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            <p className={`text-lg font-bold ${MEDAL_COLORS[idx]}`}>#{entry.rank}</p>
                            <p className="text-sm text-white font-medium mt-1 truncate max-w-[7rem]">{entry.student_name}</p>
                            <p className="text-xs text-gray-400">{entry.total_score}</p>
                            <div className={`${height} w-20 mt-2 rounded-t-lg ${idx === 0 ? 'bg-yellow-600/20' : idx === 1 ? 'bg-gray-600/20' : 'bg-amber-700/20'}`} />
                          </div>
                        )
                      })}
                    </div>

                    {/* Table */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Student</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Score</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Exams</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((e) => (
                            <tr key={e.student_id || e.rank} className="border-b border-gray-700/50">
                              <td className="px-4 py-3 text-sm text-white">#{e.rank}</td>
                              <td className="px-4 py-3 text-sm text-white">{e.student_name}</td>
                              <td className="px-4 py-3 text-sm text-white">{e.total_score}</td>
                              <td className="px-4 py-3 text-sm text-gray-400">{e.exams_attempted || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function OrganizationAdminView() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getOrganizationSession())

  const [org, setOrg] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [pendingMembers, setPendingMembers] = useState([])

  const [teacherName, setTeacherName] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [subjectName, setSubjectName] = useState('')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [activeMemberAction, setActiveMemberAction] = useState('')
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [teacherToDelete, setTeacherToDelete] = useState(null)
  const [deletingTeacherId, setDeletingTeacherId] = useState('')

  const orgId = session?.org_id

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!orgId) return

    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const [orgRes, subjectsRes, pendingRes] = await Promise.all([
        api.getOrgById(orgId),
        api.getOrgSubjects(orgId),
        api.getOrgPending(orgId),
      ])

      setOrg(orgRes || null)
      setSubjects(Array.isArray(subjectsRes?.subjects) ? subjectsRes.subjects : [])
      setPendingMembers(Array.isArray(pendingRes?.members) ? pendingRes.members : [])
    } catch (err) {
      setError(err.message || 'Could not load organization dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [orgId])

  useEffect(() => {
    if (!session?.org_id) {
      navigate('/organization/login')
      return
    }

    loadDashboard()
  }, [session, loadDashboard, navigate])

  const pendingBySubject = useMemo(() => {
    const groups = {}

    pendingMembers.forEach((member) => {
      const subject = member?.subject || {}
      const subjectKey = String(subject?.id || 'unknown')
      if (!groups[subjectKey]) {
        groups[subjectKey] = {
          key: subjectKey,
          subject,
          members: [],
        }
      }
      groups[subjectKey].members.push(member)
    })

    return Object.values(groups)
  }, [pendingMembers])

  const teachers = useMemo(() => {
    const map = {}

    subjects.forEach((subject) => {
      const teacherId = String(subject?.teacher_id || '')
      if (!teacherId) return

      const teacherInfo = relationFirst(subject?.teachers) || {}
      if (!map[teacherId]) {
        map[teacherId] = {
          id: teacherId,
          full_name: teacherInfo?.full_name || 'Unknown',
          email: teacherInfo?.email || '',
          subjectCount: 0,
        }
      }

      map[teacherId].subjectCount += 1
    })

    return Object.values(map)
  }, [subjects])

  const handleMemberStatus = async (enrollmentId, status) => {
    if (!enrollmentId) return

    const actionKey = `${enrollmentId}:${status}`
    setActiveMemberAction(actionKey)
    setError('')
    setFeedback('')

    try {
      await api.updateSubjectEnrollmentStatus(enrollmentId, status)
      await loadDashboard({ silent: true })
      setFeedback(`Enrollment ${status} successfully.`)
    } catch (err) {
      setError(err.message || 'Could not update enrollment status.')
    } finally {
      setActiveMemberAction('')
    }
  }

  const handleCreateTeacher = async (e) => {
    e.preventDefault()

    if (!teacherName.trim() || !teacherEmail.trim() || !teacherPassword || !subjectName.trim()) {
      setError('Teacher name, email, password, and subject are required.')
      return
    }

    setCreatingTeacher(true)
    setError('')
    setFeedback('')

    try {
      const res = await api.registerTeacher({
        org_id: orgId,
        email: teacherEmail.trim().toLowerCase(),
        full_name: teacherName.trim(),
        password: teacherPassword,
        subject_name: subjectName.trim(),
      })

      setTeacherName('')
      setTeacherEmail('')
      setTeacherPassword('')
      setSubjectName('')

      if (res?.teacher_already_exists) {
        setFeedback('Subject added to existing teacher account.')
      } else {
        setFeedback('Teacher created. Share the email and password with that teacher.')
      }

      await loadDashboard({ silent: true })
    } catch (err) {
      setError(err.message || 'Could not create teacher.')
    } finally {
      setCreatingTeacher(false)
    }
  }

  const handleConfirmDeleteTeacher = async () => {
    if (!teacherToDelete?.id || !orgId) return

    setDeletingTeacherId(teacherToDelete.id)
    setError('')
    setFeedback('')

    try {
      await api.deleteTeacher(orgId, teacherToDelete.id)
      setTeacherToDelete(null)
      setFeedback('Teacher and related subjects deleted successfully.')
      await loadDashboard({ silent: true })
    } catch (err) {
      setError(err.message || 'Could not delete teacher.')
    } finally {
      setDeletingTeacherId('')
    }
  }

  const handleLogout = () => {
    clearOrganizationSession()
    setSession(null)
    navigate('/organization/login')
  }

  const organizationName = useMemo(() => {
    return org?.name || session?.name || 'Organization'
  }, [org, session])

  if (!session) return null

  return (
    <div className="min-h-screen bg-[#090b14] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border border-[#22273f] bg-[linear-gradient(120deg,#121632_0%,#11172e_55%,#0d1020_100%)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-300">Organization Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">{organizationName}</h1>
              <p className="text-sm text-slate-300 mt-1">Review class join requests and manage teachers.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadDashboard({ silent: true })}
                disabled={refreshing}
                className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-xs text-slate-100 hover:border-indigo-400 disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-xs text-slate-100 hover:border-indigo-400"
              >
                Portal Selection
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-rose-600/80 px-3 py-2 text-xs text-white hover:bg-rose-500"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        {feedback && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {feedback}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-2xl border border-[#252b44] bg-[#101426] p-4 xl:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Pending Join Requests</h2>
              <p className="text-xs text-slate-400">
                {pendingMembers.length} pending
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {!loading && pendingBySubject.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#394061] bg-[#0c1020] p-6 text-center">
                  <p className="text-sm text-slate-300">No pending requests right now.</p>
                  <p className="text-xs text-slate-500 mt-1">New class join requests will appear here.</p>
                </div>
              )}

              {pendingBySubject.map((group) => {
                const subject = group.subject || {}
                return (
                  <article key={group.key} className="rounded-xl border border-[#2f3655] bg-[#121a33] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{subject.name || 'Subject'}</p>
                        <p className="text-[11px] text-indigo-200">{subject.subject_code || 'N/A'}</p>
                      </div>
                      <p className="text-[11px] text-slate-400">{group.members.length} pending</p>
                    </div>

                    <div className="space-y-2">
                      {group.members.map((member) => {
                        const enrollmentId = member?.enrollment_id
                        const approveKey = `${enrollmentId}:approved`
                        const rejectKey = `${enrollmentId}:rejected`

                        return (
                          <div key={enrollmentId} className="rounded-lg border border-[#313959] bg-[#141b35] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">{member?.student?.name || 'Student'}</p>
                                <p className="text-xs text-slate-300">{member?.student?.email || 'N/A'}</p>
                                <p className="text-[11px] text-slate-500 mt-1">Requested: {member?.requested_at || 'N/A'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleMemberStatus(enrollmentId, 'approved')}
                                  disabled={activeMemberAction === approveKey || activeMemberAction === rejectKey}
                                  className="rounded-md bg-emerald-600/80 px-2.5 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                                >
                                  {activeMemberAction === approveKey ? 'Approving...' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMemberStatus(enrollmentId, 'rejected')}
                                  disabled={activeMemberAction === approveKey || activeMemberAction === rejectKey}
                                  className="rounded-md bg-rose-600/80 px-2.5 py-1.5 text-xs text-white hover:bg-rose-500 disabled:opacity-60"
                                >
                                  {activeMemberAction === rejectKey ? 'Rejecting...' : 'Reject'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="space-y-4 xl:col-span-1">
            <article className="rounded-2xl border border-[#252b44] bg-[#101426] p-4">
              <h2 className="text-sm font-semibold text-white">Organization Summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Organization</span>
                  <span className="text-slate-100">{organizationName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Admin Email</span>
                  <span className="text-slate-100">{session?.email || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Invite Code</span>
                  <span className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-indigo-200">
                    {org?.invite_code || session?.invite_code || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[#313959] bg-[#151a31] px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Pending</p>
                  <p className="mt-1 text-lg font-semibold text-white">{pendingMembers.length}</p>
                </div>
                <div className="rounded-lg border border-[#313959] bg-[#151a31] px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Subjects</p>
                  <p className="mt-1 text-lg font-semibold text-white">{subjects.length}</p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#252b44] bg-[#101426] p-4">
              <h2 className="text-sm font-semibold text-white">Create Teacher</h2>
              <p className="mt-1 text-xs text-slate-400">Create a teacher account with an initial subject.</p>

              <form onSubmit={handleCreateTeacher} className="mt-3 space-y-2.5">
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Teacher full name"
                  className="w-full rounded-md border border-[#313959] bg-[#151a31] px-2.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  placeholder="Teacher email"
                  className="w-full rounded-md border border-[#313959] bg-[#151a31] px-2.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="Teacher password"
                  className="w-full rounded-md border border-[#313959] bg-[#151a31] px-2.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Subject name"
                  className="w-full rounded-md border border-[#313959] bg-[#151a31] px-2.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <button
                  type="submit"
                  disabled={creatingTeacher}
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {creatingTeacher ? 'Creating...' : 'Create Teacher Account'}
                </button>
              </form>
            </article>

            <article className="rounded-2xl border border-[#252b44] bg-[#101426] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Teachers</h2>
                <p className="text-[11px] text-slate-500">{teachers.length} total</p>
              </div>

              <div className="mt-3 space-y-2">
                {teachers.length > 0 ? (
                  teachers.map((teacher) => (
                    <div key={teacher.id} className="rounded-lg border border-[#313959] bg-[#151a31] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">{teacher.full_name}</p>
                          <p className="text-[11px] text-slate-300 mt-0.5">{teacher.email || 'N/A'}</p>
                          <p className="text-[11px] text-slate-500 mt-1">Subjects: {teacher.subjectCount}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTeacherToDelete(teacher)}
                          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No teachers available yet.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-[#252b44] bg-[#101426] p-4">
              <h2 className="text-sm font-semibold text-white">Subjects</h2>
              <div className="mt-3 space-y-2">
                {subjects.length > 0 ? (
                  subjects.map((subject) => (
                    <div key={subject.id} className="rounded-lg border border-[#313959] bg-[#151a31] p-2.5">
                      <p className="text-sm font-medium text-white">{subject.name}</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">{subject.subject_code}</p>
                      <p className="text-[11px] text-slate-500 mt-1">Teacher: {teacherNameFromSubject(subject)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No subjects available yet.</p>
                )}
              </div>
            </article>
          </section>
        </div>
      </div>

      {teacherToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#313959] bg-[#101426] p-5">
            <h3 className="text-base font-semibold text-white">Delete Teacher</h3>
            <p className="mt-2 text-sm text-slate-300">
              Delete <span className="font-semibold text-white">{teacherToDelete.full_name}</span> and all subjects assigned to this teacher?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This also removes announcements, assignments, and enrollments for those deleted subjects.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTeacherToDelete(null)}
                className="rounded-lg border border-[#3a4266] bg-[#161b32] px-3 py-2 text-xs text-slate-100 hover:border-indigo-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeacher}
                disabled={deletingTeacherId === teacherToDelete.id}
                className="rounded-lg bg-rose-600/85 px-3 py-2 text-xs text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deletingTeacherId === teacherToDelete.id ? 'Deleting...' : 'Delete Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
