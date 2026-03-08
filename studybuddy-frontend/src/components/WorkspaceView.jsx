import React, { useMemo, useRef, useState } from 'react'
import A4Sheet from './A4Sheet'
import LoadingSpinner from './LoadingSpinner'

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
  talkHistory,
  onDeleteTalk,
  onClearTalks,
}) {
  const [question, setQuestion] = useState('')
  const [chatError, setChatError] = useState('')
  const [sendingQuestion, setSendingQuestion] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [selectedSourceIds, setSelectedSourceIds] = useState([])
  const [activeGenerateDocId, setActiveGenerateDocId] = useState(null)
  const [activeDeleteDocId, setActiveDeleteDocId] = useState(null)
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [talkError, setTalkError] = useState('')
  const [activeDeleteTalkId, setActiveDeleteTalkId] = useState(null)
  const [clearingTalks, setClearingTalks] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const fileInputRef = useRef(null)

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
      await onChat(question.trim())
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
    <div className="h-full flex">
      <aside
        className={`border-r border-[#212339] bg-[#0e1019] transition-all duration-300 ${
          isSourcesCollapsed ? 'w-[76px]' : 'w-[19.5rem]'
        }`}
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
              <button
                type="button"
                onClick={() => setIsSourcesCollapsed(true)}
                className="rounded-lg border border-[#31344b] bg-[#171a29] p-2 text-gray-300"
                title="Collapse Sources"
              >
                <PanelIcon className="h-4 w-4" />
              </button>
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

      <main className="relative flex-1 overflow-y-auto bg-[#0a0a0f] p-6 pb-44 md:pb-36 flex items-start justify-center">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        <A4Sheet title={activeTitle} notes={activeNotes} />
      </main>

      <aside className="w-80 bg-[#0f1018] border-l border-[#1e1e2e] flex flex-col">
        <div className="h-14 border-b border-[#1e1e2e] px-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Sensei AI</p>
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <div className="rounded-xl border border-[#2c2d42] bg-[#171827] p-3">
              <p className="text-[10px] uppercase tracking-wider text-indigo-400">Sensei</p>
              <p className="text-sm text-gray-300 mt-1 leading-relaxed">{greeting || 'Ask a question and I will help you study this topic.'}</p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border p-3 ${
                  message.role === 'student'
                    ? 'bg-[#151726] border-[#2b2d42]'
                    : 'bg-[#17152a] border-[#343056]'
                }`}
              >
                <p className={`text-[10px] uppercase tracking-wider ${message.role === 'student' ? 'text-gray-400' : 'text-indigo-400'}`}>
                  {message.role === 'student' ? 'Student' : 'Sensei'}
                </p>
                <p className="text-sm text-gray-200 mt-1 leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            ))
          )}

          <div className="rounded-xl border border-[#2c2d42] bg-[#141522] p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Context Files</p>
            <div className="mt-2 space-y-2">
              {contextDocuments.length > 0 ? (
                contextDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-300 truncate">{doc.filename}</p>
                    <button
                      type="button"
                      onClick={() => handleGenerate(doc)}
                      disabled={activeGenerateDocId === doc.id}
                      className="text-[10px] rounded-md bg-[#25283b] hover:bg-indigo-600 text-gray-300 hover:text-white px-2 py-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {activeGenerateDocId === doc.id ? '...' : 'Notes'}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-1">No documents yet</p>
              )}
            </div>

            {selectedFile && <p className="text-xs text-gray-400 mt-2">Selected: {selectedFile.name}</p>}
            {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
            {uploadSuccess && <p className="text-green-400 text-xs mt-1">Uploaded: {uploadSuccess}</p>}
          </div>

          <div className="rounded-xl border border-[#2c2d42] bg-[#141522] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Talk History</p>
              <button
                type="button"
                onClick={handleClearTalks}
                disabled={clearingTalks || talkHistory.length === 0}
                className="text-[10px] rounded-md bg-[#25283b] hover:bg-red-600 text-gray-300 hover:text-white px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearingTalks ? '...' : 'Clear'}
              </button>
            </div>

            <div className="mt-2 space-y-2 max-h-44 overflow-y-auto pr-1">
              {talkHistory.length > 0 ? (
                talkHistory.slice(0, 12).map((talk) => (
                  <div key={talk.id} className="rounded-lg border border-[#2a2d42] bg-[#171a2a] px-2.5 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-indigo-300">
                          {talk.source === 'voice' ? 'Voice' : 'Text'}
                        </p>
                        <p className="text-xs text-gray-200 mt-1 line-clamp-2">Q: {talk.question}</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">A: {talk.answer}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteTalk(talk.id)}
                        disabled={activeDeleteTalkId === talk.id}
                        className="text-[10px] rounded-md bg-[#3a1e2a] hover:bg-red-600 text-red-100 px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {activeDeleteTalkId === talk.id ? '...' : 'Del'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">No talk history yet</p>
              )}
            </div>

            {talkError && <p className="text-red-400 text-xs mt-2">{talkError}</p>}
          </div>
        </div>

        <div className="border-t border-[#1e1e2e] p-4">
          <form onSubmit={handleSideChat} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask Sensei anything..."
              className="flex-1 bg-[#171827] border border-[#2c2d42] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={sendingQuestion}
              className="rounded-xl px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm min-w-20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {sendingQuestion ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LoadingSpinner />
                  Send
                </span>
              ) : (
                'Send'
              )}
            </button>
          </form>
          {chatError && <p className="text-red-400 text-xs mt-1">{chatError}</p>}
        </div>
      </aside>
    </div>
  )
}
