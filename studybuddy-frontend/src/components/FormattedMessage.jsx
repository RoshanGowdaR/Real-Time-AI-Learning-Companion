import React, { useState } from 'react'

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2.5 rounded-xl border border-[#2b2e48] bg-[#0c0d15] overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#151728] border-b border-[#24263e]">
        <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold tracking-wider">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-[#1f2237] hover:bg-indigo-600 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function parseFormattedText(text) {
  if (!text) return null

  // Split text by triple backtick code blocks
  const parts = text.split(/(```[\s\S]*?```)/g)

  return parts.map((part, partIdx) => {
    // Handle code block
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).trim().split('\n')
      const firstLine = lines[0].trim()
      let language = ''
      let codeContent = lines.join('\n')

      if (firstLine && !firstLine.includes(' ') && lines.length > 1) {
        language = firstLine
        codeContent = lines.slice(1).join('\n')
      }

      return <CodeBlock key={`block-${partIdx}`} language={language} code={codeContent} />
    }

    // Process normal text lines
    const lines = part.split('\n')
    return (
      <div key={`part-${partIdx}`} className="space-y-1.5">
        {lines.map((line, lineIdx) => {
          const trimmed = line.trim()
          if (!trimmed) {
            return <div key={`empty-${lineIdx}`} className="h-1.5" />
          }

          // Headers
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={`h4-${lineIdx}`} className="text-xs sm:text-sm font-bold text-white mt-2 mb-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                {renderInlineStyles(trimmed.slice(4))}
              </h4>
            )
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={`h3-${lineIdx}`} className="text-sm sm:text-base font-bold text-white mt-2.5 mb-1 text-indigo-300">
                {renderInlineStyles(trimmed.slice(3))}
              </h3>
            )
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={`h2-${lineIdx}`} className="text-base sm:text-lg font-bold text-white mt-3 mb-1.5">
                {renderInlineStyles(trimmed.slice(2))}
              </h2>
            )
          }

          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={`bullet-${lineIdx}`} className="flex items-start gap-2 pl-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span className="text-xs sm:text-sm text-gray-200 leading-relaxed">
                  {renderInlineStyles(trimmed.slice(2))}
                </span>
              </div>
            )
          }

          // Numbered lists: e.g. "1. " or "2. "
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
          if (numMatch) {
            return (
              <div key={`num-${lineIdx}`} className="flex items-start gap-2 pl-1 py-0.5">
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/80 border border-indigo-700/50 rounded px-1.5 py-0.2 mt-0.5 shrink-0">
                  {numMatch[1]}
                </span>
                <span className="text-xs sm:text-sm text-gray-200 leading-relaxed">
                  {renderInlineStyles(numMatch[2])}
                </span>
              </div>
            )
          }

          // Standard paragraph line
          return (
            <p key={`p-${lineIdx}`} className="text-xs sm:text-sm text-gray-200 leading-relaxed">
              {renderInlineStyles(line)}
            </p>
          )
        })}
      </div>
    )
  })
}

function renderInlineStyles(text) {
  if (!text) return ''

  // Split by bold (**text**) and inline code (`code`)
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g)

  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={idx} className="text-white font-semibold">
          {token.slice(2, -2)}
        </strong>
      )
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[#1d1f33] text-indigo-300 font-mono text-[11px] border border-[#2d304e]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    return token
  })
}

export default function FormattedMessage({ content }) {
  if (!content) return null
  return <div className="formatted-message space-y-1 break-words">{parseFormattedText(content)}</div>
}
