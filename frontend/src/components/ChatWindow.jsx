import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2, MessageCircle, Minimize2, Maximize2 } from 'lucide-react'

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Numbered list detection: "1. text" or "1) text"
    if (/^\d+[.)]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      result.push(
        <ol key={result.length} style={{ margin: '6px 0', paddingLeft: 20 }}>
          {items.map((item, j) => <li key={j} style={{ marginBottom: 3, lineHeight: 1.6 }}>{renderInline(item)}</li>)}
        </ol>
      )
      continue
    }

    // Bullet list: "- text" or "* text"
    if (/^[-*]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      result.push(
        <ul key={result.length} style={{ margin: '6px 0', paddingLeft: 20 }}>
          {items.map((item, j) => <li key={j} style={{ marginBottom: 3, lineHeight: 1.6 }}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    // Empty line = spacing
    if (!line) {
      result.push(<div key={result.length} style={{ height: 8 }} />)
      i++
      continue
    }

    // Regular paragraph
    result.push(<p key={result.length} style={{ margin: '4px 0', lineHeight: 1.6 }}>{renderInline(line)}</p>)
    i++
  }

  return result
}

function renderInline(text) {
  // **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#ff8c94', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function SpiderIcon({ size = 14, color = '#e63946' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
      <line x1="14" y1="10" x2="4" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="24" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="2" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="26" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="4" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="24" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#0a0000" stroke={color} strokeWidth="1"/>
      <ellipse cx="14" cy="10" rx="2.5" ry="3" fill={color} opacity="0.9"/>
      <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
      <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
    </svg>
  )
}

function loadConfig() {
  try {
    const raw = localStorage.getItem('ronin_user_config')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export default function ChatWindow({ result, query, embedded, collapsed, onToggleCollapse }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const width = embedded ? '100%' : '380px'
  const height = embedded ? '100%' : '520px'
  const borderRadius = embedded ? 0 : 16

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (embedded && !collapsed) inputRef.current?.focus()
  }, [embedded, collapsed])

  const buildContext = () => {
    const rec = result?.final_recommendation || {}
    return {
      query,
      mode: rec.mode || 'discovery',
      winner: rec.winner || null,
      ranked: rec.ranked || [],
      comparison_table: rec.comparison_table || [],
      verdict: rec.verdict || null,
      weights_used: rec.weights_used || {},
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const config = loadConfig()
      const context = buildContext()
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, messages: [...messages, userMsg], config }),
      })
      if (!res.ok) throw new Error('Chat request failed')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || `Error: ${data.error}` }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Failed to get response. ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const panelStyles = embedded ? {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: 'rgba(8,0,0,0.6)',
    borderLeft: '1px solid rgba(220,20,60,0.2)',
  } : {
    position: 'fixed', bottom: 24, right: 24, zIndex: 200,
    background: 'rgba(8,0,0,0.97)',
    border: '1px solid rgba(220,20,60,0.35)',
    borderRadius: 16,
    boxShadow: '0 0 60px rgba(220,20,60,0.25), 0 8px 32px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(24px)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }

  // When collapsed in embedded mode, show just a thin strip
  if (embedded && collapsed) {
    return (
      <div style={{
        ...panelStyles, width, justifyContent: 'center', cursor: 'pointer',
        flex: '0 0 38px', minWidth: 0,
      }} onClick={onToggleCollapse}>
        <div style={{
          writingMode: 'vertical-rl', textOrientation: 'mixed',
          color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace',
          fontSize: 10, letterSpacing: '0.2em', fontWeight: 700,
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
          justifyContent: 'center', flex: 1,
        }}>
          <MessageCircle size={12} />
          <span style={{ marginTop: 8 }}>INTEL CHAT</span>
          <Maximize2 size={10} style={{ marginTop: 8 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...panelStyles, width, height: embedded ? undefined : height, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(220,20,60,0.12)',
        background: 'rgba(220,20,60,0.04)',
      }}>
        <SpiderIcon size={16} color="#ff6b75" />
        <span style={{ flex: 1, fontSize: 12, letterSpacing: '0.15em', color: '#ff6b75', fontFamily: 'monospace', fontWeight: 700 }}>
          INTELLIGENCE CHAT
        </span>
        {embedded && (
          <button onClick={onToggleCollapse}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <Minimize2 size={15} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 12px',
            color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
            fontSize: 13, lineHeight: 1.7,
          }}>
            <SpiderIcon size={32} color="rgba(220,20,60,0.2)" />
            <div style={{ marginTop: 16 }}>
              Ask questions about the researched products.
              <br /><br />
              Try: "Which is best for travel?"
              <br />"Compare build quality"
              <br />"What are the downsides?"
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: 'radial-gradient(circle, #e63946, #8b0000)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 10px rgba(220,20,60,0.4)',
              }}>
                <SpiderIcon size={12} color="#fff" />
              </div>
            )}
            <div style={{
              maxWidth: msg.role === 'user' ? '80%' : '90%',
              background: msg.role === 'user' ? 'rgba(220,20,60,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(220,20,60,0.25)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              color: '#e2e8f0',
              lineHeight: 1.6,
              wordBreak: 'break-word',
            }}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'radial-gradient(circle, #e63946, #8b0000)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px rgba(220,20,60,0.4)',
            }}>
              <SpiderIcon size={12} color="#fff" />
            </div>
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ color: '#ff6b75', fontSize: 12, fontFamily: 'monospace' }}
            >
              Analysing...
            </motion.span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px', flexShrink: 0,
        borderTop: '1px solid rgba(220,20,60,0.1)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the research..."
          disabled={loading}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(220,20,60,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#e2e8f0',
            fontSize: 13,
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'rgba(220,20,60,0.5)'}
          onBlur={e => e.currentTarget.style.borderColor = 'rgba(220,20,60,0.2)'}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
            background: input.trim() && !loading ? 'linear-gradient(135deg, #e63946, #c1121f)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(220,20,60,0.3)',
            color: input.trim() && !loading ? '#fff' : 'rgba(255,255,255,0.2)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
