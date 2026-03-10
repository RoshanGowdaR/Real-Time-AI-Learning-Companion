import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Landing() {
  const [mode, setMode] = useState('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const finishAuth = (res) => {
    localStorage.setItem('student_id', res.student_id)
    localStorage.setItem('student_name', res.name)
    navigate('/app')
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = name.trim()

    try {
      let res
      if (mode === 'signup') {
        try {
          res = await api.registerStudent(normalizedName, normalizedEmail)
        } catch (signupErr) {
          const message = (signupErr?.message || '').toLowerCase()
          const accountExists =
            message.includes('already registered') ||
            message.includes('already exist') ||
            message.includes('duplicate') ||
            message.includes('unique')

          if (!accountExists) throw signupErr

          // Existing account path: switch UI mode and sign in directly.
          setMode('login')
          res = await api.loginStudent(normalizedEmail)
        }
      } else {
        res = await api.loginStudent(normalizedEmail)
      }

      finishAuth(res)
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.15),transparent_45%)]" />

      <div className="relative w-96 max-w-full bg-[#111118] rounded-2xl p-10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] border border-[#1e1e2e]">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 rounded-lg border border-[#2c2d42] bg-[#171827] grid place-items-center">
            <div className="h-4 w-4 rounded-sm bg-indigo-500" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-white">StudyBuddy</h1>
          <p className="mt-1 text-sm text-gray-400">Focused study space with AI guidance</p>
        </div>

        <div className="mt-6 p-1 bg-[#0f1018] rounded-xl border border-[#1e1e2e] grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError('')
            }}
            className={`rounded-lg py-2 text-sm font-medium transition-all ${mode === 'signup' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
            }}
            className={`rounded-lg py-2 text-sm font-medium transition-all ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Login
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">
          New here? Create account. Returning? Login with email.
        </p>

        <form onSubmit={handleAuth} className="mt-4">
          {mode === 'signup' && (
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#171827] border border-[#2c2d42] text-white rounded-xl px-4 py-3 mt-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
              placeholder="Full name"
            />
          )}

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#171827] border border-[#2c2d42] text-white rounded-xl px-4 py-3 mt-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            placeholder="Email address"
          />

          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3 transition-all duration-200 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <LoadingSpinner />
                <span>{mode === 'signup' ? 'Creating account...' : 'Logging in...'}</span>
              </span>
            ) : (
              mode === 'signup' ? 'Create Account' : 'Continue to Study'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
