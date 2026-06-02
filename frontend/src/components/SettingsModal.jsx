import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'ronin_user_config'

const PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter',    url: 'https://openrouter.ai/keys',                    defaultModel: 'deepseek/deepseek-v4-flash',               modelPlaceholder: 'e.g. deepseek/deepseek-v4-flash' },
  { id: 'openai',     label: 'OpenAI',        url: 'https://platform.openai.com/api-keys',           defaultModel: 'gpt-4o-mini',                             modelPlaceholder: 'e.g. gpt-4o-mini' },
  { id: 'anthropic',  label: 'Anthropic',     url: 'https://console.anthropic.com/keys',             defaultModel: 'claude-haiku-4-5-20251001',               modelPlaceholder: 'e.g. claude-haiku-4-5-20251001' },
  { id: 'groq',       label: 'Groq',          url: 'https://console.groq.com/keys',                  defaultModel: 'llama-3.3-70b-versatile',                 modelPlaceholder: 'e.g. llama-3.3-70b-versatile' },
  { id: 'together',   label: 'Together AI',   url: 'https://api.together.xyz/settings/api-keys',     defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', modelPlaceholder: 'e.g. meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { id: 'mistral',    label: 'Mistral',       url: 'https://console.mistral.ai/api-keys',            defaultModel: 'mistral-small-latest',                    modelPlaceholder: 'e.g. mistral-small-latest' },
  { id: 'ollama',     label: 'Ollama (local)',url: 'https://ollama.com',                             defaultModel: 'llama3.2',                                modelPlaceholder: 'e.g. llama3.2' },
]

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveConfig(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch {}
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'rgba(220,20,60,0.7)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 5 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(220,20,60,0.2)',
            borderRadius: 7, padding: '9px 36px 9px 12px', color: '#e2e8f0',
            fontSize: 12, fontFamily: 'monospace', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(220,20,60,0.6)'}
          onBlur={e => e.target.style.borderColor = 'rgba(220,20,60,0.2)'}
        />
        {isPassword && (
          <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,20,60,0.5)', fontSize: 13 }}>
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontFamily: 'monospace' }}>{hint}</div>}
    </div>
  )
}

export default function SettingsModal({ isOpen, onClose }) {
  const [cfg, setCfg] = useState(loadConfig)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (isOpen) setCfg(loadConfig()) }, [isOpen])

  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }))

  const selectedProvider = PROVIDERS.find(p => p.id === (cfg.LLM_PROVIDER || 'openrouter')) || PROVIDERS[0]

  const handleSave = () => {
    saveConfig(cfg)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const handleClear = () => {
    setCfg({})
    saveConfig({})
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }}
          />

          {/* Modal */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              pointerEvents: 'all',
              width: 'min(560px, 94vw)', height: 'min(680px, 92vh)',
              background: 'rgba(10,0,0,0.97)', border: '1px solid rgba(220,20,60,0.3)',
              borderRadius: 16, boxShadow: '0 0 60px rgba(220,20,60,0.2)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(220,20,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.25em', color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace', marginBottom: 3 }}>◈ RONIN CONFIGURATION</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>API Keys & Model</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>

              {/* ── LLM Section ── */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 12 }}>
                  ◈ AI MODEL
                </div>

                {/* Provider selector */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(220,20,60,0.7)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>PROVIDER</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => set('LLM_PROVIDER', p.id)}
                        style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer', border: '1px solid',
                          borderColor: cfg.LLM_PROVIDER === p.id || (!cfg.LLM_PROVIDER && p.id === 'openrouter') ? 'rgba(220,20,60,0.7)' : 'rgba(255,255,255,0.1)',
                          background: cfg.LLM_PROVIDER === p.id || (!cfg.LLM_PROVIDER && p.id === 'openrouter') ? 'rgba(220,20,60,0.15)' : 'rgba(255,255,255,0.03)',
                          color: cfg.LLM_PROVIDER === p.id || (!cfg.LLM_PROVIDER && p.id === 'openrouter') ? '#ff8c94' : 'rgba(255,255,255,0.45)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label="LLM API KEY"
                  type="password"
                  value={cfg.LLM_API_KEY || ''}
                  onChange={v => set('LLM_API_KEY', v)}
                  placeholder="Paste your API key here"
                  hint={<>Get your key at <a href={selectedProvider.url} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(220,20,60,0.7)' }}>{selectedProvider.url}</a></>}
                />

                <Field
                  label={`MODEL (optional — defaults to ${selectedProvider.defaultModel})`}
                  value={cfg.LLM_MODEL || ''}
                  onChange={v => set('LLM_MODEL', v)}
                  placeholder={selectedProvider.modelPlaceholder}
                />
              </div>

              <div style={{ height: 1, background: 'rgba(220,20,60,0.1)', marginBottom: 20 }} />

              {/* ── Data APIs Section ── */}
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 12 }}>
                  ◈ DATA APIS
                </div>

                <Field
                  label="RAPIDAPI KEY (Amazon product data)"
                  type="password"
                  value={cfg.RAPIDAPI_KEY || ''}
                  onChange={v => set('RAPIDAPI_KEY', v)}
                  placeholder="RapidAPI key for Real-Time Amazon Data"
                  hint={<>Subscribe at <a href="https://rapidapi.com/search/real-time-amazon-data" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(220,20,60,0.7)' }}>rapidapi.com</a></>}
                />

                <Field
                  label="YOUTUBE API KEY (review videos)"
                  type="password"
                  value={cfg.YOUTUBE_API_KEY || ''}
                  onChange={v => set('YOUTUBE_API_KEY', v)}
                  placeholder="Google Cloud YouTube Data API v3 key"
                  hint={<>Get at <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(220,20,60,0.7)' }}>Google Cloud Console</a></>}
                />

                <Field
                  label="TAVILY API KEY (web search)"
                  type="password"
                  value={cfg.TAVILY_API_KEY || ''}
                  onChange={v => set('TAVILY_API_KEY', v)}
                  placeholder="Tavily search API key"
                  hint={<>Get at <a href="https://app.tavily.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(220,20,60,0.7)' }}>app.tavily.com</a></>}
                />
              </div>

              {/* Note */}
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(220,20,60,0.05)', border: '1px solid rgba(220,20,60,0.1)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', lineHeight: 1.7 }}>
                  Keys are stored in your browser only (localStorage). They override the server defaults for your session. Leave blank to use the server's default keys.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(220,20,60,0.12)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={handleClear}
                style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer' }}
              >
                Reset to defaults
              </button>
              <motion.button
                onClick={handleSave}
                whileTap={{ scale: 0.97 }}
                style={{ padding: '9px 24px', borderRadius: 7, border: 'none', background: saved ? '#22c55e' : 'linear-gradient(135deg,#e63946,#c1121f)', color: '#fff', fontSize: 12, fontFamily: 'monospace', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.08em', transition: 'background 0.3s' }}
              >
                {saved ? '✓ SAVED' : 'SAVE & APPLY'}
              </motion.button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
