import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LandingPage from './components/LandingPage'
import SpiderHive from './components/SpiderHive'
import ResultsPanel from './components/ResultsPanel'
import HistorySidebar from './components/HistorySidebar'
import SpiderFX from './components/SpiderFX'
import SettingsModal, { loadConfig } from './components/SettingsModal'

const HISTORY_KEY = 'ronin_history'


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

  const showResults = (status === 'done' || status === 'loading') && result
  const showHive = status === 'loading' && !result

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
