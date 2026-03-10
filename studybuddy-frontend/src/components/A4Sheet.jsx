import React, { useCallback, useEffect, useRef, useState } from 'react'

function toPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>(\s|&nbsp;)*/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function removeLegacyReplyCards(html) {
  if (!html) return ''

  const container = document.createElement('div')
  container.innerHTML = html

  const isLegacyMarker = (value) => {
    const normalized = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

    return (
      normalized.startsWith('sensei answer') ||
      normalized.startsWith('voice question') ||
      normalized.startsWith('voice answer')
    )
  }

  container.querySelectorAll('div').forEach((node) => {
    const className = String(node.className || '').toLowerCase()
    const text = String(node.textContent || '')
    const looksLikeCard =
      className.includes('border-l') ||
      className.includes('rounded') ||
      className.includes('bg-') ||
      className.includes('p-')

    const isLegacyCard = looksLikeCard && isLegacyMarker(text)

    if (isLegacyCard) {
      node.remove()
    }
  })

  container.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,strong').forEach((node) => {
    if (isLegacyMarker(node.textContent || '')) {
      const parentCard = node.closest('div,section,article,blockquote')
      if (parentCard && parentCard !== container) {
        parentCard.remove()
      } else {
        node.remove()
      }
    }
  })

  container.querySelectorAll('div,section,article,blockquote').forEach((node) => {
    if (!toPlainText(node.innerHTML || '')) {
      node.remove()
    }
  })

  return container.innerHTML
}

export default function A4Sheet({ title, notes }) {
  const [saveLabel, setSaveLabel] = useState('Saved')
  const [selectionToolbar, setSelectionToolbar] = useState({
    visible: false,
    top: 0,
    left: 0,
  })

  const editorRef = useRef(null)
  const storageKeyRef = useRef('')
  const lastSyncedNotesRef = useRef('')
  const selectionRangeRef = useRef(null)

  const toRichHtml = (value) =>
    String(value || '')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  const isSystemStateText = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return normalized === 'generating notes, please wait...' || normalized === 'error generating notes.'
  }

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

  useEffect(() => {
    const studentId = localStorage.getItem('student_id') || 'guest'
    storageKeyRef.current = `studybuddy_editor_notes_${studentId}`

    const saved = localStorage.getItem(storageKeyRef.current) || ''
    const sanitizedSaved = removeLegacyReplyCards(saved)

    if (editorRef.current) {
      editorRef.current.innerHTML = sanitizedSaved
    }
    if (saved !== sanitizedSaved) {
      localStorage.setItem(storageKeyRef.current, sanitizedSaved)
    }
  }, [])

  useEffect(() => {
    if (!editorRef.current) return

    const currentSanitized = removeLegacyReplyCards(editorRef.current.innerHTML || '')
    if (currentSanitized !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = currentSanitized
      if (storageKeyRef.current) {
        localStorage.setItem(storageKeyRef.current, currentSanitized)
      }
    }

    if (!notes || isSystemStateText(notes)) return
    if (notes === lastSyncedNotesRef.current) return

    const incomingHtml = removeLegacyReplyCards(toRichHtml(notes))
    const currentHtml = editorRef.current.innerHTML.trim()

    if (!lastSyncedNotesRef.current) {
      if (!currentHtml) {
        editorRef.current.innerHTML = incomingHtml
      } else {
        const currentPlain = toPlainText(currentHtml)
        const incomingPlain = toPlainText(incomingHtml)
        if (incomingPlain && !currentPlain.includes(incomingPlain)) {
          editorRef.current.insertAdjacentHTML('beforeend', `<p><br/></p>${incomingHtml}`)
        }
      }
    } else if (notes.startsWith(lastSyncedNotesRef.current)) {
      const delta = notes.slice(lastSyncedNotesRef.current.length)
      if (delta.trim()) {
        editorRef.current.insertAdjacentHTML('beforeend', toRichHtml(delta))
      }
    } else {
      editorRef.current.innerHTML = incomingHtml
    }

    lastSyncedNotesRef.current = notes
    if (storageKeyRef.current) {
      localStorage.setItem(storageKeyRef.current, editorRef.current.innerHTML)
    }
  }, [notes, persistEditor])

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
    <div className="relative z-10 w-full max-w-[210mm] mb-36 md:mb-28">
      <div className="w-full min-h-[297mm] bg-white rounded-2xl shadow-[0_35px_80px_rgba(0,0,0,0.55)] p-10 text-gray-900 flex flex-col">
        <div className="border-b border-gray-200 pb-3 mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-800">{title || 'Study Notes'}</h2>
          <span className="text-[11px] text-gray-500">{saveLabel}</span>
        </div>

        <div className="relative flex-1 text-sm text-gray-700 leading-relaxed">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Start writing your notes... Type naturally, like Notion."
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
            className="relative min-h-[56vh] pb-12 outline-none text-[15px] leading-8 text-gray-700 [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-gray-400 [&:empty:before]:pointer-events-none [&:empty:before]:block [&:empty:before]:absolute [&:empty:before]:top-0 [&:empty:before]:left-0 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-1.5 [&_li]:ml-5 [&_li]:list-disc [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-300 [&_blockquote]:bg-indigo-50 [&_blockquote]:rounded-r-lg [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:my-2"
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
