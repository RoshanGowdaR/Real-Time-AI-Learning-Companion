import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { setTeacherSession } from '../utils/teacherSession'

export default function TeacherLogin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const storeAndNavigate = (loginResult) => {
    const subjects = Array.isArray(loginResult.subjects)
      ? loginResult.subjects
      : (loginResult.subject ? [loginResult.subject] : [])
    const activeSubject = loginResult.active_subject || subjects[0] || null

    setTeacherSession({
      teacher_id: loginResult.teacher_id,
      full_name: loginResult.full_name,
      email: loginResult.email,
      org_id: loginResult.org_id,
      subjects,
      active_subject_id: activeSubject?.id ? String(activeSubject.id) : null,
      subject: activeSubject,
    })

    if (subjects.length > 1) {
      navigate('/teacher/subjects')
      return
    }

    navigate('/teacher/home')
  }

  const handleTeacherLogin = async (e) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const loginResult = await api.teacherLogin(loginEmail.trim().toLowerCase(), loginPassword)
      storeAndNavigate(loginResult)
    } catch (err) {
      setError(err.message || 'Teacher login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#090b14] px-4 py-8 flex items-center justify-center">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[#21253a] bg-[#0f1221] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-300">Teacher Portal</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Teacher Login</h1>
            <p className="text-sm text-slate-400 mt-1">Use email and password provided by your organization.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-[#343b5a] bg-[#171c35] px-3 py-2 text-xs text-slate-200 hover:border-indigo-400"
          >
            Back To Portal Selection
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <form onSubmit={handleTeacherLogin} className="mt-4 grid gap-3">
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="Teacher email"
            className="w-full rounded-lg border border-[#313856] bg-[#11162b] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-[#313856] bg-[#11162b] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner />
                Signing in...
              </span>
            ) : 'Sign In As Teacher'}
          </button>
        </form>
      </div>
    </div>
  )
}
