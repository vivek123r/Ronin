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

  // ── Reviewer ────────────────────────────────────────────────────────────
  if (/Reviewing:/i.test(m)) {
    const prod = m.replace(/.*Reviewing:\s*/i, '').trim().split(' ').slice(0, 4).join(' ')
    return { agentId: 'reviewer', text: `Reviewing: ${prod}...` }
  }
  if (/Rating:\s*\d+/i.test(m)) {
    const n = m.match(/Rating:\s*(\d+)/)
    return { agentId: 'reviewer', text: `Intelligence scored: ${n?.[1]}/100` }
  }
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
  { id: 'reviewer', label: 'REVIEWER', color: '#e63946', angle: 0,            sourceIdxs: [1, 2] },
  { id: 'pricer',   label: 'PRICER',   color: '#ff3366', angle: Math.PI/2,    sourceIdxs: [3, 5] },
  { id: 'ranker',   label: 'RANKER',   color: '#9b1aff', angle: Math.PI,      sourceIdxs: [6, 7] },
]
const SOURCE_LABELS = ['AMAZON','REDDIT','YOUTUBE','GOOGLE','FLIPKART','BLOGS','FORUMS','TECHRADAR']
const PHASE_LABELS = ['INITIALIZING','HUNTING PRODUCTS','DEEP ANALYSIS','CROSS-VALIDATION','SYNTHESIS']
const AGENT_RING_R = 160
const SOURCE_RING_R = 310

/* ─── Hook: parse SSE progress into agent state ─────────────────────────── */
function useHiveState(progress) {
  const [milestones, setMilestones] = useState([])
  const [agents, setAgents] = useState(() => ({
    queen:    { status: 'idle', progress: 0, source: '' },
    hunter:   { status: 'idle', progress: 0, source: '' },
    reviewer: { status: 'idle', progress: 0, source: '', ratingCount: 0 },
    pricer:   { status: 'idle', progress: 0, source: '' },
    ranker:   { status: 'idle', progress: 0, source: '', _pending: false },
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

  return { milestones, agents, phase, overallProgress }
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
const AGENT_COLORS = { queen: '#ffd700', hunter: '#ff7a3d', reviewer: '#e63946', pricer: '#ff3366', ranker: '#9b1aff' }

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
    s.queenStatus = agents.queen.status
    s.phase = phase
  }, [agents, phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
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
        { label: 'AMAZON',   agentIdx: 0, spread: -0.55 },  // idx 5  (sourceIdx 0)
        // reviewer sources: REDDIT(1), YOUTUBE(2)
        { label: 'REDDIT',   agentIdx: 1, spread: -0.45 },  // idx 6  (sourceIdx 1)
        { label: 'YOUTUBE',  agentIdx: 1, spread:  0.45 },  // idx 7  (sourceIdx 2)
        // pricer sources: GOOGLE(3), BLOGS(5)
        { label: 'GOOGLE',   agentIdx: 2, spread: -0.45 },  // idx 8  (sourceIdx 3)
        { label: 'FLIPKART', agentIdx: 0, spread:  0.55 },  // idx 9  (sourceIdx 4)
        { label: 'BLOGS',    agentIdx: 2, spread:  0.45 },  // idx 10 (sourceIdx 5)
        // ranker sources: FORUMS(6), TECHRADAR(7)
        { label: 'FORUMS',   agentIdx: 3, spread: -0.45 },  // idx 11 (sourceIdx 6)
        { label: 'TECHRADAR',agentIdx: 3, spread:  0.45 },  // idx 12 (sourceIdx 7)
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
      for (let i = 5; i <= 12; i++) {
        for (let j = 13; j < nodes.length; j++) {
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
      }
    }

    const s = {
      nodes, edges: [], spiders,
      phase: 0, queenStatus: 'idle',
      queenFlash: 0, queenBloom: 0,
      bloomRadius: 14, blooming: false,
      particles: [],
      queenBodySpike: 0,
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

/* ─── Main SpiderHive component ─────────────────────────────────────────── */
export default function SpiderHive({ progress, query, resultReady, onComplete }) {
  const { milestones, agents, phase, overallProgress } = useHiveState(progress)

  const queenDef = { id: 'queen', label: 'RONIN CORE', color: '#ffd700' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080808', overflow: 'hidden' }}>

      {/* Canvas — full screen web */}
      <HiveCanvas agents={agents} phase={phase} resultReady={resultReady} onComplete={onComplete} />

      {/* Left: milestone feed */}
      <MilestoneFeed milestones={milestones} />

      {/* Right: agent status cards */}
      <motion.div
        initial={{ x: 270, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 255,
          background: 'linear-gradient(270deg, rgba(4,0,0,0.94) 72%, transparent)',
          padding: '28px 16px',
          display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center',
          zIndex: 10, pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', marginBottom: 4, fontFamily: 'monospace', fontWeight: 700 }}>
          ◈ AGENT STATUS
        </div>

        {/* Queen card */}
        <AgentCard
          def={queenDef}
          state={{ status: agents.queen.status !== 'idle' ? 'active' : 'idle', progress: overallProgress, source: '' }}
          isQueen
        />

        <div style={{ height: 1, background: 'rgba(220,20,60,0.1)', margin: '2px 0' }} />

        {/* Sub-agent cards */}
        {SUB_AGENTS.map(def => (
          <AgentCard key={def.id} def={def} state={agents[def.id]} />
        ))}
      </motion.div>

      {/* Center overlay: phase label */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, calc(-50% + 110px))',
        textAlign: 'center', pointerEvents: 'none', zIndex: 5,
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: 10, color: 'rgba(255,120,130,0.95)', letterSpacing: '0.2em', fontFamily: 'monospace', fontWeight: 700 }}
          >
            {PHASE_LABELS[phase]}
          </motion.div>
        </AnimatePresence>
        {query && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 5, fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{query}"
          </div>
        )}
      </div>

      {/* Top center: title */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{ position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', zIndex: 10 }}
      >
        <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(220,20,60,0.4)', marginBottom: 3 }}>
          [ SPIDER INTELLIGENCE NETWORK ]
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1rem,2.2vw,1.4rem)', color: '#fff', letterSpacing: '0.12em' }}>
          THE SPIDER HIVE
        </div>
      </motion.div>
    </div>
  )
}
