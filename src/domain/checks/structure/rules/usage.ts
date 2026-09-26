import { faceSize, roundTo } from '../../../design/resolve'
import { CONTACT_TOLERANCE, drawerGroups, freeSpan, overlap } from '../../../design/boxes'
import type { DesignKind } from '../../../design/kind'
import type { Design, Piece } from '../../../design/schema'
import type { Box, Geometry } from '../../../design/resolve'
import { hingeFor, pickHardware, type Catalog, type DoorMount, type Hardware } from '../../../materials/catalog'
import { doorMount } from '../../../design/doors'
import { useOf } from '../../typology/typology'
import type { Finding, Rule, RuleContext } from '../finding'
import { hingesFor, ASSUMPTIONS } from '../assumptions'

// How the piece of furniture is used: it must not tip over, its doors must hang, its floor must hold and its grain should run along.

/** Anchoring to the wall names the catalog's anti-tip kit, when there is one. */
export const antiTipData = (catalog: Catalog): Record<string, string> => {
  const kit = pickHardware(catalog, 'anti-tip')
  return kit ? { hardwareId: kit.id } : {}
}

/** Furniture that is not for storing things: lain, sat or worked on (its drawers are low in a long or wide piece), or hung from the wall (its own check). */
const NOT_STORAGE: readonly DesignKind[] = ['bed', 'bench', 'desk', 'table', 'diningTable', 'coffeeTable', 'sideTable', 'wallCabinet']

/** What the furniture stands on: every piece touching the floor, and whether legs are among them (posts, not a panel or a kick). */
export function standing(design: Design, geo: Geometry): { boxes: { id: string; box: Box }[]; onLegs: boolean } {
  const boxes = design.pieces.flatMap((p) => {
    const box = geo.boxes.get(p.id)
    return box && box.y0 <= CONTACT_TOLERANCE ? [{ id: p.id, box }] : []
  })
  const { footprint } = ASSUMPTIONS.legs
  return { boxes, onLegs: boxes.some(({ box }) => box.x1 - box.x0 <= footprint && box.z1 - box.z0 <= footprint) }
}

/** How deep the furniture stands: on legs, from its backmost leg to its frontmost, which a box on legs set back from its edges makes shallower than the box. */
function footprintDepth({ design, geo }: RuleContext): number {
  const { boxes, onLegs } = standing(design, geo)
  if (!onLegs) return design.dimensions.depth
  return Math.max(...boxes.map(({ box }) => box.z1)) - Math.min(...boxes.map(({ box }) => box.z0))
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * R4, storage: drawers or doors open and full, or a child climbing them, pull the furniture forward whatever its depth.
 * Found by what it has (drawers, doors) and how tall it is, not by its name. Null when it is not storage furniture.
 */
function storageTipping({ design, catalog }: RuleContext): Finding[] | null {
  const { height } = design.dimensions
  const { storageHeight } = ASSUMPTIONS.tipping
  const drawers = drawerGroups(design).length
  const doors = design.pieces.filter((p) => p.role === 'door').length
  const use = useOf(design)
  if ((!drawers && !doors) || height < storageHeight || (use && NOT_STORAGE.includes(use))) return null
  if (design.wallAnchored) return []
  const parts = [drawers && plural(drawers, 'cajón', 'cajones'), doors && plural(doors, 'puerta', 'puertas')].filter(Boolean).join(' y ')
  return [
    {
      code: 'R4_TIPPING',
      severity: 'critical',
      check: 'tipping.storage',
      pieces: design.pieces.filter((p) => p.role === 'side').map((p) => p.id),
      message: `Mide ${height} mm de alto y tiene ${parts}: abierto y cargado, o si un niño se sube, se va de frente. Desde ${storageHeight} mm, un mueble con cajones o puertas va anclado al muro.`,
      data: { height: height, drawers: drawers, doors: doors, min: storageHeight },
      alternatives: [{ key: 'anchor-to-wall', description: 'Anclarlo al muro con un kit antivuelco', data: antiTipData(catalog) }],
    },
  ]
}

/** R4, open furniture: tall and shallow, it falls forward when pulled or when a child climbs it. On legs, what counts is how deep the legs stand. */
function ratioTipping(ctx: RuleContext): Finding[] {
  const { design, catalog } = ctx
  const { height } = design.dimensions
  const depth = roundTo(footprintDepth(ctx), 0)
  const ratio = height / depth
  const { recommendedRatio, criticalRatio, criticalHeight } = ASSUMPTIONS.tipping
  if (design.wallAnchored || ratio < recommendedRatio) return []
  const critical = height > criticalHeight && ratio >= criticalRatio
  return [
    {
      code: 'R4_TIPPING',
      severity: critical ? 'critical' : 'recommendation',
      pieces: design.pieces.filter((p) => p.role === 'side').map((p) => p.id),
      message: `Mide ${height} mm de alto y ${depth < design.dimensions.depth ? `sus patas se apoyan en solo ${depth} mm` : `solo ${depth}`} de fondo (${roundTo(ratio)} a 1): se puede ir de frente si no va anclado al muro.`,
      data: { height: height, depth: depth, ratio: roundTo(ratio) },
      alternatives: [
        { key: 'anchor-to-wall', description: 'Anclarlo al muro con un kit antivuelco', data: antiTipData(catalog) },
        // What the legs lose to their setback, the box has to gain.
        { key: 'deeper', description: `Darle al menos ${deeper(height, design.dimensions.depth - depth)} mm de fondo`, data: { depth: deeper(height, design.dimensions.depth - depth) } },
      ],
    },
  ]
}

const deeper = (height: number, setback: number) => Math.ceil((height / ASSUMPTIONS.tipping.recommendedRatio + setback) / 10) * 10

/** R4: furniture that can fall forward goes anchored to the wall. */
export const tippingRule: Rule = (ctx) => storageTipping(ctx) ?? ratioTipping(ctx)

/** How a door sits, as the person reads it next to the hinge it takes. */
const MOUNT_TEXT: Record<DoorMount, string> = {
  overlay: 'sobrepuesta, tapando todo el canto',
  'half-overlay': 'sobrepuesta a medio canto, compartiéndolo con otra puerta',
  inset: 'embutida dentro del hueco',
}

/** R6, hinge: a straight, cranked or super-cranked hinge puts the door where that arm says; on a door that sits otherwise it does not close in place. */
function hingeMount({ design, geo, catalog }: RuleContext, door: Piece): Finding[] {
  const box = geo.boxes.get(door.id)!
  return design.joints
    .filter((u) => u.type === 'cup-hinge' && (u.a === door.id || u.b === door.id))
    .flatMap((u): Finding[] => {
      const upright = u.a === door.id ? u.b : u.a
      const uprightBox = geo.boxes.get(upright)
      const mount = uprightBox && doorMount(box, uprightBox)
      const wrong = u.hardware.map((h) => catalog.hardware.find((x) => x.id === h.hardwareId)).find((h): h is Hardware & { mount: DoorMount } => h?.role === 'hinge' && !!h.mount && h.mount !== mount)
      if (!mount || !wrong) return []
      const right = hingeFor(catalog, mount)
      return [
        {
          code: 'R6_DOORS',
          // Inset against overlay the door does not even fit its opening; straight against cranked it rubs the door beside it or leaves a gap.
          severity: mount === 'inset' || wrong.mount === 'inset' ? 'critical' : 'recommendation',
          pieces: [door.id, upright],
          check: 'door.hinge-mount',
          message: `${door.name} va ${MOUNT_TEXT[mount]}, y lleva ${wrong.name.toLowerCase()}, que es para una puerta ${MOUNT_TEXT[wrong.mount]}: así no cierra en su lugar.`,
          data: { joint: u.id, mount: mount, hinge: wrong.id },
          alternatives: right ? [{ key: 'matching-hinge', description: `Usar ${right.name.toLowerCase()}`, data: { joint: u.id, hardwareId: right.id } }] : [],
        },
      ]
    })
}

/** R6: hinges by the height of the door and for how it sits, and doors too wide for a single leaf. */
export const doorRule: Rule = (ctx) => {
  const { design, geo } = ctx
  return design.pieces
    .filter((p) => p.role === 'door')
    .flatMap((p): Finding[] => {
      const box = geo.boxes.get(p.id)
      if (!box) return []
      const height = box.y1 - box.y0
      const width = box.x1 - box.x0
      const found: Finding[] = []
      const hinges = design.joints.filter((u) => u.type === 'cup-hinge' && (u.a === p.id || u.b === p.id))
      const fitted = hinges.reduce((n, u) => n + u.hardware.reduce((m, h) => m + (h.count ?? hingesFor(height)), 0), 0)
      const needed = hingesFor(height)
      if (hinges.length && fitted < needed)
        found.push({
          code: 'R6_DOORS',
          severity: needed - fitted >= 2 ? 'critical' : 'recommendation',
          pieces: [p.id],
          check: 'door.hinges',
          message: `${p.name} mide ${Math.round(height)} mm de alto y lleva ${fitted} bisagras; con esa altura van ${needed} para que no se descuelgue.`,
          data: { height: Math.round(height), fitted: fitted, needed: needed },
          alternatives: [{ key: 'more-hinges', description: `Poner ${needed} bisagras`, data: { count: needed } }],
        })
      if (width > ASSUMPTIONS.doors.maxWidth)
        found.push({
          code: 'R6_DOORS',
          severity: 'recommendation',
          pieces: [p.id],
          check: 'door.width',
          message: `${p.name} mide ${Math.round(width)} mm de ancho: una hoja tan ancha pesa en las bisagras y estorba al abrir.`,
          data: { width: Math.round(width), max: ASSUMPTIONS.doors.maxWidth },
          alternatives: [{ key: 'two-doors', description: 'Dividirla en dos puertas', data: { doors: 2 } }],
        })
      return [...found, ...hingeMount(ctx, p)]
    })
}

/** R7, legs: two legs too far apart along the width leave the frame and the bottom carrying the middle; past the reference's width, legs go in between. */
function legSpan(ctx: RuleContext): Finding[] {
  const { boxes, onLegs } = standing(ctx.design, ctx.geo)
  if (!onLegs) return []
  // What stands on the floor, as runs along the width: two layers of a leg, or a front leg and its back one, are one.
  const runs = boxes
    .map(({ box }) => [box.x0, box.x1] as [number, number])
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((all, [x0, x1]) => {
      const last = all.at(-1)
      if (last && x0 <= last[1] + CONTACT_TOLERANCE) last[1] = Math.max(last[1], x1)
      else all.push([x0, x1])
      return all
    }, [])
  const { maxSpan } = ASSUMPTIONS.legs
  return runs.slice(1).flatMap(([x0], i): Finding[] => {
    const from = runs[i][1]
    const gap = x0 - from
    if (gap <= maxSpan) return []
    // What rests on them over the gap: the lowest horizontal piece that crosses it, usually the bottom.
    const over = ctx.design.pieces
      .filter((p) => p.normal === 'y')
      .map((p) => ({ p, box: ctx.geo.boxes.get(p.id) }))
      .filter((x): x is { p: Piece; box: Box } => !!x.box && x.box.x0 <= from && x.box.x1 >= x0)
      .sort((a, b) => a.box.y0 - b.box.y0)[0]
    return [
      {
        code: 'R7_BASE',
        severity: 'recommendation',
        check: 'base.legs',
        pieces: over ? [over.p.id] : [],
        message: `Entre dos patas quedan ${roundTo(gap, 0)} mm: el mueble carga en medio y la base se vence. Pasando de ${maxSpan} mm, lleva patas intermedias.`,
        data: { span: roundTo(gap, 0), max: maxSpan },
        alternatives: [{ key: 'center-support', description: 'Agregar un apoyo al centro, debajo del piso', data: {} }],
      },
    ]
  })
}

/** R7, floor: one that rests neither on the ground nor on a full kick needs support in between over a long span. */
const floorSpan: Rule = (ctx) =>
  ctx.design.pieces
    .filter((p) => p.role === 'bottom' && p.normal === 'y')
    .flatMap((p): Finding[] => {
      const box = ctx.geo.boxes.get(p.id)
      if (!box || box.y0 <= CONTACT_TOLERANCE) return []
      const length = box.x1 - box.x0
      const restsOnARun = ctx.contacts.some((c) => {
        if (c.a !== p.id && c.b !== p.id) return false
        const other = ctx.geo.boxes.get(c.a === p.id ? c.b : c.a)!
        return Math.abs(other.y1 - box.y0) <= CONTACT_TOLERANCE && overlap(other, box, 'x') >= length * ASSUMPTIONS.floorRunShare
      })
      const span = freeSpan(p.id, box, ctx)
      if (restsOnARun || !span || span <= ASSUMPTIONS.floorSpan) return []
      return [
        {
          code: 'R7_BASE',
          severity: 'recommendation',
          pieces: [p.id],
          message: `${p.name} cruza ${roundTo(span, 0)} mm sin nada debajo: con peso encima tiende a vencerse.`,
          data: { span: roundTo(span, 0), max: ASSUMPTIONS.floorSpan },
          alternatives: [
            { key: 'center-support', description: 'Agregar un apoyo al centro, debajo del piso', data: {} },
            { key: 'kick', description: 'Agregar un zoclo corrido al frente', data: {} },
          ],
        },
      ]
    })

/** R7: a floor that rests neither on the ground nor on a full kick needs support in between over a long span; legs, one every so often. */
export const baseRule: Rule = (ctx) => [...floorSpan(ctx), ...legSpan(ctx)]

const GRAIN_SHOWS = new Set(['side', 'shelf', 'bottom', 'top', 'divider', 'door'])

/** R8: grain across a long piece looks odd and makes it less stiff. */
export const grainRule: Rule = ({ design, geo }) =>
  design.pieces.flatMap((p): Finding[] => {
    const box = geo.boxes.get(p.id)
    if (!box || p.grain !== 'width' || !GRAIN_SHOWS.has(p.role)) return []
    const [length, width] = faceSize(box, p.normal)
    if (length < width * ASSUMPTIONS.grainRatio) return []
    return [
      {
        code: 'R8_GRAIN',
        severity: 'detail',
        pieces: [p.id],
        message: `En ${p.name} la veta corre a lo ancho: se ve menos natural y la pieza es menos rígida.`,
        data: { length: Math.round(length), width: Math.round(width) },
        alternatives: [{ key: 'grain-lengthwise', description: 'Cortarla con la veta a lo largo', data: { grain: 'length' } }],
      },
    ]
  })
