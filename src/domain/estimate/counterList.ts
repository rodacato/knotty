import { EDGE_SIDE } from '../design/edges'
import { faceAxes, roundTo, type Box, type Geometry } from '../design/resolve'
import type { Axis, Design, Piece } from '../design/schema'
import type { LayoutSettings } from '../materials/catalog'
import { afterCut, afterCutText } from './cutList'
import type { Purchase } from './purchase'

interface Cut {
  /** The measure along the grain; the longer side when the grain is free. */
  length: number
  width: number
  /** A measure was not whole and was taken down to the millimetre. */
  rounded: boolean
  freeGrain: boolean
  /** How many banded edges run along the length, and how many along the width. */
  banded: { long: number; short: number }
  after: string | null
}

interface CounterLine extends Cut {
  names: string[]
  ids: string[]
}

const size = (box: Box, axis: Axis) => box[`${axis}1`] - box[`${axis}0`]

function cutOf(design: Design, p: Piece, box: Box): Cut {
  const [a, b] = faceAxes(p.normal)
  const [longer, shorter] = size(box, a) >= size(box, b) ? [a, b] : [b, a]
  const [along, across] = p.grain === 'width' ? [shorter, longer] : [longer, shorter]
  const [length, width] = [along, across].map((axis) => roundTo(size(box, axis), 3))
  const facing = [...new Set(p.edges)].map((edge) => EDGE_SIDE[edge].axis)
  return {
    length: Math.floor(length),
    width: Math.floor(width),
    rounded: !Number.isInteger(length) || !Number.isInteger(width),
    freeGrain: p.grain === 'any',
    banded: { long: facing.filter((axis) => axis === across).length, short: facing.filter((axis) => axis === along).length },
    after: afterCutText(afterCut(design, { ids: [p.id] }), 1),
  }
}

const sameCut = (a: Cut, b: Cut) =>
  a.length === b.length && a.width === b.width && a.rounded === b.rounded && a.freeGrain === b.freeGrain && a.banded.long === b.banded.long && a.banded.short === b.banded.short && a.after === b.after

/** The lines of one material, largest first; pieces share a line only when the counter would cut and band them alike. */
function linesOf(design: Design, geo: Geometry, material: string): CounterLine[] {
  const lines: CounterLine[] = []
  for (const p of design.pieces) {
    const box = geo.boxes.get(p.id)
    if (p.material !== material || !box) continue
    const cut = cutOf(design, p, box)
    const line = lines.find((l) => sameCut(l, cut))
    if (line) {
      line.ids.push(p.id)
      line.names.push(p.name)
    } else lines.push({ ...cut, ids: [p.id], names: [p.name] })
  }
  return lines.sort((a, b) => b.length * b.width - a.length * a.width || b.length - a.length)
}

function consecutiveRuns(numbers: number[]): number[][] {
  const runs: number[][] = []
  for (const n of [...numbers].sort((a, b) => a - b)) {
    const run = runs.at(-1)
    if (run && n === run.at(-1)! + 1) run.push(n)
    else runs.push([n])
  }
  return runs
}

type NameToken = string | number

/** A name with its loose whole numbers apart, so names that differ in one of them can be said together; "1.2" and "1-3" stay text. */
const nameTokens = (name: string): NameToken[] => name.split(/(?<![\d.-])([1-9]\d*)(?![\d.-])/).map((part, i) => (i % 2 ? Number(part) : part))

const runText = (run: number[]) => (run.length === 1 ? run[0] : `${run[0]} ${run.length === 2 ? 'y' : 'a'} ${run.at(-1)}`)

/** The names that are equal but for the number at `slot`, said once for each run of that number. */
function mergedAt(names: NameToken[][], slot: number): NameToken[][] {
  const alike = new Map<string, NameToken[][]>()
  for (const name of names) {
    const key = JSON.stringify(typeof name[slot] === 'number' ? name.map((token, i) => (i === slot ? null : token)) : name)
    alike.set(key, [...(alike.get(key) ?? []), name])
  }
  return [...alike.values()].flatMap((group) =>
    group.length === 1 ? group : consecutiveRuns(group.map((name) => name[slot] as number)).map((run) => group[0].map((token, i) => (i === slot ? runText(run) : token))),
  )
}

/** "Repisa 1", "Repisa 2", "Repisa 3", "Zoclo" → "Repisa 1 a 3, Zoclo": every piece still named, a run of numbers said once. */
function namesText(names: string[]): string {
  let merged = [...new Set(names)].map(nameTokens)
  for (let before = Infinity; merged.length < before; ) {
    before = merged.length
    for (let slot = 1; slot < Math.max(...merged.map((name) => name.length)); slot += 2) merged = mergedAt(merged, slot)
  }
  return merged.map((name) => name.join('')).join(', ')
}

function bandingText({ long, short }: Cut['banded']): string | null {
  if (long === 2 && short === 2) return 'cubrecanto: los cuatro cantos'
  const sides = [long === 1 ? 'un largo' : long === 2 ? 'dos largos' : null, short === 1 ? 'un ancho' : short === 2 ? 'dos anchos' : null].filter((s) => s !== null)
  return sides.length ? `cubrecanto: ${sides.join(' y ')}` : null
}

function lineText(design: Design, line: CounterLine, number: number): string[] {
  const count = line.ids.length
  const grain = line.freeGrain ? 'veta libre' : line.length < line.width ? `veta a lo largo (${line.length})` : null
  const measures = `${line.length} × ${line.width}${line.rounded ? ' (redondeado)' : ''}`
  const parts = [namesText(line.names), measures, `${count} ${count === 1 ? 'pieza' : 'piezas'}`, grain, bandingText(line.banded)].filter((s) => s !== null)
  const after = afterCutText(afterCut(design, line), count)
  return [`${number}. ${parts.join(' · ')}`, ...(after ? [`   ${after}`] : [])]
}

/** The cut list as a message for the lumberyard's counter: a block per material, its pieces numbered across the whole message, the measure along the grain first. */
export function counterList(design: Design, geo: Geometry, purchase: Purchase, cut: LayoutSettings): string {
  const text = [`Lista de corte: ${design.name}`, 'Medidas en mm. El largo va con la veta.']
  let number = 0
  for (const { material, sheets } of purchase.sheets) {
    const lines = linesOf(design, geo, material.id)
    if (!lines.length) continue
    const unplaced = purchase.layout.find((l) => l.material === material.id)?.unplaced ?? []
    const named = material.name.includes(`${material.thickness} mm`) ? material.name : `${material.name} ${material.thickness} mm`
    text.push(
      '',
      `${named} · ${sheets} ${sheets === 1 ? 'hoja' : 'hojas'} de ${material.sheet.width} × ${material.sheet.length}`,
      `${cut.trim > 0 ? `Refilado ${cut.trim} mm por lado` : 'Sin refilar'} · corte ${cut.kerf} mm`,
      ...(unplaced.length ? [`No caben en una hoja: ${unplaced.map((p) => p.name).join(', ')}. Cuentan como hoja aparte.`] : []),
      '',
      ...lines.flatMap((line) => lineText(design, line, ++number)),
    )
  }
  return text.join('\n')
}
