import React, { useState, useRef, useEffect } from 'react'
import { api } from '../services/api'

function SenseiIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8.4" r="3.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.2 8.4h9.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.1 11.5h5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.4 18.8c1.8-2.4 4-3.6 6.6-3.6 2.6 0 4.8 1.2 6.6 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.8 7.1l2.1 0.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
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
        const { answer } = await api.chatQuery(studentId, text)
        onResult({ question: text, answer })
        // Step 3: Speak back
        handleTTS(answer)
      }
    } catch (err) {
      console.error("STT/Chat failed", err)
    }
  }

  const orbToneClass = isRecording
    ? 'sensei-orb-listening bg-[#102849] border-sky-300/70'
    : isSpeaking
      ? 'sensei-orb-speaking bg-[#123830] border-emerald-300/70'
      : 'sensei-orb-idle bg-[#1a2940] border-[#4a5f85]'

  return (
    <div className="fixed bottom-4 right-4 md:right-auto md:bottom-8 md:left-[17rem] z-40">
      <button
        type="button"
        onClick={toggleRecording}
        title="Talk with Sensei"
        className={`group relative h-[76px] w-[76px] rounded-full border-2 flex items-center justify-center shadow-[0_18px_45px_rgba(2,6,23,0.58)] transition-all duration-300 cursor-pointer ${orbToneClass}`}
      >
        <span className="absolute inset-[3px] rounded-full bg-gradient-to-b from-white/16 to-transparent pointer-events-none" />
        <span className="absolute inset-[8px] rounded-full border border-white/16 pointer-events-none" />

        {(isRecording || isSpeaking) && (
          <span
            className={`absolute -inset-2 rounded-full border animate-pulse ${
              isRecording ? 'border-sky-300/45' : 'border-emerald-300/45'
            }`}
          />
        )}

        {!isRecording && !isSpeaking && (
          <span className="absolute -inset-1 rounded-full border border-indigo-300/25 sensei-ring-idle" />
        )}

        <div className="relative z-10 h-8 w-8 text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
          {isSpeaking ? (
            <SpeakerIcon className="h-full w-full" />
          ) : isRecording ? (
            <MicIcon className="h-full w-full" />
          ) : (
            <SenseiIcon className="h-full w-full" />
          )}
        </div>
      </button>
    </div>
  )
}
