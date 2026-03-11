import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { api } from '../services/api'
import { setOrganizationSession } from '../utils/organizationSession'

export default function OrganizationLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [orgName, setOrgName] = useState('')
  const [orgDescription, setOrgDescription] = useState('')
  const [orgEmail, setOrgEmail] = useState('')
  const [orgPassword, setOrgPassword] = useState('')

  const storeAndNavigate = (res) => {
    setOrganizationSession({
      org_id: res.org_id,
      name: res.name,
      invite_code: res.invite_code,
      email: res.email,
    })
    navigate('/organization/home')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.orgAdminLogin(loginEmail.trim().toLowerCase(), loginPassword)
      storeAndNavigate(res)
    } catch (err) {
      setError(err.message || 'Organization login failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!orgName.trim() || !orgEmail.trim() || !orgPassword) {
      setError('Organization name, email, and password are required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.orgAdminRegister({
        name: orgName.trim(),
        description: orgDescription.trim(),
        email: orgEmail.trim().toLowerCase(),
        password: orgPassword,
      })
      setSuccess(`Organization created. Invite code: ${res.invite_code}`)
      storeAndNavigate(res)
    } catch (err) {
      setError(err.message || 'Could not create organization account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#090b14] px-4 py-8">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-[#222841] bg-[#0f1221] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-300">Organization Portal</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Organization Admin Access</h1>
            <p className="text-sm text-slate-400 mt-1">Create organization account and manage teacher credentials.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-[#343b5a] bg-[#171c35] px-3 py-2 text-xs text-slate-200 hover:border-indigo-400"
          >
            Back To Portal Selection
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-[#232841] bg-[#0a0d1c] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
              setSuccess('')
            }}
            className={`rounded-lg px-3 py-2 text-sm transition-all ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Organization Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError('')
              setSuccess('')
            }}
            className={`rounded-lg px-3 py-2 text-sm transition-all ${mode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Create Organization
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="mt-4 grid gap-3">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Organization admin email"
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
              ) : 'Sign In As Organization'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="mt-4 grid gap-3">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization name"
              className="w-full rounded-lg border border-[#313856] bg-[#11162b] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={orgDescription}
              onChange={(e) => setOrgDescription(e.target.value)}
              placeholder="Organization description"
              className="w-full rounded-lg border border-[#313856] bg-[#11162b] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="email"
              value={orgEmail}
              onChange={(e) => setOrgEmail(e.target.value)}
              placeholder="Organization admin email"
              className="w-full rounded-lg border border-[#313856] bg-[#11162b] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password"
              value={orgPassword}
              onChange={(e) => setOrgPassword(e.target.value)}
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
                  Creating organization...
                </span>
              ) : 'Create Organization Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
