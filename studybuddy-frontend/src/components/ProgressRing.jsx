import React from 'react'

export default function ProgressRing({
  value = 0,
  size = 88,
  stroke = 8,
  trackClass = 'stroke-[#2a2b3f]',
  progressClass = 'stroke-indigo-500',
  valueClass = 'text-white',
  labelClass = 'text-[11px] text-gray-500',
  label,
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (safeValue / 100) * circumference
  const sizeClass = {
    72: 'h-[72px] w-[72px]',
    80: 'h-20 w-20',
    88: 'h-[88px] w-[88px]',
    96: 'h-24 w-24',
  }[size] || 'h-[88px] w-[88px]'

  return (
    <div className={`relative inline-flex items-center justify-center ${sizeClass}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className={`${trackClass} fill-none`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${progressClass} fill-none transition-all duration-300`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold leading-none ${valueClass}`}>{safeValue}%</span>
        {label ? <span className={`mt-1 ${labelClass}`}>{label}</span> : null}
      </div>
    </div>
  )
}
