import React, { useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

export default function Dashboard({ studentName, greeting, documents, sessions, onUpload, onGenerate, onEndSession }) {
  const [sessionForm, setSessionForm] = useState({ topics: '', duration: 30 })
  const [showEndForm, setShowEndForm] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeGenerateDocId, setActiveGenerateDocId] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [sessionSuccess, setSessionSuccess] = useState('')
  const fileInputRef = useRef(null)

  const recentTopics = sessions
    .flatMap((session) => (Array.isArray(session.topics_covered) ? session.topics_covered : []))
    .filter(Boolean)

  const handleUploadSelect = (e) => {
    const file = e.target.files[0]
    setSelectedFile(file || null)
    setUploadError('')
    setUploadSuccess('')
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a PDF first.')
      return
    }

    setUploading(true)
    setUploadError('')
    setGenerateError('')

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

  const handleGenerateLatest = async () => {
    if (documents.length === 0) {
      setGenerateError('No documents available. Upload first.')
      return
    }

    setGenerating(true)
    setGenerateError('')

    try {
      await onGenerate(documents[0])
    } catch (err) {
      setGenerateError(err.message || 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateDocument = async (doc) => {
    setActiveGenerateDocId(doc.id)
    setGenerateError('')
    try {
      await onGenerate(doc)
    } catch (err) {
      setGenerateError(err.message || 'Generation failed.')
    } finally {
      setActiveGenerateDocId(null)
    }
  }

  const handleSaveSession = async () => {
    setSessionSuccess('')
    await onEndSession(sessionForm)
    setShowEndForm(false)
    setSessionSuccess('Session saved successfully.')
  }

  return (
    <div className="h-full w-full bg-[#111118] overflow-y-auto p-4 space-y-5">
      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Welcome</p>
        <div className="bg-[#171827] border border-[#1e1e2e] rounded-xl p-4">
          <p className="text-base font-semibold text-white">{studentName || 'Student'}</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {greeting || "Preparing your personalized greeting..."}
          </p>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Upload PDF</p>
        <div className="bg-[#171827] border border-[#1e1e2e] rounded-xl p-4">
          <label className="block w-full border-2 border-dashed border-gray-600 hover:border-indigo-500 rounded-xl py-4 text-center text-sm text-gray-400 hover:text-indigo-400 cursor-pointer transition-all">
            <div className="mx-auto mb-2 h-9 w-9 rounded-md border border-[#34364f] bg-[#111118] text-[10px] font-semibold text-gray-300 grid place-items-center">PDF</div>
            <p>Click to upload PDF</p>
            <input ref={fileInputRef} id="upload-pdf" type="file" className="hidden" accept="application/pdf" onChange={handleUploadSelect} />
          </label>

          {selectedFile && <p className="text-xs text-gray-400 mt-2">{selectedFile.name}</p>}
          {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
          {uploadSuccess && <p className="text-green-400 text-xs mt-1">{uploadSuccess}</p>}

          <label htmlFor="upload-pdf" className="block w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl py-2 text-center cursor-pointer transition-all">
            Upload
          </label>
          <button
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl py-2 disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            disabled={uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <LoadingSpinner />
                Uploading...
              </span>
            ) : (
              'Upload Now'
            )}
          </button>

          <button
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl py-2 disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            disabled={generating || documents.length === 0}
            onClick={handleGenerateLatest}
          >
            {generating ? (
              <span className="inline-flex items-center justify-center gap-2">
                <LoadingSpinner />
                Generating...
              </span>
            ) : (
              'Generate Notes'
            )}
          </button>

          {generateError && <p className="text-red-400 text-xs mt-1">{generateError}</p>}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">My Documents</p>
        <div className="bg-[#171827] border border-[#1e1e2e] rounded-xl p-4">
          {documents.length > 0 ? (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0 gap-2">
                <p className="text-xs text-gray-300 truncate max-w-32">{doc.filename}</p>
                <button
                  onClick={() => handleGenerateDocument(doc)}
                  disabled={activeGenerateDocId === doc.id}
                  className="text-xs bg-gray-700 hover:bg-indigo-600 text-gray-300 hover:text-white rounded-lg px-2 py-1 transition-all"
                >
                  {activeGenerateDocId === doc.id ? 'Working...' : 'Generate Notes'}
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-500 text-center py-2">No documents yet</p>
          )}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">My Progress</p>
        <div className="bg-[#171827] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-indigo-400">{sessions.length}</p>
            <p className="text-xs text-gray-500 pb-1">sessions completed</p>
          </div>

          <div className="mt-3">
            {recentTopics.length > 0 ? (
              recentTopics.map((topic, index) => (
                <span key={`${topic}-${index}`} className="bg-gray-700 text-gray-300 text-xs rounded-full px-2 py-1 inline-block mt-1 mr-1">
                  {topic}
                </span>
              ))
            ) : (
              <p className="text-xs text-gray-500">No sessions yet</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">End Session</p>
        {!showEndForm ? (
          <button
            onClick={() => setShowEndForm(true)}
            className="w-full bg-[#171827] hover:bg-red-950 border border-[#2f3044] hover:border-red-800 text-gray-300 hover:text-red-300 text-sm rounded-xl py-2 transition-all"
          >
            End Session
          </button>
        ) : (
          <div className="mt-3 space-y-2 bg-[#171827] border border-[#1e1e2e] rounded-xl p-3">
            <div>
              <input
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                value={sessionForm.topics}
                onChange={e => setSessionForm({...sessionForm, topics: e.target.value})}
                placeholder="Topics covered"
              />
            </div>
            <div>
              <input
                type="number"
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                value={sessionForm.duration}
                onChange={e => setSessionForm({...sessionForm, duration: e.target.value})}
                placeholder="Duration (mins)"
              />
            </div>
            <button
              onClick={handleSaveSession}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl py-2"
            >
              Save Session
            </button>
          </div>
        )}
        {sessionSuccess && <p className="text-green-400 text-xs text-center mt-2">{sessionSuccess}</p>}
      </section>
    </div>
  )
}
