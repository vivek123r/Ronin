import { useEffect, useRef } from 'react'

/*
  Spider-node swarm.
  - Lives in the 280px "swarm zone" below the 6 feature cards.
  - Scroll down → swarm travels right→left across the zone.
  - Scroll up   → reverses back right.
  - Only drawn when the swarm zone is visible in the viewport.
*/

const NODE_COUNT = 18
const CONNECT_DIST = 155
const PULSE_SPEED = 0.013

// Relative positions (x: 0–1, y: 0–1) — loose web formation
const FORMATION = [
  [0.04, 0.25], [0.12, 0.55], [0.20, 0.20], [0.26, 0.65],
  [0.34, 0.35], [0.30, 0.80], [0.42, 0.55], [0.48, 0.18],
  [0.52, 0.72], [0.58, 0.40], [0.64, 0.70], [0.70, 0.22],
  [0.74, 0.58], [0.80, 0.35], [0.84, 0.75], [0.90, 0.50],
  [0.94, 0.20], [0.97, 0.65],
]

export default function SwarmFX({ zoneId = 'swarm-zone', reverse = false }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    swarmX: 0,
    targetX: 0,
    pulses: [],
    time: 0,
    zoneTop: 0,
    zoneH: 280,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = canvas.offsetWidth || window.innerWidth
      canvas.height = stateRef.current.zoneH
    }

    const findZone = () => {
      const zone = document.getElementById(zoneId)
      if (zone) stateRef.current.zoneTop = window.scrollY + zone.getBoundingClientRect().top
    }

    setTimeout(() => { findZone(); resize() }, 200)
    window.addEventListener('resize', resize)

    const s = stateRef.current

    // init pulses
    s.pulses = Array.from({ length: 14 }, (_, i) => ({
      edgeIdx: i,
      t: Math.random(),
      speed: PULSE_SPEED * (0.6 + Math.random() * 0.9),
      active: Math.random() > 0.5,
    }))

    const onScroll = () => {
      findZone()
      const scrolled = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const pct = maxScroll > 0 ? scrolled / maxScroll : 0
      // reverse=false: starts right, moves left as you scroll down
      // reverse=true:  starts left, moves right as you scroll down
      if (reverse) {
        s.targetX = canvas.width * (-0.8 + pct * 2.2)
      } else {
        s.targetX = canvas.width * (1.2 - pct * 2.2)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    let lastActivate = 0
    let rafId

    function getNodes(swarmX) {
      const W = canvas.width
      const H = canvas.height
      return FORMATION.map(([fx, fy]) => ({
        x: fx * W * 1.1 + swarmX - W * 0.05,
        y: fy * H * 0.85 + H * 0.08,
      }))
    }

    function getEdges(nodes) {
      const edges = []
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < CONNECT_DIST) edges.push([i, j])
        }
      }
      return edges
    }

    function draw(time) {
      const dt = Math.min(time - s.time, 32)
      s.time = time

      // smooth
      s.swarmX += (s.targetX - s.swarmX) * 0.055

      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // check if swarm zone is in viewport
      const zoneBottom = s.zoneTop + s.zoneH
      const vpTop = window.scrollY
      const vpBottom = window.scrollY + window.innerHeight
      const inView = zoneBottom > vpTop && s.zoneTop < vpBottom
      if (!inView) { rafId = requestAnimationFrame(draw); return }

      const nodes = getNodes(s.swarmX)
      const edges = getEdges(nodes)

      // all off-screen check
      if (nodes.every(n => n.x < -50 || n.x > W + 50)) {
        rafId = requestAnimationFrame(draw); return
      }

      // grow pulses array to match edges
      while (s.pulses.length < Math.min(edges.length, 24)) {
        s.pulses.push({ edgeIdx: s.pulses.length, t: Math.random(), speed: PULSE_SPEED * (0.6 + Math.random()), active: false })
      }

      // ── draw silk edges ──────────────────────────────────────────────
      edges.forEach(([a, b]) => {
        const na = nodes[a], nb = nodes[b]
        if ((na.x < -40 && nb.x < -40) || (na.x > W + 40 && nb.x > W + 40)) return
        const dist = Math.hypot(na.x - nb.x, na.y - nb.y)
        const alpha = Math.max(0, 1 - dist / CONNECT_DIST) * 0.22
        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)
        ctx.strokeStyle = `rgba(220,20,60,${alpha})`
        ctx.lineWidth = 0.75
        ctx.stroke()
      })

      // ── draw pulses ──────────────────────────────────────────────────
      s.pulses.forEach(p => {
        if (!p.active || p.edgeIdx >= edges.length) return
        p.t += p.speed
        if (p.t > 1) { p.t = 0; p.active = false; return }
        const [a, b] = edges[p.edgeIdx]
        const na = nodes[a], nb = nodes[b]
        const px = na.x + (nb.x - na.x) * p.t
        const py = na.y + (nb.y - na.y) * p.t
        if (px < -10 || px > W + 10) return
        const g = ctx.createRadialGradient(px, py, 0, px, py, 8)
        g.addColorStop(0, 'rgba(220,20,60,0.95)')
        g.addColorStop(1, 'rgba(220,20,60,0)')
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = '#ff8c94'; ctx.fill()
      })

      // trigger new pulses
      if (time - lastActivate > 75) {
        lastActivate = time
        const idle = s.pulses.filter(p => !p.active && p.edgeIdx < edges.length)
        if (idle.length) idle[Math.floor(Math.random() * Math.min(idle.length, 6))].active = true
      }

      // ── draw spider nodes ────────────────────────────────────────────
      nodes.forEach((n, i) => {
        if (n.x < -24 || n.x > W + 24) return

        // glow halo
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 18)
        g.addColorStop(0, 'rgba(220,20,60,0.4)')
        g.addColorStop(1, 'rgba(220,20,60,0)')
        ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()

        // animated legs — 3 pairs
        const phase = time * 0.002 + i * 1.1
        ;[[0, 50], [60, 110], [120, 170], [180, 230], [240, 290], [300, 350]].forEach(([a1, a2], li) => {
          const swing = Math.sin(phase + li) * 4
          const r1 = ((a1 + swing) * Math.PI) / 180
          const r2 = ((a2 - swing) * Math.PI) / 180
          const len = 9
          // upper leg
          ctx.beginPath()
          ctx.moveTo(n.x, n.y)
          ctx.lineTo(n.x + Math.cos(r1) * len, n.y + Math.sin(r1) * len)
          ctx.strokeStyle = 'rgba(180,10,30,0.6)'
          ctx.lineWidth = 0.9
          ctx.stroke()
        })

        // cephalothorax
        ctx.beginPath(); ctx.arc(n.x, n.y - 1, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = '#e63946'; ctx.fill()
        // abdomen
        ctx.beginPath(); ctx.arc(n.x, n.y + 3.8, 2.8, 0, Math.PI * 2)
        ctx.fillStyle = '#8b0000'; ctx.fill()
        // red hourglass mark
        ctx.beginPath()
        ctx.moveTo(n.x - 1.2, n.y + 2.5)
        ctx.lineTo(n.x + 1.2, n.y + 5)
        ctx.moveTo(n.x + 1.2, n.y + 2.5)
        ctx.lineTo(n.x - 1.2, n.y + 5)
        ctx.strokeStyle = 'rgba(255,100,100,0.7)'
        ctx.lineWidth = 0.7
        ctx.stroke()
        // eyes
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(n.x - 1.1, n.y - 1.8, 0.7, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(n.x + 1.1, n.y - 1.8, 0.7, 0, Math.PI * 2); ctx.fill()
      })

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        width: '100%',
        height: '280px',
        zIndex: 2,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
