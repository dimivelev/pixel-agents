export type Activity = 'spawn' | 'type' | 'read' | 'think' | 'delegate' | 'ask' | 'done' | 'sleep'

export type Agent = {
  id: string
  name: string
  type: string
  model?: string
  boss?: boolean
  tool?: string
  calls: number
  born: number
  endedAt?: number
  idle?: boolean
}

export const SPAWN_MS = 1_200
export const DONE_LINGER_MS = 8_000
export const CARD_COLS = 16
const SPRITE_W = 14

const BODY = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HSSSSSSH...',
  '...SSSSSSSS...',
  '...SSSSSSSS...',
  '....SSSSSS....',
  '..BBBBBBBBBB..',
  '.BBBBBBBBBBBB.',
  '.BBBKKKKKKBBB.',
  '..DDKKGGKKDD..',
  'DDDDDDDDDDDDDD',
  '.LL........LL.',
]
const CROWN = ['....Y.YY.Y....', '....YYYYYY....']
const EYES_ROW = 3
const HANDS_ROW = 9

type Pixel = [key: string, row: number, col: number]
type Bubble = 'think' | 'done' | 'sleep' | 'alert'
const BUBBLES: Record<Bubble, (f: number) => Pixel[]> = {
  think: (f) => [['W', 0, 11], ['W', 0, 12], ['W', 0, 13]].slice(0, 1 + Math.min(2, f % 4)) as Pixel[],
  done: () => [['C', 2, 11], ['C', 3, 12], ['C', 2, 13], ['C', 1, 13], ['C', 0, 13]],
  sleep: (f) => (f % 6 < 3 ? [['W', 0, 11], ['W', 0, 12], ['W', 1, 12], ['W', 2, 11], ['W', 2, 12]] : []),
  alert: (f) => (f % 2 ? [['R', 0, 12], ['R', 1, 12], ['R', 3, 12]] : []),
}

const ACTIVITY_BY_TOOL: Record<string, Activity> = {
  Edit: 'type', Write: 'type', MultiEdit: 'type', NotebookEdit: 'type', Bash: 'type', PowerShell: 'type',
  Read: 'read', Grep: 'read', Glob: 'read', WebFetch: 'read', WebSearch: 'read', ToolSearch: 'read', Skill: 'read',
  Agent: 'delegate', Task: 'delegate', AskUserQuestion: 'ask',
}

const BUBBLE_BY_ACTIVITY: Partial<Record<Activity, Bubble>> = {
  think: 'think', delegate: 'think', done: 'done', sleep: 'sleep', ask: 'alert',
}

export class Grid {
  private readonly keys: string[]
  constructor(readonly rows: number, readonly cols: number, fill = '.') {
    this.keys = Array<string>(rows * cols).fill(fill)
  }
  static from(lines: readonly string[]): Grid {
    const grid = new Grid(lines.length, SPRITE_W)
    lines.forEach((line, r) => [...line].forEach((k, c) => grid.set(r, c, k)))
    return grid
  }
  get(r: number, c: number): string {
    return this.keys[r * this.cols + c] ?? '.'
  }
  set(r: number, c: number, k: string): void {
    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.keys[r * this.cols + c] = k
  }
  paint(lines: readonly string[], top = 0): void {
    lines.forEach((line, r) => [...line].forEach((k, c) => { if (k !== '.') this.set(top + r, c, k) }))
  }
}

const SHIRTS = [0xe5534b, 0x57ab5a, 0x539bf5, 0xc69026, 0xb083f0, 0x39c5cf, 0xf69d50, 0xe275ad]
const PALETTE: Record<string, number> = {
  H: 0x3b2a1e, S: 0xf1c27d, K: 0x9aa4b2, G: 0x7ee787, D: 0x8b5a2b, L: 0x5a3a1a,
  Y: 0xffd33d, W: 0xf0f6fc, C: 0x3fb950, R: 0xf85149, E: 0x1f2328,
}
const DEFAULT = 0x01000000
const TEXT = 0xd0d7de
const DIM = 0x7d8590

export const ACTIVITY_LABEL: Record<Activity, string> = {
  spawn: 'arriving', type: 'working', read: 'reading', think: 'thinking',
  delegate: 'delegating', ask: 'asking you', done: 'done', sleep: 'idle',
}

export function activityOf(agent: Agent, now: number): Activity {
  if (agent.endedAt !== undefined) return 'done'
  if (agent.idle) return 'sleep'
  if (now - agent.born < SPAWN_MS) return 'spawn'
  if (!agent.tool) return 'think'
  return ACTIVITY_BY_TOOL[agent.tool] ?? 'type'
}

export function composeSprite(agent: Agent, activity: Activity, frame: number, now: number): Grid {
  const grid = Grid.from(BODY)
  if (agent.boss) grid.paint(CROWN)
  const eyeShift = activity === 'read' ? [-1, 0, 1, 0][frame % 4] ?? 0 : 0
  const eyesClosed = activity === 'sleep' || (activity !== 'read' && frame % 17 === 0)
  for (const col of [5, 8]) grid.set(EYES_ROW, col + eyeShift, eyesClosed ? 'H' : 'E')
  if (activity === 'type' || activity === 'delegate') {
    const left = frame % 2 === 0
    grid.set(HANDS_ROW - (left ? 1 : 0), 3, 'S')
    grid.set(HANDS_ROW - (left ? 0 : 1), 10, 'S')
    if (activity === 'type' && frame % 2) grid.set(HANDS_ROW, 6, 'W')
  } else if (activity === 'done') {
    for (const r of [4, 5, 6]) for (const c of [1, 12]) grid.set(r, c, 'S')
  } else {
    grid.set(HANDS_ROW, 3, 'S')
    grid.set(HANDS_ROW, 10, 'S')
  }
  const bubble = BUBBLE_BY_ACTIVITY[activity]
  if (bubble) for (const [k, r, c] of BUBBLES[bubble](frame)) grid.set(r, c, k)
  if (activity !== 'spawn') return grid
  const drop = Math.max(0, BODY.length - Math.floor(((now - agent.born) / SPAWN_MS) * BODY.length * 1.5))
  const dropped = new Grid(BODY.length, SPRITE_W)
  for (let r = 0; r + drop < BODY.length; r++) for (let c = 0; c < SPRITE_W; c++) dropped.set(r + drop, c, grid.get(r, c))
  dropped.paint(BODY.slice(-2), BODY.length - 2)
  return dropped
}

function shirtOf(agent: Agent): number {
  if (agent.boss) return 0x8957e5
  let h = 0
  for (const ch of agent.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SHIRTS[h % SHIRTS.length] ?? 0x539bf5
}

function fade(c: number): number {
  const m = (v: number) => Math.round(v * 0.35 + 30)
  return (m((c >> 16) & 0xff) << 16) | (m((c >> 8) & 0xff) << 8) | m(c & 0xff)
}

const clip = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '…' : s)
const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const SPRITE_ROWS = BODY.length / 2
const CARD_ROWS = SPRITE_ROWS + 2

export type Cells = { columns: number; rows: number; words: Uint32Array }

export function drawCards(agents: Agent[], now: number, frame: number, perLine: number): Cells {
  const lines = Math.max(1, Math.ceil(agents.length / perLine))
  const columns = Math.max(1, Math.min(agents.length, perLine)) * CARD_COLS
  const rows = lines * CARD_ROWS
  const words = new Uint32Array(columns * rows * 3)
  const put = (x: number, y: number, ch: string, fg: number, bg: number) => {
    const i = (y * columns + x) * 3
    words[i] = ch.charCodeAt(0)
    words[i + 1] = fg
    words[i + 2] = bg
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) put(x, y, ' ', DEFAULT, DEFAULT)

  agents.forEach((agent, n) => {
    const ox = (n % perLine) * CARD_COLS
    const oy = Math.floor(n / perLine) * CARD_ROWS
    const activity = activityOf(agent, now)
    const faded = activity === 'done' && now - (agent.endedAt ?? now) > DONE_LINGER_MS / 2
    const grid = composeSprite(agent, activity, frame, now)
    const color = (k: string): number | undefined => {
      if (k === '.') return undefined
      const c = k === 'B' ? shirtOf(agent) : PALETTE[k] ?? 0xff00ff
      return faded ? fade(c) : c
    }
    for (let r = 0; r < BODY.length; r += 2) {
      for (let c = 0; c < SPRITE_W; c++) {
        const top = color(grid.get(r, c))
        const bot = color(grid.get(r + 1, c))
        const x = ox + 1 + c
        const y = oy + r / 2
        if (top !== undefined && bot !== undefined) put(x, y, '▀', top, bot)
        else if (top !== undefined) put(x, y, '▀', top, DEFAULT)
        else if (bot !== undefined) put(x, y, '▄', bot, DEFAULT)
      }
    }
    const status = agent.tool ? `▸${agent.tool}` : ACTIVITY_LABEL[activity]
    const labels: [string, number][] = [
      [clip(agent.name, CARD_COLS - 1), faded ? DIM : TEXT],
      [clip(`${status} ${agent.calls}× ${fmtDur((agent.endedAt ?? now) - agent.born)}`, CARD_COLS - 1), DIM],
    ]
    labels.forEach(([text, fg], i) => [...text].forEach((ch, x) => put(ox + x, oy + SPRITE_ROWS + i, ch, fg, DEFAULT)))
  })
  return { columns, rows, words }
}

export function toBase64(words: Uint32Array): string {
  const bytes = new Uint8Array(words.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
