import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, Zap } from 'lucide-react'

const QUICK_PILLS = [
  'Best earphone under 3000',
  'Gaming laptop under 60000',
  'Compare iPhone 16 vs Samsung S25'
]

export default function Hero({ onSearch, status, progress }) {
  const [inputValue, setInputValue] = useState('')
  const progressRef = useRef(null)
  const isLoading = status === 'loading'

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight
    }
  }, [progress])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading) return
    onSearch(trimmed)
  }

  const handlePill = (pill) => {
    if (isLoading) return
    setInputValue(pill)
    onSearch(pill)
  }

  const recentProgress = progress.slice(-8)

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundImage: "url('/static/samurai.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(10,14,26,0.75) 0%, rgba(10,14,26,0.85) 60%, rgba(10,14,26,0.95) 100%)',
        zIndex: 1
      }} />

      {/* Glass card */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: '680px',
        margin: '0 auto',
        padding: '0 16px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '48px 40px 40px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,212,0.05)'
        }}>
          {/* Logo / Title */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
              <Zap size={28} style={{ color: '#00d4d4' }} />
              <h1 style={{
                fontSize: '52px',
                fontWeight: 900,
                letterSpacing: '0.15em',
                color: '#00d4d4',
                margin: 0,
                textShadow: '0 0 30px #00d4d4, 0 0 60px rgba(0,212,212,0.4)',
                lineHeight: 1
              }}>
                RONIN
              </h1>
              <Zap size={28} style={{ color: '#00d4d4', transform: 'scaleX(-1)' }} />
            </div>
            <p style={{
              color: '#94a3b8',
              fontSize: '14px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              margin: 0,
              marginTop: '6px'
            }}>
              AI Product Intelligence
            </p>
          </div>

          {/* Divider */}
          <div style={{
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(0,212,212,0.3), transparent)',
            margin: '24px 0'
          }} />

          {/* Search form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  disabled={isLoading}
                  placeholder="Search products or compare..."
                  style={{
                    width: '100%',
                    paddingLeft: '42px',
                    paddingRight: '16px',
                    paddingTop: '14px',
                    paddingBottom: '14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    color: '#e2e8f0',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    opacity: isLoading ? 0.6 : 1,
                    cursor: isLoading ? 'not-allowed' : 'text',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'rgba(0,212,212,0.5)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(0,212,212,0.1)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                style={{
                  background: '#dc143c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !inputValue.trim() ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.2s, transform 0.1s, box-shadow 0.2s',
                  boxShadow: '0 4px 14px rgba(220,20,60,0.35)'
                }}
                onMouseEnter={e => {
                  if (!isLoading) {
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(220,20,60,0.55)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(220,20,60,0.35)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {isLoading ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Search size={16} />
                )}
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Quick pills */}
            {!isLoading && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {QUICK_PILLS.map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => handlePill(pill)}
                    style={{
                      background: 'rgba(0,212,212,0.08)',
                      border: '1px solid rgba(0,212,212,0.2)',
                      borderRadius: '20px',
                      padding: '6px 14px',
                      color: '#00d4d4',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                      fontFamily: 'Inter, sans-serif'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(0,212,212,0.15)'
                      e.currentTarget.style.borderColor = 'rgba(0,212,212,0.5)'
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,212,0.2)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(0,212,212,0.08)'
                      e.currentTarget.style.borderColor = 'rgba(0,212,212,0.2)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {pill}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Progress messages when loading */}
          {isLoading && recentProgress.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px'
              }}>
                <Loader2 size={14} style={{ color: '#00d4d4', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#00d4d4', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                  Agent Activity
                </span>
              </div>
              <div
                ref={progressRef}
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingRight: '4px'
                }}
              >
                {recentProgress.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(0,212,212,0.05)',
                      border: '1px solid rgba(0,212,212,0.1)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      color: i === recentProgress.length - 1 ? '#e2e8f0' : '#64748b',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      transition: 'color 0.3s'
                    }}
                  >
                    <span style={{
                      color: '#00d4d4',
                      fontSize: '10px',
                      marginTop: '3px',
                      flexShrink: 0
                    }}>▶</span>
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading indicator when no progress yet */}
          {isLoading && recentProgress.length === 0 && (
            <div style={{
              marginTop: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#64748b',
              fontSize: '14px'
            }}>
              <Loader2 size={16} style={{ color: '#00d4d4', animation: 'spin 1s linear infinite' }} />
              Initializing agents...
            </div>
          )}
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #475569; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,212,0.3); border-radius: 4px; }
      `}</style>
    </div>
  )
}
