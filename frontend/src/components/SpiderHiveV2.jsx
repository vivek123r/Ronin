import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Re-use same parseMilestone + useHiveState logic ───────────────────── */
function parseMilestone(msg) {
  const m = msg
  if (/Mode:/i.test(m)) return { agentId: 'queen', text: 'Analyzing query intent...' }
  if (/Amazon keyword:/i.test(m)) { const kw = m.replace(/.*Amazon keyword:\s*/i,'').trim(); return { agentId: 'queen', text: `Query mapped: "${kw}"` } }
  if (/Budget:/i.test(m)) { const b = m.replace(/.*Budget:\s*/i,'').trim(); return { agentId: 'queen', text: `Budget: ${b}` } }
  if (/Running Review & Price|parallel/i.test(m)) return { agentId: 'queen', text: 'Launching parallel analysis...' }
  if (/Amazon broad search/i.test(m)) return { agentId: 'hunter', text: 'Scanning Amazon candidates...' }
  if (/Price filter/i.test(m)) return { agentId: 'hunter', text: 'Applying price filter...' }
  if (/Amazon returned/i.test(m)) { const n = m.match(/(\d+) raw/); return { agentId: 'hunter', text: `Found ${n?.[1]||''} raw results` } }
  if (/Selected \d+ products/i.test(m)) { const n = m.match(/Selected (\d+)/); return { agentId: 'hunter', text: `Locked in ${n?.[1]||''} products` } }
  if (/\[Amazon sub-agent\]/i.test(m)) { const n = m.match(/(\d+) reviews/); return { agentId: 'rev_amazon', text: `Amazon: ${n?.[1]||'?'} reviews` } }
  if (/\[YouTube sub-agent\].*skipped/i.test(m)) return { agentId: 'rev_youtube', text: 'YouTube: skipped' }
  if (/\[YouTube sub-agent\]/i.test(m)) { const n = m.match(/(\d+) videos/); return { agentId: 'rev_youtube', text: `YouTube: ${n?.[1]||'?'} videos` } }
  if (/\[Reddit\] sub-agent/i.test(m)) { const n = m.match(/(\d+) posts/); return { agentId: 'rev_reddit', text: `Reddit: ${n?.[1]||'?'} posts` } }
  if (/Reviewing:/i.test(m)) { const p = m.replace(/.*Reviewing:\s*/i,'').trim().split(' ').slice(0,4).join(' '); return { agentId: 'reviewer', text: `Reviewing: ${p}...` } }
  if (/Rating:\s*\d+/i.test(m)) { const n = m.match(/Rating:\s*(\d+)/); return { agentId: 'reviewer', text: `Scored: ${n?.[1]}/100` } }
  if (/sending intelligence/i.test(m)) return { agentId: 'reviewer', text: 'Transmitting to RONIN CORE...' }
  if (/\[Review\].*products/i.test(m)) { const n = m.match(/(\d+) products/); return { agentId: 'reviewer', text: `Review complete: ${n?.[1]||''} products` } }
  if (/Pricing:/i.test(m)) { const p = m.replace(/.*Pricing:\s*/i,'').trim().split(' ').slice(0,3).join(' '); return { agentId: 'pricer', text: `Price check: ${p}` } }
  if (/₹[\d.]+\s*\(from cache\)/i.test(m)) { const p = m.match(/₹([\d.,]+)/); return { agentId: 'pricer', text: `Price: ₹${p?.[1]}` } }
  if (/Pricing complete/i.test(m)) return { agentId: 'pricer', text: 'All prices confirmed' }
  if (/Weights\s*—/i.test(m)) return { agentId: 'ranker', text: 'Calculating rankings...' }
  if (/Winner:/i.test(m)) { const p = m.replace(/.*Winner:\s*/i,'').trim().split(' ').slice(0,5).join(' '); return { agentId: 'ranker', text: `Winner: ${p}` } }
  return null
}

function useHiveState(progress) {
  const [milestones, setMilestones] = useState([])
  const [agents, setAgents] = useState(() => ({
    queen: { status: 'idle', progress: 0 },
    hunter: { status: 'idle', progress: 0 },
    reviewer: { status: 'idle', progress: 0, ratingCount: 0 },
    pricer: { status: 'idle', progress: 0 },
    ranker: { status: 'idle', progress: 0 },
    rev_amazon: { status: 'idle' }, rev_youtube: { status: 'idle' }, rev_reddit: { status: 'idle' },
  }))
  const [feedItems, setFeedItems] = useState([])
  const processedCount = useRef(0)

  useEffect(() => {
    if (progress.length <= processedCount.current) return
    const newMsgs = progress.slice(processedCount.current)
    processedCount.current = progress.length

    newMsgs.forEach(msg => {
      const milestone = parseMilestone(msg)
      if (milestone) {
        setMilestones(prev => [...prev.slice(-11), { ...milestone, id: Date.now() + Math.random() }])
      }

      // Feed items — raw SSE messages with source tagging
      const feedSource = /amazon/i.test(msg) ? 'amazon' : /reddit/i.test(msg) ? 'reddit'
        : /youtube/i.test(msg) ? 'youtube' : /flipkart/i.test(msg) ? 'flipkart'
        : /google/i.test(msg) ? 'google' : null
      if (feedSource && msg.trim()) {
        setFeedItems(prev => [...prev.slice(-19), { text: msg.trim().slice(0, 60), source: feedSource, id: Date.now() + Math.random(), ts: Date.now() }])
      }

      if (!milestone) return
      setAgents(prev => {
        const next = { ...prev }
        const aid = milestone.agentId
        if (aid === 'queen') next.queen = { ...next.queen, status: 'active', progress: Math.min(100, next.queen.progress + 20) }
        if (/Scanning|price filter/i.test(milestone.text)) next.hunter = { ...next.hunter, status: 'scanning', progress: 20 }
        if (/raw results/i.test(milestone.text)) next.hunter = { ...next.hunter, progress: 55 }
        if (/Locked in/i.test(milestone.text)) next.hunter = { ...next.hunter, status: 'done', progress: 100 }
        if (aid === 'rev_amazon') next.rev_amazon = { status: milestone.text.includes('skipped') ? 'idle' : 'done' }
        if (aid === 'rev_youtube') next.rev_youtube = { status: milestone.text.includes('skipped') ? 'idle' : 'done' }
        if (aid === 'rev_reddit') next.rev_reddit = { status: 'done' }
        if (/Reviewing:/i.test(milestone.text)) {
          next.reviewer = { ...next.reviewer, status: 'scanning', progress: Math.min(85, next.reviewer.progress + 18) }
          if (next.pricer.status === 'idle') next.pricer = { ...next.pricer, status: 'scanning', progress: 20 }
        }
        if (/Scored:/i.test(milestone.text)) {
          const rc = (next.reviewer.ratingCount || 0) + 1
          next.reviewer = { ...next.reviewer, ratingCount: rc, progress: Math.min(95, rc * 20) }
          next.pricer = { ...next.pricer, progress: Math.min(90, next.pricer.progress + 18) }
        }
        if (/Review complete/i.test(milestone.text)) {
          next.reviewer = { ...next.reviewer, status: 'done', progress: 100 }
          next.pricer = { ...next.pricer, status: 'done', progress: 100 }
          setTimeout(() => setAgents(a => ({ ...a, ranker: { ...a.ranker, status: 'scanning', progress: 40 } })), 200)
          setTimeout(() => setAgents(a => ({ ...a, ranker: { ...a.ranker, status: 'done', progress: 100 } })), 4200)
        }
        return next
      })
    })
  }, [progress.length])

  const phase = useMemo(() => {
    const a = agents
    const done = [a.hunter, a.reviewer, a.pricer, a.ranker].filter(x => x.status === 'done').length
    const active = [a.hunter, a.reviewer, a.pricer, a.ranker].filter(x => x.status !== 'idle').length
    if (done >= 4) return 4
    if (done >= 1) return 3
    if (active >= 2) return 2
    if (active >= 1 || a.queen.status !== 'idle') return 1
    return 0
  }, [agents])

  const overallProgress = useMemo(() => {
    const vals = ['hunter','reviewer','pricer','ranker'].map(k => agents[k].progress)
    return Math.round(vals.reduce((s,v) => s+v, 0) / 4)
  }, [agents])

  return { milestones, agents, phase, overallProgress, feedItems }
}

/* ─── Source node definitions (match reference image layout) ────────────── */
const SOURCE_NODES = [
  { id: 'amazon',   label: 'AMAZON',   icon: 'a', color: '#ff9900', angle: -Math.PI/2 + 0.2,   r: 280, bg: '#1a1000' },
  { id: 'reddit',   label: 'REDDIT',   icon: 'r', color: '#ff4500', angle: -Math.PI/2 + Math.PI*0.55, r: 280, bg: '#1a0800' },
  { id: 'youtube',  label: 'YOUTUBE',  icon: 'y', color: '#ff0000', angle: -Math.PI/2 - 0.2,   r: 280, bg: '#1a0000' },
  { id: 'flipkart', label: 'FLIPKART', icon: 'f', color: '#2874f0', angle: Math.PI/2 + Math.PI*0.45, r: 260, bg: '#001020' },
  { id: 'google',   label: 'GOOGLE',   icon: 'g', color: '#4285f4', angle: 0.1,                r: 275, bg: '#001020' },
  { id: 'blogs',    label: 'BLOGS',    icon: 'b', color: '#e63946', angle: Math.PI/2 + 0.3,    r: 255, bg: '#100010' },
  { id: 'forums',   label: 'FORUMS',   icon: 'fo',color: '#ff3366', angle: Math.PI/2 - 0.2,   r: 260, bg: '#10000a' },
  { id: 'techradar',label: 'TECHRADAR',icon: 't', color: '#888888', angle: Math.PI + 0.25,    r: 255, bg: '#080808' },
]

const AGENT_DEFS = [
  { id: 'hunter',  label: 'HUNTER',  sub: 'Amazon Crawler',   color: '#ff7a3d' },
  { id: 'ranker',  label: 'RANKER',  sub: 'Relevance Engine', color: '#9b1aff' },
  { id: 'reviewer',label: 'REVIEWER',sub: 'Content Analyzer', color: '#e63946' },
  { id: 'pricer',  label: 'PRICER',  sub: 'Price Tracker',    color: '#ff3366' },
]

const PHASE_LABELS = ['INITIALIZING','HUNTING PRODUCTS','DEEP ANALYSIS','CROSS-VALIDATION','SYNTHESIS']
const SOURCE_COLORS = { amazon:'#ff9900', reddit:'#ff4500', youtube:'#ff0000', flipkart:'#2874f0', google:'#4285f4' }

/* ─── Tiny spider SVG ────────────────────────────────────────────────────── */
function SpiderSVG({ size = 14, color = '#e63946' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
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

/* ─── Source icon SVG logos ──────────────────────────────────────────────── */
function SourceIcon({ id, size = 32 }) {
  const icons = {
    amazon:   <text x="50%" y="62%" textAnchor="middle" fontSize={size*0.65} fontWeight="900" fill="#ff9900" fontFamily="serif">a</text>,
    reddit:   <text x="50%" y="62%" textAnchor="middle" fontSize={size*0.6} fontWeight="900" fill="#ff4500" fontFamily="sans-serif">R</text>,
    youtube:  <polygon points="38,28 38,72 72,50" fill="#ff0000"/>,
    flipkart: <text x="50%" y="65%" textAnchor="middle" fontSize={size*0.6} fontWeight="900" fill="#2874f0" fontFamily="sans-serif">F</text>,
    google:   <text x="50%" y="65%" textAnchor="middle" fontSize={size*0.6} fontWeight="900" fill="#4285f4" fontFamily="sans-serif">G</text>,
    blogs:    <text x="50%" y="65%" textAnchor="middle" fontSize={size*0.5} fontWeight="900" fill="#e63946" fontFamily="monospace">B</text>,
    forums:   <text x="50%" y="65%" textAnchor="middle" fontSize={size*0.45} fontWeight="900" fill="#ff3366" fontFamily="monospace">F</text>,
    techradar:<text x="50%" y="65%" textAnchor="middle" fontSize={size*0.45} fontWeight="700" fill="#888" fontFamily="monospace">TR</text>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {icons[id]}
    </svg>
  )
}

/* ─── Animated canvas web ────────────────────────────────────────────────── */
function HiveWebCanvas({ agents, phase, resultReady, onComplete }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const completedRef = useRef(false)
  const resultReadyRef = useRef(resultReady)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => { resultReadyRef.current = resultReady }, [resultReady])
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (!stateRef.current) return
    const s = stateRef.current
    AGENT_DEFS.forEach(def => {
      const sp = s.spiders.find(sp => sp.id === def.id)
      if (sp) {
        sp.status = agents[def.id]?.status || 'idle'
        sp.progress = agents[def.id]?.progress || 0
      }
    })
    s.phase = phase
    // Trigger bloom on ranker done
    if (agents.ranker?.status === 'done' && !completedRef.current) {
      completedRef.current = true
      s.blooming = true
      setTimeout(() => {
        if (resultReadyRef.current) onCompleteRef.current?.()
        else {
          const poll = setInterval(() => {
            if (resultReadyRef.current) { clearInterval(poll); onCompleteRef.current?.() }
          }, 200)
        }
      }, 1200)
    }
  }, [agents, phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const setSize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    setSize()
    window.addEventListener('resize', setSize)

    const W = () => canvas.width, H = () => canvas.height
    const cx = () => W() / 2, cy = () => H() / 2

    // Build nodes
    function buildNodes() {
      const nodes = [{ id: 'queen', x: cx(), y: cy() }]
      SOURCE_NODES.forEach(sn => {
        nodes.push({ id: sn.id, x: cx() + Math.cos(sn.angle) * sn.r, y: cy() + Math.sin(sn.angle) * sn.r })
      })
      return nodes
    }

    // Spiders: one per agent, starts near queen
    const spiders = AGENT_DEFS.map((def, i) => {
      const angle = (i / AGENT_DEFS.length) * Math.PI * 2
      return {
        id: def.id, color: def.color,
        x: cx() + Math.cos(angle) * 30,
        y: cy() + Math.sin(angle) * 30,
        angle, orbitR: 25 + i * 6,
        status: 'idle', progress: 0,
        targetNodeIdx: 0,
        t: 1, fromX: cx(), fromY: cy(),
        toX: cx(), toY: cy(),
        traveling: false, returning: false,
        celebrationSpawned: false,
      }
    })

    const packets = []  // { x, y, toX, toY, t, color }
    let particles = []
    let bloomRadius = 0, blooming = false
    let time = 0

    const s = { nodes: buildNodes(), spiders, packets, particles, bloomRadius, blooming: false, phase: 0 }
    stateRef.current = s

    function drawSpider(ctx, x, y, r, t, color, status) {
      const legColor = color + 'cc'
      // glow
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
      g.addColorStop(0, color + '55'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2)
      ctx.fillStyle = g; ctx.fill()
      // legs
      ;[[-55,-125],[-25,-155],[-0,-175],[25,-20],[60,25],[100,145],[130,165],[155,135]].forEach(([a1,a2], li) => {
        const sw = Math.sin(t * 0.003 + li * 0.7) * 5
        ctx.beginPath(); ctx.moveTo(x,y)
        ctx.lineTo(x + Math.cos((a1+sw)*Math.PI/180)*r*3, y + Math.sin((a1+sw)*Math.PI/180)*r*3)
        ctx.strokeStyle = legColor; ctx.lineWidth = 0.8; ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x,y)
        ctx.lineTo(x + Math.cos((a2-sw)*Math.PI/180)*r*3, y + Math.sin((a2-sw)*Math.PI/180)*r*3)
        ctx.strokeStyle = legColor; ctx.lineWidth = 0.8; ctx.stroke()
      })
      // body
      const isDone = status === 'done'
      ctx.beginPath(); ctx.arc(x, y - r*0.3, r, 0, Math.PI*2)
      ctx.fillStyle = isDone ? '#4ade80' : color; ctx.fill()
      ctx.beginPath(); ctx.arc(x, y + r, r*0.7, 0, Math.PI*2)
      ctx.fillStyle = isDone ? '#22c55e' : '#5a0010'; ctx.fill()
      // eyes
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(x - r*0.35, y - r*0.65, r*0.25, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(x + r*0.35, y - r*0.65, r*0.25, 0, Math.PI*2); ctx.fill()
    }

    let rafId
    function draw(ts) {
      rafId = requestAnimationFrame(draw)
      const ctx = canvas.getContext('2d')
      const w = W(), h = H(), qx = cx(), qy = cy()
      const dt = Math.min(ts - time, 32); time = ts

      ctx.clearRect(0,0,w,h)
      ctx.fillStyle = '#080808'; ctx.fillRect(0,0,w,h)

      // vignette
      const vig = ctx.createRadialGradient(qx,qy,h*0.15,qx,qy,h*0.7)
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.65)')
      ctx.fillStyle = vig; ctx.fillRect(0,0,w,h)

      if (!s.nodes.length) return

      // Rebuild node positions on resize
      s.nodes[0].x = qx; s.nodes[0].y = qy
      SOURCE_NODES.forEach((sn,i) => {
        s.nodes[i+1].x = qx + Math.cos(sn.angle) * sn.r * Math.min(w,h) / 900
        s.nodes[i+1].y = qy + Math.sin(sn.angle) * sn.r * Math.min(w,h) / 900
      })

      const scale = Math.min(w, h) / 900

      // ── Web lines from queen to each source ──
      s.nodes.slice(1).forEach((n, i) => {
        const sn = SOURCE_NODES[i]
        const sp = s.spiders.find(sp => sp.status !== 'idle' && Math.hypot(sp.x - n.x, sp.y - n.y) < 120)
        const alpha = sp ? 0.55 : 0.18
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(n.x, n.y)
        ctx.strokeStyle = `rgba(220,20,60,${alpha})`; ctx.lineWidth = alpha > 0.3 ? 1.5 : 0.8; ctx.stroke()
      })

      // cross-web lines between adjacent source nodes
      for (let i = 0; i < s.nodes.length - 1; i++) {
        for (let j = i + 1; j < s.nodes.length - 1; j++) {
          const na = s.nodes[i+1], nb = s.nodes[j+1]
          const d = Math.hypot(na.x-nb.x, na.y-nb.y)
          if (d < 320 * scale) {
            ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y)
            ctx.strokeStyle = 'rgba(220,20,60,0.08)'; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }

      // ── Update + draw spiders ──
      s.spiders.forEach((sp, si) => {
        if (sp.status === 'idle') {
          sp.angle += 0.005 * (dt/16)
          sp.x = s.nodes[0].x + Math.cos(sp.angle) * sp.orbitR * scale
          sp.y = s.nodes[0].y + Math.sin(sp.angle) * sp.orbitR * scale
        } else if (sp.status === 'done') {
          const target = s.nodes[0]
          sp.x += (target.x - sp.x) * 0.03
          sp.y += (target.y - sp.y) * 0.03
          if (!sp.celebrationSpawned && Math.hypot(sp.x - target.x, sp.y - target.y) < 20 * scale) {
            sp.celebrationSpawned = true
            for (let p = 0; p < 10; p++) {
              const ang = (p/10)*Math.PI*2
              s.particles.push({ x: target.x, y: target.y, vx: Math.cos(ang)*3, vy: Math.sin(ang)*3, life: 1, color: sp.color })
            }
          }
        } else {
          // Travel to source nodes
          if (sp.t >= 1) {
            const srcIdxs = [si % SOURCE_NODES.length, (si + 3) % SOURCE_NODES.length]
            const nextIdx = srcIdxs[Math.floor((sp._visits || 0) % srcIdxs.length)] + 1
            sp._visits = (sp._visits || 0) + 1
            if (sp.traveling && !sp.returning) {
              // arrived at source → return
              s.packets.push({ x: sp.x, y: sp.y, toX: s.nodes[0].x, toY: s.nodes[0].y, t: 0, color: sp.color })
              sp.returning = true
              sp.fromX = sp.x; sp.fromY = sp.y
              sp.toX = s.nodes[0].x; sp.toY = s.nodes[0].y
              sp.t = 0
            } else {
              const tn = s.nodes[nextIdx]
              if (tn) {
                sp.traveling = true; sp.returning = false
                sp.fromX = sp.x; sp.fromY = sp.y
                sp.toX = tn.x; sp.toY = tn.y; sp.t = 0
              }
            }
          } else {
            sp.t += 0.008 * (dt/16)
            const ease = sp.t < 0.5 ? 2*sp.t*sp.t : -1+(4-2*sp.t)*sp.t
            sp.x = sp.fromX + (sp.toX - sp.fromX) * Math.min(ease,1)
            sp.y = sp.fromY + (sp.toY - sp.fromY) * Math.min(ease,1)
          }
        }
        drawSpider(ctx, sp.x, sp.y, 6 * scale, ts, sp.color, sp.status)
        ctx.font = `bold ${Math.round(8*scale)}px monospace`; ctx.textAlign = 'center'
        ctx.fillStyle = sp.status==='done' ? 'rgba(74,222,128,0.9)' : 'rgba(255,120,130,0.9)'
        ctx.fillText(sp.id.toUpperCase(), sp.x, sp.y + 20*scale)
      })

      // ── Packets (data dots) ──
      s.packets = s.packets.filter(pk => {
        pk.t += 0.025 * (dt/16)
        const t = Math.min(pk.t, 1)
        const px = pk.x + (pk.toX - pk.x) * t
        const py = pk.y + (pk.toY - pk.y) * t
        const a = t > 0.85 ? (1-t)/0.15 : 1
        ctx.beginPath(); ctx.arc(px, py, 4*scale, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,120,60,${a})`; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, 2*scale, 0, Math.PI*2)
        ctx.fillStyle = `rgba(255,255,200,${a})`; ctx.fill()
        return pk.t < 1.1
      })

      // ── Particles ──
      s.particles = s.particles.filter(p => {
        p.x+=p.vx; p.y+=p.vy; p.vx*=0.92; p.vy*=0.92; p.life-=0.025
        if (p.life<=0) return false
        const pg = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,6*scale)
        pg.addColorStop(0, p.color+Math.round(p.life*255).toString(16).padStart(2,'0'))
        pg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.beginPath(); ctx.arc(p.x,p.y,6*scale,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill()
        return true
      })

      // ── Queen spider ──
      if (s.blooming) s.bloomRadius = Math.min(Math.max(w,h), s.bloomRadius + 4*(dt/16))
      const qr = s.blooming ? Math.max(18, s.bloomRadius*0.08)*scale : (12 + (s.phase||0)*2)*scale
      const qpulse = Math.sin(ts*0.002)*0.2+0.8
      if (s.blooming && s.bloomRadius > 20) {
        const bg = ctx.createRadialGradient(qx,qy,0,qx,qy,s.bloomRadius)
        bg.addColorStop(0,`rgba(180,10,30,${0.9*Math.min(1,s.bloomRadius/Math.max(w,h))})`)
        bg.addColorStop(0.5,`rgba(80,0,15,0.5)`)
        bg.addColorStop(1,'rgba(8,0,0,0)')
        ctx.beginPath(); ctx.arc(qx,qy,s.bloomRadius,0,Math.PI*2); ctx.fillStyle=bg; ctx.fill()
      }
      const qg = ctx.createRadialGradient(qx,qy,0,qx,qy,qr*4)
      qg.addColorStop(0,`rgba(220,20,60,${0.8*qpulse})`); qg.addColorStop(1,'rgba(220,20,60,0)')
      ctx.beginPath(); ctx.arc(qx,qy,qr*4,0,Math.PI*2); ctx.fillStyle=qg; ctx.fill()
      drawSpider(ctx, qx, qy, qr, ts, '#e63946', 'active')
      if (!s.blooming) {
        ctx.font = `bold ${Math.round(9*scale)}px monospace`; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(220,20,60,0.8)'
        ctx.fillText('RONIN CORE', qx, qy + qr*3.5)
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillText('Orchestrator', qx, qy + qr*3.5 + 12*scale)
      } else {
        const bt = Math.min(1, s.bloomRadius / Math.max(w,h))
        if (bt > 0.3) {
          ctx.font = `bold ${Math.round((14+bt*8)*scale)}px monospace`; ctx.textAlign='center'
          ctx.fillStyle = `rgba(255,220,220,${bt})`
          ctx.fillText('INTELLIGENCE SYNTHESIZED', qx, qy + 30*scale)
        }
      }
    }

    rafId = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', setSize) }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}

/* ─── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status, small }) {
  const isLive = status === 'scanning' || status === 'active'
  const isDone = status === 'done'
  return (
    <motion.span
      animate={{ opacity: isLive ? [1, 0.4, 1] : 1 }}
      transition={{ duration: 1, repeat: isLive ? Infinity : 0 }}
      style={{
        fontSize: small ? 8 : 9, fontFamily: 'monospace', fontWeight: 700,
        padding: small ? '1px 5px' : '2px 7px', borderRadius: 3,
        background: isDone ? 'rgba(74,222,128,0.15)' : isLive ? 'rgba(220,20,60,0.15)' : 'rgba(255,255,255,0.04)',
        color: isDone ? '#4ade80' : isLive ? '#ff6b75' : '#475569',
        border: `1px solid ${isDone ? 'rgba(74,222,128,0.3)' : isLive ? 'rgba(220,20,60,0.3)' : 'rgba(255,255,255,0.06)'}`,
        letterSpacing: '0.08em',
      }}
    >
      {isDone ? '✓ DONE' : isLive ? '● LIVE' : 'IDLE'}
    </motion.span>
  )
}

/* ─── Left sidebar ───────────────────────────────────────────────────────── */
function LeftSidebar({ agents, overallProgress, feedItems, phase }) {
  return (
    <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0 10px 10px', overflowY: 'auto' }}>

      {/* Spider Core card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'radial-gradient(circle,#e63946,#8b0000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SpiderSVG size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', fontFamily: 'monospace' }}>SPIDER CORE</div>
            <div style={{ fontSize: 9, color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace' }}>Orchestrator Active</div>
          </div>
          <StatusBadge status="active" />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={label}>Network Health</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80', fontFamily: 'monospace' }}>{overallProgress}%</div>
        </div>
        <div>
          <div style={label}>Phase</div>
          <div style={{ fontSize: 11, color: '#ff8c94', fontFamily: 'monospace', fontWeight: 700 }}>{PHASE_LABELS[phase]}</div>
        </div>
      </div>

      {/* Active Agents */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={sectionLabel}>◈ ACTIVE AGENTS</div>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(220,20,60,0.6)' }}>
            {AGENT_DEFS.filter(d => agents[d.id]?.status !== 'idle').length} / {AGENT_DEFS.length}
          </span>
        </div>
        {AGENT_DEFS.map(def => {
          const ag = agents[def.id]
          const isLive = ag?.status === 'scanning' || ag?.status === 'active'
          const isDone = ag?.status === 'done'
          return (
            <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <SpiderSVG size={14} color={def.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? '#4ade80' : isLive ? '#fff' : '#475569', fontFamily: 'monospace', letterSpacing: '0.06em' }}>{def.label}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{def.sub}</div>
              </div>
              <StatusBadge status={ag?.status || 'idle'} small />
            </div>
          )
        })}
      </div>

      {/* Feed Stream */}
      <div style={{ ...card, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={sectionLabel}>◈ FEED STREAM</div>
          <motion.span animate={{ opacity: [1,0.3,1] }} transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 8, color: '#e63946', fontFamily: 'monospace', letterSpacing: '0.1em' }}>● LIVE</motion.span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', maxHeight: 200 }}>
          <AnimatePresence initial={false}>
            {feedItems.slice(-8).reverse().map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: SOURCE_COLORS[item.source] || '#e63946', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: i === 0 ? '#e2e8f0' : 'rgba(255,255,255,0.4)', fontFamily: 'monospace', lineHeight: 1.4 }}>{item.text.slice(0,55)}</div>
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', flexShrink: 0 }}>{Math.round((Date.now()-item.ts)/1000)}s</div>
              </motion.div>
            ))}
          </AnimatePresence>
          {feedItems.length === 0 && (
            <div style={{ fontSize: 9, color: 'rgba(220,20,60,0.35)', fontFamily: 'monospace' }}>Awaiting data stream...</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Right sidebar ──────────────────────────────────────────────────────── */
function RightSidebar({ milestones, agents, query, phase }) {
  const latest = milestones[milestones.length - 1]
  const reviewerDone = agents.reviewer?.status === 'done'
  const sentiment = reviewerDone ? 'Positive' : phase >= 2 ? 'Analyzing...' : 'Pending'
  const sentimentPct = reviewerDone ? 82 : phase >= 2 ? Math.round(30 + phase * 15) : 0

  // Extract budget from milestones
  const budgetMilestone = milestones.find(m => m.text?.startsWith('Budget:'))
  const budget = budgetMilestone?.text?.replace('Budget:', '').trim() || '—'

  return (
    <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 10px 10px 0', overflowY: 'auto' }}>

      {/* Intelligence Summary */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={sectionLabel}>◈ INTELLIGENCE SUMMARY</div>
          <motion.span animate={{ opacity: [1,0.3,1] }} transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 8, color: '#e63946', fontFamily: 'monospace' }}>● LIVE</motion.span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={label}>Overall Sentiment</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'monospace', color: sentimentPct > 60 ? '#4ade80' : '#ff8c94' }}>{sentimentPct}%</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{sentiment}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
            <motion.div animate={{ width: `${sentimentPct}%` }} transition={{ duration: 1 }}
              style={{ height: '100%', background: sentimentPct > 60 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#e63946,#ff8c94)', borderRadius: 2 }} />
          </div>
        </div>

        {/* Live milestones as pros/cons placeholder */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 6 }}>LATEST SIGNALS</div>
          {milestones.slice(-4).reverse().map((m, i) => (
            <div key={m.id} style={{ display: 'flex', gap: 5, marginBottom: 4, alignItems: 'flex-start' }}>
              <span style={{ color: i === 0 ? '#e63946' : 'rgba(220,20,60,0.4)', fontSize: 8, marginTop: 2 }}>◆</span>
              <span style={{ fontSize: 9, color: i === 0 ? '#e2e8f0' : 'rgba(255,255,255,0.35)', fontFamily: 'monospace', lineHeight: 1.4 }}>{m.text}</span>
            </div>
          ))}
          {milestones.length === 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>Awaiting signals...</div>}
        </div>

        {/* Trending keywords from query */}
        {query && (
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 6 }}>TRENDING KEYWORDS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {query.toLowerCase().split(/\s+/).filter(w => w.length > 2).map((w, i) => (
                <span key={i} style={{ fontSize: 9, fontFamily: 'monospace', color: ['#e63946','#ff9900','#4ade80','#9b1aff','#4285f4'][i%5], fontWeight: 700 }}>{w}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Target */}
      {query && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={sectionLabel}>◈ TARGET</div>
            <motion.span animate={{ opacity: [1,0.3,1] }} transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 8, color: '#e63946', fontFamily: 'monospace' }}>● LIVE</motion.span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#ff8c94', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 8 }}>
            {query.toUpperCase().slice(0, 30)}
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={label}>Price Range</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 700 }}>{budget}</div>
          </div>
          <div>
            <div style={label}>Sources</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
              {['amazon','reddit','youtube','flipkart','google'].map(src => (
                <div key={src} style={{ width: 20, height: 20, borderRadius: 4, background: '#111', border: `1px solid ${SOURCE_COLORS[src]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SourceIcon id={src} size={14} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>Status</div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#e63946' }}>{phase >= 4 ? '100%' : `${Math.round(phase * 25)}%`}</div>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${phase*25}%` }} transition={{ duration: 0.8 }}
                style={{ height: '100%', background: 'linear-gradient(90deg,#e63946,#ff8c94)', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Bottom data flow bar ───────────────────────────────────────────────── */
function DataFlowBar({ overallProgress, phase }) {
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(n => n+1), 1000); return () => clearInterval(t) }, [])
  const rps = phase >= 1 ? (8000 + Math.sin(tick*0.7)*2000).toFixed(0) : '0'
  const collected = (phase * 0.6 + Math.sin(tick*0.3)*0.1).toFixed(1)
  const success = phase >= 1 ? (98 + Math.sin(tick)*1.5).toFixed(1) : '0'
  const latency = phase >= 1 ? (120 + Math.sin(tick*1.1)*30).toFixed(0) : '—'
  const connections = phase >= 1 ? 600 + phase * 60 : 0

  return (
    <div style={{ height: 64, background: 'rgba(4,0,0,0.95)', borderTop: '1px solid rgba(220,20,60,0.15)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 0, flexShrink: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace', fontWeight: 700, marginRight: 20, whiteSpace: 'nowrap' }}>◈ DATA FLOW MONITOR</div>
      <motion.span animate={{ opacity: [1,0.3,1] }} transition={{ duration: 1.2, repeat: Infinity }}
        style={{ fontSize: 8, color: '#e63946', fontFamily: 'monospace', marginRight: 24 }}>● LIVE</motion.span>
      {[
        { label: 'Requests / s', value: rps },
        { label: 'Data Collected', value: `${collected} TB` },
        { label: 'Success Rate', value: `${success}%` },
        { label: 'Avg Response', value: `${latency}ms` },
        { label: 'Active Connections', value: connections },
      ].map(({ label, value }) => (
        <div key={label} style={{ flex: 1, padding: '0 12px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: '#fff' }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Shared styles ──────────────────────────────────────────────────────── */
const card = {
  background: 'rgba(12,0,0,0.85)',
  border: '1px solid rgba(220,20,60,0.15)',
  borderRadius: 10,
  padding: '12px 14px',
  backdropFilter: 'blur(10px)',
}
const sectionLabel = { fontSize: 9, letterSpacing: '0.2em', color: 'rgba(220,20,60,0.6)', fontFamily: 'monospace', fontWeight: 700 }
const label = { fontSize: 8, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 3 }

/* ─── Top navbar ─────────────────────────────────────────────────────────── */
function TopNav({ phase }) {
  const tabs = ['HIVE','FEED','AGENTS','ANALYTICS','TARGETS']
  return (
    <div style={{ height: 48, background: 'rgba(6,0,0,0.98)', borderBottom: '1px solid rgba(220,20,60,0.15)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 0, flexShrink: 0, zIndex: 20 }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'radial-gradient(circle,#e63946,#5a0000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SpiderSVG size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.12em', lineHeight: 1 }}>
            WEB <span style={{ color: '#e63946' }}>|</span> INTEL
          </div>
          <div style={{ fontSize: 7, color: 'rgba(220,20,60,0.5)', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
            ● NETWORK ACTIVE · {600 + phase*60} NODES
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
        {tabs.map((t, i) => (
          <div key={t} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
            letterSpacing: '0.08em', cursor: 'default',
            background: i === 0 ? 'rgba(220,20,60,0.2)' : 'transparent',
            color: i === 0 ? '#ff8c94' : 'rgba(255,255,255,0.35)',
            border: i === 0 ? '1px solid rgba(220,20,60,0.4)' : '1px solid transparent',
          }}>
            {i === 0 && <span style={{ marginRight: 5 }}>⬡</span>}
            {t}
          </div>
        ))}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>Search the web hive...</div>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>⚙</div>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>🔔</div>
        <div style={{ width: 26, height: 26, borderRadius: 50, background: 'radial-gradient(circle,#e63946,#8b0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 900 }}>R</div>
      </div>
    </div>
  )
}

/* ─── Center canvas panel with source node circles ──────────────────────── */
function CenterCanvas({ agents, phase, query, resultReady, onComplete }) {
  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 5, pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 900, fontSize: 'clamp(1rem,2vw,1.4rem)', color: '#fff', letterSpacing: '0.15em' }}>THE SPIDER HIVE</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.25em', marginTop: 2 }}>INTELLIGENCE NETWORK TOPOLOGY</div>
      </div>

      {/* Canvas */}
      <HiveWebCanvas agents={agents} phase={phase} resultReady={resultReady} onComplete={onComplete} />

      {/* Source node overlays — positioned with CSS over the canvas */}
      {SOURCE_NODES.map(sn => {
        const angle = sn.angle
        // Map to percentage positions relative to center
        const scale = 0.38
        const left = `calc(50% + ${Math.cos(angle) * sn.r * scale / 9}%)`
        // Use fixed pixel offsets based on reference proportions
        const pct_x = 50 + Math.cos(angle) * 28
        const pct_y = 50 + Math.sin(angle) * 32
        const agentActive = ['hunter','reviewer','pricer','ranker'].some(aid => {
          const ag = agents[aid]
          return (ag?.status === 'scanning' || ag?.status === 'done') && ag?.progress > 20
        })
        const isActive = agentActive && Math.random() > 0.3  // visual hint

        return (
          <div key={sn.id} style={{
            position: 'absolute',
            left: `${pct_x}%`, top: `${pct_y}%`,
            transform: 'translate(-50%,-50%)',
            zIndex: 5, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${sn.bg}, #0a0000)`,
              border: `2px solid ${sn.color}${agentActive ? 'cc' : '33'}`,
              boxShadow: agentActive ? `0 0 20px ${sn.color}44, inset 0 0 10px ${sn.color}11` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}>
              <SourceIcon id={sn.id} size={32} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#fff', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{sn.label}</div>
              <motion.div animate={{ opacity: agentActive ? [1,0.4,1] : 0.4 }} transition={{ duration: 1.2, repeat: Infinity }}
                style={{ fontSize: 7, color: sn.color, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                {agentActive ? '●LIVE' : '◯IDLE'}
              </motion.div>
            </div>
          </div>
        )
      })}

      {/* Query label at bottom of canvas */}
      {query && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>ANALYZING</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontStyle: 'italic' }}>"{query}"</div>
        </div>
      )}
    </div>
  )
}

/* ─── Main SpiderHiveV2 export ───────────────────────────────────────────── */
export default function SpiderHiveV2({ progress, query, resultReady, onComplete }) {
  const { milestones, agents, phase, overallProgress, feedItems } = useHiveState(progress)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080808', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', color: '#e2e8f0', overflow: 'hidden' }}>

      {/* Top navbar */}
      <TopNav phase={phase} />

      {/* Main body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LeftSidebar agents={agents} overallProgress={overallProgress} feedItems={feedItems} phase={phase} />
        <CenterCanvas agents={agents} phase={phase} query={query} resultReady={resultReady} onComplete={onComplete} />
        <RightSidebar milestones={milestones} agents={agents} query={query} phase={phase} />
      </div>

      {/* Bottom data flow bar */}
      <DataFlowBar overallProgress={overallProgress} phase={phase} />

      {/* System status footer */}
      <div style={{ height: 24, background: 'rgba(4,0,0,0.98)', borderTop: '1px solid rgba(220,20,60,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(74,222,128,0.6)', letterSpacing: '0.1em' }}>● SYSTEM STATUS &nbsp; All systems operational</div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.15)' }}>RONIN v2.4.1 &nbsp; © 2024 Spider Intel Network</div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(74,222,128,0.5)' }}>● Connected to {600+phase*60} nodes &nbsp; ▲ 2.4 TB/s</div>
      </div>
    </div>
  )
}
