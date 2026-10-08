import type { PlanCell } from './modules/cabinet'
import { describeExpect, type Expect } from './probe'
import type { FurniturePlan } from './modules/plan'
import type { Design } from '../design/schema'
import { DEFAULT_FINGERS } from './modules/fingerJoints'

// A ficha said in words, from its plan and its metadata: what a reader needs to understand the piece and to compare two readings of it. Nothing here is stored; it is derived, so it cannot go out of date.

export interface Explainable {
  code?: string
  version?: number
  kind?: string
  plan?: FurniturePlan
  design?: Pick<Design, 'dimensions' | 'pieces' | 'joints'>
  support?: string
  difficulty?: number
  features?: readonly string[]
  adaptations?: readonly string[]
  gaps?: readonly string[]
  expect?: Expect
}

const BASE = { kick: 'on a kick plate', floor: 'directly on the floor', legs: 'on legs' } as const
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const doorText = (cell: PlanCell) => (cell.doors && cell.doors > 1 ? `${cell.doors}-leaf door` : 'door')

/** `sliding`: the plan's doors slide, so a split `door` cell has them in front of its columns; otherwise a split cell builds only its columns. */
function cellText(cell: PlanCell, sliding: boolean): string {
  if (cell.columns) {
    const inside = `${plural(cell.columns.length, 'column')} [${cell.columns.map((c) => c.cells.map((inner) => cellText(inner, sliding)).join(', ')).join(' | ')}] (${cell.height})`
    return sliding && cell.content === 'door' ? `${doorText(cell)} in front of ${inside}` : `split into ${inside}`
  }
  const rod = cell.rod ? ', with a closet rod' : ''
  const shelves = cell.shelves ? ` with ${plural(cell.shelves, 'shelf').replace('shelfs', 'shelves')}` : ''
  const body = {
    door: doorText(cell),
    drawer: 'drawer',
    open: 'open niche',
    closed: 'closed panel',
    chest: `chest under a lift-up lid${cell.shelves ? ', its floor at mid-height' : ''}`,
    void: 'nothing built',
  }[cell.content]
  const back = cell.back === undefined ? '' : cell.back ? ', with a back' : ', no back'
  const own = Object.entries(cell.own ?? {}).map(([key, value]) => `, ${key} ${value}`).join('')
  return `${body}${cell.content === 'drawer' || cell.content === 'chest' ? '' : shelves}${rod}${back}${own} (${cell.height})`
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
    const text = `${same ? '' : `width ${column.width}, `}${column.cells.map((cell) => cellText(cell, plan.construction.doors === 'sliding')).join(', ')}`
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
    `Piece: cabinet, ${width} × ${height} × ${depth} mm, ${plan.material}, ${plan.base === 'legs' && plan.legStyle && plan.legStyle !== 'straight' ? `on ${plan.legStyle} legs` : BASE[plan.base]}, ${plan.wallMounted ? '' : 'not '}wall-mounted.`,
    `Construction: ${c.doors} doors, ${c.drawerFronts} drawer fronts, top ${c.top === 'between' ? 'between' : c.top === 'over' ? 'over' : 'over, finger-jointed to'} the sides, ${c.back === 'nailed' ? 'nailed back' : 'no back'}, ${c.shelves} shelves.`,
    ...(c.drawerCorners === 'fingers' ? [`Drawer corners: fingers, ${plan.drawerFingers ?? DEFAULT_FINGERS} per corner.`] : []),
    ...gridLines(plan),
  ]
}

/** A piece no module builds, by what it is made of: its size and its pieces by material. */
function designLines({ dimensions: d, pieces, joints }: NonNullable<Explainable['design']>): string[] {
  const byMaterial = [...new Set(pieces.map((p) => p.material))].map((m) => `${pieces.filter((p) => p.material === m).length} of ${m}`)
  return [`Piece: designed piece by piece, ${d.width} × ${d.height} × ${d.depth} mm.`, `Pieces: ${byMaterial.join(', ')}; ${plural(joints.length, 'joint')}.`, ...pieces.map((p) => `  ${p.id}: ${p.name} (${p.role})`)]
}

/** The ficha as text, in a fixed order. */
export function explain(f: Explainable): string {
  const title = [f.code && `${f.code}${f.version ? ` v${f.version}` : ''}`, f.kind].filter(Boolean).join(' · ')
  const list = (label: string, items?: readonly string[], separator = ', ') => (items ? [`${label}: ${items.length ? items.join(separator) : 'none'}`] : [])
  return [
    ...(title ? [title] : []),
    ...(f.plan ? pieceLines(f.plan) : f.design ? designLines(f.design) : []),
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
