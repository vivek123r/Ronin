import { useEffect, useRef, useState } from 'react'

/* ─── Shared spider SVG ──────────────────────────────────────────────── */
function SpiderSVG({ legPhase = 0, size = 28, flip = false, stuck = false }) {
  const L = stuck
    ? { tl:'M12 10 L3 3', tr:'M16 10 L25 3', ml:'M12 13 L1 11', mr:'M16 13 L27 11', bl:'M12 16 L3 23', br:'M16 16 L25 23' }
    : legPhase === 0
    ? { tl:'M12 10 L4 4', tr:'M16 10 L24 4', ml:'M12 13 L3 13', mr:'M16 13 L25 13', bl:'M12 16 L4 22', br:'M16 16 L24 22' }
    : { tl:'M12 10 L3 6', tr:'M16 10 L25 6', ml:'M12 13 L2 11', mr:'M16 13 L26 11', bl:'M12 16 L3 20', br:'M16 16 L25 20' }
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d={L.tl} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={L.tr} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={L.ml} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={L.mr} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={L.bl} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={L.br} stroke="#cc1122" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#1a0000" stroke="#e63946" strokeWidth="1"/>
      <ellipse cx="14" cy="10" rx="2.5" ry="3" fill="#e63946" opacity="0.9"/>
      <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
      <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
      <circle cx="12.8" cy="8.5" r="0.45" fill="#000"/>
      <circle cx="15.8" cy="8.5" r="0.45" fill="#000"/>
    </svg>
  )
}

/* ─── Corner Web with optional caught spider ─────────────────────────── */
function CornerWebEl({ corner, progress, showSpider, spiderLegPhase }) {
  if (progress <= 0) return null

  const W = 220, H = 220
  // corner: 0=top-left, 3=bottom-right
  const o = corner === 0 ? { x: 0, y: 0 } : { x: W, y: H }
  const pos = corner === 0 ? { top: 0, left: 0 } : { bottom: 0, right: 0 }
  const [a1, a2] = corner === 0 ? [0, 90] : [180, 270]

  const len = 200 * progress
  const spokeCount = 9
  const spokeAngles = Array.from({ length: spokeCount }, (_, i) => a1 + (a2 - a1) * (i / (spokeCount - 1)))

  // spider sits near the middle of the web
  const midAngle = ((a1 + a2) / 2 * Math.PI) / 180
  const spiderDist = len * 0.55
  const sx = Math.max(16, Math.min(W - 16, o.x + Math.cos(midAngle) * spiderDist))
  const sy = Math.max(16, Math.min(H - 16, o.y + Math.sin(midAngle) * spiderDist))

  return (
    <div style={{ position: 'fixed', zIndex: 9997, pointerEvents: 'none', ...pos }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="hidden">
        {/* Spokes */}
        {spokeAngles.map((angle, i) => {
          const rad = (angle * Math.PI) / 180
          const ex = Math.max(0, Math.min(W, o.x + Math.cos(rad) * len))
          const ey = Math.max(0, Math.min(H, o.y + Math.sin(rad) * len))
          return (
            <line key={i} x1={o.x} y1={o.y} x2={ex} y2={ey}
              stroke="#e63946" strokeWidth="0.9"
              strokeOpacity={0.5 * progress} />
          )
        })}
        {/* Concentric arcs */}
        {[0.22, 0.38, 0.55, 0.70, 0.85, 1.0].map((t, i) => {
          const r = len * t
          if (r < 8) return null
          const x1 = Math.max(0, Math.min(W, o.x + Math.cos((a1 * Math.PI) / 180) * r))
          const y1 = Math.max(0, Math.min(H, o.y + Math.sin((a1 * Math.PI) / 180) * r))
          const x2 = Math.max(0, Math.min(W, o.x + Math.cos((a2 * Math.PI) / 180) * r))
          const y2 = Math.max(0, Math.min(H, o.y + Math.sin((a2 * Math.PI) / 180) * r))
          return (
            <path key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none" stroke="#e63946" strokeWidth="0.7"
              strokeOpacity={0.28 * progress} />
          )
        })}
        {/* Caught spider in the web */}
        {showSpider && progress > 0.5 && (
          <g transform={`translate(${sx - 14}, ${sy - 14})`} opacity={Math.min(1, (progress - 0.5) * 4)}>
            {/* web wrapping threads around spider */}
            <line x1="14" y1="0"  x2="0"  y2="14" stroke="#e63946" strokeWidth="0.6" strokeOpacity="0.4"/>
            <line x1="14" y1="0"  x2="28" y2="14" stroke="#e63946" strokeWidth="0.6" strokeOpacity="0.4"/>
            <line x1="0"  y1="14" x2="28" y2="14" stroke="#e63946" strokeWidth="0.6" strokeOpacity="0.4"/>
            {/* spider body */}
            <path d={spiderLegPhase === 0
              ? "M12 10 L5 5 M16 10 L23 5 M12 13 L2 13 M16 13 L26 13 M12 16 L5 22 M16 16 L23 22"
              : "M12 10 L4 7 M16 10 L24 7 M12 13 L1 11 M16 13 L27 11 M12 16 L4 20 M16 16 L24 20"}
              stroke="#cc1122" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
            <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#1a0000" stroke="#e63946" strokeWidth="1"/>
            <ellipse cx="14" cy="10" rx="2.5" ry="3" fill="#e63946" opacity="0.9"/>
            <circle cx="12.5" cy="8.5" r="0.9" fill="#fff"/>
            <circle cx="15.5" cy="8.5" r="0.9" fill="#fff"/>
            <circle cx="12.8" cy="8.5" r="0.4" fill="#000"/>
            <circle cx="15.8" cy="8.5" r="0.4" fill="#000"/>
          </g>
        )}
      </svg>
    </div>
  )
}

/* ─── Main FX: scroll-driven corner webs only ───────────────────────── */
function ScrollWebs() {
  const [scrollPct, setScrollPct] = useState(0)
  const [legPhase, setLegPhase] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      setScrollPct(max > 0 ? Math.min(doc.scrollTop / max, 1) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => setLegPhase(p => 1 - p), 500)
    return () => clearInterval(iv)
  }, [])

  // top-left web: visible when near top (scroll < 0.15), full at scroll=0, fades as you scroll away
  const tlProgress = Math.max(0, 1 - scrollPct / 0.15)

  // bottom-right web: grows as you approach page end (scroll > 0.85)
  const brProgress = Math.max(0, (scrollPct - 0.85) / 0.15)

  return (
    <>
      <CornerWebEl
        corner={0}
        progress={tlProgress}
        showSpider={true}
        spiderLegPhase={legPhase}
      />
      <CornerWebEl
        corner={3}
        progress={brProgress}
        showSpider={true}
        spiderLegPhase={legPhase}
      />
    </>
  )
}

/* ─── History Spider — drops into sidebar ───────────────────────────── */
export function HistorySpider() {
  const [dropped, setDropped] = useState(false)
  const [legPhase, setLegPhase] = useState(0)
  const [hanging, setHanging] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setDropped(true), 1500)
    const t2 = setTimeout(() => setHanging(true), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (!hanging) return
    const iv = setInterval(() => setLegPhase(p => 1 - p), 600)
    return () => clearInterval(iv)
  }, [hanging])

  const threadLen = dropped ? 72 : 0

  return (
    <div style={{ position: 'absolute', top: 0, right: '24px', width: '30px', zIndex: 10, pointerEvents: 'none' }}>
      <svg width="30" height={threadLen + 30} style={{ display: 'block', overflow: 'visible' }}>
        <line x1="15" y1="0" x2="15" y2={threadLen}
          stroke="#e63946" strokeWidth="1" strokeOpacity="0.55"
          style={{ transition: 'y2 0.7s cubic-bezier(0.25,0.46,0.45,0.94)' }} />
      </svg>
      <div style={{
        position: 'absolute', top: threadLen, left: '1px',
        transform: 'translateY(-50%)',
        opacity: dropped ? 1 : 0,
        transition: 'top 0.7s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s 0.4s',
        filter: 'drop-shadow(0 0 5px rgba(220,20,60,0.7))',
        animation: hanging ? 'pendulum 3s ease-in-out infinite' : 'none',
      }}>
        <SpiderSVG legPhase={legPhase} size={26} />
      </div>
      <style>{`
        @keyframes pendulum {
          0%,100% { transform: translateY(-50%) rotate(-8deg); }
          50%      { transform: translateY(-50%) rotate(8deg); }
        }
      `}</style>
    </div>
  )
}

/* ─── Default export ─────────────────────────────────────────────────── */
export default function SpiderFX() {
  return <ScrollWebs />
}
