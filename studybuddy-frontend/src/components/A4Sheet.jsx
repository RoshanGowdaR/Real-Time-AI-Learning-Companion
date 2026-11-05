import React, { useCallback, useEffect, useRef, useState } from 'react'

function toPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>(\s|&nbsp;)*/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function formatInline(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-mono font-medium">$1</code>')
}

export function markdownToHtml(md) {
  if (!md) return ''
  const lines = String(md).split('\n')
  const htmlLines = []
  let inList = false
  let listType = null // 'ul' or 'ol'
  let inCodeBlock = false
  let codeBuffer = []

  const closeList = () => {
    if (inList) {
      htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>')
      inList = false
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        htmlLines.push(
          `<pre class="bg-gray-900 text-gray-100 p-3.5 rounded-xl my-3 text-xs overflow-x-auto font-mono leading-relaxed border border-gray-800"><code>${codeBuffer.join('\n')}</code></pre>`
        )
        codeBuffer = []
        inCodeBlock = false
      } else {
        closeList()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      continue
    }

    const trimmed = line.trim()

    if (!trimmed) {
      closeList()
      htmlLines.push('<p><br/></p>')
      continue
    }

    // Horizontal rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList()
      htmlLines.push('<hr class="my-4 border-gray-200" />')
      continue
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      closeList()
      htmlLines.push(
        `<h1 class="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-5 mb-3 pb-2 border-b border-indigo-100">${formatInline(trimmed.slice(2))}</h1>`
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      htmlLines.push(
        `<h2 class="text-xl sm:text-2xl font-bold text-indigo-950 mt-4 mb-2 pb-1 border-b border-gray-100">${formatInline(trimmed.slice(3))}</h2>`
      )
      continue
    }
    if (trimmed.startsWith('### ')) {
      closeList()
      htmlLines.push(
        `<h3 class="text-lg sm:text-xl font-semibold text-indigo-900 mt-3 mb-1.5">${formatInline(trimmed.slice(4))}</h3>`
      )
      continue
    }
    if (trimmed.startsWith('#### ')) {
      closeList()
      htmlLines.push(
        `<h4 class="text-base font-semibold text-gray-800 mt-2 mb-1">${formatInline(trimmed.slice(5))}</h4>`
      )
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      closeList()
      htmlLines.push(
        `<blockquote class="border-l-4 border-indigo-500 bg-indigo-50/70 p-3 my-2.5 rounded-r-xl text-gray-800 italic leading-relaxed">${formatInline(trimmed.slice(2))}</blockquote>`
      )
      continue
    }

    // Bullet lists: *, -, +
    const bulletMatch = line.match(/^(\s*)[*\-+]\s+(.*)$/)
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        closeList()
        htmlLines.push('<ul class="list-disc pl-6 my-2 space-y-1.5 text-gray-700">')
        inList = true
        listType = 'ul'
      }
      htmlLines.push(`<li>${formatInline(bulletMatch[2])}</li>`)
      continue
    }

    // Numbered lists: 1. , 2. 
    const numMatch = line.match(/^(\s*)\d+\.\s+(.*)$/)
    if (numMatch) {
      if (!inList || listType !== 'ol') {
        closeList()
        htmlLines.push('<ol class="list-decimal pl-6 my-2 space-y-1.5 text-gray-700">')
        inList = true
        listType = 'ol'
      }
      htmlLines.push(`<li>${formatInline(numMatch[2])}</li>`)
      continue
    }

    // Regular paragraph
    closeList()
    htmlLines.push(`<p class="my-2 leading-relaxed text-gray-700">${formatInline(trimmed)}</p>`)
  }

  closeList()
  return htmlLines.join('\n')
}

export default function A4Sheet({ title, notes }) {
  const [saveLabel, setSaveLabel] = useState('Saved')
  const [copied, setCopied] = useState(false)
  const [selectionToolbar, setSelectionToolbar] = useState({
    visible: false,
    top: 0,
    left: 0,
  })

  const editorRef = useRef(null)
  const storageKeyRef = useRef('')
  const lastRenderedNotesRef = useRef('')
  const selectionRangeRef = useRef(null)

  const isGenerating = String(notes || '').trim().toLowerCase() === 'generating notes, please wait...'

  const persistEditor = useCallback(() => {
    if (!editorRef.current || !storageKeyRef.current) return
    localStorage.setItem(storageKeyRef.current, editorRef.current.innerHTML)
  }, [])

  const restoreSelection = useCallback(() => {
    if (!selectionRangeRef.current) return
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(selectionRangeRef.current)
  }, [])

  const updateSelectionToolbar = useCallback(() => {
    const editor = editorRef.current
    if (!editor) {
      setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      selectionRangeRef.current = null
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      selectionRangeRef.current = null
      return
    }

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) {
      setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      selectionRangeRef.current = null
      return
    }

    const rect = range.getBoundingClientRect()
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      selectionRangeRef.current = null
      return
    }

    const safeLeft = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2))
    const safeTop = Math.max(12, rect.top - 54)

    selectionRangeRef.current = range.cloneRange()
    setSelectionToolbar({
      visible: true,
      top: safeTop,
      left: safeLeft,
    })
  }, [])

  const applyCommand = (command, value = null) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    restoreSelection()
    document.execCommand(command, false, value)
    persistEditor()
    updateSelectionToolbar()
  }

  const applyLink = () => {
    const href = window.prompt('Add a URL', 'https://')
    if (!href) return
    applyCommand('createLink', href)
  }

  const clearFormatting = () => {
    applyCommand('removeFormat')
    applyCommand('unlink')
  }

  const handleCopyNotes = () => {
    if (!editorRef.current) return
    const text = toPlainText(editorRef.current.innerHTML)
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleClearSheet = () => {
    if (window.confirm('Are you sure you want to clear these notes?')) {
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
        persistEditor()
      }
    }
  }

  // Load initial notes from storage on mount
  useEffect(() => {
    const studentId = localStorage.getItem('student_id') || 'guest'
    storageKeyRef.current = `studybuddy_editor_notes_${studentId}`

    const saved = localStorage.getItem(storageKeyRef.current) || ''
    if (editorRef.current && saved && !notes) {
      editorRef.current.innerHTML = saved
    }
  }, [])

  // Sync incoming notes prop
  useEffect(() => {
    if (!editorRef.current) return
    if (!notes || isGenerating) return
    if (notes === lastRenderedNotesRef.current) return

    const rendered = markdownToHtml(notes)
    editorRef.current.innerHTML = rendered
    lastRenderedNotesRef.current = notes

    if (storageKeyRef.current) {
      localStorage.setItem(storageKeyRef.current, rendered)
    }
  }, [notes, isGenerating])

  useEffect(() => {
    const handleSelection = () => updateSelectionToolbar()

    document.addEventListener('selectionchange', handleSelection)
    window.addEventListener('resize', handleSelection)
    window.addEventListener('scroll', handleSelection, true)

    return () => {
      document.removeEventListener('selectionchange', handleSelection)
      window.removeEventListener('resize', handleSelection)
      window.removeEventListener('scroll', handleSelection, true)
    }
  }, [updateSelectionToolbar])

  return (
    <div className="relative z-10 w-full max-w-[210mm] mb-36 md:mb-28 min-w-0 px-1 sm:px-0">
      <div className="w-full min-h-[297mm] bg-white rounded-2xl shadow-[0_35px_80px_rgba(0,0,0,0.55)] p-5 sm:p-7 md:p-9 lg:p-11 text-gray-900 flex flex-col min-w-0 break-words border border-gray-100">
        <div className="border-b border-gray-200 pb-3 mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {title || 'Study Notes'}
            </h2>
            <p className="text-[11px] text-indigo-600 font-medium tracking-wide">
              Interactive Notion-Style Notebook
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyNotes}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-all font-medium"
              title="Copy notes text"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button
              type="button"
              onClick={handleClearSheet}
              className="text-xs px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-all font-medium"
              title="Clear notes"
            >
              Clear
            </button>
            <span className="text-[11px] text-gray-400 pl-1">{saveLabel}</span>
          </div>
        </div>

        {isGenerating && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 flex items-center gap-3 animate-pulse">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-900">Synthesizing study notes...</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Sensei is extracting key concepts and generating comprehensive notes for {title}.
              </p>
            </div>
          </div>
        )}

        <div className="relative flex-1 text-sm text-gray-800 leading-relaxed min-w-0">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Click 'Use' on any source to display notes here, or start typing naturally like Notion..."
            onMouseUp={updateSelectionToolbar}
            onKeyUp={updateSelectionToolbar}
            onBlur={() => {
              setSelectionToolbar((prev) => (prev.visible ? { ...prev, visible: false } : prev))
            }}
            onInput={() => {
              setSaveLabel('Saving...')
              persistEditor()
              setSaveLabel('Saved')
            }}
            className="relative min-h-[60vh] pb-12 outline-none text-[15px] leading-8 text-gray-800 break-words [overflow-wrap:anywhere] min-w-0 [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-gray-400 [&:empty:before]:pointer-events-none [&:empty:before]:block [&:empty:before]:absolute [&:empty:before]:top-0 [&:empty:before]:left-0 [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:text-gray-900 [&_h1]:mt-5 [&_h1]:mb-3 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-indigo-100 [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-indigo-950 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg sm:[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-indigo-900 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-800 [&_h4]:mt-2 [&_h4]:mb-1 [&_p]:my-2 [&_p]:leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-500 [&_blockquote]:bg-indigo-50/70 [&_blockquote]:rounded-r-xl [&_blockquote]:px-3.5 [&_blockquote]:py-2.5 [&_blockquote]:my-2.5 [&_blockquote]:italic [&_hr]:my-4 [&_hr]:border-gray-200"
          />

          {selectionToolbar.visible && (
            <div
              className="fixed z-50 -translate-x-1/2 rounded-xl border border-[#2f334a] bg-[#141824] px-2 py-1.5 shadow-[0_18px_50px_rgba(6,9,18,0.5)]"
              style={{ top: `${selectionToolbar.top}px`, left: `${selectionToolbar.left}px` }}
            >
              <div className="flex items-center gap-1 text-[12px] text-gray-200">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('formatBlock', 'H2')}
                  className="rounded-md px-2 py-1 hover:bg-[#252b40]"
                >
                  H2
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('formatBlock', 'P')}
                  className="rounded-md px-2 py-1 hover:bg-[#252b40]"
                >
                  Text
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('bold')}
                  className="rounded-md px-2 py-1 font-semibold hover:bg-[#252b40]"
                >
                  B
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('italic')}
                  className="rounded-md px-2 py-1 italic hover:bg-[#252b40]"
                >
                  I
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('underline')}
                  className="rounded-md px-2 py-1 underline hover:bg-[#252b40]"
                >
                  U
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('insertUnorderedList')}
                  className="rounded-md px-2 py-1 hover:bg-[#252b40]"
                >
                  List
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCommand('formatBlock', 'BLOCKQUOTE')}
                  className="rounded-md px-2 py-1 hover:bg-[#252b40]"
                >
                  Quote
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={applyLink}
                  className="rounded-md px-2 py-1 hover:bg-[#252b40]"
                >
                  Link
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearFormatting}
                  className="rounded-md px-2 py-1 text-red-300 hover:bg-[#3a2430]"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
