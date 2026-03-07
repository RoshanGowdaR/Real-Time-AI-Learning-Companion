import React, { useCallback, useEffect, useMemo, useState } from 'react'
import WorkspaceView from '../components/WorkspaceView'
import LibraryView from '../components/LibraryView'
import FlashcardsView from '../components/FlashcardsView'
import ScheduleView from '../components/ScheduleView'
import VoiceOrb from '../components/VoiceOrb'
import { api } from '../services/api'

const TAB_ITEMS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'library', label: 'Library' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'schedule', label: 'Schedule' },
]

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore write errors (e.g. storage quota or private mode restrictions).
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function calculateStreak(history) {
  let streak = 0
  const cursor = new Date()

  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if ((history[key] || 0) > 0) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    break
  }

  return streak
}

export default function MainApp() {
  const studentId = localStorage.getItem('student_id')
  const storageSuffix = studentId || 'guest'
  const flashcardsStorageKey = `studybuddy_flashcards_${storageSuffix}`
  const flashStatsStorageKey = `studybuddy_flash_stats_${storageSuffix}`
  const scheduleStorageKey = `studybuddy_schedule_${storageSuffix}`

  const [student] = useState({
    id: studentId,
    name: localStorage.getItem('student_name')
  })
  const [activeTab, setActiveTab] = useState('workspace')
  const [greeting, setGreeting] = useState('')
  const [documents, setDocuments] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeNotes, setActiveNotes] = useState('')
  const [activeTitle, setActiveTitle] = useState('')
  const [speakText, setSpeakText] = useState('')
  const [chatMessages, setChatMessages] = useState([])

  const [flashcards, setFlashcards] = useState(() =>
    readJsonStorage(flashcardsStorageKey, [])
  )
  const [flashStats, setFlashStats] = useState(() =>
    readJsonStorage(flashStatsStorageKey, { history: {} })
  )
  const [customEvents, setCustomEvents] = useState(() =>
    readJsonStorage(scheduleStorageKey, [])
  )

  useEffect(() => {
    writeJsonStorage(flashcardsStorageKey, flashcards)
  }, [flashcardsStorageKey, flashcards])

  useEffect(() => {
    writeJsonStorage(flashStatsStorageKey, flashStats)
  }, [flashStatsStorageKey, flashStats])

  useEffect(() => {
    writeJsonStorage(scheduleStorageKey, customEvents)
  }, [scheduleStorageKey, customEvents])

  const fetchData = useCallback(async () => {
    try {
      const mem = await api.getMemory(student.id)
      setGreeting(mem.greeting || '')
      setSessions(mem.recent_sessions || [])
      setSpeakText(mem.greeting || '')

      if (mem.greeting) {
        setChatMessages((prev) => {
          if (prev.length > 0) return prev
          return [
            {
              id: `greeting-${Date.now()}`,
              role: 'assistant',
              content: mem.greeting,
            },
          ]
        })
      }

      const docs = await api.getDocuments(student.id)
      setDocuments(docs)
    } catch (err) {
      console.error("Data fetch failed", err)
    }
  }, [student.id])

  // Initial load
  useEffect(() => {
    if (!student.id) return

    const timerId = window.setTimeout(() => {
      fetchData()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [student.id, fetchData])

  const handleUpload = async (file) => {
    try {
      const result = await api.uploadPDF(file, student.id)
      await fetchData()
      setSpeakText("Document uploaded successfully! You can now generate notes.")
      return result
    } catch (err) {
      console.error("Upload failed", err)
      throw err
    }
  }

  const handleGenerate = async (doc) => {
    setActiveTitle(doc.filename)
    setActiveNotes("Generating notes, please wait...")
    try {
      const res = await api.generateNotes(student.id, doc.id, doc.filename)
      setActiveNotes(res.notes)
      setSpeakText(`Your notes for ${doc.filename} are ready!`)
      setActiveTab('workspace')
      return res
    } catch (err) {
      console.error("Notes failed", err)
      setActiveNotes("Error generating notes.")
      throw err
    }
  }

  const handleChat = async (question) => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return null

    const studentMessage = {
      id: `student-${Date.now()}`,
      role: 'student',
      content: trimmedQuestion,
    }
    setChatMessages((prev) => [...prev, studentMessage])

    try {
      const res = await api.chatQuery(student.id, trimmedQuestion)

      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.answer,
        },
      ])

      setSpeakText(res.answer)
      return res
    } catch (err) {
      console.error("Chat failed", err)
      throw err
    }
  }

  const handleVoiceResult = ({ question, answer }) => {
    setChatMessages((prev) => [
      ...prev,
      { id: `voice-student-${Date.now()}`, role: 'student', content: question },
      { id: `voice-assistant-${Date.now()}-a`, role: 'assistant', content: answer },
    ])
  }

  const handleCreateFlashcard = ({ subject, question, answer }) => {
    setFlashcards((prev) => [
      {
        id: crypto.randomUUID(),
        subject,
        question,
        answer,
        mastered: false,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  const handleToggleMastered = (cardId) => {
    setFlashcards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, mastered: !card.mastered } : card
      )
    )
  }

  const handleMarkReviewed = () => {
    const key = todayKey()
    setFlashStats((prev) => ({
      ...prev,
      history: {
        ...(prev.history || {}),
        [key]: ((prev.history || {})[key] || 0) + 1,
      },
    }))
  }

  const handleCreateScheduleEvent = (event) => {
    setCustomEvents((prev) => [...prev, event])
  }

  const reviewStats = useMemo(() => {
    const history = flashStats.history || {}
    const todayReviews = history[todayKey()] || 0
    const streakDays = calculateStreak(history)
    return { todayReviews, streakDays }
  }, [flashStats])

  const handleLogout = () => {
    localStorage.removeItem('student_id')
    localStorage.removeItem('student_name')
    window.location.href = '/'
  }

  return (
    <div className="h-screen w-full bg-[#0a0a0f] md:overflow-hidden overflow-y-auto">
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#111118] border-b border-[#1e1e2e] flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-6 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="h-6 w-6 rounded-md bg-indigo-600 border border-indigo-500 grid place-items-center">
              <span className="h-2 w-2 rounded-sm bg-white" />
            </span>
            <p className="text-white font-semibold">StudyBuddy</p>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-[#171827] border border-[#2c2d42] rounded-xl p-1">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full bg-[#161726] border border-[#2c2d42] px-3 py-1 text-sm text-gray-300 hover:text-white transition-all"
          >
            {student.name || 'Student'}
          </button>
        </div>
      </header>

      <div className="pt-14 h-[calc(100vh-56px)]">
        {activeTab === 'workspace' && (
          <WorkspaceView
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={activeTitle}
            notes={activeNotes}
            activeTitle={activeTitle}
            activeNotes={activeNotes}
            onChat={handleChat}
            chatMessages={chatMessages}
            greeting={greeting}
            documents={documents}
            onGenerate={handleGenerate}
            onUpload={handleUpload}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            documents={documents}
            onUpload={handleUpload}
            onGenerate={handleGenerate}
            onOpenWorkspace={() => setActiveTab('workspace')}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView
            flashcards={flashcards}
            reviewStats={reviewStats}
            onCreateCard={handleCreateFlashcard}
            onToggleMastered={handleToggleMastered}
            onMarkReviewed={handleMarkReviewed}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            sessions={sessions}
            customEvents={customEvents}
            onCreateEvent={handleCreateScheduleEvent}
          />
        )}
      </div>

      <VoiceOrb
        studentId={student.id}
        onResult={handleVoiceResult}
        speakText={speakText}
      />
    </div>
  )
}
