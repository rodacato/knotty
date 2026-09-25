import { z } from 'zod'
import { desde, entre, hasta, pieza, ref, tramo } from '../diseno/construir'
import type { CaraRef, Cota, Diseno, Pieza } from '../diseno/esquema'
import { completeJoints } from '../diseno/joints'
import { materialPorId, type Catalogo } from '../materiales/catalogo'
import { aplicar } from '../operaciones/aplicar'
import type { Operacion } from '../operaciones/esquema'
import { Column } from '../reading/reading'

// A cabinet from a plan: measures plus a grid of columns and cells. Knotty builds every piece, so pieces cannot overlap by construction.

export const CabinetPlan = z.object({
  name: z.string().describe('Nombre del mueble para la persona: "Librero", "Buró con cajón"'),
  dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }).describe('Medidas exteriores en mm'),
  material: z.string().describe('Id del triplay del casco, normalmente "T18"'),
  base: z.enum(['kick', 'floor']).describe('kick: zoclo al frente; floor: el piso del mueble asienta directo'),
  wallMounted: z.boolean().describe('Si va anclado o colgado del muro'),
  columns: z.array(Column).min(1).describe('De izquierda a derecha; cada una con sus huecos de abajo hacia arriba'),
})
export type CabinetPlan = z.infer<typeof CabinetPlan>

const BACK = 'TR6'
const KICK_HEIGHT = 70
const KICK_SETBACK = 30
const GAP = 2
const SHELF_SETBACK = 5

/** Fractions as given may not add up to 1; they are scaled so they do. */
const shares = (values: number[]) => {
  const total = values.reduce((s, v) => s + v, 0) || 1
  let sum = 0
  return values.map((v) => (sum += v / total))
}

export interface BuiltCabinet {
  design: Diseno
  /** Cells that could not be built as asked, for the person. */
  notes: string[]
}

export function buildCabinet(plan: CabinetPlan, catalog: Catalogo): BuiltCabinet {
  const t = materialPorId(catalog, plan.material)?.espesor ?? 18
  const half = t / 2
  const cells = plan.columns.flatMap((c) => c.cells)
  const hasFronts = cells.some((c) => c.content === 'door' || c.content === 'closed')
  // Overlay doors sit in front of the carcass, so the carcass stops one thickness short of the front.
  const front: Cota = hasFronts ? ref('mueble.z1', -t) : ref('mueble.z1')
  const depth = () => tramo(ref('trasera.z1'), front)
  const panel = (p: Omit<Parameters<typeof pieza>[0], 'material'>) => pieza({ material: plan.material, cantos: ['frente'], ...p })

  const pieces: Pieza[] = [
    pieza({ id: 'trasera', nombre: 'Trasera', rol: 'trasera', material: BACK, normal: 'z', x: tramo(ref('mueble.x0'), ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: desde(ref('mueble.z0')) }),
    panel({ id: 'lat-izq', nombre: 'Lateral izquierdo', rol: 'lateral', normal: 'x', x: desde(ref('mueble.x0')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: depth() }),
    panel({ id: 'lat-der', nombre: 'Lateral derecho', rol: 'lateral', normal: 'x', x: hasta(ref('mueble.x1')), y: tramo(ref('mueble.y0'), ref('mueble.y1')), z: depth() }),
  ]
  if (plan.base === 'kick')
    pieces.push(
      pieza({
        id: 'zoclo',
        nombre: 'Zoclo',
        rol: 'zoclo',
        material: plan.material,
        normal: 'z',
        x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')),
        y: tramo(ref('mueble.y0'), null, KICK_HEIGHT),
        z: hasta(hasFronts ? ref('mueble.z1', -t - KICK_SETBACK) : ref('mueble.z1', -KICK_SETBACK)),
      }),
    )
  pieces.push(
    panel({ id: 'piso', nombre: 'Piso', rol: 'piso', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: desde(plan.base === 'kick' ? ref('zoclo.y1') : ref('mueble.y0')), z: depth(), carga: 'media' }),
    panel({ id: 'techo', nombre: 'Techo', rol: 'techo', normal: 'y', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: hasta(ref('mueble.y1')), z: depth() }),
  )

  const columnEdges = shares(plan.columns.map((c) => c.width))
  columnEdges.slice(0, -1).forEach((share, i) =>
    pieces.push(panel({ id: `div-${i + 1}`, nombre: `Divisor ${i + 1}`, rol: 'divisor', normal: 'x', x: desde(entre('lat-izq.x1', 'lat-der.x0', share, -half)), y: tramo(ref('piso.y1'), ref('techo.y0')), z: depth() })),
  )

  const drawers: Operacion[] = []
  const notes: string[] = []
  plan.columns.forEach((column, i) => {
    const n = plan.columns.length
    const col = `c${i + 1}`
    const left: CaraRef = i === 0 ? 'lat-izq.x1' : `div-${i}.x1`
    const right: CaraRef = i === n - 1 ? 'lat-der.x0' : `div-${i + 1}.x0`
    // Door edges: over the outer sides almost to the edge, over a divider up to its middle.
    const doorLeft = i === 0 ? ref('mueble.x0', GAP) : ref(`div-${i}.x0`, half + GAP / 2)
    const doorRight = i === n - 1 ? ref('mueble.x1', -GAP) : ref(`div-${i + 1}.x0`, half - GAP / 2)
    const cellTops = shares(column.cells.map((c) => c.height))
    cellTops.slice(0, -1).forEach((share, j) =>
      pieces.push(
        panel({ id: `${col}-sep-${j + 1}`, nombre: `Entrepaño fijo ${n > 1 ? `${i + 1}.` : ''}${j + 1}`, rol: 'entrepano', normal: 'y', x: tramo(ref(left), ref(right)), y: desde(entre('piso.y1', 'techo.y0', share, -half)), z: depth() }),
      ),
    )
    column.cells.forEach((cell, j) => {
      const m = column.cells.length
      const id = `${col}-h${j + 1}`
      const label = `${n > 1 ? ` de la columna ${i + 1}` : ''}${m > 1 ? ` (hueco ${j + 1})` : ''}`
      const bottom: CaraRef = j === 0 ? 'piso.y1' : `${col}-sep-${j}.y1`
      const top: CaraRef = j === m - 1 ? 'techo.y0' : `${col}-sep-${j + 1}.y0`
      const doorBottom = j === 0 ? ref('piso.y0', GAP) : ref(`${col}-sep-${j}.y0`, half + GAP / 2)
      const doorTop = j === m - 1 ? ref('mueble.y1', -GAP) : ref(`${col}-sep-${j + 1}.y0`, half - GAP / 2)

      const shelves = cell.content === 'open' || cell.content === 'door' ? (cell.shelves ?? 0) : 0
      for (let k = 1; k <= shelves; k++)
        pieces.push(
          panel({
            id: `${id}-rep-${k}`,
            nombre: `Repisa ${k}${label}`,
            rol: 'entrepano',
            normal: 'y',
            x: tramo(ref(left), ref(right)),
            y: desde(entre(bottom, top, k / (shelves + 1), -half)),
            z: tramo(ref('trasera.z1'), cell.content === 'door' ? ref('mueble.z1', -t - SHELF_SETBACK) : front),
            carga: 'media',
            apoyo: 'movil',
          }),
        )

      if (cell.content === 'door' || cell.content === 'closed') {
        const leaves = cell.content === 'door' ? Math.min(cell.doors ?? 1, 2) : 1
        const common = { material: plan.material, normal: 'z' as const, y: tramo(doorBottom, doorTop), z: hasta(ref('mueble.z1')), cantos: ['frente', 'atras', 'izq', 'der', 'arriba', 'abajo'] as Pieza['cantos'] }
        if (cell.content === 'closed') pieces.push(pieza({ ...common, id: `${id}-tapa`, nombre: `Tapa${label}`, rol: 'otro', x: tramo(doorLeft, doorRight) }))
        else if (leaves === 1) pieces.push(pieza({ ...common, id: `${id}-puerta`, nombre: `Puerta${label}`, rol: 'puerta', x: tramo(doorLeft, doorRight) }))
        else
          pieces.push(
            pieza({ ...common, id: `${id}-puerta-izq`, nombre: `Puerta izquierda${label}`, rol: 'puerta', x: tramo(doorLeft, entre(left, right, 0.5, -GAP / 2)) }),
            pieza({ ...common, id: `${id}-puerta-der`, nombre: `Puerta derecha${label}`, rol: 'puerta', x: tramo(entre(left, right, 0.5, GAP / 2), doorRight) }),
          )
      }

      if (cell.content === 'drawer') {
        const n = drawers.length + 1
        drawers.push({ op: 'agregarCajon', grupo: `cajon-${n}`, nombre: `Cajón ${n}`, izquierda: left, derecha: right, abajo: bottom, arriba: top, frente: 'lat-izq.z1', fondo: 'trasera.z1', material: plan.material, materialFondo: BACK })
      }
    })
  })

  const base: Diseno = {
    esquema: 1,
    nombre: plan.name,
    dimensiones: { ancho: plan.dimensions.width, alto: plan.dimensions.height, fondo: plan.dimensions.depth },
    anclajeMuro: plan.wallMounted,
    observaciones: '',
    piezas: pieces,
    uniones: [],
  }
  // Drawers go one by one: one that does not fit leaves its cell open instead of failing the whole cabinet.
  let design = base
  for (const drawer of drawers) {
    const result = aplicar(design, [drawer], catalog)
    if (result.ok) design = result.valor.diseno
    else if (drawer.op === 'agregarCajon') notes.push(`${drawer.nombre}: ${result.errores[0]?.mensaje ?? 'no cupo'} Lo dejé como hueco abierto.`)
  }
  return { design: completeJoints(design, catalog), notes }
}
