import React from 'react'

const EMOTION_LABELS = {
  happy: '😊 Happy',
  confused: '😕 Confused',
  distressed: '😟 Distressed',
  neutral: '😐 Focused',
  sleeping: '😴 Sleeping',
  drowsy: '🥱 Drowsy',
  no_face: '👀 Away / Inactive',
  angry: '😠 Frustrated',
  disgust: '😖 Displeased',
  fear: '😨 Anxious',
  sad: '😢 Sad / Tired',
  surprise: '😲 Surprised',
}

function getEmotionLabel(currentEmotion) {
  const key = String(currentEmotion || 'no_face').toLowerCase()
  return EMOTION_LABELS[key] || EMOTION_LABELS.no_face
}

export default function FaceDetectionPip({ videoRef, currentEmotion, onClose }) {
  return (
    <div className="fixed bottom-20 sm:bottom-24 left-3 sm:left-4 z-40 w-44 sm:w-52 h-36 sm:h-40 rounded-2xl overflow-hidden border border-indigo-500/50 shadow-2xl bg-gray-950 shadow-indigo-950/60 flex flex-col group">
      <div className="relative flex-1 w-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Top bar with focus badge and prominent Turn Off button */}
        <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between pointer-events-auto">
          <span className="rounded-full bg-black/60 backdrop-blur-sm border border-white/15 px-2 py-0.5 text-[10px] text-indigo-200 font-medium tracking-wide">
            Focus Cam
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.()
            }}
            className="flex items-center gap-1 rounded-full bg-red-600/90 hover:bg-red-500 text-white px-2 py-0.5 text-[10px] font-semibold transition-all shadow-md active:scale-95 cursor-pointer border border-red-400/30"
            title="Turn off camera"
            aria-label="Turn off camera"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 21l-3.5-3.5M21 8.5V17m-4-8.5v5.5M4 7.5A2.5 2.5 0 0 1 6.5 5h3m5 0h1.5A2.5 2.5 0 0 1 18.5 7.5v1.5" />
            </svg>
            <span>Turn Off</span>
          </button>
        </div>
      </div>

      {/* Bottom emotion status bar */}
      <div className="bg-black/85 backdrop-blur-md py-1 px-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-[11px] text-white font-medium truncate">
          {getEmotionLabel(currentEmotion)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-red-400 hover:text-red-300 font-medium underline cursor-pointer"
        >
          Off
        </button>
      </div>
    </div>
  )
}

