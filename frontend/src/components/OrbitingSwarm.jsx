const SPIDERS = [
  { orbit: 140, dur: 14, size: 13, color: '#e63946', op: 0.25 },
  { orbit: 170, dur: 18, size: 16, color: '#ff7a3d', op: 0.35 },
  { orbit: 200, dur: 22, size: 19, color: '#9b1aff', op: 0.30 },
  { orbit: 230, dur: 26, size: 22, color: '#ff3366', op: 0.28 },
  { orbit: 155, dur: 16, size: 14, color: '#e63946', op: 0.22 },
  { orbit: 185, dur: 20, size: 17, color: '#ff7a3d', op: 0.32 },
  { orbit: 215, dur: 24, size: 20, color: '#9b1aff', op: 0.27 },
  { orbit: 145, dur: 13, size: 12, color: '#ff3366', op: 0.33 },
  { orbit: 175, dur: 17, size: 15, color: '#e63946', op: 0.24 },
  { orbit: 205, dur: 21, size: 18, color: '#ff7a3d', op: 0.29 },
  { orbit: 160, dur: 15, size: 13, color: '#9b1aff', op: 0.26 },
  { orbit: 190, dur: 19, size: 16, color: '#ff3366', op: 0.31 },
  { orbit: 180, dur: 23, size: 14, color: '#e63946', op: 0.28 },
  { orbit: 210, dur: 25, size: 19, color: '#ff7a3d', op: 0.22 },
]

export default function OrbitingSwarm() {
  return (
    <>
      {SPIDERS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: s.size, height: s.size,
          marginLeft: -s.size / 2, marginTop: -s.size / 2,
          opacity: s.op, pointerEvents: 'none', zIndex: 2,
          animation: `orbit-${i} ${s.dur}s linear infinite`
        }}>
          <OrbitSpiderIcon color={s.color} size={s.size} />
        </div>
      ))}
      <style>{SPIDERS.map((s, i) => `
        @keyframes orbit-${i} {
          0%   { transform: translate(-50%, -50%) rotate(0deg) translateX(${s.orbit}px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(${s.orbit}px) rotate(-360deg); }
        }`).join('')}
      </style>
    </>
  )
}

function OrbitSpiderIcon({ color = '#e63946', size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
      <line x1="14" y1="10" x2="4"  y2="3"  stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="10" x2="24" y2="3"  stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="2"  y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="14" x2="26" y2="12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="4"  y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="14" y1="17" x2="24" y2="24" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <ellipse cx="14" cy="14" rx="4.5" ry="6" fill="#0a0000" stroke={color} strokeWidth="1"/>
      <ellipse cx="14" cy="10" rx="2.5" ry="3" fill={color} opacity="0.9"/>
      <circle cx="12.5" cy="8.5" r="1" fill="#fff"/>
      <circle cx="15.5" cy="8.5" r="1" fill="#fff"/>
    </svg>
  )
}
