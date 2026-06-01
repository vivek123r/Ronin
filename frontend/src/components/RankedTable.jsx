import { motion } from 'framer-motion'

function findInCache(productCache, name) {
  if (!productCache || !name) return null
  if (productCache[name]) return productCache[name]
  const lower = name.toLowerCase()
  const key = Object.keys(productCache).find(k => k.toLowerCase().includes(lower.slice(0,20)) || lower.includes(k.toLowerCase().slice(0,20)))
  return key ? productCache[key] : null
}

const RANK_META = [
  { label: '#1 WINNER',     textColor: '#ff8c94', borderColor: 'rgba(220,20,60,0.5)',  bg: 'rgba(220,20,60,0.1)',  glow: '0 0 28px rgba(220,20,60,0.3), 0 0 60px rgba(220,20,60,0.1)' },
  { label: '#2 CHALLENGER', textColor: '#ff7a3d', borderColor: 'rgba(255,122,61,0.35)', bg: 'rgba(255,122,61,0.07)', glow: '0 0 16px rgba(255,122,61,0.18)' },
  { label: '#3 DARK HORSE', textColor: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)',  bg: 'rgba(251,191,36,0.06)', glow: '0 0 10px rgba(251,191,36,0.12)' },
  { label: '#4 BUDGET PICK',textColor: '#94a3b8', borderColor: 'rgba(148,163,184,0.2)', bg: 'rgba(148,163,184,0.04)', glow: 'none' },
]

function FighterCard({ item, index, productCache }) {
  const rank = item.rank || index + 1
  const meta = RANK_META[rank - 1] || { label: `#${rank} CONTENDER`, textColor: '#475569', borderColor: 'rgba(71,85,105,0.15)', bg: 'rgba(0,0,0,0)', glow: 'none' }
  const cached = findInCache(productCache, item.name)
  const imageUrl = item.product_image_url || cached?.product_image_url
  const benefits = Array.isArray(item.benefits) ? item.benefits : (item.benefits ? [item.benefits] : [])
  const losses = Array.isArray(item.losses) ? item.losses : (item.losses ? [item.losses] : [])

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.22,1,0.36,1] }}
      style={{ flexShrink: 0, width: 195, background: 'rgba(8,0,0,0.7)', border: `1px solid ${meta.borderColor}`, borderRadius: 12, overflow: 'hidden', boxShadow: meta.glow, backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column' }}>

      {/* Rank badge */}
      <div style={{ background: meta.bg, padding: '6px 10px', borderBottom: `1px solid ${meta.borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: meta.textColor, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{meta.label}</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: meta.textColor, fontFamily: 'monospace' }}>{item.score?.toFixed(1)}</span>
      </div>

      {/* Image */}
      <div style={{ height: 110, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} onError={e => e.target.style.display='none'}/>
        ) : (
          <div style={{ opacity: 0.2, fontSize: 32 }}>📦</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {item.name}
        </div>

        {/* Score bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${item.score || 0}%` }}
            transition={{ delay: index * 0.08 + 0.3, duration: 0.8 }}
            style={{ height: '100%', background: rank === 1 ? 'linear-gradient(90deg,#e63946,#ff8c94)' : 'rgba(255,255,255,0.2)', borderRadius: 2, filter: rank === 1 ? 'drop-shadow(0 0 3px rgba(220,20,60,0.6))' : 'none' }}/>
        </div>

        {/* Price */}
        <div style={{ fontSize: 14, fontWeight: 800, color: rank === 1 ? '#ff8c94' : '#94a3b8', fontFamily: 'monospace' }}>
          {item.price_inr ? `₹${Number(item.price_inr).toLocaleString('en-IN')}` : '—'}
        </div>

        {/* Benefits */}
        {benefits.slice(0, 2).map((b, i) => (
          <div key={i} style={{ fontSize: 12, color: '#4ade80', display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}>{b}</span>
          </div>
        ))}

        {/* Weakness */}
        {losses[0] && (
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, color: 'rgba(220,20,60,0.5)', marginTop: 1 }}>✗</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{losses[0]}</span>
          </div>
        )}

        {/* Link */}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ marginTop: 'auto', fontSize: 9, color: meta.textColor, fontFamily: 'monospace', textDecoration: 'none', letterSpacing: '0.1em', fontWeight: 700, opacity: 0.8 }}>
            VIEW →
          </a>
        )}
      </div>
    </motion.div>
  )
}

export default function RankedTable({ ranked, productCache }) {
  if (!ranked?.length) return null
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 14, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ PRODUCT BATTLEFIELD — {ranked.length} COMBATANTS
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 12, marginRight: -24, paddingRight: 24 }}>
        <div style={{ display: 'flex', gap: 14, width: 'max-content' }}>
          {ranked.map((item, i) => (
            <FighterCard key={i} item={item} index={i} productCache={productCache} />
          ))}
        </div>
      </div>
    </div>
  )
}
