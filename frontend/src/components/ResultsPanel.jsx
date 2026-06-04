import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, Loader2, ExternalLink, ShieldCheck, AlertTriangle, Zap, ThumbsUp } from 'lucide-react';
import RadarChart, { ProductDNA } from './RadarChart';
import ChatWindow from './ChatWindow';
import RankedTable from './RankedTable';

function SpiderIcon({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C10.9 2 10 2.9 10 4C10 4.74 10.4 5.38 11 5.73V7H9C7.9 7 7 7.9 7 9V10H5.27C4.64 9.39 3.74 9 2.73 9C1.22 9 0 10.22 0 11.73C0 13.24 1.22 14.46 2.73 14.46C3.74 14.46 4.64 14.07 5.27 13.46H7V15C7 15.55 7.22 16.05 7.59 16.41L5 21H7L9 17H15L17 21H19L16.41 16.41C16.78 16.05 17 15.55 17 15V13.46H18.73C19.36 14.07 20.26 14.46 21.27 14.46C22.78 14.46 24 13.24 24 11.73C24 10.22 22.78 9 21.27 9C20.26 9 19.36 9.39 18.73 10H17V9C17 7.9 16.1 7 15 7H13V5.73C13.6 5.38 14 4.74 14 4C14 2.9 13.1 2 12 2ZM9 9H15V11H9V9ZM9 13H15V15H9V13Z"/>
    </svg>
  )
}

function ScoreRing({ score, size = 120 }) {
  const [offset, setOffset] = useState(2 * Math.PI * (size * 0.32))
  const r = size * 0.32
  const circ = 2 * Math.PI * r
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - Math.min(100, score || 0) / 100)), 120)
    return () => clearTimeout(t)
  }, [score, circ])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e63946" strokeWidth="6"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1)', filter: 'drop-shadow(0 0 8px rgba(220,20,60,0.7))' }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize={size*0.15} fontWeight="900" fontFamily="Space Grotesk, sans-serif">
        {(score || 0).toFixed(0)}
      </text>
      <text x={size/2} y={size/2 + size*0.12} textAnchor="middle"
        fill="rgba(220,20,60,0.5)" fontSize={size*0.07} fontFamily="monospace">SCORE</text>
    </svg>
  )
}

export default function ResultsPanel({ result, isLoading, progress, query, onNewSearch, onSearch, onSettingsOpen }) {
  const [searchVal, setSearchVal] = useState(query || '')
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const inputRef = useRef(null)

  if (!result) return null;

  const rec = result.final_recommendation || {};
  const mode = rec.mode || result.mode || 'ranking';
  const winner = rec.winner;
  const ranked = rec.ranked || [];
  const comparisonTable = rec.comparison_table || [];
  const productCache = result.agent_opinions?.search_agent?.product_cache || {};
  const reviewAnalysis = result.agent_opinions?.review_agent?.products_analyzed || {};
  const isEmpty = mode !== 'comparison' ? (!winner?.name && ranked.length === 0) : comparisonTable.length === 0;

  const handleInlineSearch = (e) => {
    e.preventDefault()
    const trimmed = searchVal.trim()
    if (trimmed && onSearch) onSearch(trimmed)
  }

  const formatPrice = (p) => p ? `₹${Number(p).toLocaleString('en-IN')}` : '--'
  const availOk = (a) => a?.toLowerCase?.()?.includes('in stock') || a?.includes('In Stock')

  const headerBar = (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 24px',
    }}>
      <div style={{ maxWidth: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onNewSearch}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', borderRadius: 8, padding: '8px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8' }}>
          <ArrowLeft size={15} /> New Search
        </button>
        <form onSubmit={handleInlineSearch} style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(220,20,60,0.2)',
            borderRadius: 10, padding: '7px 14px',
          }}>
            <Search size={15} style={{ color: '#e63946', flexShrink: 0 }} />
            <input ref={inputRef} type="text" value={searchVal}
              onChange={e => setSearchVal(e.target.value)} disabled={isLoading}
              placeholder="Refine your search..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 14, fontFamily: 'Inter, sans-serif' }}/>
            {isLoading && <Loader2 size={14} style={{ color: '#e63946', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
          </div>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'radial-gradient(circle, #e63946, #8b0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(220,20,60,0.5)' }}>
              <SpiderIcon size={14} color="#fff" /></div>
            <span style={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.12em', color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>RONIN</span>
          </div>
          <button onClick={onSettingsOpen} style={{
            background: 'rgba(220,20,60,0.07)', border: '1px solid rgba(220,20,60,0.25)',
            color: '#ff6b75', borderRadius: 6, padding: '6px 14px',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
            fontFamily: 'monospace', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,20,60,0.07)'}>
            [ CONFIG ]
          </button>
        </div>
      </div>
    </div>
  )

  // ========= Discovery (Research) Mode =========
  if (mode !== 'comparison' && winner?.name) {
    const categoryScores = winner.category_scores || {}
    const hasDNA = Object.keys(categoryScores).length >= 3
    const benefits = Array.isArray(winner.benefits) ? winner.benefits : []
    const losses = Array.isArray(winner.losses) ? winner.losses : []
    const imageUrl = winner.product_image_url || (productCache[winner.name]?.product_image_url)
    const conf = (winner.confidence <= 1 ? winner.confidence * 100 : winner.confidence) || 85

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#080808', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
        {headerBar}
        <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          {/* Left: Product details */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', minWidth: 0 }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              {/* Top bar */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6, fontFamily: 'monospace' }}>
                  ◈ TARGET ACQUIRED
                </p>
                <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1.4rem, 2.8vw, 2.2rem)', color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                  {winner.name}
                </h1>
              </div>

              {/* Hero row: image + score ring + stats */}
              <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
                {/* Image */}
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  style={{
                    width: 220, height: 220, borderRadius: 18, flexShrink: 0,
                    background: 'rgba(255,255,255,0.97)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', border: '2px solid rgba(220,20,60,0.35)',
                    boxShadow: '0 0 40px rgba(220,20,60,0.35), 0 0 80px rgba(220,20,60,0.1)',
                  }}>
                  {imageUrl
                    ? <img src={imageUrl} alt={winner.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} onError={e => e.target.style.display = 'none'} />
                    : <SpiderIcon size={80} color="rgba(220,20,60,0.3)" />}
                </motion.div>

                {/* Score ring + stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <ScoreRing score={winner.combined_score} size={130} />
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: '0.15em', color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', marginBottom: 4 }}>
                      CONFIDENCE
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 900, fontFamily: 'Space Grotesk, sans-serif', color: '#e63946', lineHeight: 1 }}>
                      {Math.round(conf)}<span style={{ fontSize: 22, opacity: 0.6 }}>%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                      <StatPill label="PRICE" value={formatPrice(winner.price_inr)} />
                      <StatPill label="QUALITY" value={`${(winner.quality_score || 0).toFixed(0)}/100`} active />
                      <StatPill label="STOCK" value={availOk(winner.availability) ? 'IN STOCK' : 'OUT'} green={availOk(winner.availability)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Why / Decision logic */}
              {winner.why && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  style={{
                    background: 'rgba(220,20,60,0.04)', border: '1px solid rgba(220,20,60,0.15)',
                    borderRadius: 14, padding: '18px 22px', marginBottom: 28,
                    borderLeft: '3px solid rgba(220,20,60,0.5)',
                  }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 8 }}>
                    ◈ DECISION LOGIC
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.7, fontStyle: 'italic', margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
                    {winner.why}
                  </p>
                </motion.div>
              )}

              {/* Benefits & Losses side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
                <FeatureList title="STRENGTHS" items={benefits} icon="check" color="#4ade80" />
                <FeatureList title="WEAKNESSES" items={losses} icon="warn" color="#fbbf24" />
              </div>

              {/* DNA Profile - big */}
              {hasDNA && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                  style={{
                    background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.15)',
                    borderRadius: 16, padding: '28px', marginBottom: 28, backdropFilter: 'blur(10px)',
                  }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 20 }}>
                    ◈ DNA PROFILE
                  </div>
                  <ProductDNA categoryScores={categoryScores} size={320} />
                </motion.div>
              )}

              {/* Ranked table */}
              {ranked.length > 1 && (
                <div style={{ marginBottom: 40 }}>
                  <RankedTable ranked={ranked} productCache={productCache} />
                </div>
              )}

              {/* Buy button */}
              {winner.url && (
                <motion.a href={winner.url} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    background: 'linear-gradient(135deg, #e63946, #c1121f)',
                    color: '#fff', padding: '14px 28px', borderRadius: 10,
                    fontSize: 15, fontWeight: 800, fontFamily: 'monospace',
                    letterSpacing: '0.08em', textDecoration: 'none',
                    boxShadow: '0 0 30px rgba(220,20,60,0.5)',
                    marginBottom: 40,
                  }}>
                  <ExternalLink size={16} /> VIEW ON AMAZON
                </motion.a>
              )}
            </motion.div>
          </div>

          {/* Right: Chat sidebar */}
          <div style={{
            flex: chatCollapsed ? '0 0 38px' : '0 0 420px',
            transition: 'flex 0.3s ease',
            borderLeft: chatCollapsed ? 'none' : '1px solid rgba(220,20,60,0.15)',
          }}>
            <ChatWindow result={result} query={query} embedded collapsed={chatCollapsed} onToggleCollapse={() => setChatCollapsed(!chatCollapsed)} />
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ========= Comparison Mode (Find + Compare) =========
  if (mode === 'comparison' && comparisonTable.length > 0) {
    const productsWithDNA = comparisonTable.filter(p => Object.keys(p.category_scores || {}).length >= 3)

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#080808', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
        {headerBar}
        <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', minWidth: 0 }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6, fontFamily: 'monospace' }}>
                  ◈ {comparisonTable.length === 1 ? 'PRODUCT ANALYSIS' : 'COMPARISON'}
                </p>
                <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1.3rem, 2.4vw, 2rem)', color: '#fff', lineHeight: 1.15 }}>
                  {query}
                </h1>
              </div>

              {/* Verdict */}
              {rec.verdict && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                  style={{
                    background: 'rgba(220,20,60,0.04)', border: '1px solid rgba(220,20,60,0.15)',
                    borderRadius: 14, padding: '18px 22px', marginBottom: 28,
                    borderLeft: '3px solid rgba(220,20,60,0.5)',
                  }}>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.7, margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>{rec.verdict}</p>
                </motion.div>
              )}

              {/* Badges */}
              {(rec.best_value || rec.best_performance) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                  {rec.best_value && <Badge label="BEST VALUE" value={rec.best_value} color="#ff7a3d" />}
                  {rec.best_performance && <Badge label="BEST QUALITY" value={rec.best_performance} color="#ff8c94" />}
                </div>
              )}

              {/* DNA comparison overlay */}
              {productsWithDNA.length >= 2 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  style={{
                    background: 'rgba(8,0,0,0.6)', border: '1px solid rgba(220,20,60,0.15)',
                    borderRadius: 16, padding: '28px', marginBottom: 32, backdropFilter: 'blur(10px)',
                  }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace', fontWeight: 700, marginBottom: 16 }}>
                    ◈ DNA COMPARISON OVERLAY
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {productsWithDNA.map((p, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <ProductDNA categoryScores={p.category_scores} size={280} colorIndex={i} label={p.name?.slice(0, 30)} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Product cards */}
              {comparisonTable.map((item, i) => (
                <ComparisonProductCard key={i} item={item} index={i} />
              ))}
            </motion.div>
          </div>

          {/* Chat sidebar */}
          <div style={{
            flex: chatCollapsed ? '0 0 38px' : '0 0 420px',
            transition: 'flex 0.3s ease',
            borderLeft: chatCollapsed ? 'none' : '1px solid rgba(220,20,60,0.15)',
          }}>
            <ChatWindow result={result} query={query} embedded collapsed={chatCollapsed} onToggleCollapse={() => setChatCollapsed(!chatCollapsed)} />
          </div>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ========= Empty / Error state =========
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080808', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {headerBar}
      <div style={{ maxWidth: 700, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <SpiderIcon size={48} color="rgba(220,20,60,0.3)" />
        <h2 style={{ color: '#e2e8f0', fontSize: '1.4rem', fontWeight: 700, marginTop: 20, marginBottom: 10, fontFamily: 'Space Grotesk, sans-serif' }}>No products found</h2>
        <p style={{ color: '#64748b', fontSize: 15, marginBottom: 28 }}>Try a different search query.</p>
        <button onClick={onNewSearch}
          style={{ background: 'linear-gradient(135deg, #e63946, #e63946)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(220,20,60,0.35)' }}>
          New Search
        </button>
      </div>
    </div>
  )
}

// ========= Sub-components =========

function StatPill({ label, value, active, green }) {
  return (
    <span style={{
      background: active ? 'rgba(220,20,60,0.12)' : 'rgba(255,255,255,0.04)',
      border: active ? '1px solid rgba(220,20,60,0.3)' : '1px solid rgba(255,255,255,0.1)',
      color: green ? '#4ade80' : active ? '#ff8c94' : '#94a3b8',
      padding: '8px 16px', borderRadius: 8,
      fontSize: 13, fontWeight: 800, fontFamily: 'monospace',
      letterSpacing: '0.06em',
    }}>
      {label}: {value}
    </span>
  )
}

function Badge({ label, value, color }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}40`,
      fontWeight: 800, fontSize: 13, padding: '8px 18px', borderRadius: 9999,
      fontFamily: 'monospace', letterSpacing: '0.06em',
      boxShadow: `0 0 16px ${color}20`,
    }}>
      {label}: {value}
    </span>
  )
}

function FeatureList({ title, items, icon, color }) {
  if (!items?.length) return null
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
      style={{
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}20`,
        borderRadius: 14, padding: '20px', backdropFilter: 'blur(8px)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {icon === 'check' ? <ThumbsUp size={16} color={color} /> : <AlertTriangle size={16} color={color} />}
        <span style={{ fontSize: 13, letterSpacing: '0.15em', color, fontFamily: 'monospace', fontWeight: 700 }}>{title}</span>
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color, fontSize: 16, marginTop: 2, flexShrink: 0 }}>
              {icon === 'check' ? '✓' : '⚠'}
            </span>
            <span style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function ComparisonProductCard({ item, index }) {
  const price = item.price_inr ? `₹${Number(item.price_inr).toLocaleString('en-IN')}` : null
  const inStock = item.availability?.toLowerCase?.()?.includes('in stock') || item.availability?.includes('In Stock')
  const benefits = Array.isArray(item.benefits) ? item.benefits.slice(0, 3) : []
  const losses = Array.isArray(item.losses) ? item.losses.slice(0, 2) : []
  const highlights = Array.isArray(item.highlights) ? item.highlights.slice(0, 2) : []
  const hasDNA = Object.keys(item.category_scores || {}).length >= 3

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '28px', marginBottom: 20,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(220,20,60,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Image */}
        {item.product_image_url && (
          <div style={{
            width: 160, height: 160, borderRadius: 14, flexShrink: 0,
            background: 'rgba(255,255,255,0.97)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(220,20,60,0.2)',
            boxShadow: '0 0 20px rgba(220,20,60,0.2)', overflow: 'hidden',
          }}>
            <img src={item.product_image_url} alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
              onError={e => e.target.style.display = 'none'} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1.1rem, 1.8vw, 1.4rem)', color: '#fff', lineHeight: 1.2, marginBottom: 10 }}>
            {item.name}
          </h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <StatPill label="QUALITY" value={`${(item.quality || 0).toFixed(0)}/100`} active />
            {price && <StatPill label="PRICE" value={price} />}
            <StatPill label="STOCK" value={inStock ? 'IN STOCK' : 'N/A'} green={inStock} />
            {item.sentiment && <StatPill label="SENTIMENT" value={item.sentiment.toUpperCase()} active={item.sentiment === 'positive'} green={item.sentiment === 'positive'} />}
          </div>

          {highlights.length > 0 && (
            <div style={{ background: 'rgba(220,20,60,0.04)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, borderLeft: '2px solid rgba(220,20,60,0.3)' }}>
              {highlights.map((h, i) => (
                <p key={i} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, margin: i > 0 ? '6px 0 0 0' : 0 }}>"{h}"</p>
              ))}
            </div>
          )}

          {/* Benefits & Losses */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {benefits.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#4ade80', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>STRENGTHS</div>
                {benefits.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
                    <span style={{ color: '#4ade80' }}>✓</span> {b}
                  </div>
                ))}
              </div>
            )}
            {losses.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#fbbf24', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 8 }}>WEAKNESSES</div>
                {losses.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
                    <span style={{ color: '#fbbf24' }}>⚠</span> {l}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DNA inline */}
          {hasDNA && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <ProductDNA categoryScores={item.category_scores} size={240} colorIndex={index} />
            </div>
          )}

          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(220,20,60,0.1)', color: '#ff6b75',
                border: '1px solid rgba(220,20,60,0.25)', borderRadius: 8,
                padding: '10px 18px', fontWeight: 700, fontSize: 13,
                textDecoration: 'none', transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,20,60,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,20,60,0.1)'}>
              <ExternalLink size={14} /> View on Amazon
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}
