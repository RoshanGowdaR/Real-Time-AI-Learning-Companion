import React from 'react'

export default function LoadingSpinner({ className = '' }) {
  return (
    <span
      className={`inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ${className}`.trim()}
      aria-hidden="true"
    />
  )
}
