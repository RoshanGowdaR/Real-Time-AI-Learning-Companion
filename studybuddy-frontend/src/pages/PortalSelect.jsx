import React from 'react'
import { useNavigate } from 'react-router-dom'

function StudentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-indigo-500" aria-hidden="true">
      <path d="m3 9 9-5 9 5-9 5-9-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 11v4.2c0 .8 2 2.8 5 2.8s5-2 5-2.8V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function TeacherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-emerald-500" aria-hidden="true">
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 20v-9h12v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m4 11 8-6 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function OrganizationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-slate-300" aria-hidden="true">
      <path d="M5 20V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V20" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 20v-3h3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PortalCard({ title, description, buttonLabel, onClick, icon, accentClass }) {
  return (
    <article className="rounded-2xl border border-[#2a3048] bg-[#101424] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.3)]">
      <div className={`mx-auto mb-5 h-24 w-24 rounded-full ${accentClass} grid place-items-center`}>
        {icon}
      </div>
      <h3 className="text-center text-4xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-center text-[20px] leading-8 text-slate-300">{description}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-8 w-full rounded-xl bg-indigo-600 py-3 text-[20px] font-medium text-white hover:bg-indigo-500"
      >
        {buttonLabel}
      </button>
    </article>
  )
}

export default function PortalSelect() {
  const navigate = useNavigate()

  return (
    <div className="portal-scene relative min-h-screen overflow-hidden bg-[#060915] px-4 py-6 md:px-6 md:py-8">
      <div className="portal-motion-bg" />
      <div className="portal-motion-orb portal-motion-orb--a" />
      <div className="portal-motion-orb portal-motion-orb--b" />
      <div className="portal-motion-orb portal-motion-orb--c" />
      <div className="portal-motion-grid" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1400px] items-center justify-center">
        <div className="w-full rounded-3xl border border-[#2a3150] bg-[radial-gradient(circle_at_top,#1a2448_0%,#111a34_55%,#0b1124_100%)] px-4 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:px-8 md:py-10">
          <p className="text-xs text-slate-500">Generated Screen</p>
          <h1 className="mt-3 text-center text-5xl font-semibold text-white md:text-6xl">Welcome Back</h1>
          <p className="mt-4 text-center text-2xl text-slate-300 md:text-[34px]">Please select your portal to continue</p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <PortalCard
            title="Student"
            description="Access your courses, assignments, and grades."
            buttonLabel="Login as Student"
            onClick={() => navigate('/student/login')}
            icon={<StudentIcon />}
            accentClass="bg-indigo-500/15"
          />

          <PortalCard
            title="Teacher"
            description="Login using credentials provided by your organization."
            buttonLabel="Login as Teacher"
            onClick={() => navigate('/teacher/login')}
            icon={<TeacherIcon />}
            accentClass="bg-emerald-500/15"
          />

          <PortalCard
            title="Organization"
            description="Create organization account, manage teachers, and authorize students."
            buttonLabel="Login as Organization"
            onClick={() => navigate('/organization/login')}
            icon={<OrganizationIcon />}
            accentClass="bg-slate-400/15"
          />
          </div>
        </div>
      </div>
    </div>
  )
}
