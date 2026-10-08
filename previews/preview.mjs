#!/usr/bin/env node
const FRAME_MS = 200
const DEFAULT = null
const TEXT = '#d0d7de'
const DIM = '#7d8590'

const DEMO = [
  { id: 'main', name: 'main', boss: true, offset: 0 },
  { id: 'a1', name: 'Survey skills', offset: 0 },
  { id: 'a2', name: 'Shell versions', offset: 3.5 },
  { id: 'a3', name: 'Read the mod', offset: 7 },
  { id: 'a4', name: 'Primes script', offset: 10.5 },
]
const CYCLE_S = 14
const TIMELINE = [
  [1.2, 'spawn', null],
  [4, 'read', 'Read'],
  [7, 'type', 'Bash'],
  [8.5, 'think', null],
  [10.5, 'type', 'Edit'],
  [CYCLE_S, 'done', null],
]

function demoState(agent, now) {
  if (agent.boss) {
    const t = (now / 1000) % 6
    return t < 4 ? { activity: 'delegate', tool: 'Agent', progress: t / 6, age: 0 } : { activity: 'think', tool: null, progress: t / 6, age: 0 }
  }
  const t = (now / 1000 + agent.offset) % CYCLE_S
  const [end, activity, tool] = TIMELINE.find(([end]) => t < end)
  return { activity, tool, progress: t / CYCLE_S, age: t, sinceDone: activity === 'done' ? t - 10.5 : 0 }
}

const SHIRTS = ['#e5534b', '#57ab5a', '#539bf5', '#c69026', '#b083f0', '#39c5cf', '#f69d50', '#e275ad']
const shirtOf = (a) => (a.boss ? '#8957e5' : SHIRTS[[...a.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % SHIRTS.length])
const LABEL = { spawn: 'arriving', type: 'working', read: 'reading', think: 'thinking', delegate: 'delegating', done: 'done' }

function fade(hex) {
  const v = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.35 + 30))
  return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('')
}

class Canvas {
  constructor(cols, rows) {
    this.cols = cols
    this.rows = rows
    this.cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ ch: ' ', fg: DEFAULT, bg: DEFAULT })))
  }
  put(x, y, ch, fg = DEFAULT, bg = DEFAULT) {
    if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) this.cells[y][x] = { ch, fg, bg }
  }
  text(x, y, s, fg = TEXT, width = Infinity) {
    const clipped = s.length > width ? s.slice(0, width - 1) + '…' : s
    ;[...clipped].forEach((ch, i) => this.put(x + i, y, ch, fg))
  }
  pixels(x, y, grid, color) {
    for (let r = 0; r < grid.length; r += 2) {
      for (let c = 0; c < grid[r].length; c++) {
        const top = color(grid[r][c])
        const bot = color(grid[r + 1]?.[c] ?? '.')
        if (top && bot) this.put(x + c, y + r / 2, '▀', top, bot)
        else if (top) this.put(x + c, y + r / 2, '▀', top)
        else if (bot) this.put(x + c, y + r / 2, '▄', bot)
      }
    }
  }
  ansi() {
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(';')
    return this.cells.map((row) =>
      row.map(({ ch, fg, bg }) => `\x1b[0m${fg ? `\x1b[38;2;${rgb(fg)}m` : ''}${bg ? `\x1b[48;2;${rgb(bg)}m` : ''}${ch}`).join('') + '\x1b[0m',
    )
  }
}

const parse = (rows) => rows.map((r) => r.split(''))
const set = (g, r, c, k) => { if (g[r] && c >= 0 && c < g[r].length) g[r][c] = k }
const paint = (g, rows, top = 0) => rows.forEach((row, r) => [...row].forEach((k, c) => k !== '.' && set(g, top + r, c, k)))

function dropIn(grid, age, keepBottom) {
  const h = grid.length
  const drop = Math.max(0, h - Math.floor((age / 1.2) * h * 1.5))
  const out = [...Array.from({ length: drop }, () => Array(grid[0].length).fill('.')), ...grid].slice(0, h)
  for (let r = h - keepBottom; r < h; r++) out[r] = grid[r].slice()
  return out
}

function bubble(g, kind, f, col = 11) {
  const pix = {
    think: [['W', 0, col], ...(f % 4 > 0 ? [['W', 0, col + 1]] : []), ...(f % 4 > 1 ? [['W', 0, col + 2]] : [])],
    done: [['C', 2, col], ['C', 3, col + 1], ['C', 2, col + 2], ['C', 1, col + 2], ['C', 0, col + 2]],
  }[kind] ?? []
  for (const [k, r, c] of pix) set(g, r, c, k)
}

const BASE_PALETTE = {
  H: '#3b2a1e', S: '#f1c27d', K: '#9aa4b2', G: '#7ee787', D: '#8b5a2b', L: '#5a3a1a',
  Y: '#ffd33d', W: '#f0f6fc', C: '#3fb950', R: '#f85149', E: '#1f2328',
}

function deskSprite(body, crown, faceFn) {
  return (agent, s, f) => {
    const g = parse(body)
    if (agent.boss) paint(g, crown)
    faceFn(g, s.activity, f)
    if (s.activity === 'type' || s.activity === 'delegate') {
      const left = f % 2 === 0
      set(g, 9 - (left ? 1 : 0), 3, 'S')
      set(g, 9 - (left ? 0 : 1), 10, 'S')
    } else if (s.activity === 'done') {
      for (const r of [4, 5, 6]) for (const c of [1, 12]) set(g, r, c, 'S')
    } else {
      set(g, 9, 3, 'S')
      set(g, 9, 10, 'S')
    }
    if (s.activity === 'think' || s.activity === 'delegate') bubble(g, 'think', f)
    if (s.activity === 'done') bubble(g, 'done', f)
    return s.activity === 'spawn' ? dropIn(g, s.age, 2) : g
  }
}

const OFFICE = deskSprite(
  ['....HHHHHH....', '...HHHHHHHH...', '...HSSSSSSH...', '...SSSSSSSS...', '...SSSSSSSS...', '....SSSSSS....',
   '..BBBBBBBBBB..', '.BBBBBBBBBBBB.', '.BBBKKKKKKBBB.', '..DDKKGGKKDD..', 'DDDDDDDDDDDDDD', '.LL........LL.'],
  ['....Y.YY.Y....', '....YYYYYY....'],
  (g, a, f) => {
    const shift = a === 'read' ? [-1, 0, 1, 0][f % 4] : 0
    const closed = a !== 'read' && f % 17 === 0
    for (const c of [5, 8]) set(g, 3, c + shift, closed ? 'H' : 'E')
  },
)

const ROBOT = deskSprite(
  ['......A.......', '......M.......', '...MMMMMMMM...', '...MVVVVVVM...', '...MVVVVVVM...', '....MMMMMM....',
   '..BBBBBBBBBB..', '.BBBBBBBBBBBB.', '.BBBKKKKKKBBB.', '..DDKKGGKKDD..', 'DDDDDDDDDDDDDD', '.LL........LL.'],
  ['...Y......Y...', '...YY....YY...'],
  (g, a, f) => {
    set(g, 0, 6, a === 'think' || a === 'delegate' ? (f % 2 ? 'R' : 'Y') : 'A')
    if (a === 'done') { for (const [r, c] of [[4, 5], [3, 6], [4, 7], [3, 8]]) set(g, r, c, 'C'); return }
    const shift = a === 'read' ? [-1, 0, 1, 0][f % 4] : 0
    for (const c of [5, 8]) set(g, 3, c + shift, 'Q')
    if (a === 'type') set(g, 4, 5 + (f % 4), 'Q')
  },
)
const ROBOT_PALETTE = { ...BASE_PALETTE, M: '#adbac7', V: '#1c2128', Q: '#56d4dd', A: '#768390', S: '#adbac7' }

const CAT = (agent, s, f) => {
  const g = parse([
    '...O......O...', '...OO....OO...', '..OOOOOOOOOO..', '..OOOOOOOOOO..', '..OOOOPPOOOO..', '...OOOOOOOO...',
    '..BBBBBBBBBB..', '.BBBBBBBBBBBB.', '.BBBKKKKKKBBB.', '..DDKKGGKKDD..', 'DDDDDDDDDDDDDD', '.LL........LL.',
  ])
  if (agent.boss) paint(g, ['.....YYYY.....'])
  const shift = s.activity === 'read' ? [-1, 0, 1, 0][f % 4] : 0
  const closed = s.activity === 'done' || (s.activity !== 'read' && f % 13 === 0)
  for (const c of [4, 9]) set(g, 3, c + shift, closed ? 'O' : 'E')
  if (s.activity === 'done') for (const c of [4, 9]) set(g, 2, c, 'E')
  const tail = f % 4 < 2 ? [[7, 13], [6, 13], [5, 13]] : [[7, 13], [6, 12], [5, 12]]
  for (const [r, c] of tail) set(g, r, c, 'O')
  if (s.activity === 'type' || s.activity === 'delegate') {
    const left = f % 2 === 0
    set(g, 9 - (left ? 1 : 0), 3, 'O')
    set(g, 9 - (left ? 0 : 1), 10, 'O')
  } else {
    set(g, 9, 3, 'O')
    set(g, 9, 10, 'O')
  }
  if (s.activity === 'think' || s.activity === 'delegate') bubble(g, 'think', f, 0)
  if (s.activity === 'done') bubble(g, 'done', f, 0)
  return s.activity === 'spawn' ? dropIn(g, s.age, 2) : g
}
const CAT_PALETTE = { ...BASE_PALETTE, O: '#f0a35e', P: '#ff7b9c' }

const SLIME = (agent, s, f) => {
  const squash = s.activity === 'type' ? f % 2 : s.activity === 'read' ? (f % 4 === 0 ? 1 : 0) : s.activity === 'done' ? 0 : f % 6 === 0 ? 1 : 0
  const tall = ['....BBBBBB....', '...BBBBBBBB...', '..BBBBBBBBBB..', '..BBWBBBBWBB..', '..BBEBBBBEBB..', '.BBBBBBBBBBBB.', '.BBBBBBBBBBBB.', 'BBBBBBBBBBBBBB']
  const flat = ['..............', '...BBBBBBBB...', '.BBBBBBBBBBBB.', '.BBBWBBBBWBBB.', '.BBBEBBBBEBBB.', 'BBBBBBBBBBBBBB', 'BBBBBBBBBBBBBB', 'BBBBBBBBBBBBBB']
  const body = squash ? flat : tall
  const lift = s.activity === 'done' ? [0, 1, 2, 1][f % 4] : 0
  const g = Array.from({ length: 12 }, () => Array(14).fill('.'))
  paint(g, body, 4 - lift)
  if (agent.boss) paint(g, ['....Y.YY.Y....', '....YYYYYY....'], 2 - lift + (squash ? 1 : 0))
  if (s.activity === 'read') {
    const dir = f % 4 < 2 ? -1 : 1
    for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) if (g[r][c] === 'E' && g[r][c + dir] === 'B') { g[r][c] = 'B'; g[r][c + dir] = 'E'; c++ }
  }
  if (s.activity === 'think' || s.activity === 'delegate') bubble(g, 'think', f)
  if (s.activity === 'done') for (const [r, c] of [[0, 2], [1, 12], [2, 0], [0, 10]]) if ((f + r) % 3) set(g, r, c, 'Y')
  return s.activity === 'spawn' ? dropIn(g, s.age, 0) : g
}

function cardsLayout(sprite, palette) {
  return (agents, now, f, cols) => {
    const perLine = Math.max(1, Math.floor(cols / 16))
    const c = new Canvas(Math.min(agents.length, perLine) * 16, Math.ceil(agents.length / perLine) * 8)
    agents.forEach((a, n) => {
      const s = demoState(a, now)
      const ox = (n % perLine) * 16
      const oy = Math.floor(n / perLine) * 8
      const faded = s.activity === 'done' && s.sinceDone > 2
      const color = (k) => (k === '.' ? null : (faded ? fade : (x) => x)(k === 'B' ? shirtOf(a) : palette[k]))
      c.pixels(ox + 1, oy, sprite(a, s, f), color)
      c.text(ox, oy + 6, a.name, faded ? DIM : TEXT, 15)
      c.text(ox, oy + 7, `${s.tool ? '▸' + s.tool : LABEL[s.activity]} ${Math.floor(s.age)}s`, DIM, 15)
    })
    return c
  }
}

const MINI_BODY = ['.HHHH.', '.SSSS.', 'BBBBBB', 'BKKKKB']
function mini(agents, now, f, cols) {
  const W = 26
  const perLine = Math.max(1, Math.floor(cols / W))
  const c = new Canvas(Math.min(agents.length, perLine) * W, Math.ceil(agents.length / perLine) * 3)
  agents.forEach((a, n) => {
    const s = demoState(a, now)
    const ox = (n % perLine) * W
    const oy = Math.floor(n / perLine) * 3
    const g = parse(MINI_BODY)
    if (a.boss) paint(g, ['.Y.Y.Y'])
    const shift = s.activity === 'read' ? (f % 4 < 2 ? 0 : 1) : 0
    set(g, 1, 1 + shift, 'E')
    set(g, 1, 3 + shift, 'E')
    if (s.activity === 'type' || s.activity === 'delegate') set(g, 3, f % 2 ? 1 : 4, 'S')
    if (s.activity === 'done') { set(g, 0, 0, 'S'); set(g, 0, 5, 'S') }
    const faded = s.activity === 'done' && s.sinceDone > 2
    const color = (k) => (k === '.' ? null : (faded ? fade : (x) => x)(k === 'B' ? shirtOf(a) : BASE_PALETTE[k]))
    c.pixels(ox, oy, s.activity === 'spawn' ? dropIn(g, s.age, 0) : g, color)
    const mark = { think: ['·', '··', '···'][f % 3], delegate: ['·', '··', '···'][f % 3], done: '✓' }[s.activity] ?? ''
    c.text(ox + 7, oy, a.name, faded ? DIM : TEXT, W - 8)
    c.text(ox + 7, oy + 1, `${s.tool ? '▸' + s.tool : LABEL[s.activity]} ${mark}`, s.activity === 'done' ? '#3fb950' : DIM, W - 8)
  })
  return c
}

const WALKER = [
  ['..HHHH..', '..SESE..', '.BBBBBB.', '..BBBB..', '..L..L..', '.L....L.'],
  ['..HHHH..', '..SESE..', '.BBBBBB.', '..BBBB..', '...LL...', '...LL...'],
]
function parade(agents, now, f, cols) {
  const LABEL_W = 18
  const lane = Math.max(20, Math.min(cols, 100) - LABEL_W)
  const c = new Canvas(LABEL_W + lane, agents.length * 3)
  agents.forEach((a, n) => {
    const s = demoState(a, now)
    const oy = n * 3
    const faded = s.activity === 'done' && s.sinceDone > 2
    const done = s.activity === 'done'
    const walking = s.activity === 'type' || s.activity === 'read' || s.activity === 'delegate'
    const g = parse(WALKER[walking ? f % 2 : 1])
    if (a.boss) paint(g, ['..YYYY..'])
    if (done && f % 2) paint(g, ['S......S'], 2)
    const x = LABEL_W + Math.floor((done ? 1 : Math.min(0.95, s.progress)) * (lane - 9))
    const hop = done && f % 2 ? -1 : 0
    const color = (k) => (k === '.' ? null : (faded ? fade : (v) => v)(k === 'B' ? shirtOf(a) : BASE_PALETTE[k]))
    for (let i = LABEL_W; i < LABEL_W + lane; i++) c.put(i, oy + 2, '▁', '#30363d')
    c.put(LABEL_W + lane - 1, oy, '⚑', done ? '#3fb950' : '#30363d')
    c.pixels(x, oy + (hop < 0 ? 0 : 0), hop ? g.slice(0, 6) : g, color)
    if (s.activity === 'think') c.text(x + 8, oy, ['·', '··', '···'][f % 3], TEXT)
    c.text(0, oy, a.name, faded ? DIM : TEXT, LABEL_W - 1)
    c.text(0, oy + 1, s.tool ? '▸' + s.tool : LABEL[s.activity], done ? '#3fb950' : DIM, LABEL_W - 1)
  })
  return c
}

const VARIANTS = [
  { key: '1', name: 'Office', note: 'current: people at desks with laptops, 8 rows', draw: cardsLayout(OFFICE, BASE_PALETTE) },
  { key: '2', name: 'Robots', note: 'boxy bots, visor eyes scan, antenna blinks while thinking', draw: cardsLayout(ROBOT, ROBOT_PALETTE) },
  { key: '3', name: 'Cats', note: 'cats at laptops, tails swish, paws type', draw: cardsLayout(CAT, CAT_PALETTE) },
  { key: '4', name: 'Slimes', note: 'bouncy blobs in agent colors, squash while working', draw: cardsLayout(SLIME, BASE_PALETTE) },
  { key: '5', name: 'Mini', note: 'compact 2-row cards, fits many agents', draw: mini },
  { key: '6', name: 'Parade', note: 'walkers race to a finish flag as they progress', draw: parade },
]

let current = 0
let showAll = false

function render() {
  const now = Date.now()
  const f = Math.floor(now / FRAME_MS)
  const cols = process.stdout.columns || 100
  const rows = process.stdout.rows || 40
  const out = []
  const tabs = VARIANTS.map((v, i) => (i === current && !showAll ? `\x1b[7m ${v.key} ${v.name} \x1b[0m` : ` ${v.key} ${v.name} `)).join(' ')
  out.push(`\x1b[1m pixel agents variants\x1b[0m   ${tabs}`)
  out.push(`\x1b[2m ←/→ or 1-6 switch · a show all · q quit\x1b[0m`, '')
  const list = showAll ? VARIANTS : [VARIANTS[current]]
  for (const v of list) {
    out.push(`\x1b[36m▌ ${v.key}. ${v.name}\x1b[0m\x1b[2m  ${v.note}\x1b[0m`)
    out.push(`\x1b[2m  ⏵⏵ bypass permissions on (shift+tab to cycle)\x1b[0m`)
    out.push(...v.draw(DEMO, now, f, cols - 2).ansi().map((l) => '  ' + l), '')
  }
  process.stdout.write('\x1b[H' + out.slice(0, rows - 1).map((l) => l + '\x1b[K').join('\n') + '\x1b[J')
}

if (process.argv.includes('--snapshot')) {
  for (const v of VARIANTS) {
    console.log(`== ${v.name}`)
    for (const t of [500, 2500, 5000, 8000, 12000]) {
      const lines = v.draw(DEMO, 1_000_000 + t, Math.floor(t / FRAME_MS), 100).cells.map((r) => r.map((x) => x.ch).join('').trimEnd())
      console.log(lines.join('\n'))
    }
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
    else if (k === 'a') showAll = !showAll
    else if (k === '\x1b[C') { current = (current + 1) % VARIANTS.length; showAll = false }
    else if (k === '\x1b[D') { current = (current + VARIANTS.length - 1) % VARIANTS.length; showAll = false }
    else {
      const i = VARIANTS.findIndex((v) => v.key === k)
      if (i >= 0) { current = i; showAll = false }
    }
  })
}
setInterval(render, FRAME_MS)
render()
