import { useEffect, useRef } from 'react'

const NODE_COUNT = 45
const CONNECT_DIST = 140
const RED = (a) => `rgba(220,20,60,${a})`

// Even distribution across canvas — concentric rings + scattered center
function generateFormation() {
  const nodes = []
  // Ring 1: tight inner circle (~15 nodes)
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
    const r = 0.12 + Math.random() * 0.10
    nodes.push({ fx: 0.5 + Math.cos(a) * r, fy: 0.5 + Math.sin(a) * r })
  }
  // Ring 2: mid circle (~15 nodes)
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
    const r = 0.20 + Math.random() * 0.15
    nodes.push({ fx: 0.5 + Math.cos(a) * r, fy: 0.5 + Math.sin(a) * r })
  }
  // Ring 3: outer circle (~15 nodes)
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + (Math.random() - 0.5) * 0.25
    const r = 0.30 + Math.random() * 0.18
    nodes.push({ fx: 0.5 + Math.cos(a) * r, fy: 0.5 + Math.sin(a) * r })
  }
  return nodes
}

export default function SignalParticles() {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    pulses: [],
    time: 0,
    formation: generateFormation(),
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const s = stateRef.current
    s.pulses = Array.from({ length: 30 }, () => ({
      t: Math.random(),
      speed: 0.008 + Math.random() * 0.018,
      active: false,
      edgeA: 0,
      edgeB: 0,
      life: 0,
      maxLife: 0.7 + Math.random() * 0.3,
    }))

    const resize = () => {
      canvas.width = canvas.parentElement?.offsetWidth || 600
      canvas.height = canvas.parentElement?.offsetHeight || 400
    }
    resize()
    window.addEventListener('resize', resize)

    let lastActivate = 0
    let rafId

    function getNodes() {
      const W = canvas.width
      const H = canvas.height
      return s.formation.map((n, i) => ({
        x: n.fx * W + Math.cos(s.time * 0.0003 + i * 0.5) * 8,
        y: n.fy * H + Math.sin(s.time * 0.00035 + i * 0.6) * 7,
      }))
    }

    function getEdges(nodes) {
      const e = []
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < CONNECT_DIST) e.push([i, j, d])
        }
      }
      return e
    }

    function draw(time) {
      s.time = time

      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const nodes = getNodes()
      const edges = getEdges(nodes)

      // Draw faint silk edges
      edges.forEach(([a, b, dist]) => {
        const na = nodes[a], nb = nodes[b]
        const alpha = Math.max(0.03, 1 - dist / CONNECT_DIST) * 0.15
        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)
        ctx.strokeStyle = RED(alpha)
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      // Track live pulses drawn this frame for smooth blending
      const livePulses = []

      // Draw signal pulses — each pulse picks a random live edge when active
      s.pulses.forEach(p => {
        if (!p.active) return

        p.t += p.speed
        if (p.t > p.maxLife) {
          p.active = false
          p.t = 0
          return
        }

        // Check if the edge still exists
        const a = p.edgeA, b = p.edgeB
        if (a >= nodes.length || b >= nodes.length) { p.active = false; return }
        const stillValid = edges.some(([ea, eb]) => (ea === a && eb === b) || (ea === b && eb === a))

        if (stillValid) {
          const na = nodes[a], nb = nodes[b]
          const px = na.x + (nb.x - na.x) * p.t
          const py = na.y + (nb.y - na.y) * p.t
          livePulses.push({ px, py, t: p.t, maxLife: p.maxLife })
        } else {
          p.active = false
        }
      })

      // Draw pulses grouped so overlapping ones blend
      livePulses.sort((a, b) => a.t - b.t)
      livePulses.forEach(p => {
        const progress = p.t / p.maxLife
        const fade = progress < 0.15 ? progress / 0.15 : progress > 0.85 ? (1 - progress) / 0.15 : 1
        const r = 3 + fade * 5

        const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r)
        g.addColorStop(0, RED((0.9 * fade).toFixed(2)))
        g.addColorStop(0.5, RED((0.4 * fade).toFixed(2)))
        g.addColorStop(1, RED('0'))
        ctx.beginPath()
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        // Bright core
        ctx.beginPath()
        ctx.arc(p.px, p.py, 1.5 * fade, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,120,130,${(0.8 * fade).toFixed(2)})`
        ctx.fill()
      })

      // Activate new pulses on random edges
      if (time - lastActivate > 60 && edges.length > 0) {
        lastActivate = time
        // Find idle pulse slot
        const idle = s.pulses.find(p => !p.active)
        if (idle) {
          const edge = edges[Math.floor(Math.random() * edges.length)]
          idle.edgeA = edge[0]
          idle.edgeB = edge[1]
          idle.t = 0
          idle.maxLife = 0.6 + Math.random() * 0.4
          idle.speed = 0.008 + Math.random() * 0.02
          idle.active = true
        }
      }

      // Draw nodes — tiny red dots with glow
      nodes.forEach(n => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 6)
        g.addColorStop(0, RED('0.45'))
        g.addColorStop(1, RED('0'))
        ctx.beginPath()
        ctx.arc(n.x, n.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = RED('0.55')
        ctx.fill()
      })

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 1,
      }}
    />
  )
}
