import React, { useMemo, useState } from 'react'
import ProgressRing from './ProgressRing'

const TIMELINE_START_MINUTES = 8 * 60
const TIMELINE_END_MINUTES = 22 * 60
const TIMELINE_INTERVAL_MINUTES = 120
const TIMELINE_HEIGHT_PX = 500

function PlusIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon({ className = 'h-3 w-3' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

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

function formatWeekRange(startDate) {
  const endDate = addDays(startDate, 6)
  const startLabel = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `Week of ${startLabel} - ${endLabel}`
}

function formatDayName(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
}

function formatDayNumber(date) {
  return date.toLocaleDateString(undefined, { day: '2-digit' })
}

function formatAgendaDate(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`)
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function toMinutes(timeText) {
  const [hours = '0', minutes = '0'] = (timeText || '').split(':')
  const h = Number(hours)
  const m = Number(minutes)

  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function formatTimeLabel(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const suffix = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function calculateDuration(startTime, endTime) {
  const startMinutes = toMinutes(startTime)
  const endMinutes = toMinutes(endTime)

  if (startMinutes === null || endMinutes === null) return 0
  if (startMinutes === endMinutes) return 0

  if (endMinutes > startMinutes) {
    return endMinutes - startMinutes
  }

  // Treat end earlier than start as an overnight block crossing midnight.
  return 24 * 60 - startMinutes + endMinutes
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

function getCompactEventHeight(durationMins) {
  if (durationMins >= 360) return 94
  if (durationMins >= 240) return 84
  if (durationMins >= 120) return 74
  if (durationMins >= 60) return 64
  return 56
}

function getTimelineLayout(event) {
  const startMinutes = toMinutes(event.startTime)
  if (startMinutes === null) return null

  const totalRange = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES
  if (totalRange <= 0) return null

  const clippedStart = Math.min(Math.max(startMinutes, TIMELINE_START_MINUTES), TIMELINE_END_MINUTES)
  if (clippedStart >= TIMELINE_END_MINUTES) return null

  const topPercent = ((clippedStart - TIMELINE_START_MINUTES) / totalRange) * 100
  const rawTopPx = (topPercent / 100) * TIMELINE_HEIGHT_PX
  const heightPx = getCompactEventHeight(event.durationMins || 45)
  const maxTop = Math.max(0, TIMELINE_HEIGHT_PX - heightPx - 6)
  const topPx = Math.min(rawTopPx, maxTop)

  return { topPx, heightPx }
}

function getTimeMarks() {
  const marks = []
  const totalRange = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES

  for (let minute = TIMELINE_START_MINUTES; minute <= TIMELINE_END_MINUTES; minute += TIMELINE_INTERVAL_MINUTES) {
    marks.push({
      minute,
      label: formatTimeLabel(minute),
      topPercent: ((minute - TIMELINE_START_MINUTES) / totalRange) * 100,
    })
  }

  return marks
}

function getEventToneClass(event) {
  if (event.aiSuggested) {
    return 'bg-indigo-500/20 border-indigo-400/60 text-indigo-100 shadow-[inset_4px_0_0_0_rgba(99,102,241,1)]'
  }

  if (event.priority === 'high') {
    return 'bg-emerald-500/22 border-emerald-400/60 text-emerald-100 shadow-[inset_4px_0_0_0_rgba(16,185,129,0.95)]'
  }

  return 'bg-indigo-500/16 border-indigo-300/45 text-indigo-50 shadow-[inset_4px_0_0_0_rgba(129,140,248,0.85)]'
}

function isEventActiveAtMinutes(event, nowMinutes) {
  const start = toMinutes(event.startTime)
  if (start === null) return false

  const duration = event.durationMins || calculateDuration(event.startTime, event.endTime)
  if (duration <= 0) return false

  const end = start + duration
  if (end <= 24 * 60) {
    return nowMinutes >= start && nowMinutes <= end
  }

  return nowMinutes >= start || nowMinutes <= end - 24 * 60
}

export default function ScheduleView({ sessions, customEvents, onCreateEvent, onDeleteEvent }) {
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
  const todayKey = formatDateKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const weekStart = getMonday(now)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const boardDays = weekDays.slice(0, 5)
  const weekLabel = formatWeekRange(weekStart)
  const timeMarks = useMemo(() => getTimeMarks(), [])

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

  const weekEvents = useMemo(
    () => allEvents.filter((event) => thisWeekKeys.includes(event.date)),
    [allEvents, thisWeekKeys]
  )

  const weekMinutes = weekEvents.reduce((sum, event) => sum + (event.durationMins || 0), 0)
  const focusScore = Math.min(100, Math.round((weekMinutes / 420) * 100))
  const weeklyBlockCount = weekEvents.length
  const highPriorityCount = weekEvents.filter((event) => event.priority === 'high').length

  const currentEventId = useMemo(() => {
    const todayEvents = weekEvents
      .filter((event) => event.date === todayKey)
      .sort(sortEvents)

    const activeEvent = todayEvents.find((event) => isEventActiveAtMinutes(event, nowMinutes))
    if (activeEvent) return activeEvent.id

    const nextEvent = todayEvents.find((event) => {
      const start = toMinutes(event.startTime)
      return start !== null && start >= nowMinutes
    })

    return nextEvent?.id || null
  }, [weekEvents, todayKey, nowMinutes])

  const upcomingDeadlines = preparedCustomEvents
    .filter((event) => event.date >= formatDateKey(now))
    .sort(sortEvents)
    .slice(0, 4)

  const monthAgenda = useMemo(() => {
    const grouped = new Map()
    allEvents.forEach((event) => {
      if (!grouped.has(event.date)) grouped.set(event.date, [])
      grouped.get(event.date).push(event)
    })

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date,
        events: [...events].sort(sortEvents),
      }))
  }, [allEvents])

  const handleSubmitEvent = async (e) => {
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
      setEventError('Start and end time cannot be the same.')
      return
    }

    try {
      await onCreateEvent({
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
    } catch (err) {
      setEventError(err.message || 'Could not create event right now.')
    }
  }

  const handleDeleteEvent = async (event) => {
    if (!event || event.aiSuggested || !onDeleteEvent) return

    try {
      setEventError('')
      await onDeleteEvent(event.id)
    } catch (err) {
      setEventError(err.message || 'Could not delete event right now.')
    }
  }

  return (
    <div className="h-full bg-[#090b14]">
      <div className="h-full flex flex-col lg:flex-row">
        <aside className="lg:w-[320px] border-b lg:border-b-0 lg:border-r border-[#1c1f31] bg-[#0e101b] p-4 sm:p-5 space-y-4 overflow-y-auto">
          <section className="rounded-2xl border border-[#25283d] bg-[#131627] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em]">Daily Goals</p>
              <span className="text-indigo-400 text-xs">Focus</span>
            </div>

            <div className="mt-4 flex justify-center">
              <ProgressRing
                value={focusScore}
                size={118}
                stroke={8}
                trackClass="stroke-[#2b2f49]"
                progressClass="stroke-indigo-500"
                label=""
              />
            </div>

            <p className="mt-3 text-sm text-gray-300 text-center">{focusScore}% focus score</p>

            <div className="mt-4 space-y-2 text-sm">
              <p className="text-gray-300"><span className="text-indigo-400">●</span> {Math.round((weekMinutes / 60) * 10) / 10}h scheduled this week</p>
              <p className="text-gray-300"><span className="text-cyan-400">●</span> {weeklyBlockCount} active study blocks</p>
              <p className="text-gray-300"><span className="text-rose-400">●</span> {highPriorityCount} high-priority deadlines</p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#25283d] bg-[#131627] p-5">
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em]">Upcoming Deadlines</p>
            <div className="mt-3 space-y-2">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.map((event) => (
                  <div
                    key={event.id}
                    className={`rounded-xl border p-3 ${event.priority === 'high' ? 'bg-rose-500/12 border-rose-400/35' : 'bg-[#1a1e33] border-[#2f3450]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">{formatAgendaDate(event.date)} • {event.startTime}</p>
                        <p className="mt-1 text-sm text-white font-medium leading-snug">{event.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event)}
                        className="rounded-md border border-rose-400/30 text-rose-200 hover:text-white hover:bg-rose-600/40 p-1"
                        aria-label="Delete event"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">No upcoming deadlines yet</p>
              )}
            </div>
          </section>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">Mission Control</h2>
              <p className="mt-2 text-lg text-slate-400">{weekLabel}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[#2c3150] bg-[#151a2d] p-1 flex">
                <button
                  type="button"
                  onClick={() => setViewMode('weekly')}
                  className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'weekly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Monthly
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEventForm((prev) => !prev)
                  setEventError('')
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
              >
                <PlusIcon className="h-4 w-4" />
                Schedule Event
              </button>
            </div>
          </div>

          {showEventForm && (
            <form onSubmit={handleSubmitEvent} className="mt-5 rounded-2xl border border-[#2a2f49] bg-[#121626] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Event title"
                className="bg-[#1a1f34] border border-[#2b3150] rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={eventForm.subject}
                onChange={(e) => setEventForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Subject"
                className="bg-[#1a1f34] border border-[#2b3150] rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={eventForm.priority}
                onChange={(e) => setEventForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="bg-[#1a1f34] border border-[#2b3150] rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="normal">Normal Priority</option>
                <option value="high">High Priority</option>
              </select>

              <input
                type="date"
                value={eventForm.date}
                onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
                className="bg-[#1a1f34] border border-[#2b3150] rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={eventForm.startTime}
                onChange={(e) => setEventForm((prev) => ({ ...prev, startTime: e.target.value }))}
                className="bg-[#1a1f34] border border-[#2b3150] rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={eventForm.endTime}
                onChange={(e) => setEventForm((prev) => ({ ...prev, endTime: e.target.value }))}
                className="bg-[#1a1f34] border border-[#2b3150] rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <p className="md:col-span-3 text-[11px] text-gray-500">
                If end time is earlier than start time, the block is treated as overnight.
              </p>

              <div className="md:col-span-3 flex items-center justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
                >
                  Save Event
                </button>
              </div>
            </form>
          )}

          {eventError && (
            <p className="mt-3 text-sm text-rose-400">{eventError}</p>
          )}

          {viewMode === 'weekly' ? (
            <section className="mt-5 rounded-2xl border border-[#1f253f] bg-[#0f1323] p-4 sm:p-5 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  <div className="grid grid-cols-5 border-b border-[#222843] pb-3">
                    {boardDays.map((day) => {
                      const dayKey = formatDateKey(day)
                      const isToday = dayKey === todayKey

                      return (
                        <div key={dayKey} className="px-3 text-center">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{formatDayName(day)}</p>
                          <p className={`mt-1 text-3xl font-semibold ${isToday ? 'text-indigo-400' : 'text-white'}`}>{formatDayNumber(day)}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-2 grid grid-cols-5" style={{ height: `${TIMELINE_HEIGHT_PX}px` }}>
                    {boardDays.map((day) => {
                      const key = formatDateKey(day)
                      const dayEvents = eventsByDate.get(key) || []

                      return (
                        <div key={key} className="relative border-r last:border-r-0 border-[#232945] px-2">
                          {timeMarks.map((mark) => (
                            <div
                              key={`${key}-${mark.minute}`}
                              className="absolute left-0 right-0 border-t border-[#1b2038]"
                              style={{ top: `${mark.topPercent}%` }}
                            />
                          ))}

                          {dayEvents.map((event) => {
                            const layout = getTimelineLayout(event)
                            if (!layout) return null
                            const isCurrent = event.id === currentEventId

                            return (
                              <article
                                key={event.id}
                                className={`absolute left-1 right-1 rounded-xl border px-3 py-2 overflow-hidden ${getEventToneClass(event)}`}
                                style={{
                                  top: `${layout.topPx}px`,
                                  minHeight: `${layout.heightPx}px`,
                                  height: `${layout.heightPx}px`,
                                }}
                              >
                                {!event.aiSuggested && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEvent(event)}
                                    className="absolute top-1 right-1 text-[10px] rounded bg-black/20 hover:bg-black/35 p-0.5"
                                    aria-label="Delete event"
                                  >
                                    <CloseIcon className="h-2.5 w-2.5" />
                                  </button>
                                )}

                                {isCurrent && (
                                  <p className="text-[10px] uppercase tracking-wider text-indigo-300">• Current</p>
                                )}
                                {event.aiSuggested && !isCurrent && (
                                  <p className="text-[10px] uppercase tracking-wider text-indigo-300">Sensei AI Suggested</p>
                                )}
                                <p className="mt-1 text-[12px] leading-none opacity-90">{event.startTime} - {event.endTime}</p>
                                <p className="mt-1 text-sm leading-tight font-semibold pr-4">{event.title}</p>
                              </article>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="mt-5 rounded-2xl border border-[#1f253f] bg-[#0f1323] p-4 sm:p-5">
              <div className="space-y-3">
                {monthAgenda.length > 0 ? (
                  monthAgenda.map((day) => (
                    <div key={day.date} className="rounded-xl border border-[#2a3152] bg-[#141a2d] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{formatAgendaDate(day.date)}</p>
                        <p className="text-xs text-gray-500">{day.events.length} events</p>
                      </div>

                      <div className="mt-2 space-y-2">
                        {day.events.map((event) => (
                          <div key={event.id} className="rounded-lg border border-[#30385d] bg-[#19203a] px-3 py-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs text-gray-400">{event.startTime} - {event.endTime}</p>
                              <p className="text-sm text-white font-medium">{event.title}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${event.aiSuggested ? 'bg-indigo-600/25 text-indigo-200' : event.priority === 'high' ? 'bg-rose-500/25 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                                {event.aiSuggested ? 'AI' : event.priority}
                              </span>
                              {!event.aiSuggested && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEvent(event)}
                                  className="text-[10px] rounded-md bg-[#3a1e2a] hover:bg-rose-600 text-rose-100 px-2 py-1"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
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
    </div>
  )
}
