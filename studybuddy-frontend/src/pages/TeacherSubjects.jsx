import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearTeacherSession,
  getTeacherSession,
  setTeacherActiveSubject,
} from '../utils/teacherSession'

export default function TeacherSubjects() {
  const navigate = useNavigate()
  const [session, setSession] = useState(() => getTeacherSession())

  useEffect(() => {
    if (!session?.teacher_id) {
      navigate('/teacher/login', { replace: true })
      return
    }

    const subjects = Array.isArray(session.subjects) ? session.subjects : []
    if (subjects.length === 1 && subjects[0]?.id) {
      setTeacherActiveSubject(String(subjects[0].id))
      navigate('/teacher/home', { replace: true })
    }
  }, [session, navigate])

  const subjects = useMemo(() => {
    return Array.isArray(session?.subjects) ? session.subjects : []
  }, [session])

  const handleSelectSubject = (subjectId) => {
    setTeacherActiveSubject(String(subjectId))
    setSession(getTeacherSession())
    navigate('/teacher/home')
  }

  const handleLogout = () => {
    clearTeacherSession()
    setSession(null)
    navigate('/teacher/login')
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-[#090b14] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-2xl border border-[#242a44] bg-[linear-gradient(120deg,#11152f_0%,#0f1326_55%,#0b1020_100%)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-300">Teacher Portal</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">Choose Your Subject</h1>
              <p className="text-sm text-slate-300 mt-1">Select a subject workspace to continue.</p>
            </div>
            <div className="flex items-center gap-2">
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

        <section className="rounded-2xl border border-[#272d47] bg-[#101426] p-4">
          {subjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#3a4368] bg-[#0d1122] p-8 text-center">
              <p className="text-sm text-slate-300">No subjects are assigned to this teacher yet.</p>
              <p className="text-xs text-slate-500 mt-1">Contact your organization admin to create or assign a subject.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => handleSelectSubject(subject.id)}
                  className="rounded-xl border border-[#313a5a] bg-[#141a34] p-4 text-left transition-all hover:border-indigo-400 hover:bg-[#171f3d]"
                >
                  <p className="text-base font-semibold text-white">{subject.name || 'Subject'}</p>
                  <p className="mt-1 text-xs text-indigo-200">{subject.subject_code || 'N/A'}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
