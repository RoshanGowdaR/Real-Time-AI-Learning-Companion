import React, { useMemo, useState } from 'react'

function TrashIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4.7 5.8h10.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 5.8V4.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.2 5.8 6.8 15a1.3 1.3 0 0 0 1.3 1.2h3.8a1.3 1.3 0 0 0 1.3-1.2l.6-9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.6 8.4v5.2M11.4 8.4v5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function normalizeDateKey(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.length >= 10 ? text.slice(0, 10) : ''
}

function toMinutes(timeText) {
  const [h = '0', m = '0'] = String(timeText || '').split(':')
  const hours = Number(h)
  const mins = Number(m)

  if (Number.isNaN(hours) || Number.isNaN(mins)) return null
  return hours * 60 + mins
}

function calculateDuration(startTime, endTime) {
  const startMinutes = toMinutes(startTime)
  const endMinutes = toMinutes(endTime)

  if (startMinutes === null || endMinutes === null) return 45
  if (startMinutes === endMinutes) return 45

  if (endMinutes > startMinutes) {
    return endMinutes - startMinutes
  }

  return 24 * 60 - startMinutes + endMinutes
}

function getLastDays(count) {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    days.push(day)
  }

  return days
}

function buildStudySeries(sessions, scheduleEvents, reviewHistory, dayCount = 7) {
  const days = getLastDays(dayCount)
  const map = new Map(days.map((day) => [formatDateKey(day), 0]))

  sessions.forEach((session) => {
    const createdAt = new Date(session.created_at)
    if (Number.isNaN(createdAt.getTime())) return

    const key = formatDateKey(createdAt)
    if (!map.has(key)) return

    const duration = Number(session.duration_mins) || 45
    map.set(key, map.get(key) + duration)
  })

  scheduleEvents.forEach((event) => {
    const key = normalizeDateKey(event.date)
    if (!map.has(key)) return

    const duration = calculateDuration(event.startTime, event.endTime)
    map.set(key, map.get(key) + duration)
  })

  const history = reviewHistory && typeof reviewHistory === 'object' ? reviewHistory : {}
  Object.entries(history).forEach(([key, count]) => {
    if (!map.has(key)) return

    const reviewCount = Number(count) || 0
    if (reviewCount <= 0) return

    const estimatedMinutes = Math.min(reviewCount * 5, 60)
    if ((map.get(key) || 0) === 0) {
      map.set(key, estimatedMinutes)
    }
  })

  return days.map((day) => {
    const key = formatDateKey(day)
    return {
      key,
      minutes: map.get(key) || 0,
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      shortDate: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }
  })
}

export default function HomeView({
  studentName,
  sessions,
  customEvents,
  documents,
  reviewStats,
  workspaces,
  activeWorkspaceId,
  onOpenWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
}) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')

  const studySeries = useMemo(
    () => buildStudySeries(sessions, customEvents, reviewStats.history, 7),
    [sessions, customEvents, reviewStats.history]
  )

  const totalMinutes = studySeries.reduce((sum, item) => sum + item.minutes, 0)
  const activeStudyDays = studySeries.filter((item) => item.minutes > 0).length
  const avgMinsPerStudyDay = activeStudyDays > 0 ? Math.round(totalMinutes / activeStudyDays) : 0
  const maxMinutes = Math.max(...studySeries.map((item) => item.minutes), 60)
  const trackedSessions = sessions.length > 0
    ? sessions.length
    : customEvents.length > 0
      ? customEvents.length
      : activeStudyDays

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim()
    if (!name) {
      setWorkspaceError('Workspace name is required.')
      return
    }

    try {
      await onCreateWorkspace(name)
      setWorkspaceName('')
      setWorkspaceError('')
    } catch (err) {
      setWorkspaceError(err.message || 'Could not create workspace.')
    }
  }

  const handleDeleteWorkspace = async (workspaceId) => {
    try {
      await onDeleteWorkspace(workspaceId)
      setWorkspaceError('')
    } catch (err) {
      setWorkspaceError(err.message || 'Could not delete workspace.')
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#090b13] p-6 pb-24 space-y-6">
      <section className="rounded-2xl border border-[#242842] bg-[linear-gradient(135deg,rgba(30,35,58,0.95),rgba(17,20,35,0.92))] p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-indigo-300">Home</p>
        <h2 className="mt-2 text-4xl font-semibold text-white">Welcome back, {studentName || 'Student'}</h2>
        <p className="mt-2 text-sm text-gray-400">Track your study flow and jump into your workspace when ready.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className="rounded-xl border border-[#252a44] bg-[#111526] p-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Study Days</p>
          <p className="mt-2 text-3xl font-semibold text-white">{activeStudyDays}</p>
          <p className="text-xs text-gray-400 mt-1">Active in the last 7 days</p>
        </article>

        <article className="rounded-xl border border-[#252a44] bg-[#111526] p-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Average</p>
          <p className="mt-2 text-3xl font-semibold text-white">{avgMinsPerStudyDay}m</p>
          <p className="text-xs text-gray-400 mt-1">Per active study day</p>
        </article>

        <article className="rounded-xl border border-[#252a44] bg-[#111526] p-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Sessions</p>
          <p className="mt-2 text-3xl font-semibold text-white">{trackedSessions}</p>
          <p className="text-xs text-gray-400 mt-1">Recent tracked sessions</p>
        </article>

        <article className="rounded-xl border border-[#252a44] bg-[#111526] p-4">
          <p className="text-xs uppercase tracking-widest text-gray-500">Resources</p>
          <p className="mt-2 text-3xl font-semibold text-white">{documents.length}</p>
          <p className="text-xs text-gray-400 mt-1">Uploaded study files</p>
        </article>
      </section>

      <section className="rounded-2xl border border-[#252a44] bg-[#101425] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-white">Weekly Study Graph</p>
            <p className="text-xs text-gray-400">Minutes studied each day</p>
          </div>
          <p className="text-xs text-indigo-300 uppercase tracking-widest">Streak {reviewStats.streakDays}d</p>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2 items-end h-44">
          {studySeries.map((item) => {
            const height = Math.max(8, Math.round((item.minutes / maxMinutes) * 100))
            return (
              <div key={item.key} className="flex flex-col items-center gap-2">
                <div className="w-full h-28 rounded-lg border border-[#20253a] bg-[#0f1220] flex items-end p-1.5">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-[#38bdf8] via-[#8b5cf6] to-[#f0abfc]"
                    style={{ height: `${height}%` }}
                    title={`${item.minutes} minutes`}
                  />
                </div>
                <p className="text-[10px] text-gray-500">{item.label}</p>
                <p className="text-[10px] text-gray-600">{item.shortDate}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#252a44] bg-[#101425] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-white">My Workspaces</p>
            <p className="text-xs text-gray-400">Create workspace cards and open them from here.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateWorkspace()
              }
            }}
            placeholder="Create new workspace"
            className="w-full md:w-72 rounded-xl border border-[#2d3350] bg-[#161a2c] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            type="button"
            onClick={handleCreateWorkspace}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2"
          >
            Create
          </button>
        </div>

        {workspaceError && <p className="mt-2 text-xs text-red-400">{workspaceError}</p>}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId
            return (
              <article
                key={workspace.id}
                className={`rounded-xl border p-4 ${
                  isActive
                    ? 'border-indigo-500/70 bg-[#1b2040]'
                    : 'border-[#2a2f47] bg-[#14182b]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{workspace.name}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Workspace ready</p>
                  </div>
                  {isActive && (
                    <span className="text-[10px] uppercase tracking-wider text-indigo-300">Active</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(workspace.id)}
                    className="flex-1 rounded-lg border border-[#333a5a] bg-[#1a1f37] hover:bg-indigo-600 text-gray-200 hover:text-white text-sm py-2 transition-all"
                  >
                    Open
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteWorkspace(workspace.id)}
                    disabled={workspaces.length <= 1}
                    title="Delete workspace"
                    aria-label="Delete workspace"
                    className="rounded-lg bg-[#3a1e2a] hover:bg-red-600 text-red-100 p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
