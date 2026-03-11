import React from 'react'

const EMOTION_LABELS = {
  happy: '\uD83D\uDE0A Happy',
  confused: '\uD83D\uDE15 Confused',
  distressed: '\uD83D\uDE1F Distressed',
  neutral: '\uD83D\uDE10 Focused',
  no_face: '\uD83D\uDC40 Come back!',
}

function getEmotionLabel(currentEmotion) {
  const key = String(currentEmotion || 'no_face').toLowerCase()
  return EMOTION_LABELS[key] || EMOTION_LABELS.no_face
}

export default function FaceDetectionPip({ videoRef, currentEmotion, onClose }) {
  return (
    <div className="fixed bottom-24 left-4 z-40 w-40 h-30 sm:w-44 sm:h-32 rounded-2xl overflow-hidden border-2 border-gray-700 shadow-2xl bg-gray-900 relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      <div className="absolute top-2 left-2 rounded-full bg-black/45 border border-white/15 px-2 py-0.5">
        <p className="text-[10px] text-white tracking-wide">Focus Mode</p>
      </div>

      <button
        type="button"
        onClick={() => onClose?.()}
        className="absolute top-2 right-2 h-5 w-5 rounded-full bg-black/50 border border-white/20 text-[10px] text-gray-300 hover:text-white hover:bg-black/70"
        aria-label="Close focus mode"
      >
        x
      </button>

      <div className="absolute bottom-0 left-0 right-0 bg-black/65 py-1.5 px-2">
        <p className="text-xs text-white text-center font-medium">{getEmotionLabel(currentEmotion)}</p>
      </div>
    </div>
  )
}
