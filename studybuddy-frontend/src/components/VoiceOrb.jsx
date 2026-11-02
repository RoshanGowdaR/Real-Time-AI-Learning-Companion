import React, { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../services/api'
import { voiceKeywords } from '../utils/voiceKeywords'

const MAX_PUSH_TO_TALK_MS = 35000
const MAX_RECORD_MS = 6000

// How long Win+Alt must be held before we consider it a "hold" vs a "tap"
const HOLD_THRESHOLD_MS = 280

function normalizeTime(value, fallback) {
  const raw = String(value || '').trim().toLowerCase().replace(/\./g, '')
  if (!raw) return fallback

  const direct24 = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (direct24) {
    const hours = Number(direct24[1])
    const minutes = Number(direct24[2])
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }
  }

  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return fallback

  let hours = Number(match[1])
  const minutes = Number(match[2] || 0)
  const meridian = match[3] || ''

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return fallback
  }

  if (meridian === 'pm' && hours < 12) hours += 12
  if (meridian === 'am' && hours === 12) hours = 0

  if (hours < 0 || hours > 23) return fallback
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addOneHour(time24) {
  const [h, m] = String(time24 || '').split(':').map((part) => Number(part))
  if (Number.isNaN(h) || Number.isNaN(m)) return '10:00'

  const date = new Date()
  date.setHours(h, m, 0, 0)
  date.setHours(date.getHours() + 1)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatLocalDate(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
}

function normalizeScheduleInfo(rawInfo, sourceText = '') {
  const info = rawInfo && typeof rawInfo === 'object' ? rawInfo : {}
  const now = new Date()
  const defaultDate = formatLocalDate(now)
  const plusOneHour = new Date(now.getTime() + (60 * 60 * 1000))
  const defaultStart = `${String(plusOneHour.getHours()).padStart(2, '0')}:${String(plusOneHour.getMinutes()).padStart(2, '0')}`

  const startTime = normalizeTime(info.start_time ?? info.startTime, defaultStart)
  let endTime = normalizeTime(info.end_time ?? info.endTime, addOneHour(startTime))
  if (endTime === startTime) {
    endTime = addOneHour(startTime)
  }

  const rawSubject = String(info.subject || '').trim()
  const subject = rawSubject || 'General'
  const rawTitle = String(info.title || '').trim()
  const title = rawTitle || `${subject} Study Session`
  let date = /^\d{4}-\d{2}-\d{2}$/.test(String(info.date || '').trim())
    ? String(info.date).trim()
    : defaultDate

  const loweredSource = String(sourceText || '').toLowerCase()
  if (/\bday\s+after\s+tomorrow\b/.test(loweredSource)) {
    const d = new Date(now)
    d.setDate(now.getDate() + 2)
    date = formatLocalDate(d)
  } else if (/\btomorrow\b/.test(loweredSource)) {
    const d = new Date(now)
    d.setDate(now.getDate() + 1)
    date = formatLocalDate(d)
  } else if (/\btoday\b|\btonight\b/.test(loweredSource)) {
    date = formatLocalDate(now)
  }

  const priority = String(info.priority || '').toLowerCase() === 'high' ? 'high' : 'normal'

  return {
    title,
    subject,
    date,
    start_time: startTime,
    end_time: endTime,
    priority,
  }
}

function MicIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="9" y="4" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M6 11a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SpeakerIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 10h4l5-4v12l-5-4H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function VoiceOrb({
  studentId,
  onResult,
  speakText,
  currentEmotion,
  recentMessages = [],
  onScheduleCreated,
}) {
  const WAVE_BARS = [8, 14, 22, 16, 10, 18, 26, 20, 12, 18, 24, 17, 9]
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPushToTalk, setIsPushToTalk] = useState(false)
  const [voiceError, setVoiceError] = useState('')

  const mediaRecorder = useRef(null)
  const activeStream = useRef(null)
  const recordTimeout = useRef(null)
  const chunks = useRef([])
  const audioPlayer = useRef(new Audio())

  // Refs for stable access in keyboard handlers (avoids stale closures)
  const isPushToTalkRef = useRef(false)
  const isRecordingRef = useRef(false)
  const isProcessingRef = useRef(false)
  const isSpeakingRef = useRef(false)

  // Track when Win+Alt was first pressed (for hold vs tap detection)
  const winAltDownTimestamp = useRef(null)
  // Timer that fires after HOLD_THRESHOLD_MS to start recording
  const holdTimer = useRef(null)

  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])
  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])
  useEffect(() => { isSpeakingRef.current = isSpeaking }, [isSpeaking])

  const clearRecordTimeout = () => {
    if (recordTimeout.current) {
      window.clearTimeout(recordTimeout.current)
      recordTimeout.current = null
    }
  }

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const releaseStream = () => {
    if (activeStream.current) {
      activeStream.current.getTracks().forEach((track) => track.stop())
      activeStream.current = null
    }
  }

  // ─── Stop ALL audio playback (server TTS + browser speech synthesis) ───
  const stopAllSpeech = useCallback(() => {
    // Stop the HTML5 Audio element
    const player = audioPlayer.current
    if (player) {
      player.pause()
      player.currentTime = 0
      player.onended = null
      player.onerror = null
      if (player.src) {
        try { URL.revokeObjectURL(player.src) } catch {}
      }
      player.src = ''
    }

    // Stop browser SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    setIsSpeaking(false)
  }, [])

  // ─── Browser TTS fallback ───
// Clean text for speech: strip markdown syntax, '#' headers, bullet marks, and code blocks
function cleanTextForSpeech(text) {
  if (!text) return ''
  let t = String(text)

  // Remove code blocks
  t = t.replace(/```[\s\S]*?```/g, '')

  // Remove markdown headers: #, ##, ###, #### at start of lines
  t = t.replace(/(^|\n)\s*#+\s*/g, '$1')

  // Remove any remaining '#' symbols (e.g., #tag, standalone hashtags)
  t = t.replace(/#+/g, '')

  // Remove markdown links [text](url) -> text
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Remove markdown images ![alt](url)
  t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, '')

  // Remove bold / italics
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2')
  t = t.replace(/(\*|_)(.*?)\1/g, '$2')

  // Remove inline backticks
  t = t.replace(/`([^`]+)`/g, '$1')

  // Remove list bullet markers (- , * , + , • ) at line starts
  t = t.replace(/(^|\n)\s*[-*+•]\s+/g, '$1')

  // Collapse multiple newlines into a natural pause
  t = t.replace(/\n{2,}/g, '. ')
  t = t.replace(/\n/g, ' ')

  // Normalize whitespace
  t = t.replace(/[ \t]+/g, ' ')

  return t.trim()
}

  const speakWithBrowser = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSpeaking(false)
      return
    }
    const sanitized = cleanTextForSpeech(text)
    if (!sanitized) {
      setIsSpeaking(false)
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(sanitized)
      utterance.rate = 1.05
      utterance.pitch = 1.0
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira'))) ||
        voices.find((v) => v.lang.startsWith('en'))
      if (preferred) utterance.voice = preferred

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('Browser speech synthesis failed:', e)
      setIsSpeaking(false)
    }
  }, [])

  // ─── Server TTS with browser fallback ───
  const handleTTS = useCallback(async (text) => {
    if (!text) return
    const sanitized = cleanTextForSpeech(text)
    if (!sanitized) return

    const ttsText = sanitized.length > 1000 ? `${sanitized.slice(0, 1000)}...` : sanitized
    setIsSpeaking(true)
    try {
      const audioUrl = await api.textToSpeech(ttsText)
      if (!audioUrl) {
        speakWithBrowser(ttsText)
        return
      }
      audioPlayer.current.onended = null
      audioPlayer.current.onerror = null
      audioPlayer.current.src = audioUrl
      await audioPlayer.current.play()
      audioPlayer.current.onended = () => setIsSpeaking(false)
      audioPlayer.current.onerror = () => {
        speakWithBrowser(ttsText)
      }
    } catch {
      speakWithBrowser(ttsText)
    }
  }, [speakWithBrowser])

  // ─── STT → Chat → TTS pipeline ───
  const handleSTT = useCallback(async (blob) => {
    try {
      const response = await api.speechToText(blob)
      const text = response.text || response.transcript || ''
      const question = String(text || '').trim()

      if (!question) {
        const fallback = 'I could not hear you clearly. Please try again.'
        setVoiceError(fallback)
        handleTTS(fallback)
        return
      }

      // Check for schedule keywords
      const lowered = question.toLowerCase()
      const isScheduleAction = voiceKeywords?.schedule?.some(kw => lowered.includes(kw))

      if (isScheduleAction) {
        setIsProcessing(true)
        try {
          // 1. Extract info from LLM
          const { info: rawInfo } = await api.extractChatInfo(studentId, question)
          const info = normalizeScheduleInfo(rawInfo, question)

          // 2. Save to schedule
          const created = await api.createScheduleEvent(studentId, {
            title: info.title,
            subject: info.subject,
            date: info.date,
            startTime: info.start_time,
            endTime: info.end_time,
            priority: info.priority
          })

          if (created?.event && typeof onScheduleCreated === 'function') {
            onScheduleCreated(created.event)
          }
          
          const successMsg = `Perfect! I've scheduled "${info.title}" for ${info.date} at ${info.start_time}.`
          setVoiceError('')
          handleTTS(successMsg)
          if (typeof onResult === 'function') {
            onResult({ question, answer: successMsg, chatId: 'action-schedule' })
          }
          return
        } catch (err) {
          console.error("Schedule extraction/save failed", err)
          const fallback = 'I could not schedule that yet. Please say it like: schedule Math tomorrow at 6 PM.'
          setVoiceError(err?.message || 'Failed to save schedule event.')
          handleTTS(fallback)
          if (typeof onResult === 'function') {
            onResult({ question, answer: fallback, chatId: 'action-schedule-failed' })
          }
          return
        }
      }

      const formattedHistory = Array.isArray(recentMessages)
        ? recentMessages
            .map((m) => ({
              role: m.role === 'student' ? 'user' : m.role,
              content: m.content || '',
            }))
            .filter((m) => m.content && (m.role === 'user' || m.role === 'assistant'))
            .slice(-10)
        : []

      // Chat query with current detected emotion and conversation history
      const { answer, chat_id } = await api.chatQuery(
        studentId,
        question,
        'voice',
        currentEmotion,
        formattedHistory
      )

      // Emit answer to UI (updates text chat messages & talk history)
      if (typeof onResult === 'function') {
        onResult({ question, answer, chatId: chat_id })
      }
      handleTTS(answer)
    } catch (err) {
      console.error('STT/Chat failed', err)
      const fallback = 'I had trouble understanding that. Please try once more.'
      setVoiceError(fallback)
      handleTTS(fallback)
    }
  }, [studentId, currentEmotion, onResult, handleTTS, recentMessages])

  // ─── Start a recording session ───
  const startRecordingSession = useCallback(async (pushToTalkMode = false) => {
    if (isProcessingRef.current || isRecordingRef.current) return

    try {
      if (!studentId) {
        setVoiceError('Student session missing. Please log in again.')
        return
      }

      if (typeof MediaRecorder === 'undefined') {
        setVoiceError('Recording is not supported in this browser.')
        return
      }

      setVoiceError('')
      setIsPushToTalk(pushToTalkMode)
      isPushToTalkRef.current = pushToTalkMode

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      activeStream.current = stream
      mediaRecorder.current = new MediaRecorder(stream)
      chunks.current = []

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.current.push(e.data)
        }
      }

      mediaRecorder.current.onstop = async () => {
        clearRecordTimeout()
        setIsPushToTalk(false)
        isPushToTalkRef.current = false

        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        releaseStream()

        if (!blob.size) {
          setVoiceError('No audio detected. Please try again.')
          return
        }

        setIsProcessing(true)
        await handleSTT(blob)
        setIsProcessing(false)
      }

      mediaRecorder.current.start(200)
      setIsRecording(true)

      clearRecordTimeout()
      const maxMs = pushToTalkMode ? MAX_PUSH_TO_TALK_MS : MAX_RECORD_MS
      recordTimeout.current = window.setTimeout(() => {
        stopRecordingSession()
      }, maxMs)
    } catch (err) {
      console.error('Mic access failed', err)
      setVoiceError('Microphone access denied or unavailable.')
      setIsPushToTalk(false)
      isPushToTalkRef.current = false
      releaseStream()
    }
  }, [studentId, handleSTT])

  // ─── Stop recording ───
  const stopRecordingSession = useCallback(() => {
    clearRecordTimeout()
    const recorder = mediaRecorder.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setIsRecording(false)
  }, [])

  // ─── Tap toggle (for the on-screen button) ───
  const toggleRecording = useCallback(() => {
    if (isProcessing) return

    // If currently speaking, stop speech first
    if (isSpeaking) {
      stopAllSpeech()
      return
    }

    if (isRecording) {
      stopRecordingSession()
    } else {
      startRecordingSession(false)
    }
  }, [isProcessing, isSpeaking, isRecording, stopAllSpeech, stopRecordingSession, startRecordingSession])

  // ─── Win+Alt Push-To-Talk keyboard handler ───
  useEffect(() => {
    const keysDown = new Set()

    const bothWinAltDown = (e) => {
      const isWin =
        e.metaKey ||
        keysDown.has('meta') ||
        keysDown.has('os') ||
        keysDown.has('metaleft') ||
        keysDown.has('metaright')
      const isAlt =
        e.altKey ||
        keysDown.has('alt') ||
        keysDown.has('altleft') ||
        keysDown.has('altright')
      return isWin && isAlt
    }

    const onKeyDown = (e) => {
      const k = e.key?.toLowerCase()
      if (k) keysDown.add(k)
      if (e.code) keysDown.add(e.code.toLowerCase())

      if (!bothWinAltDown(e)) return

      e.preventDefault()

      // Already recording in push-to-talk mode — do nothing (keep holding)
      if (isPushToTalkRef.current && isRecordingRef.current) return

      // Already waiting for processing — ignore
      if (isProcessingRef.current) return

      // Mark the moment Win+Alt was first pressed
      if (winAltDownTimestamp.current === null) {
        winAltDownTimestamp.current = Date.now()

        // If currently speaking, stop speech immediately on keydown
        if (isSpeakingRef.current) {
          stopAllSpeech()
        }

        // Set a delayed timer: if still held after HOLD_THRESHOLD_MS, start recording
        clearHoldTimer()
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = null
          // Only start if keys are still down and not already recording/processing
          if (winAltDownTimestamp.current !== null && !isRecordingRef.current && !isProcessingRef.current) {
            startRecordingSession(true)
          }
        }, HOLD_THRESHOLD_MS)
      }
    }

    const onKeyUp = (e) => {
      const k = e.key?.toLowerCase()
      if (k) keysDown.delete(k)
      if (e.code) keysDown.delete(e.code.toLowerCase())

      // Check if Win or Alt was released
      const releasedWinOrAlt =
        k === 'meta' || k === 'alt' || k === 'os' ||
        e.code?.toLowerCase() === 'metaleft' || e.code?.toLowerCase() === 'metaright' ||
        e.code?.toLowerCase() === 'altleft' || e.code?.toLowerCase() === 'altright'

      if (!releasedWinOrAlt) return

      e.preventDefault()

      // If we're currently recording in push-to-talk mode, stop recording (send for processing)
      if (isPushToTalkRef.current && isRecordingRef.current) {
        stopRecordingSession()
        winAltDownTimestamp.current = null
        clearHoldTimer()
        return
      }

      // If the hold timer hasn't fired yet (it was a quick tap), cancel it
      // The tap already stopped speech in onKeyDown, so nothing more to do
      clearHoldTimer()
      winAltDownTimestamp.current = null
    }

    const onBlur = () => {
      keysDown.clear()
      clearHoldTimer()
      winAltDownTimestamp.current = null
      if (isPushToTalkRef.current && isRecordingRef.current) {
        stopRecordingSession()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      clearHoldTimer()
    }
  }, [studentId, currentEmotion, stopAllSpeech, startRecordingSession, stopRecordingSession])

  // Handle speakText prop changes (e.g. greeting on workspace entry)
  useEffect(() => {
    if (!speakText) return

    const timerId = window.setTimeout(() => {
      handleTTS(speakText)
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [speakText, handleTTS])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRecordTimeout()
      clearHoldTimer()
      releaseStream()
      stopAllSpeech()
      const recorder = mediaRecorder.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }
    }
  }, [stopAllSpeech])

  const waveformStateClass = isRecording
    ? 'voice-wave--recording'
    : isProcessing
      ? 'voice-wave--processing'
    : isSpeaking
      ? 'voice-wave--speaking'
      : 'voice-wave--idle'

  const statusText = isRecording
    ? isPushToTalk
      ? 'Listening... Release Win + Alt to send'
      : 'Listening... Tap to stop'
    : isProcessing
      ? 'Thinking...'
    : isSpeaking
      ? 'Speaking... Press Win + Alt to stop'
      : 'Tap or hold Win + Alt to talk'

  return (
    <div className="fixed bottom-16 lg:bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
      <button
        type="button"
        onClick={toggleRecording}
        title={statusText}
        className={`voice-wave-shell ${waveformStateClass} pointer-events-auto transition-transform active:scale-95`}
      >
        <span className="voice-wave-panel" />

        <span className="voice-wave-bars voice-wave-bars--left" aria-hidden="true">
          {WAVE_BARS.map((height, idx) => (
            <span
              key={`left-${idx}`}
              className="voice-wave-bar"
              style={{ height: `${height}px`, animationDelay: `${idx * 0.05}s` }}
            />
          ))}
        </span>

        <span className="voice-wave-bars voice-wave-bars--right" aria-hidden="true">
          {[...WAVE_BARS].reverse().map((height, idx) => (
            <span
              key={`right-${idx}`}
              className="voice-wave-bar"
              style={{ height: `${height}px`, animationDelay: `${idx * 0.05}s` }}
            />
          ))}
        </span>

        <span className="voice-wave-center">
          {isSpeaking ? (
            <SpeakerIcon className="h-5 w-5" />
          ) : isRecording ? (
            <MicIcon className="h-5 w-5 text-emerald-300" />
          ) : isProcessing ? (
            <SpeakerIcon className="h-5 w-5" />
          ) : (
            <MicIcon className="h-5 w-5" />
          )}
        </span>
      </button>

      {/* Push-to-talk status badge & keyboard shortcut hint */}
      <div className="flex items-center justify-center gap-2 mt-1.5 pointer-events-none">
        {isRecording ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 animate-pulse shadow-lg shadow-emerald-950/50 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {isPushToTalk ? 'Release Win + Alt to Send' : 'Listening... Tap to send'}
          </span>
        ) : isProcessing ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            Thinking & Transcribing...
          </span>
        ) : isSpeaking ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Speaking... Press
            <kbd className="px-1 py-0.5 rounded bg-indigo-950 text-indigo-200 border border-indigo-500/40 font-mono text-[9px] font-semibold">Win+Alt</kbd>
            to stop
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] text-gray-300 bg-black/60 border border-white/10 backdrop-blur-md shadow-sm">
            <span>🎙️ Hold</span>
            <kbd className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-200 border border-indigo-500/40 font-mono text-[9px] font-semibold">Win</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-200 border border-indigo-500/40 font-mono text-[9px] font-semibold">Alt</kbd>
            <span>to talk</span>
          </span>
        )}
      </div>

      {voiceError && (
        <p className="mt-1 text-center text-[11px] text-rose-300 pointer-events-none">{voiceError}</p>
      )}
    </div>
  )
}
