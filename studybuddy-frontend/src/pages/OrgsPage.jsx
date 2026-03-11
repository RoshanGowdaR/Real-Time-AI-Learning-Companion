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
    orgName: String(organization?.name || 'Organization'),
  }
}

function statusBadge(status) {
  if (status === 'approved') {
    return (
      <span className="rounded-full border border-emerald-700 bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300">
        Approved
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <span className="rounded-full border border-rose-700 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-300">
        Rejected
      </span>
    )
  }

  return (
    <span className="rounded-full border border-amber-700 bg-amber-900/25 px-2 py-0.5 text-xs text-amber-300">
      Pending
    </span>
  )
}

export default function OrgsPage() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('student_id')
  const studentName = localStorage.getItem('student_name') || 'Student'

  const [subjects, setSubjects] = useState([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [subjectCode, setSubjectCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')

  const loadSubjects = useCallback(async () => {
    if (!studentId) return

    setLoadingSubjects(true)
    try {
      const res = await api.getStudentSubjects(studentId)
      const rows = Array.isArray(res?.subjects) ? res.subjects : []
      setSubjects(rows.map(normalizeEnrollmentRow).filter((row) => row.subjectId))
    } catch (err) {
      setJoinError(err.message || 'Failed to fetch classes.')
      setSubjects([])
    } finally {
      setLoadingSubjects(false)
    }
  }, [studentId])

  useEffect(() => {
    if (!studentId) {
      navigate('/', { replace: true })
      return
    }
    loadSubjects()
  }, [studentId, navigate, loadSubjects])

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!subjectCode.trim()) {
      setJoinError('Subject code is required.')
      return
    }
    if (!studentId) {
      navigate('/', { replace: true })
      return
    }

    setJoining(true)
    setJoinError('')
    setJoinSuccess('')

    try {
      const res = await api.joinSubject(subjectCode.trim().toUpperCase(), studentId)
      const joinedName = res?.subject?.name || 'Subject'
      const joinedCode = res?.subject?.subject_code || subjectCode.trim().toUpperCase()
      setJoinSuccess(`Request sent for ${joinedName} (${joinedCode}).`)
      setSubjectCode('')
      await loadSubjects()
    } catch (err) {
      setJoinError(err.message || 'Failed to request class join.')
    } finally {
      setJoining(false)
    }
  }

  const approvedCount = useMemo(() => {
    return subjects.filter((row) => row.status === 'approved').length
  }, [subjects])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-20 h-14 border-b border-[#1e1e2e] bg-[#111118] px-4 md:px-6">
        <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="rounded-lg bg-gray-800 px-3 py-1 text-xs text-gray-400 transition-all hover:bg-gray-700 hover:text-white"
          >
            Back to Study
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-white md:text-base">
            My Classes
          </h1>

          <div className="rounded-full border border-[#2c2d42] bg-[#161726] px-3 py-1 text-sm text-gray-300">
            {studentName}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <div className="h-full rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-100">My Enrolled Classes</h2>
                <p className="text-xs text-gray-400">{approvedCount} approved</p>
              </div>

              {loadingSubjects ? (
                <div className="flex min-h-[360px] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
                </div>
              ) : subjects.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <p className="text-sm text-gray-500">No classes yet.</p>
                  <p className="mt-1 text-sm text-gray-500">Use a subject code to request access.</p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-190px)] overflow-y-auto pr-1">
                  {subjects.map((item) => (
                    <article
                      key={item.enrollmentId || item.subjectId}
                      className="mb-3 rounded-xl border border-gray-700 bg-gray-800 p-5 transition-all hover:border-indigo-500"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-white">{item.subjectName}</h3>
                        {statusBadge(item.status)}
                      </div>

                      <p className="mt-1 text-xs text-indigo-200">{item.subjectCode || 'N/A'}</p>

                      <div className="mt-2 space-y-1 text-xs text-gray-400">
                        <p>Organization: {item.orgName}</p>
                        <p>Teacher: {item.teacherName}</p>
                      </div>

                      {item.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => navigate(`/app/organizations/${item.subjectId}`)}
                          className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700"
                        >
                          Open Class
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="sticky top-20 rounded-2xl border border-gray-700 bg-gray-900 p-6">
              <h3 className="mb-1 text-base font-semibold text-white">Join a Class</h3>
              <p className="mb-4 text-xs text-gray-500">Enter the subject code provided by your teacher.</p>

              <form onSubmit={handleJoin}>
                <input
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MATH-2048"
                  style={{ textTransform: 'uppercase' }}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {joinError && <p className="mt-2 text-xs text-rose-400">{joinError}</p>}
                {joinSuccess && <p className="mt-2 text-xs text-emerald-300">{joinSuccess}</p>}

                <button
                  type="submit"
                  disabled={joining}
                  className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {joining ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                      Requesting...
                    </span>
                  ) : (
                    'Request to Join Class'
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
