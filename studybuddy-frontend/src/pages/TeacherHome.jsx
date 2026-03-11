import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import {
  clearTeacherSession,
  getTeacherSession,
  setTeacherActiveSubject,
} from '../utils/teacherSession'

/* ────────────────────────────────────────
   Helpers
   ──────────────────────────────────────── */

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE = {
  draft: 'bg-gray-700 text-gray-200',
  active: 'bg-emerald-900/40 text-emerald-300',
  closed: 'bg-rose-900/40 text-rose-300',
}

const SIDEBAR_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'students', label: 'Students', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'exams', label: 'Exams', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01' },
  { id: 'announcements', label: 'Announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
]

/* ────────────────────────────────────────
   Main Component
   ──────────────────────────────────────── */

export default function TeacherHome() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getTeacherSession())
  const [activeTab, setActiveTab] = useState('dashboard')

  /* shared state */
  const [exams, setExams] = useState([])
  const [students, setStudents] = useState([])
  const [pendingMembers, setPendingMembers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  /* exam sub-views */
  const [examView, setExamView] = useState('list') // list | create | submissions | grading
  const [selectedExam, setSelectedExam] = useState(null)
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [submissionDetail, setSubmissionDetail] = useState(null)

  /* create exam state */
  const [createStep, setCreateStep] = useState(1)
  const [examForm, setExamForm] = useState({ title: '', description: '', exam_type: 'mcq', duration_mins: 60, total_marks: 100, closes_at: '' })
  const [createdExamId, setCreatedExamId] = useState(null)
  const [examQuestions, setExamQuestions] = useState([])
  const [manualQ, setManualQ] = useState({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', marks: 1 })
  const [writtenQ, setWrittenQ] = useState({ question_text: '', max_marks: 10 })
  const [aiTopic, setAiTopic] = useState('')
  const [aiCount, setAiCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('Medium')
  const [generatingAI, setGeneratingAI] = useState(false)
  const [savingExam, setSavingExam] = useState(false)

  /* announcement form */
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annTag, setAnnTag] = useState('General')
  const [postingAnn, setPostingAnn] = useState(false)

  /* grading state */
  const [gradeAnswers, setGradeAnswers] = useState({})
  const [gradeRemarks, setGradeRemarks] = useState('')
  const [submittingGrade, setSubmittingGrade] = useState(false)

  /* leaderboard */
  const [leaderboardTab, setLeaderboardTab] = useState('exam')
  const [lbExamId, setLbExamId] = useState('')
  const [examLeaderboard, setExamLeaderboard] = useState([])
  const [subjectLeaderboard, setSubjectLeaderboard] = useState([])

  const subjects = useMemo(() => Array.isArray(session?.subjects) ? session.subjects : [], [session])
  const activeSubject = useMemo(() => {
    if (subjects.length === 0) return null
    const activeId = String(session?.active_subject_id || '')
    return subjects.find((s) => String(s.id) === activeId) || subjects[0]
  }, [subjects, session])

  /* ── Data loaders ────────────────────── */

  const loadData = useCallback(async () => {
    const subjectId = activeSubject?.id
    if (!subjectId) return
    setLoading(true)
    setError('')
    try {
      const [examsRes, studentsRes, pendingRes, annRes] = await Promise.all([
        api.getSubjectExamsAll(subjectId),
        api.getSubjectStudents(subjectId),
        api.getSubjectPending(subjectId),
        api.getAnnouncements(subjectId),
      ])
      setExams(Array.isArray(examsRes?.exams) ? examsRes.exams : [])
      setStudents(Array.isArray(studentsRes?.students) ? studentsRes.students : [])
      setPendingMembers(Array.isArray(pendingRes?.members) ? pendingRes.members : [])
      setAnnouncements(Array.isArray(annRes?.announcements) ? annRes.announcements : [])
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [activeSubject])

  useEffect(() => {
    if (!session?.teacher_id) { navigate('/teacher/login'); return }
    if (subjects.length > 1 && !activeSubject?.id) { navigate('/teacher/subjects'); return }
    loadData()
  }, [session, navigate, subjects, activeSubject, loadData])

  const handleSubjectChange = (subjectId) => {
    setTeacherActiveSubject(subjectId)
    setSession(getTeacherSession())
    setExamView('list')
    setActiveTab('dashboard')
  }

  const handleLogout = () => { clearTeacherSession(); navigate('/teacher/login') }

  const showFeedback = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000) }

  /* ── Pending actions ─────────────────── */

  const [activeMemberAction, setActiveMemberAction] = useState('')
  const handlePendingStatus = async (enrollmentId, status) => {
    setActiveMemberAction(`${enrollmentId}:${status}`)
    try {
      await api.updateSubjectEnrollmentStatus(enrollmentId, status)
      const refreshed = await api.getSubjectPending(activeSubject?.id)
      setPendingMembers(Array.isArray(refreshed?.members) ? refreshed.members : [])
      showFeedback(`Student ${status}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setActiveMemberAction('')
    }
  }

  /* ── Exam CRUD ───────────────────────── */

  const handleCreateExam = async () => {
    setSavingExam(true)
    try {
      const res = await api.createExam({
        subject_id: activeSubject.id,
        teacher_id: session.teacher_id,
        title: examForm.title,
        description: examForm.description,
        exam_type: examForm.exam_type,
        duration_mins: examForm.duration_mins,
        total_marks: examForm.total_marks,
        closes_at: examForm.closes_at || null,
      })
      setCreatedExamId(res.exam_id)
      setCreateStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingExam(false)
    }
  }

  const handleAddManualMCQ = async () => {
    if (!createdExamId || !manualQ.question_text) return
    try {
      await api.addMCQQuestion(createdExamId, manualQ)
      const fresh = await api.getExamDetails(createdExamId)
      setExamQuestions(fresh.questions || [])
      setManualQ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', marks: 1 })
      showFeedback('Question added')
    } catch (err) { setError(err.message) }
  }

  const handleAddWrittenQ = async () => {
    if (!createdExamId || !writtenQ.question_text) return
    try {
      await api.addWrittenQuestion(createdExamId, writtenQ)
      const fresh = await api.getExamDetails(createdExamId)
      setExamQuestions(fresh.questions || [])
      setWrittenQ({ question_text: '', max_marks: 10 })
      showFeedback('Question added')
    } catch (err) { setError(err.message) }
  }

  const handleGenerateAI = async () => {
    if (!createdExamId || !aiTopic) return
    setGeneratingAI(true)
    try {
      await api.generateMCQWithAI(createdExamId, { topic: aiTopic, count: aiCount, difficulty: aiDifficulty })
      const fresh = await api.getExamDetails(createdExamId)
      setExamQuestions(fresh.questions || [])
      showFeedback(`${aiCount} questions generated!`)
    } catch (err) { setError(err.message) }
    finally { setGeneratingAI(false) }
  }

  const handleDeleteQuestion = async (qId, type) => {
    try {
      if (type === 'mcq') await api.deleteMCQQuestion(qId)
      else await api.deleteWrittenQuestion(qId)
      const fresh = await api.getExamDetails(createdExamId)
      setExamQuestions(fresh.questions || [])
    } catch (err) { setError(err.message) }
  }

  const handlePublishExam = async (status = 'active') => {
    if (!createdExamId) return
    try {
      await api.updateExamStatus(createdExamId, status)
      showFeedback(status === 'active' ? 'Exam published!' : 'Saved as draft')
      setExamView('list')
      setCreateStep(1)
      setCreatedExamId(null)
      setExamQuestions([])
      loadData()
    } catch (err) { setError(err.message) }
  }

  const handleExamStatusChange = async (examId, status) => {
    try {
      await api.updateExamStatus(examId, status)
      showFeedback(`Exam ${status}`)
      loadData()
    } catch (err) { setError(err.message) }
  }

  const handleDeleteExam = async (examId) => {
    try {
      await api.deleteExam(examId)
      showFeedback('Exam deleted')
      loadData()
    } catch (err) { setError(err.message) }
  }

  /* ── Submissions ─────────────────────── */

  const loadSubmissions = async (exam) => {
    setSelectedExam(exam)
    setExamView('submissions')
    try {
      const res = await api.getExamSubmissions(exam.id)
      setSubmissions(Array.isArray(res?.submissions) ? res.submissions : [])
    } catch (err) { setError(err.message) }
  }

  const openGrading = async (sub) => {
    setSelectedSubmission(sub)
    try {
      const detail = await api.getSubmissionDetail(sub.submission_id)
      setSubmissionDetail(detail)
      const init = {}
      ;(detail.answers || []).forEach((a) => {
        init[a.answer_id] = {
          marks_awarded: a.ai_suggested_score || a.marks_awarded || 0,
          teacher_feedback: a.teacher_feedback || '',
        }
      })
      setGradeAnswers(init)
      setGradeRemarks(detail.teacher_remarks || '')
      setExamView('grading')
    } catch (err) { setError(err.message) }
  }

  const handleSubmitGrades = async () => {
    if (!submissionDetail) return
    setSubmittingGrade(true)
    try {
      const answers = Object.entries(gradeAnswers).map(([answer_id, v]) => ({
        answer_id,
        marks_awarded: Number(v.marks_awarded) || 0,
        teacher_feedback: v.teacher_feedback || '',
      }))
      await api.gradeSubmission(submissionDetail.submission_id, { answers, teacher_remarks: gradeRemarks })
      showFeedback('Grades submitted! Leaderboard updated.')
      setExamView('submissions')
      loadSubmissions(selectedExam)
    } catch (err) { setError(err.message) }
    finally { setSubmittingGrade(false) }
  }

  /* ── Announcements ───────────────────── */

  const handlePostAnnouncement = async () => {
    if (!annTitle.trim()) return
    setPostingAnn(true)
    try {
      await api.createAnnouncement({ teacher_id: session.teacher_id, subject_id: activeSubject.id, title: annTitle, body: annBody, tag: annTag })
      setAnnTitle('')
      setAnnBody('')
      setAnnTag('General')
      const res = await api.getAnnouncements(activeSubject.id)
      setAnnouncements(Array.isArray(res?.announcements) ? res.announcements : [])
      showFeedback('Announcement posted')
    } catch (err) { setError(err.message) }
    finally { setPostingAnn(false) }
  }

  const handleDeleteAnnouncement = async (announcementId) => {
    try {
      await api.deleteAnnouncement(announcementId, session.teacher_id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId))
      showFeedback('Announcement deleted')
    } catch (err) { setError(err.message) }
  }

  /* ── Leaderboard ─────────────────────── */

  const loadExamLeaderboard = async (examId) => {
    setLbExamId(examId)
    try {
      const res = await api.getExamLeaderboard(examId)
      setExamLeaderboard(Array.isArray(res?.leaderboard) ? res.leaderboard : [])
    } catch (err) { setError(err.message) }
  }

  const loadSubjectLeaderboard = useCallback(async () => {
    if (!activeSubject?.id) return
    try {
      const res = await api.getSubjectLeaderboard(activeSubject.id)
      setSubjectLeaderboard(Array.isArray(res?.leaderboard) ? res.leaderboard : [])
    } catch (err) { setError(err.message) }
  }, [activeSubject])

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      loadSubjectLeaderboard()
      if (exams.length > 0 && !lbExamId) loadExamLeaderboard(exams[0].id)
    }
  }, [activeTab, loadSubjectLeaderboard, exams, lbExamId])

  if (!session) return null

  /* ────────────────────────────────────────
     RENDER
     ──────────────────────────────────────── */

  return (
    <div className="flex h-screen bg-[#090b14] text-white overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-56 flex-shrink-0 border-r border-[#1e1e2e] bg-[#0d0f1a] flex flex-col">
        <div className="p-4 border-b border-[#1e1e2e]">
          <p className="text-[10px] uppercase tracking-[0.22em] text-indigo-400">Teacher Portal</p>
          <p className="text-sm text-white font-semibold mt-1 truncate">{session.full_name || 'Teacher'}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {SIDEBAR_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id === 'exams') setExamView('list') }}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1e1e2e] space-y-2">
          <button onClick={() => navigate('/')} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-xs text-slate-300 hover:border-indigo-400">Portal Selection</button>
          <button onClick={handleLogout} className="w-full rounded-lg bg-rose-600/80 px-3 py-2 text-xs text-white hover:bg-rose-500">Logout</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-14 border-b border-[#1e1e2e] bg-[#0d0f1a] px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-white">
              {activeSubject ? `${activeSubject.name}` : 'No Subject'}
            </h1>
            {activeSubject && (
              <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[11px] text-indigo-300">{activeSubject.subject_code}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {subjects.length > 1 && (
              <select
                value={String(activeSubject?.id || '')}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="rounded-lg border border-[#343b5a] bg-[#161b32] px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.subject_code})</option>)}
              </select>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-5">
          {feedback && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{feedback}</div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
              <button onClick={() => setError('')} className="ml-2 text-rose-400 hover:text-white">x</button>
            </div>
          )}

          {loading && activeTab === 'dashboard' ? (
            <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" /></div>
          ) : (
            <>
              {/* ══════ DASHBOARD ══════ */}
              {activeTab === 'dashboard' && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Students" value={students.length} sub="enrolled" />
                    <StatCard label="Exams" value={exams.length} sub="total" />
                    <StatCard label="Pending Requests" value={pendingMembers.length} sub="pending" />
                    <StatCard label="Subject Code" value={activeSubject?.subject_code || '—'} sub="share with students" />
                  </div>
                  {pendingMembers.length > 0 && (
                    <section className="rounded-xl border border-[#272d47] bg-[#101426] p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Pending Join Requests</h3>
                      <div className="space-y-2">
                        {pendingMembers.map((m) => (
                          <div key={m.enrollment_id} className="flex items-center justify-between rounded-lg border border-[#313959] bg-[#141b35] p-3">
                            <div>
                              <p className="text-sm font-medium text-white">{m?.student?.name || 'Student'}</p>
                              <p className="text-xs text-slate-400">{m?.student?.email || ''}</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handlePendingStatus(m.enrollment_id, 'approved')} disabled={!!activeMemberAction} className="rounded-md bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">Approve</button>
                              <button onClick={() => handlePendingStatus(m.enrollment_id, 'rejected')} disabled={!!activeMemberAction} className="rounded-md bg-rose-600/80 px-2 py-1 text-xs text-white hover:bg-rose-500 disabled:opacity-50">Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="rounded-xl border border-[#272d47] bg-[#101426] p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Recent Exams</h3>
                    {exams.length === 0 ? (
                      <p className="text-sm text-slate-500">No exams yet. Create one from the Exams tab.</p>
                    ) : (
                      <div className="space-y-2">
                        {exams.slice(0, 5).map((ex) => (
                          <div key={ex.id} className="flex items-center justify-between rounded-lg border border-[#313959] bg-[#141b35] p-3">
                            <div>
                              <p className="text-sm font-medium text-white">{ex.title}</p>
                              <p className="text-xs text-slate-400">{ex.exam_type?.toUpperCase()} · {ex.submission_count || 0} submissions</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_BADGE[ex.status] || STATUS_BADGE.draft}`}>{ex.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* ══════ STUDENTS ══════ */}
              {activeTab === 'students' && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Enrolled Students</h2>
                  {students.length === 0 ? (
                    <p className="text-sm text-slate-500">No students enrolled yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {students.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#272d47] bg-[#101426] p-4">
                          <div>
                            <p className="text-sm font-medium text-white">{s.name}</p>
                            <p className="text-xs text-slate-400">{s.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════ EXAMS LIST ══════ */}
              {activeTab === 'exams' && examView === 'list' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Exams</h2>
                    <button onClick={() => { setExamView('create'); setCreateStep(1); setExamForm({ title: '', description: '', exam_type: 'mcq', duration_mins: 60, total_marks: 100, closes_at: '' }); setCreatedExamId(null); setExamQuestions([]) }} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500">+ Create Exam</button>
                  </div>
                  {exams.length === 0 ? (
                    <p className="py-8 text-center text-slate-500">No exams created yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {exams.map((ex) => (
                        <article key={ex.id} className="rounded-xl border border-[#272d47] bg-[#101426] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-white">{ex.title}</h3>
                              <p className="text-xs text-slate-400 mt-1">Type: {ex.exam_type?.toUpperCase()} · {ex.question_count || 0} questions · {ex.total_marks} marks</p>
                              {(ex.question_count || 0) === 0 && <p className="text-xs text-red-400 mt-0.5">-- Add questions before activating</p>}
                              <p className="text-xs text-slate-400">Duration: {ex.duration_mins} mins</p>
                              {ex.closes_at && <p className="text-xs text-slate-400">Closes: {formatDate(ex.closes_at)}</p>}
                              {ex.submission_count != null && <p className="text-xs text-slate-400 mt-1">Submissions: {ex.submission_count} students</p>}
                            </div>
                            <div className="shrink-0 text-right">
                              {ex.status === 'draft' && <span className="inline-block rounded-full bg-gray-700 px-2.5 py-0.5 text-[11px] text-gray-200">Draft — Not visible to students</span>}
                              {ex.status === 'active' && <span className="inline-block rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-[11px] text-emerald-300">Active — Students can attempt</span>}
                              {ex.status === 'closed' && <span className="inline-block rounded-full bg-rose-900/40 px-2.5 py-0.5 text-[11px] text-rose-300">Closed</span>}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {ex.status === 'draft' && (
                              <>
                                <button onClick={() => { setCreatedExamId(ex.id); setExamForm({ ...examForm, exam_type: ex.exam_type }); setExamView('create'); setCreateStep(2); api.getExamDetails(ex.id).then((d) => setExamQuestions(d.questions || [])) }} className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">+ Add Questions</button>
                                <button onClick={() => handleExamStatusChange(ex.id, 'active')} disabled={(ex.question_count || 0) === 0} className="rounded-md bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed" title={(ex.question_count || 0) === 0 ? 'Add questions first' : ''}>Activate</button>
                                <button onClick={() => handleDeleteExam(ex.id)} className="rounded-md bg-rose-600/80 px-2 py-1 text-xs text-white hover:bg-rose-500">Delete</button>
                              </>
                            )}
                            {ex.status === 'active' && (
                              <>
                                <button onClick={() => loadSubmissions(ex)} className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">View Submissions</button>
                                <button onClick={() => { setActiveTab('leaderboard'); setLeaderboardTab('exam'); loadExamLeaderboard(ex.id) }} className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">Leaderboard</button>
                                <button onClick={() => handleExamStatusChange(ex.id, 'closed')} className="rounded-md bg-amber-600/80 px-2 py-1 text-xs text-white hover:bg-amber-500">Close</button>
                              </>
                            )}
                            {ex.status === 'closed' && (
                              <>
                                <button onClick={() => loadSubmissions(ex)} className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">View Submissions</button>
                                <button onClick={() => { setActiveTab('leaderboard'); setLeaderboardTab('exam'); loadExamLeaderboard(ex.id) }} className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">Leaderboard</button>
                                <button onClick={() => handleDeleteExam(ex.id)} className="rounded-md bg-rose-600/80 px-2 py-1 text-xs text-white hover:bg-rose-500">Delete</button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════ CREATE EXAM ══════ */}
              {activeTab === 'exams' && examView === 'create' && (
                <div className="max-w-2xl">
                  <button onClick={() => setExamView('list')} className="text-xs text-indigo-400 hover:text-indigo-300 mb-4 block">&larr; Back to Exams</button>
                  <h2 className="text-lg font-semibold mb-4">Create Exam</h2>

                  {createStep === 1 && (
                    <div className="space-y-4 rounded-xl border border-[#272d47] bg-[#101426] p-5">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Title *</label>
                        <input value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Description</label>
                        <textarea value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} rows={3} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Exam Type</label>
                        <div className="flex gap-2">
                          {['mcq', 'written'].map((t) => (
                            <button key={t} onClick={() => setExamForm({ ...examForm, exam_type: t })} className={`rounded-lg px-4 py-2 text-xs ${examForm.exam_type === t ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t.toUpperCase()}</button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Duration (mins)</label>
                          <input type="number" value={examForm.duration_mins} onChange={(e) => setExamForm({ ...examForm, duration_mins: parseInt(e.target.value) || 60 })} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Total Marks</label>
                          <input type="number" value={examForm.total_marks} onChange={(e) => setExamForm({ ...examForm, total_marks: parseInt(e.target.value) || 100 })} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Closes At</label>
                        <input type="datetime-local" value={examForm.closes_at} onChange={(e) => setExamForm({ ...examForm, closes_at: e.target.value })} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <button onClick={handleCreateExam} disabled={!examForm.title || savingExam} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">
                        {savingExam ? 'Creating...' : 'Next — Add Questions →'}
                      </button>
                    </div>
                  )}

                  {createStep === 2 && (
                    <div className="space-y-4">
                      {/* AI Generation (MCQ only) */}
                      {examForm.exam_type === 'mcq' && (
                        <div className="rounded-xl border border-[#272d47] bg-[#101426] p-5">
                          <h3 className="text-sm font-semibold text-white mb-3">Generate with AI</h3>
                          <div className="space-y-3">
                            <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Topic — e.g. Cloud Computing basics" className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            <div className="flex gap-3">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Count</label>
                                <div className="flex gap-1">
                                  {[5, 10, 15, 20].map((n) => (
                                    <button key={n} onClick={() => setAiCount(n)} className={`rounded px-2.5 py-1 text-xs ${aiCount === n ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{n}</button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Difficulty</label>
                                <div className="flex gap-1">
                                  {['Easy', 'Medium', 'Hard'].map((d) => (
                                    <button key={d} onClick={() => setAiDifficulty(d)} className={`rounded px-2.5 py-1 text-xs ${aiDifficulty === d ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{d}</button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <button onClick={handleGenerateAI} disabled={!aiTopic || generatingAI} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-50">
                              {generatingAI ? 'Generating...' : 'Generate with AI'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Manual add */}
                      <div className="rounded-xl border border-[#272d47] bg-[#101426] p-5">
                        <h3 className="text-sm font-semibold text-white mb-3">Add Question Manually</h3>
                        {examForm.exam_type === 'mcq' ? (
                          <div className="space-y-3">
                            <textarea value={manualQ.question_text} onChange={(e) => setManualQ({ ...manualQ, question_text: e.target.value })} placeholder="Question text" rows={2} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            <div className="grid grid-cols-2 gap-2">
                              <input value={manualQ.option_a} onChange={(e) => setManualQ({ ...manualQ, option_a: e.target.value })} placeholder="Option A" className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                              <input value={manualQ.option_b} onChange={(e) => setManualQ({ ...manualQ, option_b: e.target.value })} placeholder="Option B" className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                              <input value={manualQ.option_c} onChange={(e) => setManualQ({ ...manualQ, option_c: e.target.value })} placeholder="Option C" className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                              <input value={manualQ.option_d} onChange={(e) => setManualQ({ ...manualQ, option_d: e.target.value })} placeholder="Option D" className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Correct</label>
                                <div className="flex gap-1">
                                  {['A', 'B', 'C', 'D'].map((opt) => (
                                    <button key={opt} onClick={() => setManualQ({ ...manualQ, correct_option: opt })} className={`rounded px-2.5 py-1 text-xs ${manualQ.correct_option === opt ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{opt}</button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Marks</label>
                                <input type="number" value={manualQ.marks} onChange={(e) => setManualQ({ ...manualQ, marks: parseInt(e.target.value) || 1 })} className="w-16 rounded-lg border border-[#343b5a] bg-[#161b32] px-2 py-1 text-sm text-white focus:outline-none" />
                              </div>
                            </div>
                            <button onClick={handleAddManualMCQ} disabled={!manualQ.question_text} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-50">+ Add Question</button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea value={writtenQ.question_text} onChange={(e) => setWrittenQ({ ...writtenQ, question_text: e.target.value })} placeholder="Question text" rows={3} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Max Marks</label>
                              <input type="number" value={writtenQ.max_marks} onChange={(e) => setWrittenQ({ ...writtenQ, max_marks: parseInt(e.target.value) || 10 })} className="w-24 rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <button onClick={handleAddWrittenQ} disabled={!writtenQ.question_text} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-50">+ Add Question</button>
                          </div>
                        )}
                      </div>

                      {/* Added questions */}
                      {examQuestions.length > 0 && (
                        <div className="rounded-xl border border-[#272d47] bg-[#101426] p-5">
                          <h3 className="text-sm font-semibold text-white mb-3">Questions ({examQuestions.length})</h3>
                          <div className="space-y-2">
                            {examQuestions.map((q, i) => (
                              <div key={q.id} className="flex items-start justify-between rounded-lg border border-[#313959] bg-[#141b35] p-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white">Q{i + 1}. {q.question_text}</p>
                                  {examForm.exam_type === 'mcq' && (
                                    <p className="text-xs text-slate-400 mt-1">A: {q.option_a} · B: {q.option_b} · C: {q.option_c} · D: {q.option_d} — Correct: {q.correct_option}</p>
                                  )}
                                  {examForm.exam_type === 'written' && (
                                    <p className="text-xs text-slate-400 mt-1">Max marks: {q.max_marks}</p>
                                  )}
                                </div>
                                <button onClick={() => handleDeleteQuestion(q.id, examForm.exam_type)} className="ml-2 text-rose-400 hover:text-rose-300 text-xs flex-shrink-0">Delete</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button onClick={() => setCreateStep(1)} className="rounded-lg bg-gray-700 px-4 py-2 text-xs text-gray-200 hover:bg-gray-600">&larr; Back</button>
                        <button onClick={() => handlePublishExam('draft')} className="rounded-lg bg-gray-600 px-4 py-2 text-xs text-white hover:bg-gray-500">Save as Draft</button>
                        <button onClick={() => handlePublishExam('active')} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500">Publish Exam</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══════ VIEW SUBMISSIONS ══════ */}
              {activeTab === 'exams' && examView === 'submissions' && selectedExam && (
                <div>
                  <button onClick={() => setExamView('list')} className="text-xs text-indigo-400 hover:text-indigo-300 mb-4 block">&larr; Back to Exams</button>
                  <h2 className="text-lg font-semibold mb-1">{selectedExam.title}</h2>
                  <p className="text-xs text-slate-400 mb-4">{selectedExam.exam_type?.toUpperCase()} · {selectedExam.total_marks} marks</p>

                  {submissions.length === 0 ? (
                    <p className="py-8 text-center text-slate-500">No submissions yet.</p>
                  ) : (
                    <div className="rounded-xl border border-[#272d47] bg-[#101426] overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#272d47]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Student</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Score</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Submitted</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((sub) => (
                            <tr key={sub.submission_id} className="border-b border-[#1e1e2e]">
                              <td className="px-4 py-3">
                                <p className="text-sm text-white">{sub.student_name}</p>
                                <p className="text-xs text-slate-500">{sub.student_email}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-white">
                                {sub.status === 'graded' ? `${sub.total_score}/${selectedExam.total_marks}` : 'pending'}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-400">{timeAgo(sub.submitted_at)}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${sub.status === 'graded' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>
                                  {sub.status === 'graded' ? 'Graded' : 'Review'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {selectedExam.exam_type === 'written' && sub.status !== 'graded' ? (
                                  <button onClick={() => openGrading(sub)} className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">Grade Now</button>
                                ) : (
                                  <button onClick={() => openGrading(sub)} className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">View Details</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ══════ GRADING VIEW ══════ */}
              {activeTab === 'exams' && examView === 'grading' && submissionDetail && (
                <div className="max-w-3xl">
                  <button onClick={() => { setExamView('submissions'); setSubmissionDetail(null) }} className="text-xs text-indigo-400 hover:text-indigo-300 mb-4 block">&larr; Back to Submissions</button>
                  <h2 className="text-lg font-semibold mb-1">{submissionDetail.exam_title}</h2>
                  <p className="text-sm text-slate-300 mb-4">Student: {submissionDetail.student_name} · Status: {submissionDetail.status}</p>

                  <div className="space-y-4">
                    {(submissionDetail.answers || []).map((ans, i) => (
                      <div key={ans.answer_id} className="rounded-xl border border-[#272d47] bg-[#101426] p-4">
                        <p className="text-sm font-medium text-white mb-2">Q{i + 1}. {ans.question_text} ({ans.max_marks} marks)</p>

                        {submissionDetail.exam_type === 'mcq' ? (
                          <div className="space-y-1">
                            {['A', 'B', 'C', 'D'].map((opt) => {
                              const optKey = `option_${opt.toLowerCase()}`
                              const isSelected = ans.selected_option === opt
                              const isCorrect = ans.correct_option === opt
                              let bg = 'bg-[#141b35]'
                              if (isSelected && isCorrect) bg = 'bg-emerald-900/30 border-emerald-600/30'
                              else if (isSelected && !isCorrect) bg = 'bg-rose-900/30 border-rose-600/30'
                              else if (isCorrect) bg = 'bg-emerald-900/20 border-emerald-700/20'
                              return (
                                <div key={opt} className={`rounded-lg border border-[#313959] ${bg} px-3 py-2 text-sm text-slate-200`}>
                                  <span className="font-medium mr-2">{opt}.</span>{ans[optKey] || ''}
                                  {isCorrect && <span className="ml-2 text-emerald-400 text-xs">(correct)</span>}
                                  {isSelected && !isCorrect && <span className="ml-2 text-rose-400 text-xs">(selected)</span>}
                                </div>
                              )
                            })}
                            <p className="text-xs text-slate-400 mt-1">Marks: {ans.marks_awarded}/{ans.max_marks}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="rounded-lg border border-[#313959] bg-[#141b35] p-3">
                              <p className="text-xs text-slate-400 mb-1">Student&apos;s Answer:</p>
                              <p className="text-sm text-slate-200">{ans.answer_text || '(no answer)'}</p>
                            </div>
                            <p className="text-xs text-indigo-300">AI Suggested Score: {ans.ai_suggested_score}/{ans.max_marks}</p>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">Your Score</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={gradeAnswers[ans.answer_id]?.marks_awarded ?? ''}
                                    onChange={(e) => setGradeAnswers({ ...gradeAnswers, [ans.answer_id]: { ...gradeAnswers[ans.answer_id], marks_awarded: e.target.value } })}
                                    className="w-16 rounded-lg border border-[#343b5a] bg-[#161b32] px-2 py-1 text-sm text-white focus:outline-none"
                                    max={ans.max_marks}
                                    min={0}
                                  />
                                  <span className="text-xs text-slate-400">/ {ans.max_marks}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Feedback</label>
                              <textarea
                                value={gradeAnswers[ans.answer_id]?.teacher_feedback ?? ''}
                                onChange={(e) => setGradeAnswers({ ...gradeAnswers, [ans.answer_id]: { ...gradeAnswers[ans.answer_id], teacher_feedback: e.target.value } })}
                                rows={2}
                                className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {submissionDetail.exam_type === 'written' && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Overall Remarks</label>
                        <textarea value={gradeRemarks} onChange={(e) => setGradeRemarks(e.target.value)} rows={3} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <button onClick={handleSubmitGrades} disabled={submittingGrade} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
                        {submittingGrade ? 'Submitting...' : 'Submit Grades'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ══════ ANNOUNCEMENTS ══════ */}
              {activeTab === 'announcements' && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Announcements</h2>
                  <div className="rounded-xl border border-[#272d47] bg-[#101426] p-5 mb-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Post Announcement</h3>
                    <div className="space-y-3">
                      <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} placeholder="Body (optional)" rows={3} className="w-full rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">Tag:</label>
                        {['General', 'Assignment', 'Important'].map((t) => (
                          <button key={t} onClick={() => setAnnTag(t)} className={`rounded px-2.5 py-1 text-xs ${annTag === t ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{t}</button>
                        ))}
                      </div>
                      <button onClick={handlePostAnnouncement} disabled={!annTitle.trim() || postingAnn} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-50">
                        {postingAnn ? 'Posting...' : 'Post Announcement'}
                      </button>
                    </div>
                  </div>
                  {announcements.length === 0 ? (
                    <p className="text-sm text-slate-500">No announcements yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {announcements.map((a) => (
                        <article key={a.id} className="rounded-xl border border-[#272d47] bg-[#101426] p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${a.tag === 'Important' ? 'bg-rose-900/40 text-rose-300' : a.tag === 'Assignment' ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-700 text-gray-200'}`}>{a.tag || 'General'}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">{timeAgo(a.created_at)}</span>
                              <button onClick={() => handleDeleteAnnouncement(a.id)} className="rounded bg-red-900/20 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/40" title="Delete announcement">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                          <h4 className="mt-2 text-sm font-semibold text-white">{a.title}</h4>
                          {a.body && <p className="mt-1 text-sm text-slate-300">{a.body}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════ LEADERBOARD ══════ */}
              {activeTab === 'leaderboard' && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
                  <div className="flex gap-2 mb-4">
                    <button onClick={() => setLeaderboardTab('exam')} className={`rounded-lg px-3 py-1.5 text-xs ${leaderboardTab === 'exam' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Per Exam</button>
                    <button onClick={() => { setLeaderboardTab('subject'); loadSubjectLeaderboard() }} className={`rounded-lg px-3 py-1.5 text-xs ${leaderboardTab === 'subject' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Overall Subject</button>
                  </div>

                  {leaderboardTab === 'exam' && (
                    <div>
                      {exams.length > 0 && (
                        <select value={lbExamId} onChange={(e) => loadExamLeaderboard(e.target.value)} className="rounded-lg border border-[#343b5a] bg-[#161b32] px-3 py-2 text-xs text-white mb-4 focus:outline-none">
                          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                        </select>
                      )}
                      <LeaderboardTable entries={examLeaderboard} showExams={false} />
                    </div>
                  )}

                  {leaderboardTab === 'subject' && (
                    <div>
                      <p className="text-sm text-slate-400 mb-3">Overall Subject Ranking — {activeSubject?.name}</p>
                      <LeaderboardTable entries={subjectLeaderboard} showExams />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────── */

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-[#272d47] bg-[#101426] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  )
}

function LeaderboardTable({ entries, showExams }) {
  if (!entries || entries.length === 0) {
    return <p className="py-8 text-center text-slate-500">No leaderboard data yet.</p>
  }

  const top3 = entries.slice(0, 3)
  const medals = ['text-yellow-400', 'text-gray-300', 'text-amber-600']
  const medalLabels = ['1st', '2nd', '3rd']

  return (
    <div>
      {/* Podium */}
      <div className="flex items-end justify-center gap-4 mb-6 pt-4">
        {[1, 0, 2].map((idx) => {
          const entry = top3[idx]
          if (!entry) return <div key={idx} className="w-28" />
          const height = idx === 0 ? 'h-32' : idx === 1 ? 'h-24' : 'h-20'
          return (
            <div key={idx} className="flex flex-col items-center">
              <p className={`text-lg font-bold ${medals[idx]}`}>{medalLabels[idx]}</p>
              <p className="text-sm text-white font-medium mt-1 truncate max-w-[7rem]">{entry.student_name}</p>
              <p className="text-xs text-slate-400">{entry.total_score}</p>
              <div className={`${height} w-20 mt-2 rounded-t-lg ${idx === 0 ? 'bg-yellow-600/30' : idx === 1 ? 'bg-gray-600/30' : 'bg-amber-700/30'}`} />
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#272d47] bg-[#101426] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#272d47]">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Student</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Score</th>
              {showExams && <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Exams</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-[#1e1e2e]">
                <td className="px-4 py-3 text-sm text-white">#{e.rank}</td>
                <td className="px-4 py-3 text-sm text-white">{e.student_name}</td>
                <td className="px-4 py-3 text-sm text-white">{e.total_score}{e.total_marks ? `/${e.total_marks}` : ''}</td>
                {showExams && <td className="px-4 py-3 text-sm text-slate-400">{e.exams_attempted || '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
