import React, { useState } from 'react'
import LoadingSpinner from './LoadingSpinner'

const QUICK_TAGS = [
  'Use more examples & analogies',
  'Step-by-step breakdown',
  'More concise and to the point',
  'Add comprehension check questions',
  'Bite-sized, digestible pacing',
  'Deeper technical explanations',
  'Extra warm and encouraging tone',
]

export default function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  onExitWorkspace,
}) {
  const [rating, setRating] = useState(5)
  const [selectedTags, setSelectedTags] = useState([])
  const [feedbackText, setFeedbackText] = useState('')
  const [loading, setLoading] = useState(false)
  const [calibrationResult, setCalibrationResult] = useState(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)

    const combinedFeedback = [
      ...selectedTags,
      feedbackText.trim(),
    ].filter(Boolean).join('. ')

    if (!combinedFeedback) {
      setError('Please select at least one teaching preference tag or enter feedback.')
      setLoading(false)
      return
    }

    try {
      const res = await onSubmit(rating, combinedFeedback)
      setCalibrationResult(res?.result || res)
    } catch (err) {
      setError(err?.message || 'Failed to submit feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#111118] border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-indigo-500/10 blur-3xl pointer-events-none" />

        {calibrationResult ? (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl">
              ✓
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Sensei Calibrated via Version Space</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Your feedback was processed through the Candidate Elimination algorithm to refine your personalized tutoring hypothesis.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                Active Tutor Hypothesis Rules:
              </p>
              <pre className="text-xs text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                {calibrationResult.active_instruction || 'Teaching rules customized to your learning style.'}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20"
              >
                Continue Learning with New Style
              </button>
              {onExitWorkspace && (
                <button
                  type="button"
                  onClick={onExitWorkspace}
                  className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm transition-colors"
                >
                  Exit Workspace
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                  Version Space Learning
                </span>
                <h3 className="text-xl font-bold text-white mt-1.5">End Session & Calibrate Tutor</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-400 hover:text-white text-xl p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-zinc-400">
              How was today&apos;s session? Sensei adapts its hypothesis space after every session to match how you learn best.
            </p>

            {/* Star Rating */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Session Experience
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-transform hover:scale-110 ${
                      star <= rating ? 'text-amber-400' : 'text-zinc-600'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Preference Tags */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                What should Sensei adjust next time? (Quick select)
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border border-indigo-400'
                          : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom feedback */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Specific instructions or feedback
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g. Use some real-life analogies while explaining, and check my understanding with a question..."
                rows={3}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <LoadingSpinner size="sm" />}
                <span>Update Version Space Hypothesis</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
