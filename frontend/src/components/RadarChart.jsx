import { useMemo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

function polar(cx, cy, angle, r) {
  return {
    x: cx + Math.cos(angle - Math.PI / 2) * r,
    y: cy + Math.sin(angle - Math.PI / 2) * r,
  }
}

function polygonPoints(cx, cy, axes, values, radius) {
  return axes
    .map((_, i) => {
      const p = polar(cx, cy, axes[i].angle, radius * (values[i] / 100))
      return `${p.x},${p.y}`
    })
    .join(' ')
}

function axisPoints(cx, cy, axes, radius) {
  return axes.map(a => {
    const p = polar(cx, cy, a.angle, radius)
    return { x: p.x, y: p.y }
  })
}

const PRODUCT_COLORS = [
  { stroke: '#e63946', fill: 'rgba(220,20,60,0.18)', glow: 'rgba(220,20,60,0.5)' },
  { stroke: '#ff7a3d', fill: 'rgba(255,122,61,0.14)', glow: 'rgba(255,122,61,0.4)' },
  { stroke: '#ffd700', fill: 'rgba(255,215,0,0.12)', glow: 'rgba(255,215,0,0.4)' },
  { stroke: '#9b1aff', fill: 'rgba(155,26,255,0.12)', glow: 'rgba(155,26,255,0.4)' },
  { stroke: '#4ade80', fill: 'rgba(74,222,128,0.12)', glow: 'rgba(74,222,128,0.4)' },
]

export function ProductDNA({ categoryScores, colorIndex = 0, label = '', size = 260 }) {
  const [animProgress, setAnimProgress] = useState(0)
  const pad = 40
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.30
  const colors = PRODUCT_COLORS[colorIndex % PRODUCT_COLORS.length]

  const axes = useMemo(() => {
    const entries = Object.entries(categoryScores || {})
    if (entries.length < 3) return []
    return entries.map(([name], i) => ({
      name,
      angle: (2 * Math.PI * i) / entries.length,
    }))
  }, [categoryScores])

  const values = useMemo(() => {
    const entries = Object.entries(categoryScores || {})
    return entries.map(([, v]) => Math.min(100, Math.max(0, Number(v) || 50)))
  }, [categoryScores])

  useEffect(() => {
    const t = setTimeout(() => setAnimProgress(1), 120)
    return () => clearTimeout(t)
  }, [])

  if (axes.length < 3) return null

  const effectiveVals = values.map(v => v * animProgress)
  const ringVals = [0.25, 0.5, 0.75, 1.0]
  const endpoints = axisPoints(cx, cy, axes, R)
  const labelR = R + 40

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto', overflow: 'visible' }}>
      {label && (
        <div style={{
          position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, letterSpacing: '0.12em', color: colors.stroke, fontFamily: 'monospace',
          fontWeight: 700, whiteSpace: 'nowrap', opacity: 0.7,
          zIndex: 1,
        }}>
          {label}
        </div>
      )}
      <svg width={size} height={size} viewBox={`-10 -10 ${size + 20} ${size + 20}`} style={{ overflow: 'visible' }}>
        {/* Ring polygons */}
        {ringVals.map((r, i) => (
          <polygon key={i}
            points={endpoints.map(ep => `${ep.x * r + cx * (1 - r)},${ep.y * r + cy * (1 - r)}`).join(' ')}
            fill="none" stroke="rgba(220,20,60,0.08)" strokeWidth="0.8"
          />
        ))}

        {/* Axis lines */}
        {endpoints.map((ep, i) => (
          <line key={i} x1={cx} y1={cy} x2={ep.x} y2={ep.y}
            stroke="rgba(220,20,60,0.12)" strokeWidth="0.8"
          />
        ))}

        {/* Axis labels */}
        {axes.map((a, i) => {
          const lp = polar(cx, cy, a.angle, labelR)
          const anchor = lp.x < cx - 2 ? 'end' : lp.x > cx + 2 ? 'start' : 'middle'
          const maxChars = 16
          const displayName = a.name.length > maxChars ? a.name.slice(0, maxChars - 1) + '\u2026' : a.name
          return (
            <text key={i} x={lp.x} y={lp.y}
              textAnchor={anchor} dominantBaseline="middle"
              fill="rgba(220,20,60,0.45)" fontSize="9" fontFamily="monospace" fontWeight="700"
              letterSpacing="0.04em"
            >
              {displayName}
            </text>
          )
        })}

        {/* Data polygon */}
        <motion.polygon
          points={polygonPoints(cx, cy, axes, effectiveVals, R)}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="1.8"
          style={{
            filter: `drop-shadow(0 0 6px ${colors.glow})`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Data point dots + scores */}
        {axes.map((a, i) => {
          const p = polar(cx, cy, a.angle, R * (effectiveVals[i] / 100))
          const scoreX = polar(cx, cy, a.angle, R * (effectiveVals[i] / 100) + 10)
          return (
            <g key={i}>
              <motion.circle cx={p.x} cy={p.y} r="3.5"
                fill={colors.stroke}
                style={{ filter: `drop-shadow(0 0 3px ${colors.glow})` }}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.06, duration: 0.25 }}
              />
              <motion.text x={scoreX.x} y={scoreX.y}
                textAnchor="middle" dominantBaseline="middle"
                fill={colors.stroke} fontSize="9" fontFamily="Space Grotesk, sans-serif" fontWeight="800"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.06, duration: 0.2 }}
              >
                {Math.round(effectiveVals[i])}
              </motion.text>
            </g>
          )
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2.5" fill="rgba(220,20,60,0.4)" />
      </svg>
    </div>
  )
}

export function MultiDNA({ products, size = 280 }) {
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.30

  // Collect all unique category names across all products
  const allCategories = useMemo(() => {
    const seen = new Set()
    const cats = []
    for (const p of products || []) {
      const scores = p.category_scores || {}
      for (const name of Object.keys(scores)) {
        if (!seen.has(name)) {
          seen.add(name)
          cats.push(name)
        }
      }
    }
    return cats
  }, [products])

  const axes = useMemo(() => {
    if (allCategories.length < 3) return []
    return allCategories.map((name, i) => ({
      name,
      angle: (2 * Math.PI * i) / allCategories.length,
    }))
  }, [allCategories])

  if (axes.length < 3 || !products?.length) return null

  const endpoints = axisPoints(cx, cy, axes, R)
  const labelR = R + 40
  const ringVals = [0.25, 0.5, 0.75, 1.0]

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto', overflow: 'visible' }}>
      <svg width={size} height={size} viewBox={`-10 -10 ${size + 20} ${size + 20}`} style={{ overflow: 'visible' }}>
        {ringVals.map((r, i) => (
          <polygon key={i}
            points={endpoints.map(ep => `${ep.x * r + cx * (1 - r)},${ep.y * r + cy * (1 - r)}`).join(' ')}
            fill="none" stroke="rgba(220,20,60,0.08)" strokeWidth="0.8"
          />
        ))}
        {endpoints.map((ep, i) => (
          <line key={i} x1={cx} y1={cy} x2={ep.x} y2={ep.y}
            stroke="rgba(220,20,60,0.12)" strokeWidth="0.8"
          />
        ))}
        {axes.map((a, i) => {
          const lp = polar(cx, cy, a.angle, labelR)
          const anchor = lp.x < cx - 2 ? 'end' : lp.x > cx + 2 ? 'start' : 'middle'
          return (
            <text key={i} x={lp.x} y={lp.y}
              textAnchor={anchor} dominantBaseline="middle"
              fill="rgba(220,20,60,0.45)" fontSize="9" fontFamily="monospace" fontWeight="700"
              letterSpacing="0.04em"
            >
              {a.name}
            </text>
          )
        })}
        {/* Legend */}
        {(products || []).slice(0, 5).map((p, pidx) => {
          const colors = PRODUCT_COLORS[pidx % PRODUCT_COLORS.length]
          const vals = axes.map(a => {
            const scores = p.category_scores || {}
            return Math.min(100, Math.max(0, Number(scores[a.name]) || 0))
          })
          if (vals.every(v => v === 0)) return null
          const pts = axes
            .map((a, ai) => {
              const pt = polar(cx, cy, a.angle, R * (vals[ai] / 100))
              return `${pt.x},${pt.y}`
            })
            .join(' ')
          return (
            <motion.polygon key={pidx}
              points={pts}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth="1.6"
              style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + pidx * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          )
        })}
        <circle cx={cx} cy={cy} r="2.5" fill="rgba(220,20,60,0.4)" />
      </svg>
      {/* Legend labels */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        {(products || []).slice(0, 5).map((p, pidx) => {
          const colors = PRODUCT_COLORS[pidx % PRODUCT_COLORS.length]
          const name = (p.name || '').slice(0, 28)
          return (
            <div key={pidx} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.stroke,
                boxShadow: `0 0 4px ${colors.glow}` }} />
              <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>{name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RadarChart({ categoryScores, products, winner, ranked }) {
  // If multiple products passed, show comparison overlay
  if (products && products.length > 1) {
    return <MultiDNA products={products} />
  }

  // If ranked has products with category_scores, use those
  const allProducts = ranked || (products || [])
  const productsWithDNA = allProducts.filter(p => {
    const scores = p.category_scores || {}
    return Object.keys(scores).length >= 3
  })

  if (productsWithDNA.length > 1) {
    return <MultiDNA products={productsWithDNA} />
  }

  // Single product: use winner's category_scores
  const scores = categoryScores || winner?.category_scores || {}
  const entries = Object.entries(scores)
  if (entries.length < 3) {
    // Fallback to the old-style hardcoded axes
    const legacyScores = {
      'QUALITY': winner?.quality_score || 70,
      'VALUE': (winner?.price_score || 70),
      'REVIEWS': (winner?.quality_score || 70) * 0.85,
      'CONFIDENCE': (winner?.confidence || 75),
    }
    return (
      <div style={{ padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 14, backdropFilter: 'blur(10px)' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 12, fontFamily: 'monospace', fontWeight: 700 }}>
          ◈ DNA PROFILE
        </div>
        <ProductDNA categoryScores={legacyScores} label="" size={260} />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px', background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.12)', borderRadius: 14, backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 12, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ DNA PROFILE
      </div>
      <ProductDNA categoryScores={scores} label="" size={260} />
    </div>
  )
}
