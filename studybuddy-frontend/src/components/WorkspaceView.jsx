import React, { useEffect, useMemo, useRef, useState } from 'react'
import A4Sheet from './A4Sheet'
import LoadingSpinner from './LoadingSpinner'
import FormattedMessage from './FormattedMessage'

function PanelIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="4" width="14" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4v12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function SearchIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="8.8" cy="8.8" r="5.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12.7 12.7 16.4 16.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function PdfIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M6 3.8h6.8L16 7v9.2H6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.8 3.8V7H16" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.7 10.3h6M7.7 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 4.2v11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.2 10h11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function WorkspaceView({
  workspaceName,
  activeTitle,
  activeNotes,
  onChat,
  chatMessages,
  greeting,
  documents,
  onGenerate,
  onSearchNotes,
  onUpload,
  onDeleteDocument,
  talkHistory = [],
  onDeleteTalk,
  onClearTalks,
  onNewChat,
  onResumeTalk,
  onExitWorkspace,
  faceDetectionOn = false,
  onToggleFaceDetection,
}) {
  const [question, setQuestion] = useState('')
  const [chatError, setChatError] = useState('')
  const [sendingQuestion, setSendingQuestion] = useState(false)
  const [chatViewMode, setChatViewMode] = useState('chat') // 'chat' or 'history'
  const [showContextFiles, setShowContextFiles] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem('studybuddy_chat_width')
    return saved ? parseInt(saved, 10) : 380
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [selectedSourceIds, setSelectedSourceIds] = useState([])
  const [activeGenerateDocId, setActiveGenerateDocId] = useState(null)
  const [activeDeleteDocId, setActiveDeleteDocId] = useState(null)
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false)
  const [isAiCollapsed, setIsAiCollapsed] = useState(false)
  const [mobilePanel, setMobilePanel] = useState('notes')
  const [deleteError, setDeleteError] = useState('')
  const [talkError, setTalkError] = useState('')
  const [activeDeleteTalkId, setActiveDeleteTalkId] = useState(null)
  const [clearingTalks, setClearingTalks] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (chatViewMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, sendingQuestion, chatViewMode])

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX
      const clamped = Math.max(280, Math.min(newWidth, Math.min(950, window.innerWidth * 0.65)))
      setChatWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    if (chatWidth) {
      localStorage.setItem('studybuddy_chat_width', String(chatWidth))
    }
  }, [chatWidth])

  const filteredTalkHistory = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase()
    if (!q) return talkHistory
    return talkHistory.filter(
      (t) =>
        String(t.question || '').toLowerCase().includes(q) ||
        String(t.answer || '').toLowerCase().includes(q)
    )
  }, [talkHistory, historySearchQuery])

  const contextDocuments = useMemo(() => {
    const selected = documents.filter((doc) => selectedSourceIds.includes(String(doc.id)))
    return selected.length > 0 ? selected.slice(0, 4) : documents.slice(0, 4)
  }, [documents, selectedSourceIds])

  const filteredDocuments = useMemo(() => {
    const query = sourceQuery.trim().toLowerCase()
    if (!query) return documents

    return documents.filter(
      (doc) =>
        doc.filename.toLowerCase().includes(query) ||
        String(doc.summary || '').toLowerCase().includes(query)
    )
  }, [documents, sourceQuery])

  const allVisibleSelected =
    filteredDocuments.length > 0 &&
    filteredDocuments.every((doc) => selectedSourceIds.includes(String(doc.id)))

  const handleSideChat = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    setChatError('')
    setSendingQuestion(true)
    try {
      await onChat(question.trim(), {
        activeNotes,
        activeTitle,
        selectedSourceIds,
      })
      setQuestion('')
    } catch (err) {
      setChatError(err.message || 'Could not send question right now.')
    } finally {
      setSendingQuestion(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setSelectedFile(file || null)
    setUploadError('')
    setUploadSuccess('')
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Select a PDF before uploading.')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      await onUpload(selectedFile, { assignToActiveWorkspace: true })
      setUploadSuccess(selectedFile.name)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleGenerate = async (doc) => {
    setActiveGenerateDocId(doc.id)
    try {
      await onGenerate(doc)
      setMobilePanel('notes')
    } catch (err) {
      console.error('Note generation error handled in WorkspaceView:', err)
    } finally {
      setActiveGenerateDocId(null)
    }
  }

  const handleSearchTrigger = async (searchType) => {
    const query = sourceQuery.trim()
    if (!query) {
      setDeleteError('Enter a search term first.')
      return
    }

    if (!onSearchNotes) return

    setIsSearching(true)
    setDeleteError('')
    try {
      await onSearchNotes(query, searchType)
      setSourceQuery('')
    } catch (err) {
      setDeleteError(err.message || 'Search failed.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleDeleteDocument = async (doc) => {
    if (!onDeleteDocument) return

    setDeleteError('')
    setActiveDeleteDocId(doc.id)
    try {
      await onDeleteDocument(doc)
      setSelectedSourceIds((prev) => prev.filter((id) => String(id) !== String(doc.id)))
    } catch (err) {
      setDeleteError(err.message || 'Delete failed.')
    } finally {
      setActiveDeleteDocId(null)
    }
  }

  const handleDeleteTalk = async (talkId) => {
    if (!onDeleteTalk) return

    setTalkError('')
    setActiveDeleteTalkId(talkId)
    try {
      await onDeleteTalk(talkId)
    } catch (err) {
      setTalkError(err.message || 'Could not delete talk history entry.')
    } finally {
      setActiveDeleteTalkId(null)
    }
  }

  const handleClearTalks = async () => {
    if (!onClearTalks) return

    setTalkError('')
    setClearingTalks(true)
    try {
      await onClearTalks()
    } catch (err) {
      setTalkError(err.message || 'Could not clear talk history right now.')
    } finally {
      setClearingTalks(false)
    }
  }

  const toggleSourceSelection = (sourceId) => {
    const normalizedId = String(sourceId)
    setSelectedSourceIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [...prev, normalizedId]
    )
  }

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredDocuments.map((doc) => String(doc.id))
    if (visibleIds.length === 0) return

    setSelectedSourceIds((prev) => {
      const alreadyAllSelected = visibleIds.every((id) => prev.includes(id))
      if (alreadyAllSelected) {
        return prev.filter((id) => !visibleIds.includes(id))
      }
      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }

  const workspaceLabel = workspaceName || 'General'

  return (
    <div className="h-full flex flex-col xl:flex-row overflow-hidden">
      {/* Mobile/Tablet View Switcher (< xl) */}
      <div className="xl:hidden shrink-0 flex items-center justify-between border-b border-[#212339] bg-[#0c0e17] px-3 py-2 z-20">
        <div className="flex items-center gap-1 bg-[#151726] p-1 rounded-xl border border-[#2a2d44]">
          <button
            type="button"
            onClick={() => setMobilePanel('sources')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              mobilePanel === 'sources'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📚 Sources ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel('notes')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              mobilePanel === 'notes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📝 Notes
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel('ai')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              mobilePanel === 'ai'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🤖 Sensei AI
          </button>
        </div>
        <div className="flex items-center gap-2">
          {onToggleFaceDetection && (
            <button
              type="button"
              onClick={onToggleFaceDetection}
              className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                faceDetectionOn
                  ? 'text-red-300 bg-red-950/60 hover:bg-red-900 border-red-700/60'
                  : 'text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900 border-indigo-700/60'
              }`}
              title={faceDetectionOn ? 'Camera is ON. Click to turn off' : 'Camera is OFF. Click to turn on'}
            >
              <span>{faceDetectionOn ? '🔴 Cam: ON (Turn Off)' : '📷 Turn On Cam'}</span>
            </button>
          )}
          <span className="text-xs text-gray-400 font-medium truncate max-w-[110px] sm:max-w-none">{workspaceLabel}</span>
          {onExitWorkspace && (
            <button
              type="button"
              onClick={onExitWorkspace}
              className="text-[11px] text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 rounded-lg px-2 py-0.5 font-medium transition-all shadow-sm"
              title="Exit workspace & submit session feedback"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <aside
          className={`border-r border-[#212339] bg-[#0e1019] transition-all duration-300 ${
            mobilePanel === 'sources' ? 'w-full flex-1 flex flex-col' : 'hidden xl:flex xl:flex-col'
          } ${isSourcesCollapsed ? 'xl:w-[76px]' : 'xl:w-[19.5rem]'}`}
        >
        <input
          id="workspace-upload-file"
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {isSourcesCollapsed ? (
          <div className="h-full flex flex-col items-center py-3 gap-3">
            <button
              type="button"
              onClick={() => setIsSourcesCollapsed(false)}
              className="h-11 w-11 rounded-xl border border-[#31344b] bg-[#171a29] text-gray-300 grid place-items-center"
              title="Expand Sources"
            >
              <PanelIcon className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 w-11 rounded-xl border border-[#31344b] bg-[#171a29] text-gray-300 grid place-items-center hover:border-indigo-500 hover:text-indigo-300"
              title="Add source"
            >
              <PlusIcon className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="w-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Push source"
            >
              {uploading ? '...' : 'Push'}
            </button>

            <div className="mt-auto w-11 rounded-lg border border-[#2a2f45] bg-[#141826] px-1 py-2 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Src</p>
              <p className="text-sm text-white font-semibold leading-tight">{documents.length}</p>
            </div>
          </div>
        ) : (
          <div className="h-full p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[32px] leading-none font-semibold text-gray-100">Sources</h3>
                <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-300 mt-1">{workspaceLabel}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {onExitWorkspace && (
                  <button
                    type="button"
                    onClick={onExitWorkspace}
                    className="rounded-lg border border-rose-800/60 bg-rose-950/60 hover:bg-rose-900 text-rose-200 hover:text-white px-2.5 py-1.5 text-xs font-medium transition-all shadow-sm"
                    title="Exit workspace & submit session feedback"
                  >
                    Exit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSourcesCollapsed(true)}
                  className="rounded-lg border border-[#31344b] bg-[#171a29] p-2 text-gray-300 hover:text-white"
                  title="Collapse Sources"
                >
                  <PanelIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-full border border-[#323650] bg-[#171b2a] px-4 py-3 text-white text-[28px] leading-none flex items-center justify-center gap-3 hover:border-indigo-500 transition-all"
            >
              <span className="text-xl">+</span>
              <span className="text-[20px] font-semibold">Add sources</span>
            </button>

            <div className="rounded-2xl border border-[#2c3046] bg-[#141826] p-3">
              <div className="rounded-xl border border-[#2f334a] bg-[#10131f] px-3 py-2 flex items-center gap-2">
                <SearchIcon className="h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="Search sources"
                  className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSearchTrigger('web')}
                  disabled={isSearching}
                  className="rounded-full border border-[#31364f] bg-[#1a1f30] px-3 py-1.5 text-xs text-gray-200 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                >
                  {isSearching ? '...' : 'Web'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchTrigger('research')}
                  disabled={isSearching}
                  className="rounded-full border border-[#31364f] bg-[#1a1f30] px-3 py-1.5 text-xs text-gray-200 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                >
                  {isSearching ? '...' : 'Fast Research'}
                </button>
                <button
                  type="button"
                  className="ml-auto h-8 w-8 rounded-full border border-[#31364f] bg-[#1a1f30] text-gray-200"
                >&gt;</button>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between px-1">
              <p className="text-sm text-gray-300">Select all sources</p>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                className="h-4 w-4 rounded border-[#3a3f5a] bg-[#151a2a] text-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2 overflow-y-auto pr-1">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => {
                    const selected = selectedSourceIds.includes(String(doc.id))
                  return (
                    <div
                      key={doc.id}
                      className={`rounded-xl border p-3 transition-all ${
                        selected
                          ? 'bg-[#1b2033] border-indigo-500/70'
                          : 'bg-[#121625] border-[#2a2f45]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-red-400">
                          <PdfIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-200 truncate">{doc.filename}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {doc.summary ? 'Indexed source' : 'Uploaded source'}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSourceSelection(doc.id)}
                          className="mt-0.5 h-4 w-4 rounded border-[#3a3f5a] bg-[#151a2a] text-indigo-500 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleGenerate(doc)}
                          disabled={activeGenerateDocId === doc.id}
                          className="rounded-md bg-[#25283b] hover:bg-indigo-600 text-gray-200 text-[11px] px-2.5 py-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {activeGenerateDocId === doc.id ? '...' : 'Use'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc)}
                          disabled={activeDeleteDocId === doc.id}
                          className="rounded-md bg-[#3a1e2a] hover:bg-red-600 text-red-100 text-[11px] px-2.5 py-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {activeDeleteDocId === doc.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="rounded-xl border border-dashed border-[#2a2f45] bg-[#111423] px-3 py-5 text-center text-xs text-gray-500">
                  No sources found.
                </p>
              )}
            </div>

            <div className="mt-auto rounded-xl border border-[#2a2f45] bg-[#141826] p-3 space-y-1.5">
              {selectedFile && <p className="text-xs text-gray-300 truncate">Selected: {selectedFile.name}</p>}
              {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
              {uploadSuccess && <p className="text-green-400 text-xs">Uploaded: {uploadSuccess}</p>}
              {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Push Source'}
              </button>
            </div>
          </div>
        )}
      </aside>

      <main
        className={`relative flex-1 overflow-y-auto bg-[#0a0a0f] p-3 sm:p-6 pb-44 md:pb-36 flex items-start justify-center min-w-0 ${
          mobilePanel === 'notes' ? 'flex' : 'hidden xl:flex'
        }`}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        <A4Sheet title={activeTitle} notes={activeNotes} />
      </main>

      <aside
        style={{
          width: isAiCollapsed
            ? undefined
            : isMaximized
            ? '52%'
            : `${chatWidth}px`,
        }}
        className={`bg-[#0f1018] border-l border-[#1e1e2e] flex flex-col relative transition-[width] ${
          isDragging ? 'transition-none select-none' : 'duration-200'
        } ${
          mobilePanel === 'ai' ? 'w-full flex-1 flex' : 'hidden xl:flex'
        } ${isAiCollapsed ? 'xl:w-[56px]' : ''}`}
      >
        {/* Interactive Drag Handle to resize chat width */}
        {!isAiCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={`hidden xl:block absolute -left-1 top-0 bottom-0 w-2.5 cursor-col-resize z-30 transition-colors ${
              isDragging ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)]' : 'hover:bg-indigo-500/50 bg-transparent'
            }`}
            title="Drag left/right to resize Sensei AI chat panel"
          >
            <div className="absolute top-1/2 -translate-y-1/2 left-0.5 w-1 h-8 rounded-full bg-gray-500/50 pointer-events-none" />
          </div>
        )}

        <div className="h-14 border-b border-[#1e1e2e] px-3 sm:px-4 flex items-center justify-between shrink-0 bg-[#111320]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
            {!isAiCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">Sensei AI</p>
                <p className="text-[10px] text-indigo-300 -mt-0.5">
                  {chatViewMode === 'history' ? 'Chat History' : 'Active Discussion'}
                </p>
              </div>
            )}
          </div>

          {!isAiCollapsed && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onNewChat?.()
                  setChatViewMode('chat')
                }}
                className="flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-950/60 hover:bg-indigo-600 text-indigo-200 hover:text-white px-2 py-1 text-xs transition-all font-medium"
                title="Start a new chat session (like Antigravity IDE)"
              >
                <span>+</span>
                <span className="hidden sm:inline">New Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setChatViewMode((prev) => (prev === 'history' ? 'chat' : 'history'))}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-all font-medium ${
                  chatViewMode === 'history'
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-[#2f334a] bg-[#171a29] text-gray-300 hover:text-white hover:border-gray-500'
                }`}
                title="View past conversation sessions"
              >
                <span>💬</span>
                <span className="hidden sm:inline">History</span>
                {talkHistory.length > 0 && (
                  <span className="text-[10px] px-1 rounded-full bg-black/40 ml-0.5">
                    {talkHistory.length}
                  </span>
                )}
              </button>

              {/* Maximize / Expand Chat Width Toggle */}
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className={`hidden xl:grid place-items-center h-7 w-7 rounded-lg border px-1 text-xs transition-all ${
                  isMaximized
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                    : 'border-[#31344b] bg-[#171a29] text-gray-300 hover:text-white hover:border-gray-500'
                }`}
                title={isMaximized ? 'Restore chat width' : 'Expand chat width (52% split)'}
              >
                {isMaximized ? '🗗' : '⤢'}
              </button>

              <button
                type="button"
                onClick={() => setIsAiCollapsed(!isAiCollapsed)}
                className="hidden xl:grid place-items-center h-7 w-7 rounded-lg border border-[#31344b] bg-[#171a29] text-gray-400 hover:text-white transition-all ml-0.5"
                title={isAiCollapsed ? 'Expand Sensei AI' : 'Collapse Sensei AI'}
              >
                <PanelIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {isAiCollapsed ? (
          <div className="hidden xl:flex flex-col items-center py-4 gap-4 flex-1">
            <button
              type="button"
              onClick={() => setIsAiCollapsed(false)}
              className="h-10 w-10 rounded-xl border border-[#31344b] bg-[#171a29] text-indigo-400 grid place-items-center hover:bg-indigo-600 hover:text-white transition-all"
              title="Expand Sensei AI"
            >
              🤖
            </button>
            <div className="text-[11px] tracking-widest text-gray-500 uppercase font-semibold mt-4" style={{ writingMode: 'vertical-rl' }}>
              Sensei AI
            </div>
          </div>
        ) : chatViewMode === 'history' ? (
          /* ========================================================= */
          /* CHAT HISTORY DRAWER (Antigravity IDE Style)               */
          /* ========================================================= */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0d15]">
            <div className="p-3 border-b border-[#1e1e2e] bg-[#111320] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setChatViewMode('chat')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                >
                  ← Back to Active Chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNewChat?.()
                    setChatViewMode('chat')
                  }}
                  className="text-xs text-indigo-200 bg-indigo-600/80 hover:bg-indigo-600 px-2 py-0.5 rounded-md font-medium"
                >
                  + New Chat
                </button>
              </div>

              <div className="rounded-lg border border-[#2b2e46] bg-[#161828] px-2.5 py-1.5 flex items-center gap-2">
                <SearchIcon className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Search past conversations..."
                  className="w-full bg-transparent text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
                />
                {historySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchQuery('')}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredTalkHistory.length > 0 ? (
                filteredTalkHistory.map((talk) => (
                  <div
                    key={talk.id}
                    className="group rounded-xl border border-[#26283e] bg-[#141624] p-3 hover:border-indigo-500/60 transition-all hover:bg-[#181a2c]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                        {talk.source === 'voice' ? '🎙️ Voice' : '💬 Text'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTalk(talk.id)}
                        disabled={activeDeleteTalkId === talk.id}
                        className="text-[11px] text-gray-500 hover:text-red-400 transition-colors opacity-80 group-hover:opacity-100"
                        title="Delete from history"
                      >
                        {activeDeleteTalkId === talk.id ? '...' : '✕'}
                      </button>
                    </div>

                    <p className="text-xs font-medium text-gray-200 mt-2 line-clamp-2">
                      Q: {talk.question}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                      A: {talk.answer}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-[#202235] flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">
                        {talk.created_at ? new Date(talk.created_at).toLocaleDateString() : 'Recent'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onResumeTalk?.(talk)
                          setChatViewMode('chat')
                        }}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                      >
                        Open in Chat →
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 px-4">
                  <p className="text-3xl mb-2">📜</p>
                  <p className="text-sm font-medium text-gray-400">No conversations found</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {historySearchQuery ? 'Try a different search keyword.' : 'Your chat sessions will appear here.'}
                  </p>
                </div>
              )}
            </div>

            {talkHistory.length > 0 && (
              <div className="p-3 border-t border-[#1e1e2e] bg-[#111320] flex items-center justify-between">
                <span className="text-xs text-gray-500">{talkHistory.length} total discussions</span>
                <button
                  type="button"
                  onClick={handleClearTalks}
                  disabled={clearingTalks}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50"
                >
                  {clearingTalks ? 'Clearing...' : 'Clear All History'}
                </button>
              </div>
            )}
            {talkError && <p className="text-red-400 text-xs px-3 py-1">{talkError}</p>}
          </div>
        ) : (
          /* ========================================================= */
          /* ACTIVE CHAT VIEW                                          */
          /* ========================================================= */
          <>
            {/* Context Documents pill */}
            {contextDocuments.length > 0 && (
              <div className="border-b border-[#1c1e30] bg-[#121422] px-3 py-2 shrink-0">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowContextFiles(!showContextFiles)}
                    className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-medium"
                  >
                    <span>📎 Context Sources ({contextDocuments.length})</span>
                    <span className="text-[10px] text-gray-500">{showContextFiles ? '▲' : '▼'}</span>
                  </button>
                  <span className="text-[10px] text-gray-500">Grounded AI</span>
                </div>

                {showContextFiles && (
                  <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto pt-1">
                    {contextDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#181a2c] px-2 py-1 text-xs">
                        <span className="text-gray-300 truncate">{doc.filename}</span>
                        <button
                          type="button"
                          onClick={() => handleGenerate(doc)}
                          disabled={activeGenerateDocId === doc.id}
                          className="text-[10px] rounded bg-indigo-600/80 hover:bg-indigo-600 text-white px-2 py-0.5 shrink-0 disabled:opacity-50"
                        >
                          {activeGenerateDocId === doc.id ? '...' : 'Notes'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CHAT MESSAGES SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="rounded-2xl border border-[#2b2d44] bg-gradient-to-b from-[#151728] to-[#10121f] p-4 text-center my-4">
                  <span className="text-2xl mb-2 inline-block">🤖</span>
                  <h4 className="text-sm font-semibold text-white">Sensei Study Assistant</h4>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {greeting || 'Ask questions about your notes, request explanations, or practice flashcard concepts.'}
                  </p>
                  <div className="mt-3.5 flex flex-col gap-1.5 text-left">
                    <button
                      type="button"
                      onClick={() => onChat('Can you summarize the main key concepts for this topic?', { activeNotes, activeTitle, selectedSourceIds })}
                      className="rounded-lg border border-[#2b2e46] bg-[#161828] hover:border-indigo-500/60 p-2 text-xs text-gray-300 hover:text-white transition-all"
                    >
                      💡 Summarize key concepts
                    </button>
                    <button
                      type="button"
                      onClick={() => onChat('Quiz me with 3 questions based on my uploaded notes.', { activeNotes, activeTitle, selectedSourceIds })}
                      className="rounded-lg border border-[#2b2e46] bg-[#161828] hover:border-indigo-500/60 p-2 text-xs text-gray-300 hover:text-white transition-all"
                    >
                      🎯 Quiz me with 3 questions
                    </button>
                  </div>
                </div>
              ) : (
                chatMessages.map((message) => {
                  const isUser = message.role === 'student' || message.role === 'user'

                  return (
                    <div
                      key={message.id}
                      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {isUser ? (
                        /* User message bubble (Aligned Right) */
                        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-3.5 py-2.5 shadow-md">
                          <p className="text-[10px] text-indigo-200 font-semibold uppercase tracking-wider mb-1 text-right">
                            You
                          </p>
                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                      ) : (
                        /* Assistant message card (Aligned Left) */
                        <div className="mr-auto max-w-[90%] rounded-2xl rounded-tl-xs bg-[#161829] border border-[#2b2e48] text-gray-100 px-3.5 py-3 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                            <p className="text-[10px] text-indigo-400 uppercase font-semibold tracking-wider">
                              Sensei AI
                            </p>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-200 leading-relaxed">
                            <FormattedMessage content={message.content} />
                          </div>
                          {message.content?.includes('Would you like me to find and explain the answer from the web for you?') && (
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof onChat === 'function') {
                                  onChat('yes, find and explain the answer from the web')
                                }
                              }}
                              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-medium transition-all hover:scale-[1.02] cursor-pointer"
                            >
                              <span>🌐</span>
                              <span>Yes, search web</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {sendingQuestion && (
                <div className="flex justify-start w-full">
                  <div className="mr-auto rounded-2xl rounded-tl-xs bg-[#161829] border border-[#2b2e48] text-indigo-300 px-3.5 py-2 text-xs flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" />
                    <span>Sensei is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* CHAT INPUT AREA */}
            <div className="border-t border-[#1e1e2e] p-3 sm:p-4 bg-[#0d0f19] shrink-0">
              <form onSubmit={handleSideChat} className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask Sensei anything..."
                  className="flex-1 bg-[#171827] border border-[#2c2d42] rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={sendingQuestion || !question.trim()}
                  className="rounded-xl px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium min-w-16 sm:min-w-20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sendingQuestion ? (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <LoadingSpinner />
                      <span>...</span>
                    </span>
                  ) : (
                    'Send'
                  )}
                </button>
              </form>
              {chatError && <p className="text-red-400 text-xs mt-1.5">{chatError}</p>}
            </div>
          </>
        )}
      </aside>
    </div>
  </div>
  )
}
