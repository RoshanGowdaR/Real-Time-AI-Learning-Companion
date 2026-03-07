import React, { useMemo, useState } from 'react'
import ProgressRing from './ProgressRing'

function getMonday(date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
}

function calculateDuration(startTime, endTime) {
  const [sh = '0', sm = '0'] = (startTime || '').split(':')
  const [eh = '0', em = '0'] = (endTime || '').split(':')
  const startMinutes = Number(sh) * 60 + Number(sm)
  const endMinutes = Number(eh) * 60 + Number(em)
  return Math.max(0, endMinutes - startMinutes)
}

function toSessionEvents(sessions) {
  return sessions
    .map((session) => {
      const createdAt = new Date(session.created_at)
      if (Number.isNaN(createdAt.getTime())) return null

      const duration = Number(session.duration_mins) || 45
      const endDate = new Date(createdAt.getTime() + duration * 60 * 1000)
      const title = Array.isArray(session.topics_covered) && session.topics_covered.length > 0
        ? session.topics_covered[0]
        : 'Study Session'

      return {
        id: `session-${session.id}`,
        title,
        subject: title,
        priority: 'normal',
        date: formatDateKey(createdAt),
        startTime: `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
        durationMins: duration,
        aiSuggested: true,
      }
    })
    .filter(Boolean)
}

function sortEvents(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  return a.startTime.localeCompare(b.startTime)
}

export default function ScheduleView({ sessions, customEvents, onCreateEvent }) {
  const [viewMode, setViewMode] = useState('weekly')
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventError, setEventError] = useState('')
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    subject: '',
    priority: 'normal',
  })

  const now = new Date()
  const weekStart = getMonday(now)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const sessionEvents = useMemo(() => toSessionEvents(sessions), [sessions])

  const preparedCustomEvents = useMemo(
    () => customEvents.map((event) => ({
      ...event,
      durationMins: calculateDuration(event.startTime, event.endTime),
      aiSuggested: false,
    })),
    [customEvents]
  )

  const allEvents = useMemo(
    () => [...sessionEvents, ...preparedCustomEvents].sort(sortEvents),
    [sessionEvents, preparedCustomEvents]
  )

  const eventsByDate = useMemo(() => {
    const map = new Map()
    allEvents.forEach((event) => {
      if (!map.has(event.date)) map.set(event.date, [])
      map.get(event.date).push(event)
    })
    return map
  }, [allEvents])

  const thisWeekKeys = weekDays.map(formatDateKey)
  const weekMinutes = allEvents
    .filter((event) => thisWeekKeys.includes(event.date))
    .reduce((sum, event) => sum + (event.durationMins || 0), 0)

  const focusScore = Math.min(100, Math.round((weekMinutes / 360) * 100))

  const upcomingDeadlines = preparedCustomEvents
    .filter((event) => event.date >= formatDateKey(now))
    .sort(sortEvents)
    .slice(0, 4)

  const handleSubmitEvent = (e) => {
    e.preventDefault()
    setEventError('')

    const title = eventForm.title.trim()
    const subject = eventForm.subject.trim()

    if (!title) {
      setEventError('Event title is required.')
      return
    }
    if (!eventForm.date) {
      setEventError('Pick a date for the event.')
      return
    }
    if (calculateDuration(eventForm.startTime, eventForm.endTime) <= 0) {
      setEventError('End time must be after start time.')
      return
    }

    onCreateEvent({
      id: crypto.randomUUID(),
      title,
      subject: subject || 'General',
      date: eventForm.date,
      startTime: eventForm.startTime,
      endTime: eventForm.endTime,
      priority: eventForm.priority,
    })

    setEventForm({
      title: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
      subject: '',
      priority: 'normal',
    })
    setShowEventForm(false)
  }

  return (
    <div className="h-full flex bg-[#0a0a0f]">
      <aside className="w-64 border-r border-[#1e1e2e] bg-[#0d0e15] p-4 space-y-4 overflow-y-auto">
        <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Daily Goals</p>
          <div className="mt-3 flex justify-center">
            <ProgressRing
              value={focusScore}
              size={96}
              stroke={8}
              trackClass="stroke-[#2a2b3f]"
              progressClass="stroke-indigo-500"
              label="Focus"
            />
          </div>
          <p className="mt-3 text-xs text-gray-400 text-center">{weekMinutes} minutes scheduled this week</p>
        </section>

        <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Upcoming Deadlines</p>
          <div className="mt-3 space-y-2">
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-lg border px-3 py-2 ${
                    event.priority === 'high'
                      ? 'bg-red-950/40 border-red-800'
                      : 'bg-[#1b1d2e] border-[#2d3044]'
                  }`}
                >
                  <p className="text-sm text-white font-medium leading-snug">{event.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {event.date} • {event.startTime}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">No upcoming deadlines yet</p>
            )}
          </div>
        </section>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-4xl font-bold text-white">Mission Control</h2>
            <p className="text-sm text-gray-400 mt-1">Strategic planning with AI-suggested study blocks.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-[#2c2d42] bg-[#171827] p-1 flex">
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs ${viewMode === 'weekly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs ${viewMode === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Monthly
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowEventForm((prev) => !prev)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all"
            >
              Schedule Event
            </button>
          </div>
        </div>

        {showEventForm && (
          <form onSubmit={handleSubmitEvent} className="mt-4 rounded-xl border border-[#2c2d42] bg-[#141522] p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={eventForm.title}
              onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Event title"
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={eventForm.subject}
              onChange={(e) => setEventForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Subject"
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={eventForm.priority}
              onChange={(e) => setEventForm((prev) => ({ ...prev, priority: e.target.value }))}
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
            </select>

            <input
              type="date"
              value={eventForm.date}
              onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="time"
              value={eventForm.startTime}
              onChange={(e) => setEventForm((prev) => ({ ...prev, startTime: e.target.value }))}
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="time"
              value={eventForm.endTime}
              onChange={(e) => setEventForm((prev) => ({ ...prev, endTime: e.target.value }))}
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="md:col-span-3 flex items-center justify-between">
              {eventError ? <p className="text-red-400 text-xs">{eventError}</p> : <span />}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
              >
                Save Event
              </button>
            </div>
          </form>
        )}

        {viewMode === 'weekly' ? (
          <section className="mt-5 rounded-2xl border border-[#1f2132] bg-[#10111a] p-4 overflow-x-auto">
            <div className="grid grid-cols-7 gap-3 min-w-[920px]">
              {weekDays.map((day) => {
                const key = formatDateKey(day)
                const dayEvents = eventsByDate.get(key) || []

                return (
                  <div key={key} className="rounded-xl border border-[#24263a] bg-[#141522] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">{formatDayLabel(day)}</p>
                    <p className="text-lg font-semibold text-white">{formatShortDate(day)}</p>

                    <div className="mt-3 space-y-2">
                      {dayEvents.length > 0 ? (
                        dayEvents.map((event) => (
                          <article
                            key={event.id}
                            className={`rounded-lg border px-2 py-2 ${
                              event.aiSuggested
                                ? 'bg-indigo-600/15 border-indigo-500/40'
                                : event.priority === 'high'
                                  ? 'bg-red-900/20 border-red-700/50'
                                  : 'bg-[#1b1d2e] border-[#2d3044]'
                            }`}
                          >
                            {event.aiSuggested && <p className="text-[9px] uppercase tracking-wider text-indigo-300">AI Suggested</p>}
                            <p className="text-sm text-white font-medium leading-snug">{event.title}</p>
                            <p className="text-[11px] text-gray-400 mt-1">{event.startTime} - {event.endTime}</p>
                          </article>
                        ))
                      ) : (
                        <p className="text-xs text-gray-600 text-center py-2">No blocks</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-2xl border border-[#1f2132] bg-[#10111a] p-4">
            <div className="space-y-2">
              {allEvents.length > 0 ? (
                allEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[#2a2c42] bg-[#151726] px-3 py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white font-medium">{event.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{event.date} • {event.startTime} - {event.endTime}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${event.aiSuggested ? 'bg-indigo-600/20 text-indigo-300' : 'bg-[#23253a] text-gray-300'}`}>
                      {event.aiSuggested ? 'AI' : event.priority}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-6">No events yet. Schedule your first study block.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
