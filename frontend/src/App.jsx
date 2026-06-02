import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LandingPage from './components/LandingPage'
import SpiderHive from './components/SpiderHive'
import ResultsPanel from './components/ResultsPanel'
import HistorySidebar from './components/HistorySidebar'
import SpiderFX from './components/SpiderFX'
import SettingsModal, { loadConfig } from './components/SettingsModal'

const HISTORY_KEY = 'ronin_history'

function UrlRequestModal({ request, onSubmit }) {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset input when a new request comes in (retry scenario)
  useEffect(() => { setUrl(''); setSubmitting(false) }, [request.product, request.reason])

  const handleSubmit = async (val) => {
    setSubmitting(true)
    await onSubmit(val)
    // modal stays open until next url_request or pipeline resumes — parent handles close
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      {/* Backdrop */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)' }} onClick={() => onSubmit('')} />
      {/* Modal */}
      <div style={{
        position:'relative', zIndex:301, width:'min(520px,92vw)',
        background:'rgba(8,0,0,0.97)', border:'1px solid rgba(220,20,60,0.35)',
        borderRadius:16, padding:'28px 28px 24px', boxShadow:'0 0 60px rgba(220,20,60,0.25)',
      }}>
        <div style={{ fontSize:10, letterSpacing:'0.22em', color:'rgba(220,20,60,0.6)', fontFamily:'monospace', marginBottom:6 }}>◈ PRODUCT URL REQUIRED</div>
        <div style={{ fontSize:18, fontWeight:900, color:'#fff', fontFamily:'Space Grotesk,sans-serif', marginBottom:8 }}>
          Can't auto-resolve product
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', fontFamily:'monospace', marginBottom:6 }}>
          {request.reason}
        </div>
        <div style={{ fontSize:14, color:'#ff8c94', fontFamily:'monospace', fontWeight:700, marginBottom:20,
          padding:'8px 12px', background:'rgba(220,20,60,0.08)', borderRadius:7, border:'1px solid rgba(220,20,60,0.18)' }}>
          {request.product}
        </div>
        {submitting ? (
          <div style={{ fontSize:13, color:'rgba(220,20,60,0.7)', fontFamily:'monospace', textAlign:'center', padding:'20px 0' }}>
            <motion.span animate={{ opacity:[1,0.3,1] }} transition={{ duration:1, repeat:Infinity }}>
              ● Validating product...
            </motion.span>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontFamily:'monospace', marginBottom:8 }}>
              Paste an Amazon product URL to continue, or skip this product:
            </div>
            <input
              autoFocus
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(url) }}
              placeholder="https://www.amazon.in/dp/..."
              style={{
                width:'100%', boxSizing:'border-box',
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(220,20,60,0.3)',
                borderRadius:9, padding:'11px 14px', color:'#e2e8f0',
                fontSize:13, fontFamily:'monospace', outline:'none', marginBottom:18,
              }}
              onFocus={e => e.target.style.borderColor='rgba(220,20,60,0.7)'}
              onBlur={e => e.target.style.borderColor='rgba(220,20,60,0.3)'}
            />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => handleSubmit('')}
                style={{ padding:'9px 20px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
                  background:'transparent', color:'rgba(255,255,255,0.4)', fontSize:12, fontFamily:'monospace', cursor:'pointer' }}>
                Skip this product
              </button>
              <button onClick={() => handleSubmit(url)} disabled={!url.trim()}
                style={{ padding:'9px 24px', borderRadius:8, border:'none',
                  background: url.trim() ? 'linear-gradient(135deg,#e63946,#c1121f)' : 'rgba(255,255,255,0.08)',
                  color: url.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize:12, fontFamily:'monospace', fontWeight:800, cursor: url.trim() ? 'pointer' : 'default',
                  letterSpacing:'0.06em', boxShadow: url.trim() ? '0 4px 20px rgba(220,20,60,0.4)' : 'none',
                  transition:'all 0.2s' }}>
                SUBMIT URL
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


function App() {
  const [status, setStatus] = useState('idle')
  const [query, setQuery] = useState('')
  const [progress, setProgress] = useState([])
  const [result, setResult] = useState(null)
  const [pendingResult, setPendingResult] = useState(null)
  const [error, setError] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [urlRequest, setUrlRequest] = useState(null)  // { product, reason, threadId }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setHistory(JSON.parse(stored))
    } catch (e) {}
  }, [])

  const saveToHistory = (q, data) => {
    const entry = { query: q, result: data, timestamp: Date.now() }
    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, 50)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch (e) {}
      return updated
    })
  }

  const handleSearch = async (q) => {
    setQuery(q)
    setStatus('loading')
    setProgress([])
    setResult(null)
    setError(null)

    const userConfig = loadConfig()

    try {
      const response = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, config: userConfig })
      })

      if (!response.ok) throw new Error(`HTTP error ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          if (!chunk.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(chunk.slice(6))
            if (msg.type === 'progress') setProgress(p => [...p, msg.message])
            if (msg.type === 'result') setPendingResult({ data: msg.data, q })
            if (msg.type === 'error') { setError(msg.message); setStatus('error') }
            if (msg.type === 'url_request') setUrlRequest({ product: msg.product, reason: msg.reason, threadId: msg.thread_id })
          } catch (e) {}
        }
      }

      setPendingResult(prev => {
        if (!prev) setStatus(s => s === 'loading' ? 'error' : s)
        return prev
      })
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  const handleHiveComplete = () => {
    if (pendingResult) {
      setResult(pendingResult.data)
      setStatus('done')
      saveToHistory(pendingResult.q, pendingResult.data)
      setPendingResult(null)
    }
  }

  const handleNewSearch = () => {
    setStatus('idle')
    setResult(null)
    setPendingResult(null)
    setError(null)
    setProgress([])
  }

  // Close URL modal when pipeline finishes or errors
  useEffect(() => {
    if (status !== 'loading') setUrlRequest(null)
  }, [status])

  const showResults = (status === 'done' || status === 'loading') && result
  const showHive = status === 'loading' && !result

  const handleUrlSubmit = async (url) => {
    const req = urlRequest
    await fetch('/url_response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: req.threadId, url: url || '' })
    })
    // Close immediately on skip; otherwise keep spinner open —
    // next url_request SSE will update it, or pipeline finishing will clear it
    if (!url) setUrlRequest(null)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080808', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' }}>
      <SpiderFX />

      {!showHive && (
        <HistorySidebar
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(o => !o)}
          onSelect={handleSearch}
          history={history}
        />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {urlRequest && <UrlRequestModal request={urlRequest} onSubmit={handleUrlSubmit} />}

      <div style={{ transition: 'margin-left 0.3s ease', marginLeft: historyOpen ? '320px' : '0' }}>
        <AnimatePresence mode="wait">
          {status === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}
            >
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '32px 40px', textAlign: 'center', maxWidth: '480px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <p style={{ color: '#f87171', fontSize: '18px', marginBottom: '8px', fontWeight: 700 }}>Something went wrong</p>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6 }}>{error}</p>
              </div>
              <button
                onClick={handleNewSearch}
                style={{ background: 'linear-gradient(135deg,#e63946,#e63946)', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 20px rgba(220,20,60,0.4)' }}
              >
                Try Again
              </button>
            </motion.div>
          ) : showHive ? (
            <motion.div
              key="hive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
            >
              <SpiderHive progress={progress} query={query} resultReady={!!pendingResult} onComplete={handleHiveComplete} />
            </motion.div>
          ) : showResults ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -32 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <ResultsPanel
                result={result}
                progress={progress}
                isLoading={status === 'loading'}
                query={query}
                onNewSearch={handleNewSearch}
                onSearch={handleSearch}
                onSettingsOpen={() => setSettingsOpen(true)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
            >
              <LandingPage
                status={status}
                onSearch={handleSearch}
                progress={progress}
                onHistoryToggle={() => setHistoryOpen(o => !o)}
                onSettingsOpen={() => setSettingsOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default App
