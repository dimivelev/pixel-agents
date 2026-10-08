#!/usr/bin/env node
const FRAME_MS = 200
const SS = 4
const TEXT = '#d0d7de'
const DIM = '#7d8590'

const SIZES = [
  { key: 's', name: 'Small', px: 16 },
  { key: 'm', name: 'Medium', px: 24 },
  { key: 'l', name: 'Large', px: 32 },
  { key: 'x', name: 'XL', px: 44 },
]

const DEMO = [
  { id: 'main', name: 'main', boss: true, offset: 0 },
  { id: 'a1', name: 'Survey skills', offset: 0 },
  { id: 'a2', name: 'Shell versions', offset: 3.5 },
  { id: 'a3', name: 'Read the mod', offset: 7 },
  { id: 'a4', name: 'Primes script', offset: 10.5 },
]
const CYCLE_S = 14
const TIMELINE = [[1.2, 'spawn', null], [4, 'read', 'Read'], [7, 'type', 'Bash'], [8.5, 'think', null], [10.5, 'type', 'Edit'], [CYCLE_S, 'done', null]]
const LABEL = { spawn: 'arriving', type: 'working', read: 'reading', think: 'thinking', delegate: 'delegating', done: 'done' }

function demoState(agent, now) {
  if (agent.boss) {
    const t = (now / 1000) % 6
    return t < 4 ? { activity: 'delegate', tool: 'Agent', age: 5 } : { activity: 'think', tool: null, age: 5 }
  }
  const t = (now / 1000 + agent.offset) % CYCLE_S
  const [, activity, tool] = TIMELINE.find(([end]) => t < end)
  return { activity, tool, age: t, sinceDone: activity === 'done' ? t - 10.5 : 0 }
}

const SHIRTS = ['#e5534b', '#57ab5a', '#539bf5', '#c69026', '#b083f0', '#39c5cf', '#f69d50', '#e275ad']
const shirtOf = (a) => (a.boss ? '#8957e5' : SHIRTS[[...a.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % SHIRTS.length])

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const scale = (c, f) => c.map((v) => v * f)
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)

function inside(s, x, y) {
  switch (s.k) {
    case 'e': {
      const nx = (x - s.cx) / s.rx, ny = (y - s.cy) / s.ry
      return nx * nx + ny * ny <= 1 ? [nx, ny] : null
    }
    case 'r': {
      if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1) return null
      const r = s.rad ?? 0
      const qx = Math.max(s.x0 + r - x, 0, x - (s.x1 - r)), qy = Math.max(s.y0 + r - y, 0, y - (s.y1 - r))
      if (qx * qx + qy * qy > r * r) return null
      return [((x - s.x0) / (s.x1 - s.x0)) * 2 - 1, ((y - s.y0) / (s.y1 - s.y0)) * 2 - 1]
    }
    case 't': {
      const [[ax, ay], [bx, by], [cx, cy]] = s.p
      const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
      const u = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / d
      const v = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / d
      return u >= 0 && v >= 0 && u + v <= 1 ? [0, v * 2 - 1] : null
    }
    case 'l': {
      const dx = s.x1 - s.x0, dy = s.y1 - s.y0
      const t = Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / (dx * dx + dy * dy || 1)))
      const px = s.x0 + t * dx - x, py = s.y0 + t * dy - y
      return px * px + py * py <= s.r * s.r ? [0, 0] : null
    }
  }
}

function shade(s, n) {
  const base = s.rgb ?? (s.rgb = rgb(s.c))
  if (!s.sh) return base
  const light = -0.45 * n[0] - 0.75 * n[1]
  return scale(base, 1 + s.sh * 0.32 * light)
}

function rasterize(shapes, px, lift = 0) {
  const out = Array.from({ length: px }, () => Array(px).fill(null))
  for (let j = 0; j < px; j++) {
    for (let i = 0; i < px; i++) {
      let sum = [0, 0, 0], hits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (i + (sx + 0.5) / SS) / px, y = (j + (sy + 0.5) / SS) / px + lift
          let col = null
          for (const s of shapes) {
            const n = inside(s, x, y)
            if (!n) continue
            const c = shade(s, n)
            col = s.a !== undefined && col ? mix(col, c, s.a) : c
          }
          if (col) { sum = sum.map((v, k) => v + col[k]); hits++ }
        }
      }
      if (hits * 2 >= SS * SS) out[j][i] = scale(sum, 1 / hits)
    }
  }
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    if (!out[j][i] || out[j][i].edge) continue
    const open = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => !out[j + dy]?.[i + dx])
    if (open) out[j][i] = Object.assign(scale(out[j][i], 0.45), { edge: true })
  }
  return out
}

const E = (cx, cy, rx, ry, c, sh = 0, a) => ({ k: 'e', cx, cy, rx, ry: ry ?? rx, c, sh, a })
const R = (x0, y0, x1, y1, c, rad = 0, sh = 0) => ({ k: 'r', x0, y0, x1, y1, c, rad, sh })
const T = (p, c, sh = 0) => ({ k: 't', p, c, sh })
const L = (x0, y0, x1, y1, r, c) => ({ k: 'l', x0, y0, x1, y1, r, c })

function poseOf(s, f) {
  const typing = s.activity === 'type' || s.activity === 'delegate'
  return {
    eye: s.activity === 'read' ? [-0.03, 0, 0.03, 0][f % 4] : 0,
    blink: s.activity !== 'read' && s.activity !== 'done' && f % 17 === 0,
    hands: typing ? (f % 2 ? [0.68, 0.75] : [0.75, 0.68]) : [0.75, 0.75],
    done: s.activity === 'done',
    think: s.activity === 'think' || s.activity === 'delegate' ? 1 + (f % 3) : 0,
    glow: typing && f % 2,
    f,
  }
}

function desk(p, glow = '#7ee787') {
  return [
    R(0.29, 0.58, 0.71, 0.84, '#9aa4b2', 0.025, 1),
    E(0.5, 0.71, 0.035, 0.035, p.glow ? '#b4f5c0' : glow),
    R(0.02, 0.82, 0.98, 0.9, '#8b5a2b', 0.015, 1),
    R(0.07, 0.9, 0.13, 1, '#5a3a1a'),
    R(0.87, 0.9, 0.93, 1, '#5a3a1a'),
  ]
}

function extras(p) {
  const out = []
  if (p.think) [[0.8, 0.14, 0.035], [0.87, 0.08, 0.045], [0.95, 0.03, 0.055]].slice(0, p.think).forEach(([x, y, r]) => out.push(E(x, y, r, r, '#f0f6fc')))
  if (p.done) out.push(L(0.8, 0.12, 0.86, 0.18, 0.025, '#3fb950'), L(0.86, 0.18, 0.96, 0.04, 0.025, '#3fb950'))
  return out
}

function crown(y = 0.06) {
  return [R(0.38, y + 0.04, 0.62, y + 0.09, '#ffd33d', 0.01, 1), T([[0.38, y + 0.05], [0.4, y - 0.02], [0.45, y + 0.05]], '#ffd33d'), T([[0.46, y + 0.05], [0.5, y - 0.03], [0.54, y + 0.05]], '#ffd33d'), T([[0.55, y + 0.05], [0.6, y - 0.02], [0.62, y + 0.05]], '#ffd33d'), E(0.5, y + 0.065, 0.015, 0.015, '#f85149')]
}

function hands(p, c, done) {
  if (done) return [L(0.28, 0.56, 0.16, 0.36, 0.05, c.arm), L(0.72, 0.56, 0.84, 0.36, 0.05, c.arm), E(0.16, 0.34, 0.055, 0.055, c.hand, 1), E(0.84, 0.34, 0.055, 0.055, c.hand, 1)]
  return [E(0.27, p.hands[0], 0.055, 0.05, c.hand, 1), E(0.73, p.hands[1], 0.055, 0.05, c.hand, 1)]
}

const CHARACTERS = {
  Office(agent, p) {
    const shirt = shirtOf(agent)
    const eyes = p.blink
      ? [L(0.41, 0.345, 0.47, 0.345, 0.012, '#1f2328'), L(0.53, 0.345, 0.59, 0.345, 0.012, '#1f2328')]
      : p.done
        ? [L(0.41, 0.35, 0.44, 0.32, 0.012, '#1f2328'), L(0.44, 0.32, 0.47, 0.35, 0.012, '#1f2328'), L(0.53, 0.35, 0.56, 0.32, 0.012, '#1f2328'), L(0.56, 0.32, 0.59, 0.35, 0.012, '#1f2328')]
        : [0.44, 0.56].flatMap((x) => [E(x + p.eye, 0.34, 0.03, 0.042, '#1f2328'), E(x + p.eye + 0.01, 0.325, 0.011, 0.011, '#ffffff')])
    return [
      R(0.22, 0.5, 0.78, 0.95, shirt, 0.12, 1),
      R(0.44, 0.47, 0.56, 0.53, '#e0ac69'),
      E(0.5, 0.32, 0.17, 0.18, '#f1c27d', 1),
      E(0.5, 0.2, 0.19, 0.12, '#4a3426', 1),
      E(0.34, 0.27, 0.035, 0.08, '#4a3426'), E(0.66, 0.27, 0.035, 0.08, '#4a3426'),
      ...eyes,
      E(0.4, 0.41, 0.03, 0.02, '#f4a29a'), E(0.6, 0.41, 0.03, 0.02, '#f4a29a'),
      L(0.47, 0.43, 0.53, 0.43, 0.009, '#9c5a3c'),
      ...(agent.boss ? crown(0.03) : []),
      ...desk(p),
      ...hands(p, { hand: '#f1c27d', arm: shirt }, p.done),
      ...extras(p),
    ]
  },
  Robot(agent, p) {
    const shirt = shirtOf(agent)
    const eyes = p.done
      ? [0.44, 0.56].flatMap((x) => [L(x - 0.03, 0.31, x, 0.27, 0.014, '#3fb950'), L(x, 0.27, x + 0.03, 0.31, 0.014, '#3fb950')])
      : [0.44, 0.56].flatMap((x) => [E(x + p.eye, 0.29, 0.045, 0.045, '#56d4dd', 0, 0.35), E(x + p.eye, 0.29, 0.028, 0.028, '#b3f0ff')])
    return [
      R(0.25, 0.5, 0.75, 0.95, shirt, 0.06, 1),
      E(0.5, 0.62, 0.04, 0.04, p.f % 4 < 2 ? '#ffd33d' : '#f69d50'),
      R(0.45, 0.44, 0.55, 0.52, '#768390'),
      L(0.5, 0.15, 0.5, 0.06, 0.028, '#768390'),
      E(0.5, 0.05, 0.035, 0.035, p.think ? (p.f % 2 ? '#f85149' : '#ffd33d') : '#768390', 1),
      R(0.31, 0.13, 0.69, 0.45, '#adbac7', 0.06, 1),
      E(0.3, 0.29, 0.03, 0.05, '#768390', 1), E(0.7, 0.29, 0.03, 0.05, '#768390', 1),
      R(0.36, 0.21, 0.64, 0.37, '#1c2128', 0.04),
      ...eyes,
      R(0.42, 0.4, 0.58, 0.42, '#768390'),
      ...(agent.boss ? crown(0.0) : []),
      ...desk(p, '#56d4dd'),
      ...hands(p, { hand: '#adbac7', arm: '#768390' }, p.done),
      ...extras(p),
    ]
  },
  Cat(agent, p) {
    const fur = '#f0a35e', light = '#fbe3c8'
    const shirt = shirtOf(agent)
    const sway = Math.sin(p.f * 0.8) * 0.06
    const tail = [0, 1, 2, 3, 4].map((i) => [0.78 + i * 0.03 + sway * (i / 4), 0.78 - i * 0.09])
    const eyes = p.done || p.blink
      ? [0.43, 0.57].flatMap((x) => [L(x - 0.03, 0.335, x, 0.31, 0.012, '#5a3a1a'), L(x, 0.31, x + 0.03, 0.335, 0.012, '#5a3a1a')])
      : [0.43, 0.57].flatMap((x) => [E(x + p.eye, 0.33, 0.035, 0.045, '#3fb950', 1), E(x + p.eye, 0.33, 0.009, 0.04, '#0d1117'), E(x + p.eye + 0.012, 0.315, 0.009, 0.009, '#ffffff')])
    return [
      ...tail.slice(1).map(([x, y], i) => L(tail[i][0], tail[i][1], x, y, 0.04, fur)),
      E(0.5, 0.7, 0.26, 0.24, fur, 1),
      R(0.37, 0.52, 0.63, 0.56, shirt, 0.02),
      E(0.5, 0.6, 0.03, 0.03, '#ffd33d', 1),
      T([[0.32, 0.25], [0.35, 0.06], [0.46, 0.18]], fur, 1), T([[0.68, 0.25], [0.65, 0.06], [0.54, 0.18]], fur, 1),
      T([[0.35, 0.21], [0.36, 0.11], [0.42, 0.18]], '#ff9eb5'), T([[0.65, 0.21], [0.64, 0.11], [0.58, 0.18]], '#ff9eb5'),
      E(0.5, 0.33, 0.2, 0.17, fur, 1),
      L(0.44, 0.19, 0.44, 0.24, 0.012, '#c47a35'), L(0.5, 0.18, 0.5, 0.24, 0.012, '#c47a35'), L(0.56, 0.19, 0.56, 0.24, 0.012, '#c47a35'),
      E(0.5, 0.41, 0.085, 0.055, light, 1),
      ...eyes,
      T([[0.475, 0.38], [0.525, 0.38], [0.5, 0.41]], '#ff7b9c'),
      ...(agent.boss ? crown(0.0) : []),
      ...desk(p),
      ...hands(p, { hand: light, arm: fur }, p.done),
      ...extras(p),
    ]
  },
  Slime(agent, p) {
    const shirt = shirtOf(agent)
    const squash = p.hands[0] !== p.hands[1] ? (p.f % 2 ? 1 : 0) : p.f % 6 === 0 ? 1 : 0
    const hop = p.done ? [0, 0.06, 0.1, 0.06][p.f % 4] : 0
    const sx = squash ? 1.12 : 1, sy = squash ? 0.86 : 1
    const top = 0.95 - 0.62 * sy - hop
    const eyes = p.done || p.blink
      ? [0.41, 0.59].flatMap((x) => [L(x - 0.035, top + 0.27, x, top + 0.23, 0.014, '#0d1117'), L(x, top + 0.23, x + 0.035, top + 0.27, 0.014, '#0d1117')])
      : [0.41, 0.59].flatMap((x) => [E(x + p.eye, top + 0.26, 0.05, 0.065, '#ffffff'), E(x + p.eye * 1.5, top + 0.27, 0.03, 0.045, '#0d1117'), E(x + p.eye * 1.5 + 0.012, top + 0.25, 0.01, 0.01, '#ffffff')])
    return [
      E(0.5, 0.97, 0.36 * sx, 0.04, '#000000', 0, 0.25),
      E(0.5, top + 0.4 * sy, 0.38 * sx, 0.4 * sy, shirt, 1.4),
      R(0.5 - 0.38 * sx, top + 0.4 * sy, 0.5 + 0.38 * sx, 0.95 - hop, shirt, 0.08, 1),
      E(0.36, top + 0.14, 0.07, 0.05, '#ffffff', 0, 0.55),
      ...eyes,
      E(0.5, top + 0.37, 0.04, p.think ? 0.015 : 0.03, '#0d1117'),
      ...(agent.boss ? crown(top - 0.1) : []),
      ...extras(p),
    ]
  },
}

class Canvas {
  constructor(cols, rows) {
    this.cols = cols
    this.rows = rows
    this.cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ch: ' ', fg: null, bg: null })))
  }
  put(x, y, ch, fg = null, bg = null) {
    if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) this.cells[y][x] = { ch, fg, bg }
  }
  text(x, y, s, fg = TEXT, width = Infinity) {
    const clipped = s.length > width ? s.slice(0, width - 1) + '…' : s
    ;[...clipped].forEach((ch, i) => this.put(x + i, y, ch, fg))
  }
  pixels(x, y, grid, map = (c) => c) {
    for (let r = 0; r < grid.length; r += 2) {
      for (let c = 0; c < grid[r].length; c++) {
        const top = grid[r][c] && hex(map(grid[r][c]))
        const bot = grid[r + 1]?.[c] && hex(map(grid[r + 1][c]))
        if (top && bot) this.put(x + c, y + r / 2, '▀', top, bot)
        else if (top) this.put(x + c, y + r / 2, '▀', top)
        else if (bot) this.put(x + c, y + r / 2, '▄', bot)
      }
    }
  }
  ansi() {
    const esc = (h) => rgb(h).join(';')
    return this.cells.map((row) => row.map(({ ch, fg, bg }) => `\x1b[0m${fg ? `\x1b[38;2;${esc(fg)}m` : ''}${bg ? `\x1b[48;2;${esc(bg)}m` : ''}${ch}`).join('') + '\x1b[0m')
  }
}

function drawCards(character, size, agents, now, f, cols) {
  const W = Math.max(16, size.px + 2)
  const H = size.px / 2 + 2
  const perLine = Math.max(1, Math.floor(cols / W))
  const c = new Canvas(Math.min(agents.length, perLine) * W, Math.ceil(agents.length / perLine) * H)
  agents.forEach((a, n) => {
    const s = demoState(a, now)
    const ox = (n % perLine) * W + Math.floor((W - size.px) / 2)
    const oy = Math.floor(n / perLine) * H
    const faded = s.activity === 'done' && s.sinceDone > 2
    const lift = s.activity === 'spawn' ? Math.max(0, 1 - s.age / 1.0) : 0
    const grid = rasterize(CHARACTERS[character](a, poseOf(s, f)), size.px, lift)
    c.pixels(ox, oy, grid, faded ? (v) => mix(v, [22, 27, 34], 0.65) : undefined)
    c.text((n % perLine) * W, oy + size.px / 2, a.name, faded ? DIM : TEXT, W - 1)
    c.text((n % perLine) * W, oy + size.px / 2 + 1, `${s.tool ? '▸' + s.tool : LABEL[s.activity]} ${Math.floor(s.age)}s`, s.activity === 'done' ? '#3fb950' : DIM, W - 1)
  })
  return c
}

const NAMES = Object.keys(CHARACTERS)
let charIdx = 0
let sizeIdx = 1
let compare = false

function render() {
  const now = Date.now()
  const f = Math.floor(now / FRAME_MS)
  const cols = (process.stdout.columns || 120) - 2
  const rows = process.stdout.rows || 40
  const tab = (label, on) => (on ? `\x1b[7m ${label} \x1b[0m` : ` ${label} `)
  const out = [
    `\x1b[1m pixel agents HD\x1b[0m  ${NAMES.map((n, i) => tab(`${i + 1} ${n}`, i === charIdx && !compare)).join('')}`,
    ` size  ${SIZES.map((s, i) => tab(`${s.key} ${s.name} ${s.px}px·${s.px / 2 + 2} rows`, i === sizeIdx)).join('')}`,
    `\x1b[2m 1-4 or ←/→ character · s m l x size · c compare all characters · q quit\x1b[0m`,
    '',
  ]
  const shown = compare ? NAMES : [NAMES[charIdx]]
  for (const name of shown) {
    if (compare) out.push(`\x1b[36m▌ ${name}\x1b[0m`)
    out.push(`\x1b[2m  ⏵⏵ bypass permissions on (shift+tab to cycle)\x1b[0m`)
    const agents = compare ? DEMO.slice(0, Math.max(1, Math.floor(cols / Math.max(16, SIZES[sizeIdx].px + 2)))) : DEMO
    out.push(...drawCards(name, SIZES[sizeIdx], agents, now, f, cols).ansi().map((l) => '  ' + l), '')
  }
  process.stdout.write('\x1b[H' + out.slice(0, rows - 1).map((l) => l + '\x1b[K').join('\n') + '\x1b[J')
}

if (process.argv.includes('--snapshot')) {
  const started = Date.now()
  for (const name of NAMES) for (const size of SIZES) for (const t of [500, 2500, 5000, 8000, 12000]) drawCards(name, size, DEMO, 1_000_000 + t, t / FRAME_MS, 200)
  console.log(`rendered ${NAMES.length * SIZES.length * 5} frames in ${Date.now() - started}ms`)
  if (process.argv.includes('--letters')) {
    const name = process.argv[process.argv.indexOf('--letters') + 1]
    const g = rasterize(CHARACTERS[name](DEMO[1], poseOf({ activity: 'read' }, 1)), 24)
    const keys = new Map()
    console.log(g.map((row) => row.map((c) => (c ? (c.edge ? '#' : (keys.has(hex(c)) || keys.set(hex(c), String.fromCharCode(97 + (keys.size % 26))), keys.get(hex(c)))) : '.')).join('')).join('\n'))
  }
  process.exit(0)
}

process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J')
const quit = () => {
  process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l')
  process.exit(0)
}
process.on('SIGINT', quit)
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
  process.stdin.on('data', (d) => {
    const k = d.toString()
    if (k === 'q' || d[0] === 3) quit()
    else if (k === 'c') compare = !compare
    else if (k === '\x1b[C') { charIdx = (charIdx + 1) % NAMES.length; compare = false }
    else if (k === '\x1b[D') { charIdx = (charIdx + NAMES.length - 1) % NAMES.length; compare = false }
    else if (/^[1-4]$/.test(k)) { charIdx = Number(k) - 1; compare = false }
    else {
      const i = SIZES.findIndex((s) => s.key === k)
      if (i >= 0) sizeIdx = i
    }
  })
}
setInterval(render, FRAME_MS)
render()
