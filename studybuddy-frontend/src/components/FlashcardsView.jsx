 import React, { useMemo, useState } from 'react'
import ProgressRing from './ProgressRing'

function TrashIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4.7 5.8h10.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 5.8V4.6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.2 5.8 6.8 15a1.3 1.3 0 0 0 1.3 1.2h3.8a1.3 1.3 0 0 0 1.3-1.2l.6-9.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.6 8.4v5.2M11.4 8.4v5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function getUniqueSubjects(flashcards) {
  const subjectSet = new Set()
  flashcards.forEach((card) => subjectSet.add(card.subject || 'General'))
  return Array.from(subjectSet)
}

export default function FlashcardsView({
  flashcards,
  reviewStats,
  onCreateCard,
  onToggleMastered,
  onMarkReviewed,
  onDeleteCard,
}) {
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState({ subject: '', question: '', answer: '' })

  const subjects = useMemo(() => getUniqueSubjects(flashcards), [flashcards])

  const filteredCards = useMemo(() => {
    if (subjectFilter === 'all') return flashcards
    return flashcards.filter((card) => (card.subject || 'General') === subjectFilter)
  }, [flashcards, subjectFilter])

  const boundedIndex = filteredCards.length > 0
    ? Math.min(currentIndex, filteredCards.length - 1)
    : 0

  const activeCard = filteredCards[boundedIndex] || null
  const masteredCount = flashcards.filter((card) => card.mastered).length
  const masteryPercent = flashcards.length > 0 ? Math.round((masteredCount / flashcards.length) * 100) : 0
  const dailyGoalPercent = Math.min(100, Math.round((reviewStats.todayReviews / 20) * 100))

  const handleFlip = () => {
    if (!activeCard) return
    if (!showAnswer) {
      onMarkReviewed(activeCard.id)
    }
    setShowAnswer((prev) => !prev)
    setActionMessage('')
    setActionError('')
  }

  const handleNext = () => {
    if (filteredCards.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length)
    setShowAnswer(false)
  }

  const handlePrev = () => {
    if (filteredCards.length === 0) return
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length)
    setShowAnswer(false)
  }

  const handleMastered = async () => {
    if (!activeCard) return

    try {
      await onToggleMastered(activeCard.id)
      setActionMessage(activeCard.mastered ? 'Marked as learning' : 'Marked as mastered')
      setActionError('')
    } catch (err) {
      setActionError(err.message || 'Could not update this card right now.')
      setActionMessage('')
    }
  }

  const handleShare = async () => {
    if (!activeCard) return
    try {
      await navigator.clipboard.writeText(`Q: ${activeCard.question}\nA: ${activeCard.answer}`)
      setActionMessage('Card copied to clipboard.')
      setActionError('')
    } catch {
      setActionError('Clipboard permission blocked. Copy manually.')
      setActionMessage('')
    }
  }

  const handleDelete = async () => {
    if (!activeCard || !onDeleteCard) return

    try {
      await onDeleteCard(activeCard.id)
      setActionMessage('Flashcard deleted.')
      setActionError('')
      setShowAnswer(false)
      setCurrentIndex(0)
    } catch (err) {
      setActionError(err.message || 'Could not delete this card right now.')
      setActionMessage('')
    }
  }

  const handleCreateCard = async (e) => {
    e.preventDefault()
    const payload = {
      subject: (form.subject.trim() || 'General'),
      question: form.question.trim(),
      answer: form.answer.trim(),
    }

    if (!payload.question || !payload.answer) {
      setActionError('Question and answer are required.')
      return
    }

    try {
      await onCreateCard(payload)
      setForm({ subject: '', question: '', answer: '' })
      setShowCreateForm(false)
      setActionMessage('Flashcard created.')
      setActionError('')
      setSubjectFilter('all')
      setCurrentIndex(0)
      setShowAnswer(false)
    } catch (err) {
      setActionError(err.message || 'Could not create flashcard right now.')
      setActionMessage('')
    }
  }

  return (
    <div className="h-full flex bg-[#0a0a0f]">
      <aside className="w-56 border-r border-[#1e1e2e] bg-[#0d0e15] p-4 space-y-4 overflow-y-auto">
        <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Your Subjects</p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => {
                setSubjectFilter('all')
                setCurrentIndex(0)
                setShowAnswer(false)
              }}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all ${
                subjectFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-[#1b1d2e] text-gray-300 hover:text-white'
              }`}
            >
              All Subjects ({flashcards.length})
            </button>

            {subjects.length > 0 ? (
              subjects.map((subject) => {
                const count = flashcards.filter((card) => (card.subject || 'General') === subject).length
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => {
                      setSubjectFilter(subject)
                      setCurrentIndex(0)
                      setShowAnswer(false)
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all ${
                      subjectFilter === subject ? 'bg-indigo-600 text-white' : 'bg-[#1b1d2e] text-gray-300 hover:text-white'
                    }`}
                  >
                    {subject} ({count})
                  </button>
                )
              })
            ) : (
              <p className="text-xs text-gray-500 text-center py-1">No subjects yet</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Study Progress</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-2xl font-bold text-indigo-400">{masteryPercent}%</p>
            <p className="text-xs text-gray-500">Mastery</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">{masteredCount} of {flashcards.length} cards mastered</p>
        </section>

        <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Current Streak</p>
          <p className="mt-2 text-3xl font-bold text-white">{reviewStats.streakDays} days</p>
          <p className="text-xs text-gray-400 mt-1">Keep reviewing daily to grow mastery.</p>
        </section>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-4xl font-bold text-white">Flashcards Session</h2>
            <p className="text-sm text-gray-400 mt-1">Active recall mode with minimal distractions.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm((prev) => !prev)
              setActionError('')
              setActionMessage('')
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          >
            {showCreateForm ? 'Close Form' : 'New Card'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateCard} className="mt-4 rounded-xl border border-[#2c2d42] bg-[#141522] p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Subject"
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div />
            <textarea
              value={form.question}
              onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
              placeholder="Card question"
              rows={3}
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={form.answer}
              onChange={(e) => setForm((prev) => ({ ...prev, answer: e.target.value }))}
              placeholder="Card answer"
              rows={3}
              className="bg-[#1a1b2a] border border-[#2c2d42] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="md:col-span-2 flex items-center justify-between">
              <p className="text-red-400 text-xs">{actionError}</p>
              <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
                Save Card
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-5">
          <section className="rounded-2xl border border-[#212337] bg-[#11121b] min-h-[420px] p-6 flex flex-col justify-between">
            {activeCard ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">{activeCard.subject || 'General'} • card {boundedIndex + 1}/{filteredCards.length}</p>
                  <h3 className="mt-8 text-4xl font-bold text-white text-center leading-tight">
                    {showAnswer ? activeCard.answer : activeCard.question}
                  </h3>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleFlip}
                    className="mx-auto block px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
                  >
                    {showAnswer ? 'Hide Answer' : 'Reveal Answer'}
                  </button>

                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="px-3 py-1.5 rounded-lg bg-[#1e2032] border border-[#2c2d42] text-gray-300 hover:text-white"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-3 py-1.5 rounded-lg bg-[#1e2032] border border-[#2c2d42] text-gray-300 hover:text-white"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-center">
                <div>
                  <p className="text-gray-400">No flashcards yet.</p>
                  <p className="text-gray-500 text-sm mt-1">Create your first card to begin active recall.</p>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Daily Goal</p>
              <div className="mt-3 flex justify-center">
                <ProgressRing
                  value={dailyGoalPercent}
                  size={96}
                  stroke={8}
                  trackClass="stroke-[#2a2b3f]"
                  progressClass="stroke-indigo-500"
                  label="goal"
                />
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">{reviewStats.todayReviews} reviews today</p>
            </section>

            <section className="rounded-xl border border-[#25273b] bg-[#141522] p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Shortcuts</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={handleFlip} className="rounded-lg bg-[#1f2132] border border-[#2c2d42] text-gray-300 text-xs py-2 hover:text-white">Flip</button>
                <button type="button" onClick={handleNext} className="rounded-lg bg-[#1f2132] border border-[#2c2d42] text-gray-300 text-xs py-2 hover:text-white">Next</button>
                <button type="button" onClick={handleMastered} className="rounded-lg bg-[#1f2132] border border-[#2c2d42] text-gray-300 text-xs py-2 hover:text-white">Mastered</button>
                <button type="button" onClick={handleShare} className="rounded-lg bg-[#1f2132] border border-[#2c2d42] text-gray-300 text-xs py-2 hover:text-white">Share</button>
                <button
                  type="button"
                  onClick={handleDelete}
                  title="Delete card"
                  aria-label="Delete card"
                  className="col-span-2 rounded-lg bg-[#3a1e2a] border border-[#5f3347] text-red-200 py-2 flex items-center justify-center hover:bg-red-600 hover:text-white"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              {actionMessage && <p className="text-green-400 text-xs mt-2">{actionMessage}</p>}
              {actionError && <p className="text-red-400 text-xs mt-2">{actionError}</p>}
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
