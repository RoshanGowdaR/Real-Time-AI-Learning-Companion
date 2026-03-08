import React, { useCallback, useEffect, useMemo, useState } from 'react'
import HomeView from '../components/HomeView'
import WorkspaceView from '../components/WorkspaceView'
import LibraryView from '../components/LibraryView'
import FlashcardsView from '../components/FlashcardsView'
import ScheduleView from '../components/ScheduleView'
import VoiceOrb from '../components/VoiceOrb'
import { api } from '../services/api'

const TAB_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'library', label: 'Library' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'schedule', label: 'Schedule' },
]

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

function mapFlashcardFromApi(row) {
  return {
    id: String(row.id),
    subject: row.subject || 'General',
    question: row.question || '',
    answer: row.answer || '',
    mastered: Boolean(row.mastered),
    createdAt: row.created_at || new Date().toISOString(),
  }
}

function normalizeTime(value, fallback) {
  if (!value) return fallback
  const text = String(value)
  return text.length >= 5 ? text.slice(0, 5) : fallback
}

function mapScheduleEventFromApi(row) {
  return {
    id: String(row.id),
    title: row.title || 'Untitled Event',
    subject: row.subject || 'General',
    date: String(row.date || ''),
    startTime: normalizeTime(row.start_time, '09:00'),
    endTime: normalizeTime(row.end_time, '10:00'),
    priority: row.priority || 'normal',
  }
}

function sortScheduleEvents(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  return a.startTime.localeCompare(b.startTime)
}

export default function MainApp() {
  const studentId = localStorage.getItem('student_id')
  const storageSuffix = studentId || 'guest'
  const activeWorkspaceStorageKey = `studybuddy_active_workspace_${storageSuffix}`

  const [student] = useState({
    id: studentId,
    name: localStorage.getItem('student_name'),
  })

  const [activeTab, setActiveTab] = useState('home')
  const [greeting, setGreeting] = useState('')
  const [documents, setDocuments] = useState([])
  const [sessions, setSessions] = useState([])
  const [speakText, setSpeakText] = useState('')

  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() =>
    localStorage.getItem(activeWorkspaceStorageKey) || ''
  )
  const [workspaceStates, setWorkspaceStates] = useState({})
  const [workspaceResources, setWorkspaceResources] = useState({})

  const [flashcards, setFlashcards] = useState([])
  const [flashStats, setFlashStats] = useState({ history: {} })
  const [customEvents, setCustomEvents] = useState([])
  const [talkHistory, setTalkHistory] = useState([])

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => String(workspace.id) === String(activeWorkspaceId)) || workspaces[0] || null,
    [workspaces, activeWorkspaceId]
  )

  const activeWorkspaceState = useMemo(() => {
    if (!activeWorkspace?.id) return {}
    return workspaceStates[activeWorkspace.id] || {}
  }, [workspaceStates, activeWorkspace])

  const activeWorkspaceDocumentIds = useMemo(() => {
    if (!activeWorkspace?.id) return []
    const ids = workspaceResources[activeWorkspace.id]
    return Array.isArray(ids) ? ids.map((id) => String(id)) : []
  }, [workspaceResources, activeWorkspace])

  const workspaceDocuments = useMemo(() => {
    if (activeWorkspaceDocumentIds.length === 0) return []
    return documents.filter((doc) => activeWorkspaceDocumentIds.includes(String(doc.id)))
  }, [documents, activeWorkspaceDocumentIds])

  const activeTitle = activeWorkspaceState.activeTitle || `${activeWorkspace?.name || 'Workspace'} Notes`
  const activeNotes = activeWorkspaceState.activeNotes || ''
  const chatMessages = Array.isArray(activeWorkspaceState.chatMessages)
    ? activeWorkspaceState.chatMessages
    : []

  const reviewStats = useMemo(() => {
    const history = flashStats.history || {}
    const todayReviews = history[todayKey()] || 0
    const streakDays = calculateStreak(history)
    return { todayReviews, streakDays }
  }, [flashStats])

  useEffect(() => {
    if (!activeWorkspaceId) return
    localStorage.setItem(activeWorkspaceStorageKey, String(activeWorkspaceId))
  }, [activeWorkspaceStorageKey, activeWorkspaceId])

  const syncWorkspaceStates = useCallback((nextWorkspaces, greetingText) => {
    setWorkspaceStates((prev) => {
      const next = {}

      nextWorkspaces.forEach((workspace) => {
        const id = String(workspace.id)
        const existing = prev[id] || {}
        next[id] = {
          activeTitle: existing.activeTitle || `${workspace.name} Notes`,
          activeNotes: existing.activeNotes || '',
          chatMessages: Array.isArray(existing.chatMessages)
            ? existing.chatMessages
            : greetingText
              ? [{ id: `greeting-${id}`, role: 'assistant', content: greetingText }]
              : [],
        }
      })

      return next
    })
  }, [])

  const fetchData = useCallback(async () => {
    const [
      memoryResult,
      documentsResult,
      workspacesResult,
      workspaceLinksResult,
      flashcardsResult,
      flashStatsResult,
      scheduleResult,
      talksResult,
    ] = await Promise.allSettled([
      api.getMemory(student.id),
      api.getDocuments(student.id),
      api.getWorkspaces(student.id),
      api.getWorkspaceDocumentLinks(student.id),
      api.getFlashcards(student.id),
      api.getFlashcardReviewStats(student.id),
      api.getScheduleEvents(student.id),
      api.getTalks(student.id, 100),
    ])

    let greetingText = ''

    if (memoryResult.status === 'fulfilled') {
      const mem = memoryResult.value
      greetingText = mem.greeting || ''
      setGreeting(greetingText)
      setSessions(mem.recent_sessions || [])
      setSpeakText(greetingText || '')
    } else {
      console.error('Memory fetch failed', memoryResult.reason)
    }

    if (documentsResult.status === 'fulfilled') {
      const docs = Array.isArray(documentsResult.value) ? documentsResult.value : []
      setDocuments(docs)
    } else {
      console.error('Documents fetch failed', documentsResult.reason)
    }

    if (workspacesResult.status === 'fulfilled') {
      const rows = Array.isArray(workspacesResult.value?.workspaces)
        ? workspacesResult.value.workspaces
        : []

      const normalized = rows.map((workspace) => ({
        ...workspace,
        id: String(workspace.id),
      }))

      setWorkspaces(normalized)
      syncWorkspaceStates(normalized, greetingText)

      setActiveWorkspaceId((prev) => {
        if (normalized.length === 0) return ''
        if (normalized.some((workspace) => String(workspace.id) === String(prev))) {
          return String(prev)
        }
        return String(normalized[0].id)
      })
    } else {
      console.error('Workspaces fetch failed', workspacesResult.reason)
    }

    if (workspaceLinksResult.status === 'fulfilled') {
      const links = Array.isArray(workspaceLinksResult.value?.links)
        ? workspaceLinksResult.value.links
        : []

      const mapping = {}
      links.forEach((link) => {
        const workspaceId = String(link.workspace_id)
        const documentId = String(link.document_id)
        if (!mapping[workspaceId]) mapping[workspaceId] = []
        if (!mapping[workspaceId].includes(documentId)) {
          mapping[workspaceId].push(documentId)
        }
      })

      setWorkspaceResources(mapping)
    } else {
      console.error('Workspace resource links fetch failed', workspaceLinksResult.reason)
    }

    if (flashcardsResult.status === 'fulfilled') {
      const rows = Array.isArray(flashcardsResult.value?.flashcards)
        ? flashcardsResult.value.flashcards
        : []
      setFlashcards(rows.map(mapFlashcardFromApi))
    } else {
      console.error('Flashcards fetch failed', flashcardsResult.reason)
    }

    if (flashStatsResult.status === 'fulfilled') {
      setFlashStats({ history: flashStatsResult.value?.history || {} })
    } else {
      console.error('Flashcard review stats fetch failed', flashStatsResult.reason)
    }

    if (scheduleResult.status === 'fulfilled') {
      const rows = Array.isArray(scheduleResult.value?.events)
        ? scheduleResult.value.events
        : []
      setCustomEvents(rows.map(mapScheduleEventFromApi).sort(sortScheduleEvents))
    } else {
      console.error('Schedule events fetch failed', scheduleResult.reason)
    }

    if (talksResult.status === 'fulfilled') {
      const rows = Array.isArray(talksResult.value?.talks)
        ? talksResult.value.talks
        : []
      setTalkHistory(rows)
    } else {
      console.error('Talk history fetch failed', talksResult.reason)
    }
  }, [student.id, syncWorkspaceStates])

  useEffect(() => {
    if (!student.id) return

    const timerId = window.setTimeout(() => {
      fetchData()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [student.id, fetchData])

  const updateActiveWorkspaceState = useCallback((updater) => {
    if (!activeWorkspace?.id) return

    setWorkspaceStates((prev) => {
      const current = prev[activeWorkspace.id] || {
        activeTitle: `${activeWorkspace.name} Notes`,
        activeNotes: '',
        chatMessages: [],
      }

      const nextState = typeof updater === 'function' ? updater(current) : updater
      return {
        ...prev,
        [activeWorkspace.id]: {
          ...current,
          ...nextState,
        },
      }
    })
  }, [activeWorkspace])

  const handleUpload = async (file, options = {}) => {
    const { assignToActiveWorkspace = false } = options

    try {
      const result = await api.uploadPDF(file, student.id)
      const uploadedDocId = String(result.document_id || `doc-${Date.now()}`)

      setDocuments((prev) => {
        const uploadedDoc = {
          id: uploadedDocId,
          filename: result.filename || file.name,
          summary: result.summary || '',
          upload_time: new Date().toISOString(),
        }

        const alreadyExists = prev.some((doc) => String(doc.id) === uploadedDocId)
        if (alreadyExists) return prev
        return [uploadedDoc, ...prev]
      })

      if (assignToActiveWorkspace && activeWorkspace?.id) {
        await api.assignDocumentToWorkspace(student.id, activeWorkspace.id, uploadedDocId)

        setWorkspaceResources((prev) => {
          const current = Array.isArray(prev[activeWorkspace.id]) ? prev[activeWorkspace.id] : []
          if (current.some((id) => String(id) === uploadedDocId)) return prev
          return {
            ...prev,
            [activeWorkspace.id]: [...current, uploadedDocId],
          }
        })
      }

      await fetchData()
      setSpeakText('Document uploaded successfully! You can now generate notes.')
      return result
    } catch (err) {
      console.error('Upload failed', err)
      throw err
    }
  }

  const handleGenerate = async (doc) => {
    updateActiveWorkspaceState({
      activeTitle: doc.filename,
      activeNotes: 'Generating notes, please wait...',
    })

    try {
      const res = await api.generateNotes(student.id, doc.id, doc.filename)
      updateActiveWorkspaceState({
        activeTitle: doc.filename,
        activeNotes: res.notes,
      })

      setSpeakText(`Your notes for ${doc.filename} are ready!`)
      setActiveTab('workspace')
      return res
    } catch (err) {
      console.error('Notes failed', err)
      updateActiveWorkspaceState({ activeNotes: 'Error generating notes.' })
      throw err
    }
  }

  const handleSearchNotes = async (query, searchType) => {
    updateActiveWorkspaceState({
      activeTitle: `${searchType === 'research' ? 'Research' : 'Web'}: ${query}`,
      activeNotes: `Searching the ${searchType === 'research' ? 'academic' : 'world wide'} web for "${query}"...`,
    })

    try {
      const res = await api.generateNotes(student.id, null, null, {
        query,
        search_type: searchType,
      })

      updateActiveWorkspaceState({
        activeNotes: res.notes,
      })

      setSpeakText(`Search results for ${query} are ready!`)
      return res
    } catch (err) {
      console.error('Search failed', err)
      updateActiveWorkspaceState({ activeNotes: 'Error fetching search results.' })
      throw err
    }
  }

  const handleDeleteDocument = async (doc) => {
    if (!doc?.id) return

    await api.deleteDocument(student.id, doc.id)

    setDocuments((prev) => prev.filter((item) => String(item.id) !== String(doc.id)))
    setWorkspaceResources((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).map(([workspaceId, ids]) => [
          workspaceId,
          Array.isArray(ids)
            ? ids.filter((id) => String(id) !== String(doc.id))
            : [],
        ])
      )
      return next
    })

    if (activeTitle === doc.filename) {
      updateActiveWorkspaceState({
        activeTitle: `${activeWorkspace?.name || 'Workspace'} Notes`,
        activeNotes: '',
      })
    }

    setSpeakText(`Removed ${doc.filename} from your resources.`)
    await fetchData()
  }

  const handleChat = async (question) => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return null

    const studentMessage = {
      id: `student-${Date.now()}`,
      role: 'student',
      content: trimmedQuestion,
    }

    updateActiveWorkspaceState((current) => ({
      chatMessages: [...(current.chatMessages || []), studentMessage],
    }))

    try {
      const res = await api.chatQuery(student.id, trimmedQuestion, 'text')

      updateActiveWorkspaceState((current) => ({
        chatMessages: [
          ...(current.chatMessages || []),
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: res.answer,
          },
        ],
      }))

      if (res.chat_id) {
        setTalkHistory((prev) => [
          {
            id: String(res.chat_id),
            question: trimmedQuestion,
            answer: res.answer,
            source: 'text',
            created_at: new Date().toISOString(),
          },
          ...prev.filter((talk) => String(talk.id) !== String(res.chat_id)),
        ].slice(0, 100))
      }

      setSpeakText(res.answer)
      return res
    } catch (err) {
      console.error('Chat failed', err)
      throw err
    }
  }

  const handleVoiceResult = ({ question, answer, chatId }) => {
    updateActiveWorkspaceState((current) => ({
      chatMessages: [
        ...(current.chatMessages || []),
        { id: `voice-student-${Date.now()}`, role: 'student', content: question },
        { id: `voice-assistant-${Date.now()}-a`, role: 'assistant', content: answer },
      ],
    }))

    if (chatId) {
      setTalkHistory((prev) => [
        {
          id: String(chatId),
          question,
          answer,
          source: 'voice',
          created_at: new Date().toISOString(),
        },
        ...prev.filter((talk) => String(talk.id) !== String(chatId)),
      ].slice(0, 100))
    }
  }

  const handleDeleteTalk = async (talkId) => {
    if (!talkId) return
    await api.deleteTalk(student.id, talkId)
    setTalkHistory((prev) => prev.filter((talk) => String(talk.id) !== String(talkId)))
  }

  const handleClearTalks = async () => {
    await api.clearTalks(student.id)
    setTalkHistory([])
  }

  const handleOpenWorkspace = (workspaceId) => {
    setActiveWorkspaceId(String(workspaceId))
    setActiveTab('workspace')
  }

  const handleCreateWorkspace = async (workspaceName) => {
    const normalized = workspaceName.trim()
    if (!normalized) {
      throw new Error('Workspace name is required.')
    }

    const duplicate = workspaces.some(
      (workspace) => String(workspace.name || '').toLowerCase() === normalized.toLowerCase()
    )
    if (duplicate) {
      throw new Error('Workspace already exists.')
    }

    const response = await api.createWorkspace(student.id, normalized)
    const created = {
      ...response.workspace,
      id: String(response.workspace.id),
    }

    setWorkspaces((prev) => [created, ...prev])
    setWorkspaceStates((prev) => ({
      ...prev,
      [created.id]: {
        activeTitle: `${created.name} Notes`,
        activeNotes: '',
        chatMessages: greeting
          ? [
              {
                id: `greeting-${created.id}-${Date.now()}`,
                role: 'assistant',
                content: greeting,
              },
            ]
          : [],
      },
    }))
    setWorkspaceResources((prev) => ({
      ...prev,
      [created.id]: [],
    }))

    setActiveWorkspaceId(created.id)
    setActiveTab('workspace')
  }

  const handleDeleteWorkspace = async (workspaceId) => {
    if (workspaces.length <= 1) {
      throw new Error('At least one workspace must remain.')
    }

    await api.deleteWorkspace(student.id, workspaceId)

    const remaining = workspaces.filter((workspace) => String(workspace.id) !== String(workspaceId))
    if (remaining.length === workspaces.length) return

    setWorkspaces(remaining)
    setWorkspaceStates((prev) => {
      const next = { ...prev }
      delete next[String(workspaceId)]
      return next
    })
    setWorkspaceResources((prev) => {
      const next = { ...prev }
      delete next[String(workspaceId)]
      return next
    })

    if (String(workspaceId) === String(activeWorkspaceId)) {
      setActiveWorkspaceId(String(remaining[0].id))
      setActiveTab('workspace')
    }
  }

  const handleCreateFlashcard = async ({ subject, question, answer }) => {
    const response = await api.createFlashcard(student.id, { subject, question, answer })
    const created = mapFlashcardFromApi(response.flashcard)

    setFlashcards((prev) => {
      const withoutDuplicate = prev.filter((card) => String(card.id) !== String(created.id))
      return [created, ...withoutDuplicate]
    })
  }

  const handleDeleteFlashcard = async (cardId) => {
    await api.deleteFlashcard(student.id, cardId)
    setFlashcards((prev) => prev.filter((card) => String(card.id) !== String(cardId)))
  }

  const handleToggleMastered = async (cardId) => {
    const current = flashcards.find((card) => String(card.id) === String(cardId))
    if (!current) return

    const response = await api.updateFlashcard(student.id, cardId, { mastered: !current.mastered })
    const updated = mapFlashcardFromApi(response.flashcard)

    setFlashcards((prev) =>
      prev.map((card) => (String(card.id) === String(cardId) ? updated : card))
    )
  }

  const handleMarkReviewed = async () => {
    try {
      const response = await api.incrementFlashcardReviewStats(student.id)
      setFlashStats({ history: response.history || {} })
    } catch (err) {
      console.error('Review stats update failed', err)
    }
  }

  const handleCreateScheduleEvent = async (event) => {
    const response = await api.createScheduleEvent(student.id, event)
    const created = mapScheduleEventFromApi(response.event)

    setCustomEvents((prev) => [...prev, created].sort(sortScheduleEvents))
  }

  const handleDeleteScheduleEvent = async (eventId) => {
    await api.deleteScheduleEvent(student.id, eventId)
    setCustomEvents((prev) => prev.filter((event) => String(event.id) !== String(eventId)))
  }

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
        {activeTab === 'home' && (
          <HomeView
            studentName={student.name}
            sessions={sessions}
            documents={documents}
            reviewStats={reviewStats}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspace?.id}
            onOpenWorkspace={handleOpenWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
          />
        )}

        {activeTab === 'workspace' && (
          <WorkspaceView
            workspaceName={activeWorkspace?.name}
            activeTitle={activeTitle}
            activeNotes={activeNotes}
            onChat={handleChat}
            chatMessages={chatMessages}
            greeting={greeting}
            documents={workspaceDocuments}
            onGenerate={handleGenerate}
            onSearchNotes={handleSearchNotes}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            talkHistory={talkHistory}
            onDeleteTalk={handleDeleteTalk}
            onClearTalks={handleClearTalks}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            documents={documents}
            onUpload={handleUpload}
            onGenerate={handleGenerate}
            onOpenWorkspace={() => setActiveTab('workspace')}
            onDeleteDocument={handleDeleteDocument}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView
            flashcards={flashcards}
            reviewStats={reviewStats}
            onCreateCard={handleCreateFlashcard}
            onToggleMastered={handleToggleMastered}
            onMarkReviewed={handleMarkReviewed}
            onDeleteCard={handleDeleteFlashcard}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            sessions={sessions}
            customEvents={customEvents}
            onCreateEvent={handleCreateScheduleEvent}
            onDeleteEvent={handleDeleteScheduleEvent}
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
