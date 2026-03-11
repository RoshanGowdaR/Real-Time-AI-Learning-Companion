import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function WrittenExamRoom() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const studentId = localStorage.getItem('student_id')

  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({}) // { questionId: 'answer text' }
  const [currentQ, setCurrentQ] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef(null)

  /* ── Load exam ── */
  useEffect(() => {
    if (!studentId) { navigate('/'); return }
    ;(async () => {
      setLoading(true)
      try {
        const res = await api.getExamDetails(examId)
        if (!res || res.exam_type !== 'written') { setError('Invalid written exam.'); return }
        setExam(res)
        setQuestions(Array.isArray(res.questions) ? res.questions : [])
        setTimeLeft((res.duration_mins || 60) * 60)
      } catch (err) {
        setError(err.message || 'Failed to load exam')
      } finally {
        setLoading(false)
      }
    })()
  }, [examId, studentId, navigate])

  /* ── Timer ── */
  useEffect(() => {
    if (!exam || submitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [exam, submitted])

  const updateAnswer = (qId, text) => {
    setAnswers((prev) => ({ ...prev, [qId]: text }))
  }

  const answeredCount = Object.values(answers).filter((v) => v.trim().length > 0).length
  const totalQ = questions.length
  const currentQuestion = questions[currentQ]

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting || submitted) return
    if (!autoSubmit) { setShowConfirm(true); return }
    setShowConfirm(false)
    setSubmitting(true)
    clearInterval(timerRef.current)
    try {
      const payload = {
        exam_id: examId,
        student_id: studentId,
        answers: questions.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id] || '',
        })),
      }
      await api.submitWrittenExam(payload)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Submission failed')
      setSubmitting(false)
    }
  }, [submitting, submitted, examId, studentId, questions, answers])

  const confirmSubmit = () => handleSubmit(true)

  const wordCount = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length

  /* ── RENDER ── */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b14] text-white flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#090b14] text-white flex items-center justify-center">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center max-w-md">
          <p className="text-sm text-rose-200">{error}</p>
          <button onClick={() => navigate(-1)} className="mt-4 rounded-lg bg-gray-700 px-4 py-2 text-xs text-white hover:bg-gray-600">Go Back</button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#090b14] text-white flex items-center justify-center">
        <div className="rounded-2xl border border-[#272d47] bg-[#101426] p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Exam Submitted!</h2>
          <p className="text-sm text-slate-400 mb-4">Your answers have been submitted for review. The teacher will grade your responses and scores will be updated.</p>
          <div className="rounded-lg bg-amber-900/20 border border-amber-600/20 px-3 py-2 mb-6">
            <p className="text-xs text-amber-300">Grading in progress — check back later for your score.</p>
          </div>
          <button onClick={() => navigate(-1)} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-500">Back to Class</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#090b14] text-white flex flex-col">
      {/* HEADER */}
      <header className="h-14 border-b border-[#1e1e2e] bg-[#0d0f1a] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{exam?.title || 'Written Exam'}</h1>
          <span className="rounded-full bg-amber-600/20 px-2 py-0.5 text-[11px] text-amber-300">Written</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm font-mono font-semibold ${timeLeft < 300 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </span>
          <button onClick={() => handleSubmit(false)} disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* QUESTION NAVIGATOR */}
        <aside className="w-52 border-r border-[#1e1e2e] bg-[#0d0f1a] p-4 flex flex-col flex-shrink-0">
          <p className="text-xs text-slate-400 mb-3">{answeredCount}/{totalQ} answered</p>
          <div className="space-y-1 flex-1 overflow-y-auto">
            {questions.map((q, i) => {
              const hasAnswer = (answers[q.id] || '').trim().length > 0
              const isCurrent = i === currentQ
              let bg = 'bg-gray-800 text-gray-400'
              if (isCurrent) bg = 'bg-indigo-600 text-white'
              else if (hasAnswer) bg = 'bg-emerald-700/40 text-emerald-300'
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQ(i)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-xs ${bg} hover:ring-1 hover:ring-indigo-400 transition-colors`}
                >
                  Q{i + 1}
                  {hasAnswer && <span className="ml-1 text-[10px] text-emerald-400">({wordCount(answers[q.id])} words)</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-4 space-y-1 text-[10px] text-slate-500">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-700/40 inline-block" /> Answered</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gray-800 inline-block" /> Not answered</div>
          </div>
        </aside>

        {/* ANSWER AREA */}
        <main className="flex-1 p-6 overflow-y-auto">
          {currentQuestion && (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Question {currentQ + 1} of {totalQ} · {currentQuestion.max_marks} mark(s)</p>
                <p className="text-xs text-slate-500">{wordCount(answers[currentQuestion.id])} words</p>
              </div>
              <h2 className="text-lg font-medium text-white mb-5">{currentQuestion.question_text}</h2>

              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                placeholder="Write your answer here..."
                rows={12}
                className="w-full rounded-xl border border-[#272d47] bg-[#101426] px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
              />

              <div className="flex justify-between mt-6">
                <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className="rounded-lg bg-gray-700 px-4 py-2 text-xs text-gray-200 hover:bg-gray-600 disabled:opacity-30">
                  Previous
                </button>
                {currentQ < totalQ - 1 ? (
                  <button onClick={() => setCurrentQ(currentQ + 1)} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500">
                    Next
                  </button>
                ) : (
                  <button onClick={() => handleSubmit(false)} disabled={submitting} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">
                    Finish & Submit
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-2xl border border-[#272d47] bg-[#101426] p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-white mb-2">Submit Exam?</h3>
            <p className="text-sm text-slate-400 mb-1">You have answered {answeredCount} of {totalQ} questions.</p>
            {answeredCount < totalQ && (
              <p className="text-sm text-amber-300 mb-3">{totalQ - answeredCount} question(s) unanswered!</p>
            )}
            <p className="text-xs text-slate-500 mb-4">Written exams are graded by the teacher. Your AI-assisted scores will be available after review.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-lg bg-gray-700 px-3 py-2 text-xs text-gray-200 hover:bg-gray-600">Cancel</button>
              <button onClick={confirmSubmit} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-500">Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
