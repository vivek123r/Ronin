import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Tiny colored spider SVG ──────────────────────────────────────────── */
function SpiderIcon({ color = '#e63946', size = 20 }) {
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

/* ─── SSE message filter & parser ──────────────────────────────────────── */
const DROP_PATTERNS = [
  /⚠️/, /🔄/, /Cached:/, /\[API\]/, /Skipping/, /HTTP/, /JSON parse/,
  /failed/, /fallback/, /──/, /Searching for:/, /Found \d+ products:/, /No products/,
  /No cached/, /Could not/, /thread failed/, /human loop/, /lookn/, /Resolved to:/,
  /Looking up/, /Total after/, /Fetching details/, /Analysing \d/,
]
function shouldShow(msg) {
  if (!msg || !msg.trim()) return false
  return !DROP_PATTERNS.some(p => p.test(msg))
}

function parseMilestone(msg) {
  // Returns { agentId, text } or null
  const m = msg

  // ── Queen / intent ──────────────────────────────────────────────────────
  if (/Mode:/i.test(m)) return { agentId: 'queen', text: 'Analyzing query intent...' }
  if (/Amazon keyword:/i.test(m)) {
    const kw = m.replace(/.*Amazon keyword:\s*/i, '').trim()
    return { agentId: 'queen', text: `Query mapped: "${kw}"` }
  }
  if (/Budget:/i.test(m)) {
    const b = m.replace(/.*Budget:\s*/i, '').trim()
    return { agentId: 'queen', text: `Budget: ${b}` }
  }
  if (/Running Review & Price|parallel/i.test(m)) return { agentId: 'queen', text: 'Launching parallel analysis...' }

  // ── Hunter ──────────────────────────────────────────────────────────────
  if (/Amazon broad search/i.test(m)) return { agentId: 'hunter', text: 'Scanning Amazon for candidates...' }
  if (/Price filter to API/i.test(m)) return { agentId: 'hunter', text: 'Applying price filter...' }
  if (/Amazon returned/i.test(m)) {
    const n = m.match(/(\d+) raw/)
    return { agentId: 'hunter', text: `Found ${n?.[1] || ''} raw results` }
  }
  if (/Fetching product details/i.test(m)) {
    const n = m.match(/(\d+) products/)
    return { agentId: 'hunter', text: `Fetching details for ${n?.[1] || ''} products...` }
  }
  if (/Selected \d+ products/i.test(m)) {
    const n = m.match(/Selected (\d+)/)
    return { agentId: 'hunter', text: `Locked in ${n?.[1] || ''} products to analyze` }
  }
  if (/Resolving \d+ products/i.test(m)) return { agentId: 'hunter', text: 'Resolving comparison products...' }
  if (/products resolved/i.test(m)) return { agentId: 'hunter', text: 'Products locked in for comparison' }

  // ── Reviewer sub-agents ──────────────────────────────────────────────────
  if (/\[Amazon sub-agent\]/i.test(m)) {
    const n = m.match(/(\d+) reviews/)
    return { agentId: 'rev_amazon', text: `Amazon: ${n?.[1] || '?'} reviews fetched` }
  }
  if (/\[YouTube sub-agent\].*skipped/i.test(m)) return { agentId: 'rev_youtube', text: 'YouTube: skipped (no key)' }
  if (/\[YouTube sub-agent\]/i.test(m)) {
    const n = m.match(/(\d+) videos/)
    return { agentId: 'rev_youtube', text: `YouTube: ${n?.[1] || '?'} videos fetched` }
  }
  if (/\[Reddit\] sub-agent/i.test(m)) {
    const n = m.match(/(\d+) posts/)
    return { agentId: 'rev_reddit', text: `Reddit: ${n?.[1] || '?'} posts found` }
  }
  if (/sources available/i.test(m)) {
    const n = m.match(/(\d+)\/3/)
    return { agentId: 'reviewer', text: `${n?.[1] || '?'}/3 sources — scoring...` }
  }

  // ── Reviewer ────────────────────────────────────────────────────────────
  if (/Reviewing:/i.test(m)) {
    const prod = m.replace(/.*Reviewing:\s*/i, '').trim().split(' ').slice(0, 4).join(' ')
    return { agentId: 'reviewer', text: `Reviewing: ${prod}...` }
  }
  if (/Rating:\s*\d+/i.test(m)) {
    const n = m.match(/Rating:\s*(\d+)/)
    return { agentId: 'reviewer', text: `Intelligence scored: ${n?.[1]}/100` }
  }
  if (/sending intelligence to master/i.test(m)) return { agentId: 'reviewer', text: 'Transmitting intelligence to RONIN CORE...' }
  if (/\[Review\].*products/i.test(m)) {
    const n = m.match(/(\d+) products/)
    return { agentId: 'reviewer', text: `Review complete: ${n?.[1] || ''} products analyzed` }
  }

  // ── Pricer ──────────────────────────────────────────────────────────────
  if (/Pricing:/i.test(m)) {
    const prod = m.replace(/.*Pricing:\s*/i, '').trim().split(' ').slice(0, 3).join(' ')
    return { agentId: 'pricer', text: `Checking price: ${prod}...` }
  }
  if (/₹[\d.]+\s*\(from cache\)/i.test(m)) {
    const price = m.match(/₹([\d.,]+)/)
    return { agentId: 'pricer', text: `Price confirmed: ₹${price?.[1]}` }
  }
  if (/\[Price\].*products priced/i.test(m)) {
    const n = m.match(/(\d+\/\d+)/)
    return { agentId: 'pricer', text: `Pricing complete: ${n?.[1] || ''} products` }
  }
  // Also catch the new explicit print we added
  if (/Pricing complete:/i.test(m)) return { agentId: 'pricer', text: 'All prices confirmed' }

  // ── Ranker ──────────────────────────────────────────────────────────────
  if (/Weights\s*—/i.test(m)) return { agentId: 'ranker', text: 'Calculating optimal rankings...' }
  if (/\[Ranker\].*Winner:/i.test(m) || /🏆.*Winner:/i.test(m)) {
    const prod = m.replace(/.*Winner:\s*/i, '').trim().split('|')[0].trim().split(' ').slice(0, 5).join(' ')
    return { agentId: 'ranker', text: `Winner: ${prod}` }
  }

  return null
}

/* ─── Agent definitions ─────────────────────────────────────────────────── */
const SUB_AGENTS = [
  { id: 'hunter',   label: 'HUNTER',   color: '#ff7a3d', angle: -Math.PI/2,   sourceIdxs: [0, 4] },
  { id: 'reviewer', label: 'REVIEWER', color: '#e63946', angle: 0,            sourceIdxs: [1, 2, 8] },
  { id: 'pricer',   label: 'PRICER',   color: '#ff3366', angle: Math.PI/2,    sourceIdxs: [3, 5] },
  { id: 'ranker',   label: 'RANKER',   color: '#9b1aff', angle: Math.PI,      sourceIdxs: [6, 7] },
]
// Maps reviewer source nodes to sub-agent IDs for wave firing
// node indices in nodes[]: REDDIT=6, YOUTUBE=7, AMZ_REVIEW=13 (after filler shift)
// We'll store this as a runtime lookup after buildLayout
const REVIEWER_SOURCE_WAVE_MAP = [
  { sourceLabel: 'REDDIT',     subId: 'rev_reddit',  color: '#ff4500' },
  { sourceLabel: 'YOUTUBE',    subId: 'rev_youtube', color: '#ff4444' },
  { sourceLabel: 'AMZ-REVIEW', subId: 'rev_amazon',  color: '#ff9900' },
]

const SOURCE_LABELS = ['AMAZON','REDDIT','YOUTUBE','GOOGLE','FLIPKART','BLOGS','FORUMS','TECHRADAR']
const PHASE_LABELS = ['INITIALIZING','HUNTING PRODUCTS','DEEP ANALYSIS','CROSS-VALIDATION','SYNTHESIS']
const AGENT_RING_R = 160
const SOURCE_RING_R = 310

/* ─── Hook: parse SSE progress into agent state ─────────────────────────── */
function useHiveState(progress) {
  const [milestones, setMilestones] = useState([])
  const [agents, setAgents] = useState(() => ({
    queen:       { status: 'idle', progress: 0, source: '' },
    hunter:      { status: 'idle', progress: 0, source: '' },
    reviewer:    { status: 'idle', progress: 0, source: '', ratingCount: 0 },
    pricer:      { status: 'idle', progress: 0, source: '' },
    ranker:      { status: 'idle', progress: 0, source: '', _pending: false },
    rev_amazon:  { status: 'idle', progress: 0 },
    rev_youtube: { status: 'idle', progress: 0 },
    rev_reddit:  { status: 'idle', progress: 0 },
  }))

  const processedCount = useRef(0)

  useEffect(() => {
    if (progress.length <= processedCount.current) return
    const newMsgs = progress.slice(processedCount.current)
    processedCount.current = progress.length

    newMsgs.forEach(msg => {
      const milestone = parseMilestone(msg)
      if (!milestone) return

      setMilestones(prev => [...prev.slice(-7), { ...milestone, id: Date.now() + Math.random() }])

      setAgents(prev => {
        const next = { ...prev }
        const aid = milestone.agentId

        // Queen activations
        if (aid === 'queen') {
          next.queen = { ...next.queen, status: 'active', progress: Math.min(100, next.queen.progress + 20) }
        }

        // Hunter
        if (/Scanning Amazon|price filter/i.test(milestone.text)) {
          next.hunter = { ...next.hunter, status: 'scanning', progress: 20, source: 'AMAZON' }
          next.queen = { ...next.queen, status: 'active' }
        }
        if (/raw results/i.test(milestone.text)) {
          next.hunter = { ...next.hunter, progress: 50 }
        }
        if (/Fetching details/i.test(milestone.text)) {
          next.hunter = { ...next.hunter, progress: 75 }
        }
        if (/Locked in \d+|products.*comparison/i.test(milestone.text)) {
          next.hunter = { ...next.hunter, status: 'done', progress: 100 }
        }

        // Reviewer sub-agent states
        if (aid === 'rev_amazon') {
          if (/fetched/i.test(milestone.text))
            next.rev_amazon = { status: 'done', progress: 100 }
          else
            next.rev_amazon = { status: 'scanning', progress: 50 }
        }
        if (aid === 'rev_youtube') {
          if (/skipped/i.test(milestone.text))
            next.rev_youtube = { status: 'idle', progress: 0 }
          else if (/fetched/i.test(milestone.text))
            next.rev_youtube = { status: 'done', progress: 100 }
          else
            next.rev_youtube = { status: 'scanning', progress: 50 }
        }
        if (aid === 'rev_reddit') {
          if (/found/i.test(milestone.text))
            next.rev_reddit = { status: 'done', progress: 100 }
          else
            next.rev_reddit = { status: 'scanning', progress: 50 }
        }

        // Reviewer + Pricer start together
        if (/Reviewing:/i.test(milestone.text)) {
          next.reviewer = { ...next.reviewer, status: 'scanning', source: 'AMAZON/YT', progress: Math.min(85, next.reviewer.progress + 18) }
          // Pricer starts at same time as reviewer
          if (next.pricer.status === 'idle') {
            next.pricer = { ...next.pricer, status: 'scanning', source: 'AMAZON', progress: 20 }
          }
        }
        if (/scored: \d+/i.test(milestone.text)) {
          const rc = (next.reviewer.ratingCount || 0) + 1
          next.reviewer = { ...next.reviewer, ratingCount: rc, progress: Math.min(95, rc * 20) }
          // Pricer progresses alongside reviewer
          if (next.pricer.status === 'scanning') {
            next.pricer = { ...next.pricer, progress: Math.min(90, next.pricer.progress + 18) }
          }
        }
        // Pricer done 2s after it starts (fast), reviewer finishes naturally
        if (/Checking price:/i.test(milestone.text) && next.pricer.status === 'idle') {
          next.pricer = { ...next.pricer, status: 'scanning', source: 'AMAZON', progress: 20 }
          setTimeout(() => setAgents(a => ({ ...a, pricer: { ...a.pricer, status: 'done', progress: 100 } })), 4000)
        }

        // Reviewer done → immediately start ranker for 4s then done
        if (/Review complete:/i.test(milestone.text)) {
          next.reviewer = { ...next.reviewer, status: 'done', progress: 100 }
          next.pricer = { ...next.pricer, status: 'done', progress: 100 }
          // ranker starts immediately, runs 4s, then done
          setTimeout(() => setAgents(a => ({ ...a, ranker: { ...a.ranker, status: 'scanning', progress: 40, source: 'ANALYSIS' } })), 0)
          setTimeout(() => setAgents(a => ({ ...a, ranker: { ...a.ranker, status: 'done', progress: 100 } })), 4000)
        }


        return next
      })
    })
  }, [progress.length])

  const phase = useMemo(() => {
    const a = agents
    const doneCount = [a.hunter, a.reviewer, a.pricer, a.ranker].filter(x => x.status === 'done').length
    const activeCount = [a.hunter, a.reviewer, a.pricer, a.ranker].filter(x => x.status !== 'idle').length
    if (doneCount >= 4) return 4
    if (doneCount >= 1) return 3
    if (activeCount >= 2) return 2
    if (activeCount >= 1 || a.queen.status !== 'idle') return 1
    return 0
  }, [agents])

  const overallProgress = useMemo(() => {
    const vals = [agents.hunter, agents.reviewer, agents.pricer, agents.ranker].map(a => a.progress)
    return Math.round(vals.reduce((s, v) => s + v, 0) / 4)
  }, [agents])

  // Feed items for the left sidebar live stream
  const [feedItems, setFeedItems] = useState([])
  const feedProcessed = useRef(0)
  useEffect(() => {
    if (progress.length <= feedProcessed.current) return
    const newMsgs = progress.slice(feedProcessed.current)
    feedProcessed.current = progress.length
    newMsgs.forEach(msg => {
      const src = /amazon/i.test(msg) ? 'amazon' : /reddit/i.test(msg) ? 'reddit'
        : /youtube/i.test(msg) ? 'youtube' : /flipkart/i.test(msg) ? 'flipkart'
        : /google/i.test(msg) ? 'google' : null
      if (src && msg.trim().length > 4) {
        setFeedItems(prev => [...prev.slice(-19), { text: msg.trim().slice(0, 58), source: src, id: Date.now() + Math.random(), ts: Date.now() }])
      }
    })
  }, [progress.length])

  return { milestones, agents, phase, overallProgress, feedItems }
}

/* ─── AgentCard ─────────────────────────────────────────────────────────── */
function AgentCard({ def, state, isQueen = false }) {
  const isActive = state.status === 'scanning' || state.status === 'active'
  const isDone = state.status === 'done'
  return (
    <motion.div
      animate={{
        borderColor: isDone ? 'rgba(74,222,128,0.45)' : isActive ? 'rgba(220,20,60,0.55)' : 'rgba(255,255,255,0.06)',
        boxShadow: isActive ? '0 0 18px rgba(220,20,60,0.15)' : 'none',
      }}
      transition={{ duration: 0.4 }}
      style={{
        background: isQueen ? 'rgba(30,0,0,0.7)' : 'rgba(8,0,0,0.65)',
        border: `1px solid rgba(255,255,255,0.06)`,
        borderRadius: isQueen ? 12 : 9,
        padding: isQueen ? '12px 14px' : '9px 12px',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isQueen ? 8 : 6 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <SpiderIcon color={isDone ? '#4ade80' : (def.color || '#e63946')} size={isQueen ? 22 : 17} />
          <div>
            <div style={{ fontSize: isQueen ? 11 : 10, fontWeight: 800, letterSpacing: '0.12em', color: isDone ? '#4ade80' : isActive ? '#ff8c94' : '#475569', fontFamily: 'monospace' }}>
              {def.label}
            </div>
            {isQueen && (
              <div style={{ fontSize: 9, color: 'rgba(220,20,60,0.5)', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
                ORCHESTRATOR
              </div>
            )}
          </div>
        </div>
        <motion.div
          animate={{ opacity: isActive ? [1, 0.3, 1] : 1 }}
          transition={{ duration: 1.2, repeat: isActive ? Infinity : 0 }}
          style={{
            fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 700,
            padding: '2px 7px', borderRadius: 4,
            background: isDone ? 'rgba(74,222,128,0.12)' : isActive ? 'rgba(220,20,60,0.12)' : 'rgba(255,255,255,0.04)',
            color: isDone ? '#4ade80' : isActive ? '#e63946' : '#334155',
          }}
        >
          {isDone ? '✓ DONE' : isActive ? '● LIVE' : 'IDLE'}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div style={{ height: isQueen ? 4 : 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: state.source ? 5 : 0 }}>
        <motion.div
          animate={{ width: `${state.progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 2,
            background: isDone
              ? 'linear-gradient(90deg,#4ade80,#22c55e)'
              : isQueen
              ? 'linear-gradient(90deg,#e63946,#ff2040,#e63946)'
              : 'linear-gradient(90deg,#e63946,#ff8c94)',
          }}
        />
      </div>

      {/* Source label */}
      {state.source && !isDone && (
        <div style={{ fontSize: 9, color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', marginTop: 4 }}>
          → {state.source}
        </div>
      )}
    </motion.div>
  )
}

/* ─── MilestoneFeed ─────────────────────────────────────────────────────── */
const AGENT_COLORS = { queen: '#ffd700', hunter: '#ff7a3d', reviewer: '#e63946', pricer: '#ff3366', ranker: '#9b1aff', rev_amazon: '#ff9900', rev_youtube: '#ff4444', rev_reddit: '#ff4500' }

function MilestoneFeed({ milestones }) {
  return (
    <motion.div
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 270,
        background: 'linear-gradient(90deg, rgba(4,0,0,0.94) 72%, transparent)',
        padding: '28px 14px 28px 22px',
        display: 'flex', flexDirection: 'column',
        zIndex: 10, pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 18, fontFamily: 'monospace', fontWeight: 700 }}>
        ◈ INTELLIGENCE FEED
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
        <AnimatePresence initial={false}>
          {milestones.map((m, i) => {
            const isLatest = i === milestones.length - 1
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -22, y: 6 }}
                animate={{ opacity: isLatest ? 1 : 0.38, x: 0, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'flex', gap: 9, alignItems: 'flex-start',
                  padding: '6px 9px', borderRadius: 7,
                  background: isLatest ? 'rgba(220,20,60,0.08)' : 'transparent',
                  borderLeft: `2px solid ${isLatest ? 'rgba(220,20,60,0.6)' : 'transparent'}`,
                }}
              >
                <SpiderIcon color={AGENT_COLORS[m.agentId] || '#e63946'} size={14} />
                <div>
                  <div style={{ fontSize: 11, color: isLatest ? '#ffffff' : '#94a3b8', lineHeight: 1.5, fontFamily: 'monospace' }}>
                    {m.text}
                  </div>
                  {isLatest && (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      style={{ fontSize: 9, color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', marginTop: 2, letterSpacing: '0.1em' }}
                    >
                      ● LIVE
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {milestones.length === 0 && (
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: 10, color: 'rgba(220,20,60,0.35)', fontFamily: 'monospace', letterSpacing: '0.1em' }}
          >
            Awaiting intelligence...
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Canvas HiveWeb ─────────────────────────────────────────────────────── */
function HiveCanvas({ agents, phase, resultReady, onComplete }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const completedRef = useRef(false)
  const resultReadyRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const prevSubStatusRef = useRef({})
  useEffect(() => { resultReadyRef.current = resultReady }, [resultReady])
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  // Sync React agent state → canvas stateRef
  useEffect(() => {
    if (!stateRef.current) return
    const s = stateRef.current
    SUB_AGENTS.forEach((def, i) => {
      const ag = agents[def.id]
      const sp = s.spiders[i]
      if (!sp) return
      sp.reactStatus = ag.status
      sp.reactProgress = ag.progress
    })
    // Track reviewer status for dot spawning
    prevSubStatusRef.current['reviewer'] = agents.reviewer?.status || 'idle'

    // Track which sub-sources are active for continuous waves (driven from draw loop)
    if (s) {
      const reviewerDone = agents.reviewer?.status === 'done'
      s.activeSubSources = reviewerDone ? [] : REVIEWER_SOURCE_WAVE_MAP
        .filter(({ subId }) => agents[subId]?.status === 'scanning' || agents[subId]?.status === 'done')
        .map(({ sourceLabel, color }) => {
          const srcNode = s.nodes?.find(n => n.type === 'source' && n.label === sourceLabel)
          const rn = s.nodes?.[2]
          return srcNode && rn ? { fromX: srcNode.x, fromY: srcNode.y, toX: rn.x, toY: rn.y, color } : null
        })
        .filter(Boolean)
      // Clear waves when reviewer finishes
      if (reviewerDone) s.subWaves = []
    }
    s.queenStatus = agents.queen.status
    s.phase = phase
  }, [agents, phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getW = () => canvas.parentElement?.offsetWidth || window.innerWidth
    const getH = () => canvas.parentElement?.offsetHeight || window.innerHeight
    canvas.width = getW()
    canvas.height = getH()

    const resize = () => {
      canvas.width = getW()
      canvas.height = getH()
      buildLayout()
    }

    let nodes = [], spiders = []

    function buildLayout() {
      const W = canvas.width, H = canvas.height
      nodes = []

      // 0: Queen (hub)
      nodes.push({ x: W/2, y: H/2, type: 'queen' })

      // 1–4: sub-agent anchors
      SUB_AGENTS.forEach(def => {
        nodes.push({ x: W/2 + Math.cos(def.angle) * AGENT_RING_R, y: H/2 + Math.sin(def.angle) * AGENT_RING_R, type: 'agent', def })
      })

      // 5–12: source nodes — each pair fans out from its agent's anchor
      // SUB_AGENTS order: hunter(0,-π/2), reviewer(1,0), pricer(2,π/2), ranker(3,π)
      // sourceIdxs: hunter=[0,4], reviewer=[1,2], pricer=[3,5], ranker=[6,7]
      const SOURCE_NODE_DEFS = [
        // hunter sources: AMAZON(0) and FLIPKART(4) — spread horizontally at top
        { label: 'AMAZON',      agentIdx: 0, spread: -0.55 },  // idx 5  (sourceIdx 0)
        // reviewer sources: REDDIT(1), YOUTUBE(2), AMZ-REVIEW(8)
        { label: 'REDDIT',      agentIdx: 1, spread: -0.65 },  // idx 6  (sourceIdx 1)
        { label: 'YOUTUBE',     agentIdx: 1, spread:  0.65 },  // idx 7  (sourceIdx 2)
        // pricer sources: GOOGLE(3), BLOGS(5)
        { label: 'GOOGLE',      agentIdx: 2, spread: -0.45 },  // idx 8  (sourceIdx 3)
        { label: 'FLIPKART',    agentIdx: 0, spread:  0.55 },  // idx 9  (sourceIdx 4)
        { label: 'BLOGS',       agentIdx: 2, spread:  0.45 },  // idx 10 (sourceIdx 5)
        // ranker sources: FORUMS(6), TECHRADAR(7)
        { label: 'FORUMS',      agentIdx: 3, spread: -0.45 },  // idx 11 (sourceIdx 6)
        { label: 'TECHRADAR',   agentIdx: 3, spread:  0.45 },  // idx 12 (sourceIdx 7)
        // reviewer 3rd source: AMZ-REVIEW (8)
        { label: 'AMZ-REVIEW',  agentIdx: 1, spread:  0.0  },  // idx 13 (sourceIdx 8) — center, farthest
      ]
      SOURCE_NODE_DEFS.forEach(({ label, agentIdx, spread }) => {
        const agentAngle = SUB_AGENTS[agentIdx].angle
        const perpAngle  = agentAngle + Math.PI / 2
        const r          = Math.min(SOURCE_RING_R, Math.min(W, H) * 0.38)
        const cx         = W/2 + Math.cos(agentAngle) * r
        const cy         = H/2 + Math.sin(agentAngle) * r
        const fanSpread  = r * 0.55
        nodes.push({
          x: cx + Math.cos(perpAngle) * fanSpread * spread * 2,
          y: cy + Math.sin(perpAngle) * fanSpread * spread * 2,
          type: 'source', label,
        })
      })

      // 13–19: filler nodes (kept away from top where hunter patrols)
      const fillerPositions = [
        [0.80, 0.55], [0.65, 0.82], [0.32, 0.78],
        [0.18, 0.58], [0.20, 0.40], [0.78, 0.38], [0.50, 0.88],
      ]
      fillerPositions.forEach(([fx, fy]) => {
        nodes.push({ x: fx * W, y: fy * H, type: 'filler' })
      })

      // Build edges
      const edges = []
      // Queen ↔ sub-agents
      for (let i = 1; i <= 4; i++) edges.push({ a: 0, b: i, type: 'main' })
      // Sub-agents ↔ their source nodes
      SUB_AGENTS.forEach((def, i) => {
        def.sourceIdxs.forEach(si => edges.push({ a: i + 1, b: si + 5, type: 'agent', agentIdx: i }))
      })
      // Atmospheric: sources ↔ nearby fillers
      for (let i = 5; i <= 13; i++) {
        for (let j = 14; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < 160) edges.push({ a: i, b: j, type: 'atmo' })
        }
      }

      // Init spiders
      spiders = SUB_AGENTS.map((def, i) => {
        const an = nodes[i + 1]
        return {
          def, agentNodeIdx: i + 1,
          x: an.x, y: an.y,
          orbitAngle: (i / 4) * Math.PI * 2,
          // travel state
          traveling: false, returning: false,
          fromX: an.x, fromY: an.y,
          toX: an.x, toY: an.y,
          t: 1,
          targetSourceIdx: def.sourceIdxs[0] + 5,
          packetT: -1, // packet from source→queen
          reactStatus: 'idle', reactProgress: 0,
          cocoons: [],
          wasActive: false,
          waypoint: null, travelPhase: 1,
          _finalToX: an.x, _finalToY: an.y,
          celebrationSpawned: false,
        }
      })

      if (stateRef.current) {
        stateRef.current.nodes = nodes
        stateRef.current.edges = edges
        stateRef.current.spiders = spiders
        if (!stateRef.current.subWaves) stateRef.current.subWaves = []
      }
    }

    const s = {
      nodes, edges: [], spiders,
      subWaves: [],
      activeSubSources: [],  // sources currently beaming to reviewer
      waveSpawnTimer: {},    // per-source spawn timer
      dotSpawnTimer: 0,      // reviewer→queen dot timer
      reviewerDots: [],
      phase: 0, queenStatus: 'idle',
      queenFlash: 0, queenBloom: 0,
      bloomRadius: 14, blooming: false,
      particles: [],
      queenBodySpike: 0,
      reviewerFrozen: 0,  // countdown frames reviewer is frozen receiving a wave
      time: 0,
    }
    stateRef.current = s

    buildLayout()
    window.addEventListener('resize', resize)

    function routeAroundQueen(fromX, fromY, toX, toY, qx, qy, clearance) {
      const dx = toX - fromX, dy = toY - fromY
      const len = Math.hypot(dx, dy)
      if (len < 1) return null
      const t = Math.max(0, Math.min(1, ((qx-fromX)*dx + (qy-fromY)*dy) / (len*len)))
      const closestX = fromX + t*dx, closestY = fromY + t*dy
      const dist = Math.hypot(qx-closestX, qy-closestY)
      if (dist >= clearance) return null
      const perpX = -(toY - fromY) / len
      const perpY = (toX - fromX) / len
      const dot = perpX*(qx-fromX) + perpY*(qy-fromY)
      const side = dot > 0 ? -1 : 1
      return {
        x: (fromX+toX)/2 + side * perpX * (clearance + 20),
        y: (fromY+toY)/2 + side * perpY * (clearance + 20),
      }
    }

    function drawSpiderBody(ctx, x, y, bodyR, time, legOffset, glow, legColor) {
      const _legColor = legColor || 'rgba(180,10,30,0.7)'
      // glow halo
      const g = ctx.createRadialGradient(x, y, 0, x, y, bodyR * 4)
      g.addColorStop(0, glow || 'rgba(220,20,60,0.5)')
      g.addColorStop(1, 'rgba(220,20,60,0)')
      ctx.beginPath(); ctx.arc(x, y, bodyR * 4, 0, Math.PI * 2)
      ctx.fillStyle = g; ctx.fill()

      // legs — 8 pairs
      const phase = time * 0.002 + legOffset
      ;[[-60,-120],[-30,-150],[-5,-170],[20,-20],[60,20],[100,140],[130,160],[155,130]].forEach(([a1, a2], li) => {
        const swing = Math.sin(phase + li * 0.8) * 6
        const r1 = ((a1 + swing) * Math.PI) / 180
        const r2 = ((a2 - swing) * Math.PI) / 180
        const len = bodyR * 3
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(r1)*len, y + Math.sin(r1)*len)
        ctx.strokeStyle = _legColor; ctx.lineWidth = 1; ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(r2)*len, y + Math.sin(r2)*len)
        ctx.strokeStyle = _legColor; ctx.lineWidth = 1; ctx.stroke()
      })

      // body
      ctx.beginPath(); ctx.arc(x, y - bodyR*0.3, bodyR, 0, Math.PI * 2)
      ctx.fillStyle = '#e63946'; ctx.fill()
      ctx.beginPath(); ctx.arc(x, y + bodyR*1.1, bodyR * 0.75, 0, Math.PI * 2)
      ctx.fillStyle = '#8b0000'; ctx.fill()
      // teardrop abdomen extension
      ctx.beginPath(); ctx.ellipse(x, y + bodyR*2.2, bodyR*0.4, bodyR*0.7, 0, 0, Math.PI*2)
      ctx.fillStyle = '#5a0010'; ctx.fill()
      // hourglass mark on abdomen
      ctx.strokeStyle = 'rgba(255,100,100,0.5)'; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(x - bodyR*0.3, y + bodyR*0.7); ctx.lineTo(x + bodyR*0.3, y + bodyR*1.5)
      ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x + bodyR*0.3, y + bodyR*0.7); ctx.lineTo(x - bodyR*0.3, y + bodyR*1.5)
      ctx.stroke()
      // eyes
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(x - bodyR*0.38, y - bodyR*0.65, bodyR*0.27, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + bodyR*0.38, y - bodyR*0.65, bodyR*0.27, 0, Math.PI*2); ctx.fill()
    }

    let rafId
    function draw(time) {
      rafId = requestAnimationFrame(draw)
      const dt = Math.min(time - s.time, 32)
      s.time = time

      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, W, H)
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.72)
      vig.addColorStop(0, 'transparent'); vig.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)

      if (!s.nodes?.length) { return }

      const ph = s.phase

      // ── Draw edges ──────────────────────────────────────────────────
      s.edges?.forEach(e => {
        const na = s.nodes[e.a], nb = s.nodes[e.b]
        if (!na || !nb) return

        let alpha = 0
        if (e.type === 'main') alpha = 0.7
        else if (e.type === 'agent') {
          const sp = s.spiders[e.agentIdx]
          alpha = sp?.reactStatus !== 'idle' ? 0.5 : 0.18
        } else alpha = 0.18

        // phase fade
        if (ph >= 4) {
          const dh = Math.hypot(na.x - W/2, na.y - H/2) + Math.hypot(nb.x - W/2, nb.y - H/2)
          if (dh > 500) alpha *= 0.3
        }

        ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y)
        ctx.strokeStyle = `rgba(220,20,60,${alpha})`; ctx.lineWidth = e.type === 'main' ? 1.5 : 1
        ctx.stroke()
      })

      // ── Draw source node labels ──────────────────────────────────────
      ctx.font = '9px monospace'; ctx.textAlign = 'center'
      s.nodes.forEach(n => {
        if (n.type !== 'source') return
        const nearAny = s.spiders.some(sp => Math.hypot(sp.x - n.x, sp.y - n.y) < 90)
        const alpha = nearAny ? 1.0 : 0.6
        ctx.fillStyle = `rgba(255,100,110,${alpha})`
        ctx.fillText(n.label, n.x, n.y - 10)
        // dot
        ctx.beginPath(); ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,80,100,${nearAny ? 1.0 : 0.6})`; ctx.fill()
      })

      // ── Draw cocoons ──────────────────────────────────────────────────
      s.spiders.forEach(sp => {
        sp.cocoons.forEach(c => {
          const pulse = Math.sin(time * 0.003 + c.x * 0.01) * 0.25 + 0.75
          ctx.save()
          ctx.translate(c.x, c.y)
          ctx.rotate(Math.PI * 0.15)
          const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 12)
          cg.addColorStop(0, `rgba(220,20,60,${0.8 * pulse})`)
          cg.addColorStop(1, 'rgba(220,20,60,0)')
          ctx.beginPath(); ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI*2)
          ctx.fillStyle = cg; ctx.fill()
          ctx.beginPath(); ctx.ellipse(0, 0, 2, 3, 0, 0, Math.PI*2)
          ctx.fillStyle = `rgba(255,200,200,${0.9*pulse})`; ctx.fill()
          ctx.restore()
        })
      })

      // ── Update & draw sub-agent spiders ───────────────────────────────
      s.spiders.forEach((sp, i) => {
        const an = s.nodes[sp.agentNodeIdx]
        if (!an) return

        const wasIdle = !sp.wasActive
        if (sp.reactStatus !== 'idle' && !sp.wasActive) sp.wasActive = true

        if (sp.reactStatus === 'idle') {
          // Orbit anchor node slowly
          sp.orbitAngle += 0.005 * (dt / 16)
          sp.x = an.x + Math.cos(sp.orbitAngle) * 9
          sp.y = an.y + Math.sin(sp.orbitAngle) * 9
        } else if (sp.reactStatus === 'done' && (sp.def.id !== 'ranker' || s.spiders.every(o => (o.def.id !== 'pricer' && o.def.id !== 'reviewer') || o.reactStatus === 'done'))) {
          // Move toward queen — hunter stays at anchor, ranker waits for pricer+reviewer
          const qn = s.nodes[0]
          const offset = { x: Math.cos(SUB_AGENTS[i].angle + Math.PI) * 28, y: Math.sin(SUB_AGENTS[i].angle + Math.PI) * 28 }
          const tx = qn.x + offset.x, ty = qn.y + offset.y
          sp.x += (tx - sp.x) * 0.04
          sp.y += (ty - sp.y) * 0.04
          // Celebration when first arriving at hub
          if (!sp.celebrationSpawned && Math.hypot(sp.x - qn.x, sp.y - qn.y) < 35) {
            sp.celebrationSpawned = true
            s.queenFlash = 2.0
            for (let p = 0; p < 8; p++) {
              const angle = (p / 8) * Math.PI * 2
              s.particles.push({ x: qn.x, y: qn.y, vx: Math.cos(angle)*3.5, vy: Math.sin(angle)*3.5, life: 1.0, color: sp.def.color })
            }
            s.queenBodySpike = 1.0
            // Ranker arrives → massive queen bloom, then show results
            if (sp.def.id === 'ranker' && !completedRef.current) {
              completedRef.current = true
              s.blooming = true
              s.bloomRadius = 14
              // Wait for bloom to fill screen, then fire onComplete
              setTimeout(() => {
                if (resultReadyRef.current) onCompleteRef.current?.()
                else {
                  // poll until result ready (backend still sending)
                  const poll = setInterval(() => {
                    if (resultReadyRef.current) { clearInterval(poll); onCompleteRef.current?.() }
                  }, 200)
                }
              }, 800)
            }
          }
        } else if (sp.def.id === 'reviewer') {
          // Reviewer stays at its anchor — sub-agents send data via waves.
          // Orbit tightly at anchor while scanning; waves knock it briefly.
          const frozen = s.reviewerFrozen > 0
          if (frozen) {
            // Receiving wave — shake slightly
            sp.x = an.x + (Math.random() - 0.5) * 3
            sp.y = an.y + (Math.random() - 0.5) * 3
            s.reviewerFrozen = Math.max(0, s.reviewerFrozen - 1)
          } else {
            // Gentle breathing orbit at anchor
            sp.orbitAngle += 0.006 * (dt / 16)
            sp.x = an.x + Math.cos(sp.orbitAngle) * 6
            sp.y = an.y + Math.sin(sp.orbitAngle) * 6
          }
        } else {
          // Travel to source → back → repeat
          if (sp.t >= 1) {
            // Waypoint phase transition
            if (sp.travelPhase === 0 && sp.waypoint) {
              sp.travelPhase = 1
              sp.fromX = sp.x; sp.fromY = sp.y
              sp.toX = sp._finalToX; sp.toY = sp._finalToY
              sp.t = 0
            } else if (sp.traveling && !sp.returning) {
              // arrived at source, deposit cocoon
              const sn = s.nodes[sp.targetSourceIdx]
              if (sn) sp.cocoons.push({ x: sn.x, y: sn.y })
              // start packet toward queen
              sp.packetT = 0
              // return to anchor
              sp.returning = true
              sp.waypoint = null; sp.travelPhase = 1
              sp.fromX = sp.x; sp.fromY = sp.y
              sp.toX = an.x; sp.toY = an.y
              sp.t = 0
            } else {
              // choose next source target
              const srcIdxs = sp.def.sourceIdxs
              const nextSrc = srcIdxs[Math.floor(sp.cocoons.length % srcIdxs.length)]
              sp.targetSourceIdx = nextSrc + 5
              const tn = s.nodes[sp.targetSourceIdx]
              if (tn) {
                const qn = s.nodes[0]
                sp._finalToX = tn.x; sp._finalToY = tn.y
                const wp = routeAroundQueen(sp.x, sp.y, tn.x, tn.y, qn.x, qn.y, 85)
                sp.fromX = sp.x; sp.fromY = sp.y
                if (wp) {
                  sp.waypoint = wp
                  sp.travelPhase = 0
                  sp.toX = wp.x; sp.toY = wp.y
                } else {
                  sp.waypoint = null
                  sp.travelPhase = 1
                  sp.toX = tn.x; sp.toY = tn.y
                }
                sp.t = 0; sp.traveling = true; sp.returning = false
              }
            }
          } else {
            sp.t += 0.009 * (dt / 16)
            const ease = sp.t < 0.5 ? 2*sp.t*sp.t : -1+(4-2*sp.t)*sp.t
            sp.x = sp.fromX + (sp.toX - sp.fromX) * Math.min(ease, 1)
            sp.y = sp.fromY + (sp.toY - sp.fromY) * Math.min(ease, 1)
          }
        }

        // Draw packet (source→agent→queen)
        if (sp.packetT >= 0 && sp.packetT <= 1) {
          sp.packetT += 0.018 * (dt / 16)
          const sn = s.nodes[sp.targetSourceIdx]
          const qn = s.nodes[0]
          if (sn && qn) {
            const px = sn.x + (qn.x - sn.x) * sp.packetT
            const py = sn.y + (qn.y - sn.y) * sp.packetT
            const pg = ctx.createRadialGradient(px, py, 0, px, py, 8)
            pg.addColorStop(0, 'rgba(255,100,100,0.95)'); pg.addColorStop(1, 'rgba(220,20,60,0)')
            ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2)
            ctx.fillStyle = pg; ctx.fill()
            ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2)
            ctx.fillStyle = '#fff'; ctx.fill()
            // flash queen when packet arrives
            if (sp.packetT > 0.95) { s.queenFlash = 1; sp.packetT = -1 }
          }
        }

        // Draw spider
        const isDone = sp.reactStatus === 'done'
        const glowColor = isDone ? 'rgba(74,222,128,0.5)' : 'rgba(220,20,60,0.5)'
        const legColor = sp.def.color + 'aa'
        drawSpiderBody(ctx, sp.x, sp.y, 7, time, i * 1.4, glowColor, legColor)
        // Identity dot on abdomen
        ctx.beginPath(); ctx.arc(sp.x, sp.y + 9, 2.5, 0, Math.PI*2)
        ctx.fillStyle = sp.def.color; ctx.fill()

        // Label
        ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'
        ctx.fillStyle = isDone ? 'rgba(74,222,128,1.0)' : 'rgba(255,100,110,1.0)'
        ctx.fillText(sp.def.label, sp.x, sp.y + 26)
      })

      // ── Continuous kamehameha waves from source nodes → REVIEWER ─────────
      // Spawn new wave per active source every ~50 frames
      if (s.activeSubSources?.length) {
        s.activeSubSources.forEach(src => {
          const key = `${src.fromX},${src.fromY}`
          s.waveSpawnTimer[key] = (s.waveSpawnTimer[key] || 0) + dt
          if (s.waveSpawnTimer[key] > 800) {  // new wave every ~800ms
            s.waveSpawnTimer[key] = 0
            s.subWaves.push({ ...src, t: 0, arrived: false })
          }
        })
      } else {
        s.waveSpawnTimer = {}
      }

      s.subWaves = s.subWaves.filter(w => w.t <= 1.05)
      s.subWaves.forEach(w => {
        w.t += 0.016 * (dt / 16)
        const ease = w.t < 0.5 ? 2*w.t*w.t : -1+(4-2*w.t)*w.t
        const ex = Math.min(ease, 1)
        const px = w.fromX + (w.toX - w.fromX) * ex
        const py = w.fromY + (w.toY - w.fromY) * ex

        // Continuous beam: draw full persistent line from source to leading orb
        const totalLen = Math.hypot(w.toX - w.fromX, w.toY - w.fromY)
        const steps = 24
        for (let k = steps; k >= 0; k--) {
          const kt = Math.max(0, ex - k * 0.035)
          const kx = w.fromX + (w.toX - w.fromX) * kt
          const ky = w.fromY + (w.toY - w.fromY) * kt
          const frac = 1 - k / steps
          const beamAlpha = frac * 0.85
          const beamW = frac * 5 + 0.5
          ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(px, py)
          ctx.strokeStyle = `rgba(255,210,50,${beamAlpha})`
          ctx.lineWidth = beamW; ctx.stroke()
        }

        // Leading orb
        const orbAlpha = Math.max(0, 1 - w.t * 0.2)
        const og = ctx.createRadialGradient(px, py, 0, px, py, 13)
        og.addColorStop(0, `rgba(255,255,200,${orbAlpha})`)
        og.addColorStop(0.4, `rgba(255,200,40,${orbAlpha * 0.8})`)
        og.addColorStop(1, 'rgba(220,80,0,0)')
        ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2)
        ctx.fillStyle = og; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${orbAlpha})`; ctx.fill()

        // Impact
        if (!w.arrived && w.t > 0.9) {
          w.arrived = true
          s.reviewerFrozen = 40
          const rn = s.nodes[2]
          if (rn) {
            for (let p = 0; p < 8; p++) {
              const ang = (p / 8) * Math.PI * 2
              s.particles.push({ x: rn.x, y: rn.y, vx: Math.cos(ang)*2.5, vy: Math.sin(ang)*2.5, life: 0.7, color: w.color })
            }
          }
        }
      })

      // ── Reviewer → queen signal dots (every ~1s while scanning or done) ──
      {
        const reviewerSp = s.spiders[1]  // reviewer is index 1
        const reviewerActive = reviewerSp && (reviewerSp.reactStatus === 'scanning' || reviewerSp.reactStatus === 'done')
        if (reviewerActive) {
          s.dotSpawnTimer = (s.dotSpawnTimer || 0) + dt
          if (s.dotSpawnTimer > 1000) {
            s.dotSpawnTimer = 0
            const rn = s.nodes[2]
            const qn = s.nodes[0]
            if (rn && qn) s.reviewerDots.push({ fromX: rn.x, fromY: rn.y, toX: qn.x, toY: qn.y, t: 0 })
          }
        }
        s.reviewerDots = s.reviewerDots.filter(d => d.t < 1.2)
        s.reviewerDots.forEach(d => {
          d.t += 0.012 * (dt / 16)
          const t = Math.min(d.t, 1)
          const px = d.fromX + (d.toX - d.fromX) * t
          const py = d.fromY + (d.toY - d.fromY) * t
          const alpha = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1.0
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(220,20,60,${alpha * 0.9})`; ctx.fill()
          ctx.beginPath(); ctx.arc(px - (d.toX - d.fromX) * 0.05, py - (d.toY - d.fromY) * 0.05, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,100,110,${alpha * 0.4})`; ctx.fill()
        })
      }

      // ── Particles ─────────────────────────────────────────────────────
      s.particles = s.particles.filter(p => {
        p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life -= 0.025
        if (p.life <= 0) return false
        const pg2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6)
        pg2.addColorStop(0, p.color + Math.round(p.life*255).toString(16).padStart(2,'0'))
        pg2.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2)
        ctx.fillStyle = pg2; ctx.fill()
        return true
      })

      // ── Queen spider ──────────────────────────────────────────────────
      const qn = s.nodes[0]
      if (qn) {
        s.queenFlash = Math.max(0, s.queenFlash - 0.04)
        if (s.queenBodySpike > 0) s.queenBodySpike = Math.max(0, s.queenBodySpike - 0.02 * (dt/16))
        const activeCount = s.spiders.filter(sp => sp.reactStatus !== 'idle').length
        const doneCount = s.spiders.filter(sp => sp.reactStatus === 'done').length

        // bloom triggered by ranker arrival (completedRef), not just doneCount
        if (s.blooming) s.bloomRadius = Math.min(Math.max(W, H), s.bloomRadius + 3.5 * (dt/16))

        const baseR = s.blooming ? Math.max(18, s.bloomRadius * 0.09) : 14 + activeCount * 3 + s.queenBodySpike * 8
        const pulse = Math.sin(time * (0.002 + activeCount * 0.001)) * 0.2 + 0.8
        const flashBoost = s.queenFlash * 0.4
        const bloomT = s.blooming ? Math.min(1, s.bloomRadius / Math.max(W, H)) : 0

        // Full-screen bloom fill
        if (s.blooming && s.bloomRadius > 30) {
          const bg = ctx.createRadialGradient(qn.x, qn.y, 0, qn.x, qn.y, s.bloomRadius)
          bg.addColorStop(0, `rgba(180,10,30,${0.85 * bloomT})`)
          bg.addColorStop(0.4, `rgba(100,0,20,${0.6 * bloomT})`)
          bg.addColorStop(1, 'rgba(8,0,0,0)')
          ctx.beginPath(); ctx.arc(qn.x, qn.y, s.bloomRadius, 0, Math.PI * 2)
          ctx.fillStyle = bg; ctx.fill()
        }

        const qg = ctx.createRadialGradient(qn.x, qn.y, 0, qn.x, qn.y, baseR * (s.blooming ? 8 : 3.5))
        qg.addColorStop(0, s.blooming ? `rgba(255,220,220,${0.95*pulse+flashBoost})` : `rgba(220,20,60,${0.75*pulse+flashBoost})`)
        qg.addColorStop(0.4, `rgba(220,20,60,${0.4*pulse})`)
        qg.addColorStop(1, 'rgba(220,20,60,0)')
        ctx.beginPath(); ctx.arc(qn.x, qn.y, baseR * (s.blooming ? 8 : 3.5), 0, Math.PI * 2)
        ctx.fillStyle = qg; ctx.fill()

        drawSpiderBody(ctx, qn.x, qn.y, baseR, time, 0,
          s.blooming ? `rgba(255,220,220,${0.95*pulse})` : `rgba(255,60,60,${0.7*pulse+flashBoost})`,
          s.blooming ? 'rgba(255,150,150,0.9)' : 'rgba(200,30,30,0.75)')

        // Queen label
        if (!s.blooming) {
          ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'
          ctx.fillStyle = `rgba(220,20,60,${0.6 + activeCount * 0.1})`
          ctx.fillText('RONIN CORE', qn.x, qn.y + baseR * 2.8 + 14)
        } else if (bloomT > 0.3) {
          ctx.font = `bold ${Math.round(14 + bloomT * 10)}px monospace`; ctx.textAlign = 'center'
          ctx.fillStyle = `rgba(255,220,220,${bloomT})`
          ctx.fillText('INTELLIGENCE SYNTHESIZED', qn.x, qn.y + baseR + 28)
        }
      }
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
}

/* ─── Shared panel styles ────────────────────────────────────────────────── */
const _card = { background: 'rgba(10,0,0,0.90)', border: '1px solid rgba(220,20,60,0.25)', borderRadius: 11, padding: '16px 18px', backdropFilter: 'blur(14px)' }
const _sec  = { fontSize: 13, letterSpacing: '0.16em', color: 'rgba(220,20,60,0.9)', fontFamily: 'monospace', fontWeight: 700 }
const _lbl  = { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', letterSpacing: '0.05em', marginBottom: 4 }
const SRC_COLORS = { amazon:'#ff9900', reddit:'#ff4500', youtube:'#ff2020', flipkart:'#2874f0', google:'#4285f4' }

function LiveDot() {
  return (
    <motion.span animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.2, repeat:Infinity }}
      style={{ fontSize:11, color:'#e63946', fontFamily:'monospace', letterSpacing:'0.1em' }}>● LIVE</motion.span>
  )
}

function StatusPill({ status, small }) {
  const live = status === 'scanning' || status === 'active'
  const done = status === 'done'
  return (
    <motion.span animate={{ opacity: live ? [1,0.4,1] : 1 }} transition={{ duration:1.1, repeat: live ? Infinity : 0 }}
      style={{ fontSize: small?10:11, fontFamily:'monospace', fontWeight:700, padding: small?'2px 7px':'3px 9px', borderRadius:4,
        background: done?'rgba(74,222,128,0.12)':live?'rgba(220,20,60,0.12)':'rgba(255,255,255,0.04)',
        color: done?'#4ade80':live?'#ff6b75':'#475569',
        border:`1px solid ${done?'rgba(74,222,128,0.3)':live?'rgba(220,20,60,0.28)':'rgba(255,255,255,0.06)'}`,
        letterSpacing:'0.07em', whiteSpace:'nowrap' }}>
      {done ? '✓ DONE' : live ? '● LIVE' : 'IDLE'}
    </motion.span>
  )
}

/* ── Top navbar ── */
function HiveNavbar({ phase }) {
  const tabs = ['HIVE','FEED','AGENTS','ANALYTICS','TARGETS']
  return (
    <motion.div initial={{ y:-56, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ duration:0.5 }}
      style={{ height:56, background:'rgba(6,0,0,0.97)', borderBottom:'1px solid rgba(220,20,60,0.2)',
        display:'flex', alignItems:'center', padding:'0 20px', flexShrink:0, zIndex:20, pointerEvents:'all' }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:11, marginRight:32 }}>
        <div style={{ width:36, height:36, borderRadius:9, background:'radial-gradient(circle,#e63946,#6a0000)',
          display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 18px rgba(220,20,60,0.55)' }}>
          <SpiderIcon color="#fff" size={20} />
        </div>
        <div>
          <div style={{ fontSize:17, fontWeight:900, color:'#fff', fontFamily:'Space Grotesk,sans-serif', letterSpacing:'0.12em', lineHeight:1.1 }}>
            WEB <span style={{ color:'#e63946' }}>|</span> INTEL
          </div>
          <div style={{ fontSize:10, color:'rgba(220,20,60,0.6)', fontFamily:'monospace', letterSpacing:'0.13em' }}>
            ● NETWORK ACTIVE · {600 + phase*60} NODES
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ display:'flex', gap:3, flex:1, justifyContent:'center' }}>
        {tabs.map((t,i) => (
          <div key={t} style={{ padding:'7px 18px', borderRadius:7, fontSize:13, fontFamily:'monospace', fontWeight:700,
            letterSpacing:'0.08em', cursor:'default',
            background: i===0?'rgba(220,20,60,0.2)':'transparent',
            color: i===0?'#ff8c94':'rgba(255,255,255,0.35)',
            border: i===0?'1px solid rgba(220,20,60,0.45)':'1px solid transparent' }}>
            {t}
          </div>
        ))}
      </div>
      {/* Right */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.2)', fontFamily:'monospace', padding:'5px 12px',
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6 }}>
          Search the web hive...
        </div>
        {['⚙','🔔'].map(ic => (
          <div key={ic} style={{ width:32, height:32, borderRadius:7, background:'rgba(255,255,255,0.05)',
            display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.35)', fontSize:15 }}>{ic}</div>
        ))}
        <div style={{ width:32, height:32, borderRadius:'50%', background:'radial-gradient(circle,#e63946,#8b0000)',
          display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:900,
          boxShadow:'0 0 12px rgba(220,20,60,0.55)' }}>R</div>
      </div>
    </motion.div>
  )
}

/* ── Left sidebar ── */
function HiveLeftPanel({ agents, overallProgress, feedItems, phase }) {
  const AGENT_LIST = [
    { id:'hunter',  label:'HUNTER',  sub:'Amazon Crawler',   color:'#ff7a3d' },
    { id:'ranker',  label:'RANKER',  sub:'Relevance Engine', color:'#9b1aff' },
    { id:'reviewer',label:'REVIEWER',sub:'Content Analyzer', color:'#e63946' },
    { id:'pricer',  label:'PRICER',  sub:'Price Tracker',    color:'#ff3366' },
  ]
  return (
    <motion.div initial={{ x:-300, opacity:0 }} animate={{ x:0, opacity:1 }} transition={{ delay:0.3, duration:0.55 }}
      style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', gap:10,
        padding:'12px 0 12px 14px', overflowY:'auto', zIndex:10, pointerEvents:'all' }}>

      {/* Spider Core */}
      <div style={_card}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:'radial-gradient(circle,#e63946,#7a0000)',
            display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 16px rgba(220,20,60,0.55)' }}>
            <SpiderIcon color="#fff" size={22} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'0.1em', fontFamily:'monospace' }}>SPIDER CORE</div>
            <div style={{ fontSize:12, color:'rgba(220,20,60,0.7)', fontFamily:'monospace' }}>Orchestrator Active</div>
          </div>
          <StatusPill status="active" />
        </div>
        <div style={{ display:'flex', gap:20 }}>
          <div>
            <div style={_lbl}>Network Health</div>
            <div style={{ fontSize:28, fontWeight:900, color:'#4ade80', fontFamily:'monospace', lineHeight:1 }}>{overallProgress}%</div>
          </div>
          <div>
            <div style={_lbl}>Phase</div>
            <div style={{ fontSize:13, color:'#ff8c94', fontFamily:'monospace', fontWeight:700 }}>{PHASE_LABELS[phase]}</div>
          </div>
        </div>
      </div>

      {/* Active Agents */}
      <div style={_card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={_sec}>◈ ACTIVE AGENTS</div>
          <span style={{ fontSize:12, fontFamily:'monospace', color:'rgba(220,20,60,0.7)' }}>
            {AGENT_LIST.filter(d => agents[d.id]?.status !== 'idle').length} / {AGENT_LIST.length}
          </span>
        </div>
        {AGENT_LIST.map(def => {
          const ag = agents[def.id]
          const live = ag?.status === 'scanning' || ag?.status === 'active'
          const done = ag?.status === 'done'
          return (
            <div key={def.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 0',
              borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <SpiderIcon color={def.color} size={18} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color: done?'#4ade80':live?'#fff':'#475569', fontFamily:'monospace', letterSpacing:'0.06em' }}>{def.label}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontFamily:'monospace' }}>{def.sub}</div>
              </div>
              <StatusPill status={ag?.status||'idle'} small />
            </div>
          )
        })}
      </div>

      {/* Feed Stream */}
      <div style={{ ..._card, flex:1 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={_sec}>◈ FEED STREAM</div>
          <LiveDot />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <AnimatePresence initial={false}>
            {(feedItems.length ? feedItems : []).slice(-7).reverse().map((item, i) => (
              <motion.div key={item.id} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
                style={{ display:'flex', alignItems:'flex-start', gap:7 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', marginTop:4, flexShrink:0,
                  background: SRC_COLORS[item.source]||'#e63946',
                  boxShadow: i===0?`0 0 7px ${SRC_COLORS[item.source]||'#e63946'}`:'none' }} />
                <div style={{ flex:1, fontSize:12, color: i===0?'#e2e8f0':'rgba(255,255,255,0.45)', fontFamily:'monospace', lineHeight:1.5 }}>
                  {item.text.slice(0,50)}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.22)', fontFamily:'monospace', flexShrink:0 }}>
                  {Math.round((Date.now()-item.ts)/1000)}s
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {!feedItems.length && <div style={{ fontSize:12, color:'rgba(220,20,60,0.35)', fontFamily:'monospace' }}>Awaiting data stream...</div>}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Right sidebar ── */
function HiveRightPanel({ milestones, agents, query, phase }) {
  const sentimentPct = agents.reviewer?.status === 'done' ? 82 : phase >= 2 ? Math.min(75, 30 + phase*12) : 0
  const budgetM = milestones.find(m => m.text?.startsWith('Budget:'))
  const budget = budgetM?.text?.replace('Budget:','').trim() || '—'

  return (
    <motion.div initial={{ x:300, opacity:0 }} animate={{ x:0, opacity:1 }} transition={{ delay:0.3, duration:0.55 }}
      style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', gap:10,
        padding:'12px 14px 12px 0', overflowY:'auto', zIndex:10, pointerEvents:'all' }}>

      {/* Intelligence Summary */}
      <div style={_card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={_sec}>◈ INTELLIGENCE SUMMARY</div>
          <LiveDot />
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={_lbl}>Overall Sentiment</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span style={{ fontSize:28, fontWeight:900, fontFamily:'monospace', color: sentimentPct>60?'#4ade80':'#ff8c94', lineHeight:1 }}>{sentimentPct}%</span>
            <span style={{ fontSize:14, color:'rgba(255,255,255,0.5)', fontFamily:'monospace' }}>
              {agents.reviewer?.status==='done'?'Positive': phase>=2?'Analyzing...':'Pending'}
            </span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, marginTop:7, overflow:'hidden' }}>
            <motion.div animate={{ width:`${sentimentPct}%` }} transition={{ duration:1 }}
              style={{ height:'100%', borderRadius:2, background: sentimentPct>60?'linear-gradient(90deg,#4ade80,#22c55e)':'linear-gradient(90deg,#e63946,#ff8c94)' }} />
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:7 }}>LATEST SIGNALS</div>
          {milestones.slice(-4).reverse().map((m,i) => (
            <div key={m.id} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'flex-start' }}>
              <span style={{ color: i===0?'#e63946':'rgba(220,20,60,0.35)', fontSize:10, marginTop:2 }}>◆</span>
              <span style={{ fontSize:12, color: i===0?'#e2e8f0':'rgba(255,255,255,0.42)', fontFamily:'monospace', lineHeight:1.5 }}>{m.text}</span>
            </div>
          ))}
          {!milestones.length && <div style={{ fontSize:12, color:'rgba(255,255,255,0.2)', fontFamily:'monospace' }}>Awaiting signals...</div>}
        </div>
        {query && (
          <div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', fontFamily:'monospace', letterSpacing:'0.1em', marginBottom:7 }}>TRENDING KEYWORDS</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {query.toLowerCase().split(/\s+/).filter(w=>w.length>2).map((w,i) => (
                <span key={i} style={{ fontSize:13, fontFamily:'monospace', fontWeight:700,
                  color:['#e63946','#ff9900','#4ade80','#9b1aff','#4285f4'][i%5] }}>{w}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Target */}
      {query && (
        <div style={_card}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <div style={_sec}>◈ TARGET</div>
            <LiveDot />
          </div>
          <div style={{ fontSize:15, fontWeight:800, color:'#ff8c94', fontFamily:'monospace', letterSpacing:'0.07em', marginBottom:10 }}>
            {query.toUpperCase().slice(0,24)}{query.length>24?'…':''}
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={_lbl}>Price Range</div>
            <div style={{ fontSize:16, fontFamily:'monospace', color:'#e2e8f0', fontWeight:700 }}>{budget}</div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={_lbl}>Sources</div>
            <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
              {Object.entries(SRC_COLORS).map(([src,col]) => (
                <div key={src} style={{ width:30, height:30, borderRadius:7, background:'#111',
                  border:`1px solid ${col}55`, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:900, color:col, fontFamily:'monospace' }}>
                  {src[0].toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <div style={_lbl}>Status</div>
              <div style={{ fontSize:12, fontFamily:'monospace', color:'#e63946' }}>{phase>=4?'100%':`${phase*25}%`}</div>
            </div>
            <div style={{ height:4, background:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden' }}>
              <motion.div animate={{ width:`${phase*25}%` }} transition={{ duration:0.8 }}
                style={{ height:'100%', background:'linear-gradient(90deg,#e63946,#ff8c94)', borderRadius:2 }} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

/* ── Bottom data flow bar ── */
function HiveDataBar({ phase }) {
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(()=>setTick(n=>n+1), 1000); return ()=>clearInterval(t) }, [])
  const rps   = phase>=1 ? (8000+Math.sin(tick*0.7)*2000).toFixed(0) : '0'
  const coll  = (phase*0.6+Math.sin(tick*0.3)*0.1).toFixed(1)
  const succ  = phase>=1 ? (98.5+Math.sin(tick)*1.2).toFixed(1) : '0'
  const lat   = phase>=1 ? (130+Math.sin(tick*1.1)*28).toFixed(0) : '—'
  const conns = phase>=1 ? 600+phase*60 : 0
  return (
    <div style={{ height:72, background:'rgba(4,0,0,0.97)', borderTop:'1px solid rgba(220,20,60,0.14)',
      display:'flex', alignItems:'center', padding:'0 22px', flexShrink:0, zIndex:10 }}>
      <div style={{ fontSize:11, letterSpacing:'0.14em', color:'rgba(220,20,60,0.7)', fontFamily:'monospace', fontWeight:700, marginRight:18, whiteSpace:'nowrap' }}>◈ DATA FLOW MONITOR</div>
      <LiveDot />
      {[['Requests / s', rps],['Data Collected',`${coll} TB`],['Success Rate',`${succ}%`],['Avg Response',`${lat}ms`],['Active Connections',conns]].map(([lbl,val]) => (
        <div key={lbl} style={{ flex:1, padding:'0 16px', borderLeft:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)', fontFamily:'monospace', marginBottom:3 }}>{lbl}</div>
          <div style={{ fontSize:20, fontWeight:900, fontFamily:'monospace', color:'#fff' }}>{val}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Main SpiderHive component ─────────────────────────────────────────── */
export default function SpiderHive({ progress, query, resultReady, onComplete }) {
  const { milestones, agents, phase, overallProgress, feedItems } = useHiveState(progress)

  return (
    <div style={{ position:'fixed', inset:0, background:'#080808', overflow:'hidden', display:'flex', flexDirection:'column', fontFamily:'Inter,sans-serif' }}>

      {/* Top navbar */}
      <HiveNavbar phase={phase} />

      {/* Main body row */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Left panel */}
        <HiveLeftPanel agents={agents} overallProgress={overallProgress} feedItems={feedItems} phase={phase} />

        {/* Center — canvas + overlays */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
          <HiveCanvas agents={agents} phase={phase} resultReady={resultReady} onComplete={onComplete} />

          {/* Phase label */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, calc(-50% + 110px))', textAlign:'center', pointerEvents:'none', zIndex:5 }}>
            <AnimatePresence mode="wait">
              <motion.div key={phase} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.4 }}
                style={{ fontSize:10, color:'rgba(255,120,130,0.95)', letterSpacing:'0.2em', fontFamily:'monospace', fontWeight:700 }}>
                {PHASE_LABELS[phase]}
              </motion.div>
            </AnimatePresence>
            {query && (
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:5, fontFamily:'monospace', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                "{query}"
              </div>
            )}
          </div>

          {/* Title */}
          <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2, duration:0.5 }}
            style={{ position:'absolute', top:16, left:0, right:0, textAlign:'center', pointerEvents:'none', zIndex:10 }}>
            <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.3em', color:'rgba(220,20,60,0.5)', marginBottom:3 }}>
              [ SPIDER INTELLIGENCE NETWORK ]
            </div>
            <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:900, fontSize:'clamp(1rem,2.2vw,1.4rem)', color:'#fff', letterSpacing:'0.12em' }}>
              THE SPIDER HIVE
            </div>
          </motion.div>

          {/* Red ambient glow */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
            background:'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(220,20,60,0.09) 0%, transparent 70%)' }} />
        </div>

        {/* Right panel */}
        <HiveRightPanel milestones={milestones} agents={agents} query={query} phase={phase} />
      </div>

      {/* Bottom data flow bar */}
      <HiveDataBar phase={phase} />

      {/* System status footer */}
      <div style={{ height:28, background:'rgba(4,0,0,0.98)', borderTop:'1px solid rgba(220,20,60,0.08)',
        display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', flexShrink:0 }}>
        <div style={{ fontSize:11, fontFamily:'monospace', color:'rgba(74,222,128,0.6)', letterSpacing:'0.1em' }}>● SYSTEM STATUS &nbsp; All systems operational</div>
        <div style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,255,255,0.18)' }}>RONIN v2.4.1 &nbsp; © 2024 Spider Intel Network</div>
        <div style={{ fontSize:11, fontFamily:'monospace', color:'rgba(74,222,128,0.5)' }}>● Connected to {600+phase*60} nodes &nbsp; ▲ 2.4 TB/s</div>
      </div>
    </div>
  )
}
