import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

function normalizeEnrollmentRow(row) {
  const subject = row?.subject || {}
  const teacher = row?.teacher || {}
  const organization = row?.organization || {}

  return {
    enrollmentId: String(row?.enrollment_id || row?.id || ''),
    status: String(row?.status || 'pending').toLowerCase(),
    requestedAt: row?.requested_at || '',
    subjectId: String(subject?.id || ''),
    subjectName: String(subject?.name || 'Subject'),
    subjectCode: String(subject?.subject_code || ''),
    teacherName: String(teacher?.full_name || 'Unassigned'),
    orgName: String(organization?.name || ''),
  }
}

function statusBadge(status) {
  if (status === 'approved')
    return <span className="rounded-full border border-emerald-700 bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300">Approved</span>
  if (status === 'rejected')
    return <span className="rounded-full border border-rose-700 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-300">Rejected</span>
  return <span className="rounded-full border border-amber-700 bg-amber-900/25 px-2 py-0.5 text-xs text-amber-300">Pending</span>
}

export default function OrganizationsView({ studentName }) {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('student_id')

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectCode, setSubjectCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const loadSubjects = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    try {
      const res = await api.getStudentSubjects(studentId)
      const rows = Array.isArray(res?.subjects) ? res.subjects : []
      setSubjects(rows.map(normalizeEnrollmentRow).filter((r) => r.subjectId))
    } catch {
      setSubjects([])
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!subjectCode.trim()) { setError('Subject code is required.'); return }
    if (!studentId) return

    setJoining(true)
    setError('')
    setFeedback('')
    try {
      const res = await api.joinSubject(subjectCode.trim().toUpperCase(), studentId)
      const name = res?.subject?.name || 'Class'
      setFeedback(`Request sent for ${name}.`)
      setSubjectCode('')
      await loadSubjects()
    } catch (err) {
      setError(err.message || 'Failed to join class.')
    } finally {
      setJoining(false)
    }
  }

  const approvedCount = useMemo(() => subjects.filter((r) => r.status === 'approved').length, [subjects])

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b12] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* HEADER */}
        <div className="rounded-2xl border border-[#23263a] bg-[linear-gradient(120deg,#131730_0%,#0f1223_55%,#11152b_100%)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-300">My Classes</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Welcome, {studentName || 'Student'}</h2>
              <p className="text-sm text-slate-300 mt-1">Join classes with subject codes and access your enrolled subjects.</p>
            </div>
            <button
              type="button"
              onClick={loadSubjects}
              className="rounded-lg border border-[#343a58] bg-[#1b2140] px-3 py-2 text-xs text-slate-100 hover:border-indigo-400 hover:text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* JOIN FORM */}
          <section className="rounded-2xl border border-[#24283d] bg-[#111424] p-4 xl:col-span-1">
            <h3 className="text-sm font-semibold text-white">Join a Class</h3>
            <p className="mt-1 text-xs text-slate-400">Enter the subject code from your teacher.</p>

            <form onSubmit={handleJoin} className="mt-3 space-y-3">
              <input
                type="text"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                placeholder="e.g. MATH-2048"
                style={{ textTransform: 'uppercase' }}
                className="w-full rounded-lg border border-[#303756] bg-[#0f1324] px-3 py-2 text-sm font-mono tracking-wider text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {error && <p className="text-xs text-rose-300">{error}</p>}
              {feedback && <p className="text-xs text-emerald-300">{feedback}</p>}

              <button
                type="submit"
                disabled={joining}
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {joining ? 'Requesting...' : 'Request to Join'}
              </button>
            </form>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#2d3248] bg-[#0f1322] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Approved</p>
                <p className="mt-1 text-lg font-semibold text-white">{approvedCount}</p>
              </div>
              <div className="rounded-lg border border-[#2d3248] bg-[#0f1322] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Total</p>
                <p className="mt-1 text-lg font-semibold text-white">{subjects.length}</p>
              </div>
            </div>
          </section>

          {/* ENROLLED CLASSES */}
          <section className="rounded-2xl border border-[#24283d] bg-[#111424] p-4 xl:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Enrolled Classes</h3>
              <p className="text-xs text-slate-400">{approvedCount} approved</p>
            </div>

            <div className="mt-3 space-y-3">
              {loading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
                </div>
              ) : subjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#353b59] bg-[#0e1221] px-4 py-8 text-center">
                  <p className="text-sm text-slate-300">No classes yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Enter a subject code to request access.</p>
                </div>
              ) : (
                subjects.map((item) => (
                  <article
                    key={item.enrollmentId || item.subjectId}
                    className="rounded-xl border border-[#2c3250] bg-[#0e1222] p-4 transition-all hover:border-indigo-500/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-base font-semibold text-white">{item.subjectName}</h4>
                        <p className="text-xs text-indigo-300 mt-0.5">{item.subjectCode}</p>
                      </div>
                      {statusBadge(item.status)}
                    </div>

                    <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                      <p>Teacher: {item.teacherName}</p>
                      {item.orgName && <p>Organization: {item.orgName}</p>}
                    </div>

                    {item.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/organizations/${item.subjectId}`)}
                        className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
                      >
                        Open Class
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
