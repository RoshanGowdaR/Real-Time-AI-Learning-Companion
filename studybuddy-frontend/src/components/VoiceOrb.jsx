import React, { useState, useRef, useEffect } from 'react'
import { api } from '../services/api'

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

export default function VoiceOrb({ studentId, onResult, speakText }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const mediaRecorder = useRef(null)
  const chunks = useRef([])
  const audioPlayer = useRef(new Audio())

  const handleTTS = async (text) => {
    if (!text) return
    setIsSpeaking(true)
    try {
      const audioUrl = await api.textToSpeech(text)
      audioPlayer.current.src = audioUrl
      audioPlayer.current.play()
      audioPlayer.current.onended = () => setIsSpeaking(false)
    } catch (err) {
      console.error("TTS failed", err)
      setIsSpeaking(false)
    }
  }

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
    if (isRecording) {
      mediaRecorder.current.stop()
      setIsRecording(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder.current = new MediaRecorder(stream)
        chunks.current = []

        mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data)
        mediaRecorder.current.onstop = async () => {
          const blob = new Blob(chunks.current, { type: 'audio/webm' })
          handleSTT(blob)
          stream.getTracks().forEach(track => track.stop())
        }

        mediaRecorder.current.start()
        setIsRecording(true)
      } catch (err) {
        console.error("Mic access failed", err)
      }
    }
  }

  const handleSTT = async (blob) => {
    try {
      const { text } = await api.speechToText(blob)
      if (text) {
        // Step 2: Chat
        const { answer, chat_id } = await api.chatQuery(studentId, text, 'voice')
        onResult({ question: text, answer, chatId: chat_id })
        // Step 3: Speak back
        handleTTS(answer)
      }
    } catch (err) {
      console.error("STT/Chat failed", err)
    }
  }

  const waveformStateClass = isRecording
    ? 'voice-wave--recording'
    : isSpeaking
      ? 'voice-wave--speaking'
      : 'voice-wave--idle'

  const statusText = isRecording
    ? 'Listening'
    : isSpeaking
      ? 'Speaking'
      : 'Tap to talk'

  return (
    <div className="fixed bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(84vw,30rem)] pointer-events-none">
      <button
        type="button"
        onClick={toggleRecording}
        title={statusText}
        className={`voice-wave-shell ${waveformStateClass} pointer-events-auto`}
      >
        <span className="voice-wave-glow" />
        <span className="voice-wave-core" />
        <span className="voice-wave-peak voice-wave-peak-1" />
        <span className="voice-wave-peak voice-wave-peak-2" />
        <span className="voice-wave-peak voice-wave-peak-3" />
        <span className="voice-wave-peak voice-wave-peak-4" />
        <span className="voice-wave-peak voice-wave-peak-5" />

        <span className="voice-wave-center">
          {isSpeaking ? (
            <SpeakerIcon className="h-5 w-5" />
          ) : isRecording ? (
            <MicIcon className="h-5 w-5" />
          ) : (
            <MicIcon className="h-5 w-5" />
          )}
        </span>
      </button>
    </div>
  )
}
