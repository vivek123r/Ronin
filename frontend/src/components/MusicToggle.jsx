import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

// shared audio singleton so it survives across re-renders
let globalAudio = null
let _enabled = null

export function playTheme() {
  _enabled = true
  localStorage.setItem('ronin_music', 'on')
  if (!globalAudio) {
    globalAudio = new Audio('/theme.mp3')
    globalAudio.loop = true
    globalAudio.volume = 0.3
  }
  globalAudio.play().catch(() => {})
}

export function pauseTheme() {
  localStorage.setItem('ronin_music', 'off')
  _enabled = false
  if (globalAudio) globalAudio.pause()
  try { window.dispatchEvent(new CustomEvent('roninMusicChange', { detail: false })) } catch {}
}

export default function MusicToggle() {
  const [playing, setPlaying] = useState(() => localStorage.getItem('ronin_music') !== 'off')

  useEffect(() => {
    const handler = (e) => setPlaying(e.detail)
    window.addEventListener('roninMusicChange', handler)
    return () => window.removeEventListener('roninMusicChange', handler)
  }, [])

  const toggle = () => {
    setPlaying(prev => {
      const next = !prev
      if (next) { playTheme() } else { pauseTheme() }
      return next
    })
  }

  return (
    <button
      onClick={toggle}
      title={playing ? 'Mute theme' : 'Play theme'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 8,
        background: playing ? 'rgba(220,20,60,0.12)' : 'rgba(255,255,255,0.04)',
        border: playing ? '1px solid rgba(220,20,60,0.3)' : '1px solid rgba(255,255,255,0.08)',
        color: playing ? '#ff6b75' : 'rgba(255,255,255,0.25)',
        cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = playing ? 'rgba(220,20,60,0.2)' : 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = playing ? 'rgba(220,20,60,0.12)' : 'rgba(255,255,255,0.04)'}
    >
      {playing ? <Volume2 size={14} /> : <VolumeX size={14} />}
    </button>
  )
}
