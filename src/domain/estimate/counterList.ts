import { EDGE_SIDE } from '../design/edges'
import { faceAxes, roundTo, type Box, type Geometry } from '../design/resolve'
import type { Axis, Design, Piece } from '../design/schema'
import type { BoardMaterial, LayoutSettings } from '../materials/catalog'
import { afterCut, afterCutText } from './cutList'
import { namesText } from './pieceNames'
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

interface Group extends Cut {
  names: string[]
  ids: string[]
}

/** One numbered line of the cut list: the boards the counter cuts and bands alike, as the message and the screen both say them. */
export interface CounterLine {
  number: number
  ids: string[]
  /** Every piece of the line, a run of numbers said once. */
  names: string
  length: number
  width: number
  count: number
  rounded: boolean
  grain: string | null
  banding: string | null
  after: string | null
}

export interface CounterBlock {
  material: BoardMaterial
  /** The material with its thickness, said once. */
  name: string
  sheets: number
  unplaced: string[]
  lines: CounterLine[]
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
function groupsOf(design: Design, geo: Geometry, material: string): Group[] {
  const lines: Group[] = []
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

function bandingText({ long, short }: Cut['banded']): string | null {
  if (long === 2 && short === 2) return 'cubrecanto: los cuatro cantos'
  const sides = [long === 1 ? 'un largo' : long === 2 ? 'dos largos' : null, short === 1 ? 'un ancho' : short === 2 ? 'dos anchos' : null].filter((s) => s !== null)
  return sides.length ? `cubrecanto: ${sides.join(' y ')}` : null
}

function lineOf(design: Design, group: Group, number: number): CounterLine {
  const count = group.ids.length
  return {
    number,
    ids: group.ids,
    names: namesText(group.names),
    length: group.length,
    width: group.width,
    count,
    rounded: group.rounded,
    grain: group.freeGrain ? 'veta libre' : group.length < group.width ? `veta a lo largo (${group.length})` : null,
    banding: bandingText(group.banded),
    after: afterCutText(afterCut(design, group), count),
  }
}

/** The cut list by what the saw does: a block per material bought, its lines numbered across the whole list, the measure along the grain first. */
export function counterLines(design: Design, geo: Geometry, purchase: Purchase): CounterBlock[] {
  let number = 0
  return purchase.sheets.flatMap(({ material, sheets }) => {
    const groups = groupsOf(design, geo, material.id)
    if (!groups.length) return []
    const unplaced = purchase.layout.find((l) => l.material === material.id)?.unplaced.map((p) => p.name) ?? []
    const name = material.name.includes(`${material.thickness} mm`) ? material.name : `${material.name} ${material.thickness} mm`
    return [{ material, name, sheets, unplaced, lines: groups.map((group) => lineOf(design, group, ++number)) }]
  })
}

function lineText(line: CounterLine): string[] {
  const measures = `${line.length} × ${line.width}${line.rounded ? ' (redondeado)' : ''}`
  const parts = [line.names, measures, `${line.count} ${line.count === 1 ? 'pieza' : 'piezas'}`, line.grain, line.banding].filter((s) => s !== null)
  return [`${line.number}. ${parts.join(' · ')}`, ...(line.after ? [`   ${line.after}`] : [])]
}

/** What the measures are and what the sheets were counted with, so the counter neither takes the blade off a piece nor trusts a count made for another saw. */
function readingNote({ trim, kerf }: LayoutSettings): string {
  const trimmed = trim > 0 ? `${trim} mm de refilado por orilla` : 'sin refilar'
  return `Medidas finales de cada pieza: el disco va aparte. Las piezas del mismo renglón, con el mismo tope. Calculé las hojas con disco de ${kerf} mm y ${trimmed}; si el suyo es distinto, avísenme.`
}

/** The cut list as a message for the lumberyard's counter: the lines of `counterLines`, in plain text. */
export function counterList(design: Design, geo: Geometry, purchase: Purchase, cut: LayoutSettings): string {
  const text = [`Lista de corte: ${design.name}`, readingNote(cut), 'Medidas en mm. El largo va con la veta.']
  for (const { material, name, sheets, unplaced, lines } of counterLines(design, geo, purchase)) {
    text.push(
      '',
      `${name} · ${sheets} ${sheets === 1 ? 'hoja' : 'hojas'} de ${material.sheet.width} × ${material.sheet.length}`,
      ...(unplaced.length ? [`No caben en una hoja: ${unplaced.join(', ')}. Cuentan como hoja aparte.`] : []),
      '',
      ...lines.flatMap(lineText),
    )
  }
  return text.join('\n')
}
