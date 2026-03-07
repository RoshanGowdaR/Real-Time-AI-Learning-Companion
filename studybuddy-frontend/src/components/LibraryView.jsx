import React, { useMemo, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import ProgressRing from './ProgressRing'

const FILTERS = [
  { id: 'all', label: 'All Files' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'doc', label: 'Docs' },
  { id: 'sheet', label: 'Spreadsheets' },
  { id: 'recording', label: 'Recordings' },
]

function getFileType(filename = '') {
  const extension = filename.split('.').pop()?.toLowerCase()

  if (extension === 'pdf') return 'pdf'
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(extension)) return 'doc'
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'sheet'
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) return 'recording'
  return 'other'
}

function getSubjectFromFilename(filename = '') {
  const plain = filename.replace(/\.[^/.]+$/, '')
  const parts = plain.split(/[-_\s]+/).filter(Boolean)
  if (parts.length === 0) return 'General'
  return parts.slice(0, 2).join(' ')
}

function formatRelativeTime(value) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absMs < hour) return formatter.format(Math.round(diffMs / minute), 'minute')
  if (absMs < day) return formatter.format(Math.round(diffMs / hour), 'hour')
  return formatter.format(Math.round(diffMs / day), 'day')
}

function summarize(text = '') {
  if (!text) return 'No summary yet. Generate notes to create context.'
  const cleaned = text
    .replace(/[#>*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned
}

export default function LibraryView({ documents, onUpload, onGenerate, onOpenWorkspace }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [activeGenerateId, setActiveGenerateId] = useState(null)
  const [generateError, setGenerateError] = useState('')
  const fileInputRef = useRef(null)

  const resourceLimit = Number(import.meta.env.VITE_RESOURCE_LIMIT || 100)

  const subjects = useMemo(() => {
    const map = new Map()
    documents.forEach((doc) => {
      const subject = getSubjectFromFilename(doc.filename)
      map.set(subject, (map.get(subject) || 0) + 1)
    })
    return Array.from(map.entries())
  }, [documents])

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return documents.filter((doc) => {
      const fileType = getFileType(doc.filename)
      const typeMatches = activeFilter === 'all' || fileType === activeFilter
      const queryMatches =
        query.length === 0 ||
        doc.filename.toLowerCase().includes(query) ||
        (doc.summary || '').toLowerCase().includes(query)

      return typeMatches && queryMatches
    })
  }, [documents, activeFilter, searchQuery])

  const usagePercent = Math.min(100, Math.round((documents.length / resourceLimit) * 100))

  const handleSelectUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    setUploadSuccess('')
    setGenerateError('')
    setUploading(true)

    try {
      await onUpload(file)
      setUploadSuccess(file.name)
    } catch (err) {
      setUploadError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleGenerate = async (doc) => {
    setGenerateError('')
    setActiveGenerateId(doc.id)
    try {
      await onGenerate(doc)
      onOpenWorkspace()
    } catch (err) {
      setGenerateError(err.message || 'Could not generate notes.')
    } finally {
      setActiveGenerateId(null)
    }
  }

  return (
    <div className="h-full flex bg-[#0a0a0f]">
      <aside className="w-56 border-r border-[#1e1e2e] bg-[#0d0e15] p-4 flex flex-col">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Core Subjects</p>
          <div className="mt-3 space-y-2">
            {subjects.length > 0 ? (
              subjects.map(([subject, count]) => (
                <div key={subject} className="rounded-lg border border-[#25273b] bg-[#141522] px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-gray-300 truncate pr-2">{subject}</span>
                  <span className="text-[10px] text-indigo-400">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">No subjects yet</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-gray-500">Collections</p>
          <div className="mt-3 space-y-2 text-xs text-gray-300">
            <div className="rounded-lg border border-[#25273b] bg-[#141522] px-3 py-2 flex items-center justify-between">
              <span>All Resources</span>
              <span className="text-indigo-400">{documents.length}</span>
            </div>
            <div className="rounded-lg border border-[#25273b] bg-[#141522] px-3 py-2 flex items-center justify-between">
              <span>Needs Notes</span>
              <span className="text-indigo-400">{documents.filter((doc) => !doc.summary).length}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto rounded-xl border border-[#2a2b3f] bg-[#141522] p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Storage Status</p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressRing
              value={usagePercent}
              size={72}
              stroke={7}
              progressClass="stroke-indigo-500"
              trackClass="stroke-[#26283b]"
              label="used"
            />
            <div>
              <p className="text-sm text-white font-semibold">{documents.length} resources</p>
              <p className="text-[11px] text-gray-400">Limit: {resourceLimit}</p>
            </div>
          </div>
          {uploading && <p className="text-xs text-indigo-300 mt-1">Uploading resource...</p>}
          {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
          {uploadSuccess && <p className="text-green-400 text-xs mt-1">Uploaded: {uploadSuccess}</p>}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-4xl font-bold text-white">Mission Archives</h2>
            <p className="text-sm text-gray-400 mt-1">Secure storage for all your academic resources.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveFilter('all')
                setSearchQuery('')
              }}
              className="px-4 py-2 rounded-xl border border-[#2c2d42] bg-[#171827] text-gray-300 text-sm hover:border-indigo-500 hover:text-white transition-all"
            >
              Reset
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              className="hidden"
              onChange={handleSelectUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all"
            >
              New Resource
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                activeFilter === filter.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#171827] text-gray-400 hover:text-white border border-[#2c2d42]'
              }`}
            >
              {filter.label}
            </button>
          ))}

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mission archives..."
            className="ml-auto max-w-72 w-full bg-[#171827] border border-[#2c2d42] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {generateError && <p className="text-red-400 text-xs mt-2">{generateError}</p>}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => {
              const type = getFileType(doc.filename)
              const subject = getSubjectFromFilename(doc.filename)

              return (
                <article key={doc.id} className="rounded-2xl border border-[#23243a] bg-[#131420] p-4 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-[#20233a] text-indigo-300 text-[10px] uppercase tracking-widest px-2 py-1">{type}</span>
                    <span className="text-gray-500 text-xs">{formatRelativeTime(doc.upload_time)}</span>
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-white leading-snug">{doc.filename}</h3>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">{summarize(doc.summary)}</p>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] rounded-full bg-[#20233a] text-indigo-300 px-2 py-1 uppercase tracking-wider">{subject}</span>
                    <button
                      type="button"
                      onClick={() => handleGenerate(doc)}
                      disabled={activeGenerateId === doc.id}
                      className="text-xs rounded-lg bg-[#25283b] hover:bg-indigo-600 text-gray-300 hover:text-white px-3 py-1.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {activeGenerateId === doc.id ? (
                        <span className="inline-flex items-center gap-1">
                          <LoadingSpinner className="w-3.5 h-3.5" />
                          Notes
                        </span>
                      ) : (
                        'Generate Notes'
                      )}
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-[#2c2d42] bg-[#121320] p-8 text-center">
              <p className="text-gray-400">No resources found for this filter.</p>
              <p className="text-gray-500 text-sm mt-1">Upload a PDF to start your archive.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
