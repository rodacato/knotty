import { startAt, partway, makePiece, ref, extent, makeJoint } from '../../../domain/diseno/builders'
import type { Design, Dimensions } from '../../../domain/diseno/schema'
import { exampleWallCabinet } from '../../../domain/fixtures/wallCabinet'
import { exampleNightstand } from '../../../domain/fixtures/nightstand'
import { exampleBookcase } from '../../../domain/fixtures/bookcase'
import type { Operation } from '../../../domain/operaciones/schema'
import type { PhotoReading } from '../../../domain/reading/reading'
import { verdictOf } from '../../../domain/viabilidad/viability'
import type { BedPlan } from '../../../domain/modules/bed'
import { TABLE_NAMES, type TablePlan } from '../../../domain/modules/table'
import type { LLMProvider, ExpertResponse, AdjustmentResponse, ReviewResponse, PlanResponse, ReconstructionResponse, ReviewRequest } from '../../../ports/LLMProvider'

// Fixed answers to develop without an API: it recognizes a few requests by keyword, on the example furniture.

const ORIGIN = { promptId: 'simulado@1', proveedor: 'simulado', modelo: 'reglas' }
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Cancelado', 'AbortError'))))
  })

const response = <T>(value: T): ExpertResponse<T> => ({ value, origin: ORIGIN, usage: {} })

const adjustment = (partial: Partial<AdjustmentResponse> & Pick<AdjustmentResponse, 'explicacion' | 'resumen'>): AdjustmentResponse => ({
  sugerencias: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Agrega un cajón abajo'],
  operaciones: [],
  preguntas: [],
  fotosSolicitadas: [],
  requisitos: { agregar: [], quitar: [] },
  decisiones: [],
  aceptaRiesgo: [],
  ...partial,
})

const HEADBOARD: Record<BedPlan['headboard']['style'], string> = { none: 'sin cabecera', plain: 'cabecera lisa', bookcase: 'cabecera tipo librero', storage: 'cabecera con un compartimento a la altura de la almohada y repisas arriba' }
const WORDS: Record<string, number> = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4 }

/** "3 cajones", "dos entrepaños": the number said right before a word. */
function countBefore(text: string, word: string): number | null {
  const said = new RegExp(`(\\d|un|uno|dos|tres|cuatro)\\s+${word}`).exec(text)?.[1]
  return said ? (WORDS[said] ?? Number(said)) : null
}

const TABLES: [TablePlan['use'], RegExp, { width: number; height: number; depth: number }][] = [
  ['desk', /escritorio/, { width: 1200, height: 750, depth: 600 }],
  ['coffee', /mesa de centro|mesa de caf/, { width: 1000, height: 420, depth: 550 }],
  ['side', /mesa lateral|mesa de noche|mesita/, { width: 500, height: 550, depth: 400 }],
  ['dining', /\bmesa\b/, { width: 1500, height: 750, depth: 900 }],
]

/** A table or desk read from the request's words, or null if it is neither. */
function tableFrom(notes: string, measures: Dimensions | null): TablePlan | null {
  const text = notes.toLowerCase()
  const found = TABLES.find(([, pattern]) => pattern.test(text))
  if (!found) return null
  const [use, , dimensions] = found
  const name = TABLE_NAMES[use]
  const drawers = use === 'desk' && /caj/.test(text) ? (countBefore(text, 'caj') ?? 3) : 0
  return {
    kind: 'table',
    use,
    name: drawers ? `${name} con cajonera` : name,
    material: 'T18',
    dimensions: measures ? { width: measures.ancho, height: measures.alto, depth: measures.fondo } : dimensions,
    overhang: use === 'dining' ? 50 : 0,
    shelf: use === 'coffee' || use === 'side',
    pedestal: { side: drawers ? (/izquier/.test(text) ? 'left' : 'right') : 'none', drawers: Math.min(4, drawers) },
  }
}

/** A bed read from the request's words, or null if it is not a bed. */
function bedFrom(notes: string): BedPlan | null {
  const text = notes.toLowerCase()
  if (!/\bcama\b/.test(text)) return null
  const mattress = (['king', 'queen', 'matrimonial', 'individual'] as const).find((m) => text.includes(m)) ?? 'individual'
  const drawers = /caj[oó]n/.test(text)
  const both = /(dos|ambos) lados|cada lado/.test(text)
  return {
    kind: 'bed',
    name: `Cama ${mattress}${drawers ? ' con cajones' : ''}`,
    mattress,
    material: 'T18',
    height: 400,
    drawers: {
      side: !drawers ? 'none' : both ? 'both' : /derech/.test(text) ? 'right' : 'left',
      count: Math.min(4, Math.max(1, countBefore(text, 'caj') ?? 3)),
      position: /\bpie\b/.test(text) ? 'foot' : /centro/.test(text) ? 'center' : 'head',
    },
    headboard: {
      style: /sin cabecera/.test(text) ? 'none' : /cerrad|compartimento|almohada/.test(text) ? 'storage' : /librer|repisa|entrepa/.test(text) ? 'bookcase' : 'plain',
      height: 1100,
      depth: 250,
      shelves: countBefore(text, 'entrepa') ?? countBefore(text, 'repisa') ?? 2,
    },
  }
}

/** The simulated expert only knows its three example pieces; for anything else it says so instead of making up a bookcase. */
export class UnknownFurniture extends Error {
  constructor() {
    super('El modo simulado solo sabe armar libreros, burós y alacenas de ejemplo. Para diseñar este mueble conecta un experto real (Claude, OpenAI o SheLLM) en el engrane.')
  }
}

function chooseFixture(measures: Pick<Dimensions, 'ancho' | 'alto'> | null, description = ''): Design {
  const d = description.toLowerCase()
  // The furniture's name first: "repisa" or "puertas" also come up when describing a nightstand.
  if (/bur[oó]|mesa de noche|mesita/.test(d)) return exampleNightstand
  if (/alacena|gabinete/.test(d)) return exampleWallCabinet
  if (/librer|estante|libros/.test(d)) return exampleBookcase
  if (/repisa/.test(d)) return exampleBookcase
  if (/puertas/.test(d)) return exampleWallCabinet
  if (d.trim()) throw new UnknownFurniture()
  if (!measures) return exampleBookcase
  const { ancho: width, alto: height } = measures
  if (height > width * 1.8) return exampleBookcase
  if (height < 650) return exampleNightstand
  return exampleWallCabinet
}

const loadedHorizontals = (d: Design) => d.piezas.filter((p) => p.normal === 'y' && (p.rol === 'entrepano' || p.rol === 'piso'))
const shelves = (d: Design) => d.piezas.filter((p) => p.rol === 'entrepano').sort((a, b) => a.id.localeCompare(b.id))

function dividerOps(d: Design): Operation[] {
  const ops: Operation[] = [
    {
      op: 'agregarPieza',
      pieza: makePiece({ id: 'divisor', nombre: 'Divisor', rol: 'divisor', material: 'T18', normal: 'x', x: startAt(partway('lat-izq.x1', 'lat-der.x0', 0.5, -9)), y: extent(ref('piso.y1'), ref('techo.y0')), z: extent(ref('trasera.z1'), ref('mueble.z1')) }),
    },
    { op: 'agregarUnion', union: makeJoint('u-div-piso', 'piso', 'divisor', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
    { op: 'agregarUnion', union: makeJoint('u-div-techo', 'techo', 'divisor', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
    { op: 'agregarUnion', union: makeJoint('u-div-trasera', 'trasera', 'divisor', 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }]) },
  ]
  if (d.piezas.some((p) => p.id === 'zoclo'))
    ops.push(
      {
        op: 'agregarPieza',
        pieza: makePiece({ id: 'apoyo-piso', nombre: 'Apoyo central del piso', rol: 'refuerzo', material: 'T18', normal: 'x', x: startAt(partway('lat-izq.x1', 'lat-der.x0', 0.5, -9)), y: extent(ref('mueble.y0'), ref('piso.y0')), z: extent(ref('trasera.z1'), ref('zoclo.z0')) }),
      },
      { op: 'agregarUnion', union: makeJoint('u-apoyo-piso', 'piso', 'apoyo-piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
      { op: 'agregarUnion', union: makeJoint('u-apoyo-zoclo', 'zoclo', 'apoyo-piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: 2 }]) },
      { op: 'agregarUnion', union: makeJoint('u-apoyo-trasera', 'trasera', 'apoyo-piso', 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }]) },
    )
  for (const e of shelves(d)) {
    const right = `${e.id}-der`
    ops.push(
      { op: 'redimensionar', id: e.id, eje: 'x', extremo: 'hasta', cota: ref('divisor.x0') },
      { op: 'duplicarPieza', id: e.id, nuevoId: right, nombre: `${e.nombre} derecho`, eje: 'x', cota: ref('divisor.x1') },
      { op: 'redimensionar', id: right, eje: 'x', extremo: 'hasta', cota: ref('lat-der.x0') },
      ...d.uniones.filter((u) => u.a === e.id && u.b === 'lat-der').map((u): Operation => ({ op: 'eliminarUnion', id: u.id })),
      { op: 'agregarUnion', union: makeJoint(`u-${e.id}-div`, e.id, 'divisor', 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }]) },
      { op: 'agregarUnion', union: makeJoint(`u-${right}-div`, right, 'divisor', 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }]) },
    )
  }
  return ops
}

const BACK_QUESTION = '¿La trasera va clavada por detrás o metida en un canal?'

function propose(request: string, d: Design, pendingItems: Operation[] | null, withPhoto: boolean): AdjustmentResponse {
  const text = request.toLowerCase()
  const back = d.piezas.find((p) => p.id === 'trasera' && p.confianza !== 'alta')
  if (back && (withPhoto || /clavada|canal|no sé|trasera/.test(text))) {
    const channel = /canal/.test(text) && !withPhoto
    return adjustment({
      explicacion: withPhoto
        ? 'Con la foto se ve que la trasera va clavada por detrás, sobre los cantos de laterales, piso y techo. Lo dejo confirmado.'
        : channel
          ? 'Un canal pide router y sacarlo con precisión; para armarlo en casa te propongo dejarla clavada y pegada por detrás, que escuadra igual de bien con 6 mm. La marco como confirmada.'
          : 'Perfecto: la trasera va clavada y pegada por detrás. La marco como confirmada.',
      resumen: 'Confirmar la trasera',
      operaciones: [{ op: 'cambiarPropiedades', id: back.id, nombre: null, rol: null, veta: null, carga: null, apoyo: null, cantos: null, confianza: 'alta' }],
      decisiones: [{ tema: 'trasera', texto: 'Trasera clavada y pegada por detrás, sin canal' }],
    })
  }
  const cm = /(\d+(?:[.,]\d+)?)\s*(cm|mm)/.exec(text)
  const measure = cm ? Number(cm[1].replace(',', '.')) * (cm[2] === 'cm' ? 10 : 1) : null

  if (/divisor|apoyo/.test(text) && d.piezas.some((p) => p.id === 'lat-izq') && !d.piezas.some((p) => p.id === 'divisor'))
    return adjustment({
      explicacion: 'Pongo un divisor vertical al centro, de piso a techo, y parto cada entrepaño en dos; abajo agrego un apoyo central para el piso. Así cada tramo queda con la mitad de claro y aguanta los libros sin pandearse.',
      resumen: pendingItems ? 'Ensanchar con divisor al centro' : 'Agregar divisor al centro',
      operaciones: [...(pendingItems ?? []), ...dividerOps(d)],
      decisiones: [{ tema: 'divisor', texto: 'Divisor al centro para que los entrepaños no se pandeen con el ancho nuevo' }],
    })

  if (/fondo|profund/.test(text) && measure && !/caj[oó]n/.test(text))
    return adjustment({
      explicacion: `Cambio el fondo a ${measure / 10} cm. Laterales, piso, techo y entrepaños se alargan hacia el frente.`,
      resumen: `Fondo de ${measure / 10} cm`,
      operaciones: [{ op: 'cambiarDimensionGlobal', eje: 'z', valor: measure, regla: 'estirar' }],
    })

  const gap = ['piso', ...shelves(d).map((p) => p.id)]
  if (/caj[oó]n/.test(text) && gap.length > 1 && d.piezas.some((p) => p.id === 'lat-izq') && !d.piezas.some((p) => p.rol === 'puerta')) {
    const n = new Set(d.piezas.filter((p) => p.grupo?.startsWith('cajon-')).map((p) => p.grupo)).size + 1
    const bottom = n === 1 ? 'piso' : gap[n - 1]
    const top = gap[n]
    if (top)
      return adjustment({
        explicacion: `Pongo un cajón ${bottom === 'piso' ? 'entre el piso y el primer entrepaño' : 'en el siguiente hueco entre entrepaños'}, con correderas telescópicas y frente embutido. La caja es de 15 mm atornillada, con fondo de 6 mm clavado; la corredera la elijo según el fondo del mueble.`,
        resumen: `Agregar cajón ${n}`,
        operaciones: [
          {
            op: 'agregarCajon',
            grupo: `cajon-${n}`,
            nombre: `Cajón ${n}`,
            izquierda: 'lat-izq.x1',
            derecha: 'lat-der.x0',
            abajo: `${bottom}.y1`,
            arriba: `${top}.y0`,
            frente: 'mueble.z1',
            fondo: 'trasera.z1',
            material: 'T15',
            materialFondo: 'TR6',
          },
        ],
        decisiones: [{ tema: 'cajones', texto: 'Cajones con frente embutido y correderas telescópicas; caja de 15 mm' }],
      })
  }

  if (/ancho|anch|espacio/.test(text) && measure)
    return adjustment({
      explicacion: `Cambio el ancho total a ${measure / 10} cm. Los laterales se recorren y el piso, el techo y los entrepaños se estiran para llenar el espacio.`,
      resumen: `Ensanchar a ${measure / 10} cm`,
      operaciones: [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: measure, regla: 'estirar' }],
      requisitos: { agregar: [{ id: 'espacio-ancho', texto: `El espacio mide ${measure / 10} cm de ancho`, tipo: 'espacio', eje: 'x', min: null, max: measure }], quitar: [] },
    })

  if (/libro|pesad/.test(text))
    return adjustment({
      explicacion: 'Marco los entrepaños y el piso para carga de libros. Con eso la revisión calcula cuánto se pandearían.',
      resumen: 'Preparar para libros',
      operaciones: loadedHorizontals(d).map((p): Operation => ({ op: 'cambiarPropiedades', id: p.id, nombre: null, rol: null, veta: null, carga: 'pesada', apoyo: null, cantos: null, confianza: null })),
      requisitos: { agregar: [{ id: 'carga-libros', texto: 'Va a cargar libros', tipo: 'carga', eje: null, min: null, max: null }], quitar: [] },
    })

  if (/muro|ancla|vuelco/.test(text) && !d.anclajeMuro)
    return adjustment({
      explicacion: 'Lo marco para ir anclado al muro: con un kit antivuelco atornillado a la pared ya no se va de frente aunque lo jalen.',
      resumen: 'Anclar al muro',
      operaciones: [{ op: 'cambiarAnclajeMuro', valor: true }],
      decisiones: [{ tema: 'anclaje', texto: 'Anclado al muro con kit antivuelco por ser alto y poco profundo' }],
    })

  const first = shelves(d)[0]
  if (/baja|sube/.test(text) && first) {
    const delta = (measure ?? 100) * (/baja/.test(text) ? -1 : 1)
    const current = first.y.desde ?? first.y.hasta
    const position = current && current.tipo !== 'mm' ? { ...current, mas: current.mas + delta } : null
    if (position)
      return adjustment({
        explicacion: `${delta < 0 ? 'Bajo' : 'Subo'} ${first.nombre.toLowerCase()} ${Math.abs(delta) / 10} cm.`,
        resumen: `${delta < 0 ? 'Bajar' : 'Subir'} ${first.nombre.toLowerCase()}`,
        operaciones: [{ op: 'mover', id: first.id, eje: 'y', cota: position }],
      })
  }

  if (/refuerz|base/.test(text) && d.piezas.some((p) => p.id === 'zoclo') && !d.piezas.some((p) => p.id === 'refuerzo-base'))
    return adjustment({
      explicacion: 'Agrego un travesaño trasero bajo el piso, con tornillos de bolsillo a los laterales. Junto con el zoclo, el piso queda apoyado adelante y atrás y la base ya no se tuerce.',
      resumen: 'Reforzar la base',
      operaciones: [
        {
          op: 'agregarPieza',
          pieza: makePiece({ id: 'refuerzo-base', nombre: 'Travesaño trasero', rol: 'refuerzo', material: 'T18', normal: 'z', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: extent(ref('mueble.y0'), ref('piso.y0')), z: startAt(ref('trasera.z1')) }),
        },
        { op: 'agregarUnion', union: makeJoint('u-refuerzo-izq', 'refuerzo-base', 'lat-izq', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]) },
        { op: 'agregarUnion', union: makeJoint('u-refuerzo-der', 'refuerzo-base', 'lat-der', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]) },
        { op: 'agregarUnion', union: makeJoint('u-refuerzo-piso', 'piso', 'refuerzo-base', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
        { op: 'agregarUnion', union: makeJoint('u-refuerzo-trasera', 'trasera', 'refuerzo-base', 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }]) },
      ],
      decisiones: [{ tema: 'base', texto: 'Travesaño trasero bajo el piso además del zoclo' }],
    })

  return adjustment({
    explicacion: 'En modo simulado solo entiendo algunos pedidos. Prueba con uno de estos:',
    resumen: 'Sin cambios',
    preguntas: [{ texto: 'Pedidos de ejemplo', opciones: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Hazlo de 50 cm de fondo', 'Agrega un cajón abajo'] }],
  })
}

/** No judgment of its own: it keeps the arithmetic's verdict and gives the usual advice. */
function reviewPurchase(s: ReviewRequest): ReviewResponse {
  const verdict = verdictOf(s.comprobaciones)
  return {
    veredicto: verdict,
    resumen:
      verdict === 'viable'
        ? `Tu ${s.design.nombre.toLowerCase()} se puede comprar y armar así. (Esto es el modo simulado: conecta un experto real para una revisión con criterio.)`
        : `Antes de comprar hay que resolver lo marcado en las cuentas. (Esto es el modo simulado: conecta un experto real para una revisión con criterio.)`,
    problemas: [],
    consejos: ['Mide el espesor real de tus hojas antes de cortar: el triplay de 18 mm suele medir un poco menos.', 'Pide los cortes largos en la tienda y deja los chicos para casa.'],
  }
}

export function createSimulated(delay = 900): LLMProvider {
  return {
    id: 'simulado',
    label: 'Simulado',
    async reconstruct(s, signal) {
      await wait(delay * 2, signal)
      const withoutPhotos = s.photos.length === 0 && !s.reading
      const base = chooseFixture(s.measures, s.notes)
      const design = { ...structuredClone(base), dimensiones: s.measures ?? base.dimensiones }
      const back = design.piezas.find((p) => p.id === 'trasera')
      if (back) back.confianza = 'baja'
      const wantsDrawer = /caj[oó]n/i.test(s.notes) && base === exampleBookcase
      const detail = `${base.observaciones.charAt(0).toLowerCase()}${base.observaciones.slice(1)}`
      const value: ReconstructionResponse = {
        explicacion: withoutPhotos
          ? `Con tu descripción armé un ${base.nombre.toLowerCase()} de triplay${s.measures ? ' con tus medidas' : ''}: ${detail} No dijiste cómo va la trasera, así que la dejé en boceto.${wantsDrawer ? ' El cajón lo agrego en cuanto me confirmes.' : ''}`
          : `Veo un ${base.nombre.toLowerCase()} de triplay. Lo armé con tus medidas; ${detail} No alcanzo a ver cómo va la trasera, así que la dejé en boceto.`,
        diseno: design,
        preguntas: [
          { texto: BACK_QUESTION, opciones: ['Clavada', 'En canal', 'No sé'] },
          wantsDrawer
            ? { texto: '¿Agrego el cajón que mencionaste?', opciones: ['Agrega un cajón abajo', 'Sin cajón por ahora'] }
            : { texto: '¿Qué vas a guardar principalmente?', opciones: ['Libros', 'Ropa doblada', 'Decoración'] },
        ],
        fotosSolicitadas: withoutPhotos || s.photos.some((f) => f.angle === 'interior') ? [] : [{ angulo: 'interior', motivo: 'Para ver cómo va fijada la trasera' }],
        requisitos: [],
        sugerencias: ['Que aguante libros pesados', 'Hazlo de 90 cm de ancho', 'Hazlo de 50 cm de fondo'],
      }
      return response(value)
    },
    async proposeAdjustment(s, signal) {
      await wait(delay, signal)
      return response(propose(s.request, s.design, s.proposal, s.photos.length > 0))
    },
    // Only beds come from a plan: its demo adjustments name the pieces of its fixtures, so those are designed whole.
    async planDesign(s, signal) {
      await wait(delay, signal)
      const bed = bedFrom(s.notes)
      const table = bed ? null : tableFrom(s.notes, s.measures)
      if (table)
        return response<PlanResponse>({
          explicacion: `Armé ${table.use === 'desk' ? 'un escritorio' : `una ${table.name.toLowerCase()}`} de ${table.dimensions.width / 10} × ${table.dimensions.depth / 10} cm y ${table.dimensions.height / 10} cm de alto${table.pedestal.side === 'none' ? '' : `, con una cajonera de ${table.pedestal.drawers} cajones a la ${table.pedestal.side === 'left' ? 'izquierda' : 'derecha'}`}. Todo lo puedes cambiar en la ficha, en la pestaña Mueble.`,
          cabinet: null,
          bed: null,
          table,
          preguntas: [],
          fotosSolicitadas: [],
          requisitos: [],
          sugerencias: table.use === 'desk' ? ['Hazlo de 1.40 m', 'Cajonera del otro lado'] : ['Hazla más larga', 'Con repisa abajo'],
        })
      return response<PlanResponse>({
        explicacion: bed
          ? `Armé una cama ${bed.mattress} con base de ${bed.height / 10} cm, ${bed.drawers.side === 'none' ? 'sin cajones' : `${bed.drawers.count} cajones ${bed.drawers.side === 'both' ? 'de cada lado' : `del lado ${bed.drawers.side === 'left' ? 'izquierdo' : 'derecho'}`}`} y ${HEADBOARD[bed.headboard.style]}. Todo lo puedes cambiar en la ficha, en la pestaña Mueble.`
          : '',
        cabinet: null,
        bed,
        table: null,
        preguntas: bed ? [{ texto: '¿Cuánto peso va a cargar la cama?', opciones: ['Una persona', 'Dos personas'] }] : [],
        fotosSolicitadas: [],
        requisitos: [],
        sugerencias: bed ? ['Súbela a 45 cm', 'Cabecera tipo librero', 'Cajones de los dos lados'] : [],
      })
    },
    adjustPlan: null,
    async readPhoto(r, signal) {
      await wait(delay, signal)
      const base = chooseFixture(null, `${r.context} ${r.photo.note ?? ''}`)
      const front = r.photo.angle !== 'lateral'
      return response<PhotoReading>({
        kind: base.nombre.toLowerCase(),
        confidence: 'medium',
        description: `Parece un ${base.nombre.toLowerCase()} de triplay. (Lectura simulada.)`,
        proportions: { height: base.dimensiones.alto / base.dimensiones.ancho, width: 1, depth: base.dimensiones.fondo / base.dimensiones.ancho },
        base: base === exampleBookcase ? 'kick' : 'floor',
        topOverhangs: false,
        columns: front ? [{ width: 1, cells: [{ height: 1, content: base === exampleWallCabinet ? 'door' : 'open', shelves: base === exampleBookcase ? 4 : 1, doors: base === exampleWallCabinet ? 2 : null }] }] : null,
        details: [],
        doubts: ['No se ve cómo va fijada la trasera'],
      })
    },
    async reviewPurchase(s, signal) {
      await wait(delay, signal)
      return response(reviewPurchase(s))
    },
  }
}
