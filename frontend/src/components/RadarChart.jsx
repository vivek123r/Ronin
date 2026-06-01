import { motion } from 'framer-motion'

export default function RadarChart({ winner, weights, productCache }) {
  const cx = 150, cy = 150, R = 100
  const axes = [
    { label: 'QUALITY',    angle: -Math.PI/2 },
    { label: 'VALUE',      angle: 0 },
    { label: 'REVIEWS',    angle: Math.PI/2 },
    { label: 'CONFIDENCE', angle: Math.PI },
  ]

  // Derive values 0-1
  const vals = [
    Math.min(1, (winner?.quality_score || 50) / 100),
    Math.min(1, (weights?.price || 0.33) * 2.2),
    Math.min(1, (winner?.quality_score || 50) / 100 * 0.88),
    Math.min(1, (winner?.confidence || 75) / 100),
  ]

  function point(angle, val) {
    return { x: cx + Math.cos(angle) * R * val, y: cy + Math.sin(angle) * R * val }
  }

  const rings = [0.25, 0.5, 0.75, 1.0]
  function ringPoints(scale) {
    return axes.map(a => `${cx + Math.cos(a.angle)*R*scale},${cy + Math.sin(a.angle)*R*scale}`).join(' ')
  }

  const dataPoints = axes.map((a, i) => point(a.angle, vals[i]))
  const polyStr = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  const LABEL_R = R + 22

  return (
    <div style={{ padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 14, backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 12, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ HIVE MIND CONSENSUS
      </div>
      <svg width="300" height="300" viewBox="0 0 300 300" style={{ display: 'block', margin: '0 auto' }}>
        {rings.map((r, i) => (
          <polygon key={i} points={ringPoints(r)} fill="none"
            stroke="rgba(220,20,60,0.1)" strokeWidth="0.8"/>
        ))}
        {axes.map((a, i) => (
          <line key={i} x1={cx} y1={cy}
            x2={cx + Math.cos(a.angle)*R} y2={cy + Math.sin(a.angle)*R}
            stroke="rgba(220,20,60,0.15)" strokeWidth="0.8"/>
        ))}
        {axes.map((a, i) => {
          const lx = cx + Math.cos(a.angle) * LABEL_R
          const ly = cy + Math.sin(a.angle) * LABEL_R
          return (
            <text key={i} x={lx} y={ly}
              textAnchor={Math.abs(a.angle) < 0.1 ? 'start' : Math.abs(a.angle - Math.PI) < 0.1 ? 'end' : 'middle'}
              dominantBaseline="middle"
              fill="rgba(220,20,60,0.55)" fontSize="10" fontFamily="monospace" fontWeight="700">
              {a.label}
            </text>
          )
        })}
        {axes.map((a, i) => {
          const p = point(a.angle, vals[i])
          return (
            <text key={i} x={p.x + Math.cos(a.angle)*10} y={p.y + Math.sin(a.angle)*10}
              textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,140,148,0.8)" fontSize="11" fontFamily="monospace">
              {Math.round(vals[i]*100)}
            </text>
          )
        })}
        <motion.polygon
          points={polyStr}
          fill="rgba(220,20,60,0.18)"
          stroke="#e63946"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 8px rgba(220,20,60,0.5))', transformOrigin: '150px 150px' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {dataPoints.map((p, i) => (
          <motion.circle key={i} cx={p.x} cy={p.y} r="4"
            fill="#e63946"
            style={{ filter: 'drop-shadow(0 0 4px rgba(220,20,60,0.9))' }}
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.6 + i*0.08, duration: 0.3 }}
          />
        ))}
        <circle cx={cx} cy={cy} r="3" fill="rgba(220,20,60,0.6)"/>
      </svg>
    </div>
  )
}
