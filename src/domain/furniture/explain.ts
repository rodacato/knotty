import type { PlanCell } from './modules/cabinet'
import { describeExpect, type Expect } from './probe'
import type { FurniturePlan } from './modules/plan'
import { DEFAULT_FINGERS } from './modules/fingerJoints'

// A ficha said in words, from its plan and its metadata: what a reader needs to understand the piece and to compare two readings of it. Nothing here is stored; it is derived, so it cannot go out of date.

export interface Explainable {
  code?: string
  version?: number
  kind?: string
  plan: FurniturePlan
  support?: string
  difficulty?: number
  features?: readonly string[]
  adaptations?: readonly string[]
  gaps?: readonly string[]
  expect?: Expect
}

const BASE = { kick: 'on a kick plate', floor: 'directly on the floor', legs: 'on legs' } as const
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function cellText(cell: PlanCell): string {
  const shelves = cell.shelves ? ` with ${plural(cell.shelves, 'shelf').replace('shelfs', 'shelves')}` : ''
  const body = {
    door: cell.doors && cell.doors > 1 ? `${cell.doors}-leaf door` : 'door',
    drawer: 'drawer',
    open: 'open niche',
    closed: 'closed panel',
    void: 'nothing built',
  }[cell.content]
  return `${body}${cell.content === 'drawer' ? '' : shelves} (${cell.height})`
}

type Cabinet = Extract<FurniturePlan, { kind: 'cabinet' }>

/** The grid, one line per run of equal columns: «Columns 2–3: door with 1 shelf (0.75), open niche (0.25)». */
function gridLines(plan: Cabinet): string[] {
  const widths = plan.columns.map((c) => c.width)
  const same = widths.every((w) => w === widths[0])
  const total = widths.reduce((s, w) => s + w, 0)
  const head = same ? `${plural(plan.columns.length, 'column')} of equal width` : `${plural(plan.columns.length, 'column')}, widths ${widths.map((w) => Math.round((w / total) * 1000) / 1000).join(' : ')}`
  const runs: { from: number; to: number; text: string }[] = []
  plan.columns.forEach((column, i) => {
    const text = `${same ? '' : `width ${column.width}, `}${column.cells.map(cellText).join(', ')}`
    const last = runs.at(-1)
    if (last && last.text === text) last.to = i + 1
    else runs.push({ from: i + 1, to: i + 1, text })
  })
  const label = (r: (typeof runs)[number]) => (r.from === r.to ? `Column ${r.from}:` : `Columns ${r.from}–${r.to}:`)
  const width = Math.max(...runs.map((r) => label(r).length))
  return [`Grid: ${head}. Cells from the bottom up:`, ...runs.map((r) => `  ${label(r).padEnd(width)} ${r.text}`)]
}

function pieceLines(plan: FurniturePlan): string[] {
  if (plan.kind !== 'cabinet') {
    const { kind, name: _name, ...rest } = plan
    return [`Piece: ${kind}.`, `Plan: ${JSON.stringify(rest)}`]
  }
  const { width, height, depth } = plan.dimensions
  const c = plan.construction
  return [
    `Piece: cabinet, ${width} × ${height} × ${depth} mm, ${plan.material}, ${BASE[plan.base]}, ${plan.wallMounted ? '' : 'not '}wall-mounted.`,
    `Construction: ${c.doors} doors, ${c.drawerFronts} drawer fronts, top ${c.top === 'between' ? 'between' : c.top === 'over' ? 'over' : 'over, finger-jointed to'} the sides, ${c.back === 'nailed' ? 'nailed back' : 'no back'}, ${c.shelves} shelves.`,
    ...(c.drawerCorners === 'fingers' ? [`Drawer corners: fingers, ${plan.drawerFingers ?? DEFAULT_FINGERS} per corner.`] : []),
    ...gridLines(plan),
  ]
}

/** The ficha as text, in a fixed order. */
export function explain(f: Explainable): string {
  const title = [f.code && `${f.code}${f.version ? ` v${f.version}` : ''}`, f.kind].filter(Boolean).join(' · ')
  const list = (label: string, items?: readonly string[], separator = ', ') => (items ? [`${label}: ${items.length ? items.join(separator) : 'none'}`] : [])
  return [
    ...(title ? [title] : []),
    ...pieceLines(f.plan),
    ...(f.support || f.difficulty ? [`Support: ${[f.support, f.difficulty && `difficulty ${f.difficulty}`].filter(Boolean).join(' · ')}`] : []),
    ...list('Features', f.features),
    ...list('Adaptations', f.adaptations, '; '),
    ...list('Gaps', f.gaps),
    ...(f.expect ? [`Engine: ${describeExpect(f.expect)}`] : []),
  ].join('\n')
}

/** The lines that are in only one of two readings, marked «-» (before) and «+» (after); empty when they say the same. */
export function linesChanged(before: string, after: string): string[] {
  const a = before.split('\n')
  const b = after.split('\n')
  return [...a.filter((l) => !b.includes(l)).map((l) => `- ${l}`), ...b.filter((l) => !a.includes(l)).map((l) => `+ ${l}`)]
}
