import React, { useMemo, useRef, useState } from 'react'
import A4Sheet from './A4Sheet'
import LoadingSpinner from './LoadingSpinner'

function WorkspaceIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function LibraryIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 4.5h10v11H5z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.5v11" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function FlashcardsIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="4" y="6" width="11" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 4h10v8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function ScheduleIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 2.8v2.4M13 2.8v2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const RAIL_ITEMS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'library', label: 'Library' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'schedule', label: 'Schedule' },
]

function RailIcon({ id }) {
  if (id === 'workspace') return <WorkspaceIcon className="h-4 w-4" />
  if (id === 'library') return <LibraryIcon className="h-4 w-4" />
  if (id === 'flashcards') return <FlashcardsIcon className="h-4 w-4" />
  return <ScheduleIcon className="h-4 w-4" />
}

export default function WorkspaceView({
  activeTab,
  onTabChange,
  activeTitle,
  activeNotes,
  onChat,
  chatMessages,
  greeting,
  documents,
  onGenerate,
  onUpload,
}) {
  const [question, setQuestion] = useState('')
  const [chatError, setChatError] = useState('')
  const [sendingQuestion, setSendingQuestion] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploading, setUploading] = useState(false)
  const [activeGenerateDocId, setActiveGenerateDocId] = useState(null)
  const fileInputRef = useRef(null)

  const quickDocuments = useMemo(() => documents.slice(0, 4), [documents])

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
      await onUpload(selectedFile)
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

  return (
    <div className="h-full flex">
      <aside className="w-16 bg-[#0d0e15] border-r border-[#1e1e2e] flex flex-col items-center py-3 gap-2">
        {RAIL_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onTabChange(id)}
            className={`h-10 w-10 rounded-xl border transition-all grid place-items-center ${
              activeTab === id
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-[#121320] border-[#2a2b3c] text-gray-400 hover:text-white hover:border-indigo-500'
            }`}
          >
            <RailIcon id={id} />
          </button>
        ))}

        <div className="mt-auto w-full px-2">
          <label
            htmlFor="workspace-upload-file"
            className="block text-center text-[10px] text-gray-400 rounded-lg border border-dashed border-[#3a3b4f] py-2 cursor-pointer hover:border-indigo-500 hover:text-indigo-300 transition-all"
          >
            Upload
          </label>
          <input
            id="workspace-upload-file"
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="mt-2 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? '...' : 'Push'}
          </button>
        </div>
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
              {quickDocuments.length > 0 ? (
                quickDocuments.map((doc) => (
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
