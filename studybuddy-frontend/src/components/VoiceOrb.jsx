import React, { useState, useRef, useEffect } from 'react'
import { api } from '../services/api'
import { voiceKeywords } from '../utils/voiceKeywords'

const MAX_RECORD_MS = 4500

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

export default function VoiceOrb({ studentId, onResult, speakText, onScheduleCreated }) {
  const WAVE_BARS = [8, 14, 22, 16, 10, 18, 26, 20, 12, 18, 24, 17, 9]
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const mediaRecorder = useRef(null)
  const activeStream = useRef(null)
  const recordTimeout = useRef(null)
  const chunks = useRef([])
  const audioPlayer = useRef(new Audio())

  const clearRecordTimeout = () => {
    if (recordTimeout.current) {
      window.clearTimeout(recordTimeout.current)
      recordTimeout.current = null
    }
  }

  const releaseStream = () => {
    if (activeStream.current) {
      activeStream.current.getTracks().forEach((track) => track.stop())
      activeStream.current = null
    }
  }

  const stopRecordingSession = () => {
    clearRecordTimeout()

    const recorder = mediaRecorder.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }

    setIsRecording(false)
  }

  const handleTTS = async (text) => {
    if (!text) return
    setIsSpeaking(true)
    try {
      const audioUrl = await api.textToSpeech(text)
      audioPlayer.current.onended = null
      audioPlayer.current.onerror = null
      audioPlayer.current.src = audioUrl
      audioPlayer.current.play()
      audioPlayer.current.onended = () => setIsSpeaking(false)
      audioPlayer.current.onerror = () => setIsSpeaking(false)
    } catch (err) {
      console.error("TTS failed", err)
      setIsSpeaking(false)
    }
  }

  useEffect(() => {
    return () => {
      clearRecordTimeout()
      releaseStream()

      const recorder = mediaRecorder.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }
    }
  }, [])

  // Handle speakText prop changes
  useEffect(() => {
    if (!speakText) return

    const timerId = window.setTimeout(() => {
      handleTTS(speakText)
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [speakText])

  const toggleRecording = async () => {
    if (isProcessing) return

    if (isRecording) {
      stopRecordingSession()
    } else {
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

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        activeStream.current = stream
        mediaRecorder.current = new MediaRecorder(stream)
        chunks.current = []

        mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data)
        mediaRecorder.current.onstop = async () => {
          clearRecordTimeout()

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

        mediaRecorder.current.start(250)
        setIsRecording(true)

        clearRecordTimeout()
        recordTimeout.current = window.setTimeout(() => {
          stopRecordingSession()
        }, MAX_RECORD_MS)
      } catch (err) {
        console.error("Mic access failed", err)
        setVoiceError('Microphone access denied or unavailable.')
        releaseStream()
      }
    }
  }

  const handleSTT = async (blob) => {
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
      const isScheduleAction = voiceKeywords.schedule.some(kw => lowered.includes(kw))

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
          onResult({ question, answer: successMsg, chatId: 'action-schedule' })
          return
        } catch (err) {
          console.error("Schedule extraction/save failed", err)
          const fallback = 'I could not schedule that yet. Please say it like: schedule Math tomorrow at 6 PM.'
          setVoiceError(err?.message || 'Failed to save schedule event.')
          handleTTS(fallback)
          onResult({ question, answer: fallback, chatId: 'action-schedule-failed' })
          return
        }
      }

      // Default: Chat
      const { answer, chat_id } = await api.chatQuery(studentId, question, 'voice')
      onResult({ question, answer, chatId: chat_id })
      // Speaking back
      handleTTS(answer)
    } catch (err) {
      console.error("STT/Chat failed", err)
      const fallback = 'I had trouble understanding that. Please try once more.'
      setVoiceError(fallback)
      handleTTS(fallback)
    }
  }

  const waveformStateClass = isRecording
    ? 'voice-wave--recording'
    : isProcessing
      ? 'voice-wave--processing'
    : isSpeaking
      ? 'voice-wave--speaking'
      : 'voice-wave--idle'

  const statusText = isRecording
    ? 'Listening'
    : isProcessing
      ? 'Thinking'
    : isSpeaking
      ? 'Speaking'
      : 'Tap to talk'

  return (
    <div className="fixed bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(84vw,30rem)] pointer-events-none">
      <button
        type="button"
        onClick={toggleRecording}
        title={statusText}
        className={`voice-wave-shell ${waveformStateClass} pointer-events-auto`}
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
            <MicIcon className="h-5 w-5" />
          ) : isProcessing ? (
            <SpeakerIcon className="h-5 w-5" />
          ) : (
            <MicIcon className="h-5 w-5" />
          )}
        </span>
      </button>

      {voiceError && (
        <p className="mt-1 text-center text-[11px] text-rose-300 pointer-events-none">{voiceError}</p>
      )}
    </div>
  )
}
