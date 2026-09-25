import { startAt, partway, makePiece, ref, extent, makeJoint } from '../../../domain/design/builders'
import type { Design, Dimensions } from '../../../domain/design/schema'
import { exampleWallCabinet } from '../../../domain/fixtures/wallCabinet'
import { exampleNightstand } from '../../../domain/fixtures/nightstand'
import { exampleBookcase } from '../../../domain/fixtures/bookcase'
import type { Operation } from '../../../domain/operations/schema'
import type { PhotoReading } from '../../../domain/reading/reading'
import { verdictOf } from '../../../domain/viability/viability'
import type { BedPlan } from '../../../domain/modules/bed'
import { TABLE_NAMES, TYPICAL_TABLE_DIMENSIONS, type TablePlan } from '../../../domain/modules/table'
import type { LLMProvider, ExpertResponse, AdjustmentResponse, ReviewResponse, PlanResponse, ReconstructionResponse, ReviewRequest } from '../../../ports/LLMProvider'

// Fixed answers to develop without an API: it recognizes a few requests by keyword, on the example furniture.

const ORIGIN = { promptId: 'simulated@1', provider: 'simulated', model: 'reglas' }
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Cancelado', 'AbortError'))))
  })

const response = <T>(value: T): ExpertResponse<T> => ({ value, origin: ORIGIN, usage: {} })

const adjustment = (partial: Partial<AdjustmentResponse> & Pick<AdjustmentResponse, 'explanation' | 'summary'>): AdjustmentResponse => ({
  suggestions: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Agrega un cajón abajo'],
  operations: [],
  questions: [],
  requestedPhotos: [],
  requirements: { add: [], remove: [] },
  decisions: [],
  acceptedRisks: [],
  ...partial,
})

const HEADBOARD: Record<BedPlan['headboard']['style'], string> = { none: 'sin cabecera', plain: 'cabecera lisa', bookcase: 'cabecera tipo librero', storage: 'cabecera con un compartimento a la altura de la almohada y repisas arriba' }
const WORDS: Record<string, number> = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4 }

/** "3 cajones", "dos entrepaños": the number said right before a word. */
function countBefore(text: string, word: string): number | null {
  const said = new RegExp(`(\\d|un|uno|dos|tres|cuatro)\\s+${word}`).exec(text)?.[1]
  return said ? (WORDS[said] ?? Number(said)) : null
}

/** In order: the first that matches wins, so plain "mesa" goes last. */
const TABLES: [TablePlan['use'], RegExp][] = [
  ['desk', /escritorio/],
  ['coffee', /mesa de centro|mesa de caf/],
  ['side', /mesa lateral|mesa de noche|mesita/],
  ['dining', /\bmesa\b/],
]

/** A table or desk read from the request's words, or null if it is neither. */
function tableFrom(notes: string, measures: Dimensions | null): TablePlan | null {
  const text = notes.toLowerCase()
  const found = TABLES.find(([, pattern]) => pattern.test(text))
  if (!found) return null
  const [use] = found
  const name = TABLE_NAMES[use]
  const drawers = use === 'desk' && /caj/.test(text) ? (countBefore(text, 'caj') ?? 3) : 0
  return {
    kind: 'table',
    use,
    name: drawers ? `${name} con cajonera` : name,
    material: 'T18',
    dimensions: measures ? { width: measures.width, height: measures.height, depth: measures.depth } : TYPICAL_TABLE_DIMENSIONS[use],
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
      shelves: countBefore(text, 'entrepa') ?? countBefore(text, 'shelf') ?? 2,
    },
  }
}

/** The simulated expert only knows its three example pieces; for anything else it says so instead of making up a bookcase. */
class UnknownFurniture extends Error {
  constructor() {
    super('El modo simulado solo sabe armar libreros, burós y alacenas de ejemplo. Para diseñar este mueble conecta un experto real (Claude, OpenAI o SheLLM) en el engrane.')
  }
}

function chooseFixture(measures: Pick<Dimensions, 'width' | 'height'> | null, description = ''): Design {
  const d = description.toLowerCase()
  // The furniture's name first: "repisa" or "puertas" also come up when describing a nightstand.
  if (/bur[oó]|mesa de noche|mesita/.test(d)) return exampleNightstand
  if (/alacena|gabinete/.test(d)) return exampleWallCabinet
  if (/librer|estante|libros/.test(d)) return exampleBookcase
  if (/repisa/.test(d)) return exampleBookcase
  if (/puertas/.test(d)) return exampleWallCabinet
  if (d.trim()) throw new UnknownFurniture()
  if (!measures) return exampleBookcase
  const { width, height } = measures
  if (height > width * 1.8) return exampleBookcase
  if (height < 650) return exampleNightstand
  return exampleWallCabinet
}

const loadedHorizontals = (d: Design) => d.pieces.filter((p) => p.normal === 'y' && (p.role === 'shelf' || p.role === 'bottom'))
const shelves = (d: Design) => d.pieces.filter((p) => p.role === 'shelf').sort((a, b) => a.id.localeCompare(b.id))

function dividerOps(d: Design): Operation[] {
  const ops: Operation[] = [
    {
      op: 'addPiece',
      piece: makePiece({ id: 'divider', name: 'Divisor', role: 'divider', material: 'T18', normal: 'x', x: startAt(partway('side-left.x1', 'side-right.x0', 0.5, -9)), y: extent(ref('bottom.y1'), ref('top.y0')), z: extent(ref('back.z1'), ref('furniture.z1')) }),
    },
    { op: 'addJoint', joint: makeJoint('j-div-bottom', 'bottom', 'divider', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]) },
    { op: 'addJoint', joint: makeJoint('j-div-top', 'top', 'divider', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]) },
    { op: 'addJoint', joint: makeJoint('j-div-back', 'back', 'divider', 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }]) },
  ]
  if (d.pieces.some((p) => p.id === 'kick'))
    ops.push(
      {
        op: 'addPiece',
        piece: makePiece({ id: 'bottom-support', name: 'Apoyo central del piso', role: 'brace', material: 'T18', normal: 'x', x: startAt(partway('side-left.x1', 'side-right.x0', 0.5, -9)), y: extent(ref('furniture.y0'), ref('bottom.y0')), z: extent(ref('back.z1'), ref('kick.z0')) }),
      },
      { op: 'addJoint', joint: makeJoint('j-bottom-support', 'bottom', 'bottom-support', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]) },
      { op: 'addJoint', joint: makeJoint('j-support-kick', 'kick', 'bottom-support', 'butt-screw', [{ hardwareId: 'screw-8x2', count: 2 }]) },
      { op: 'addJoint', joint: makeJoint('j-support-back', 'back', 'bottom-support', 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }]) },
    )
  for (const e of shelves(d)) {
    const right = `${e.id}-right`
    ops.push(
      { op: 'resize', id: e.id, axis: 'x', end: 'to', at: ref('divider.x0') },
      { op: 'duplicatePiece', id: e.id, newId: right, name: `${e.name} derecho`, axis: 'x', at: ref('divider.x1') },
      { op: 'resize', id: right, axis: 'x', end: 'to', at: ref('side-right.x0') },
      ...d.joints.filter((u) => u.a === e.id && u.b === 'side-right').map((u): Operation => ({ op: 'removeJoint', id: u.id })),
      { op: 'addJoint', joint: makeJoint(`j-${e.id}-div`, e.id, 'divider', 'shelf-pin', [{ hardwareId: 'shelf-pin-5', count: 2 }]) },
      { op: 'addJoint', joint: makeJoint(`j-${right}-div`, right, 'divider', 'shelf-pin', [{ hardwareId: 'shelf-pin-5', count: 2 }]) },
    )
  }
  return ops
}

const BACK_QUESTION = '¿La trasera va clavada por detrás o metida en un canal?'

function propose(request: string, d: Design, pendingItems: Operation[] | null, withPhoto: boolean): AdjustmentResponse {
  const text = request.toLowerCase()
  const back = d.pieces.find((p) => p.id === 'back' && p.confidence !== 'high')
  if (back && (withPhoto || /clavada|canal|no sé|trasera/.test(text))) {
    const channel = /canal/.test(text) && !withPhoto
    return adjustment({
      explanation: withPhoto
        ? 'Con la foto se ve que la trasera va clavada por detrás, sobre los cantos de laterales, piso y techo. Lo dejo confirmado.'
        : channel
          ? 'Un canal pide router y sacarlo con precisión; para armarlo en casa te propongo dejarla clavada y pegada por detrás, que escuadra igual de bien con 6 mm. La marco como confirmada.'
          : 'Perfecto: la trasera va clavada y pegada por detrás. La marco como confirmada.',
      summary: 'Confirmar la trasera',
      operations: [{ op: 'changeProperties', id: back.id, name: null, role: null, grain: null, load: null, support: null, edges: null, confidence: 'high' }],
      decisions: [{ topic: 'back', text: 'Trasera clavada y pegada por detrás, sin canal' }],
    })
  }
  const cm = /(\d+(?:[.,]\d+)?)\s*(cm|mm)/.exec(text)
  const measure = cm ? Number(cm[1].replace(',', '.')) * (cm[2] === 'cm' ? 10 : 1) : null

  if (/divisor|apoyo/.test(text) && d.pieces.some((p) => p.id === 'side-left') && !d.pieces.some((p) => p.id === 'divider'))
    return adjustment({
      explanation: 'Pongo un divisor vertical al centro, de piso a techo, y parto cada entrepaño en dos; abajo agrego un apoyo central para el piso. Así cada tramo queda con la mitad de claro y aguanta los libros sin pandearse.',
      summary: pendingItems ? 'Ensanchar con divisor al centro' : 'Agregar divisor al centro',
      operations: [...(pendingItems ?? []), ...dividerOps(d)],
      decisions: [{ topic: 'divider', text: 'Divisor al centro para que los entrepaños no se pandeen con el ancho nuevo' }],
    })

  if (/fondo|profund/.test(text) && measure && !/caj[oó]n/.test(text))
    return adjustment({
      explanation: `Cambio el fondo a ${measure / 10} cm. Laterales, piso, techo y entrepaños se alargan hacia el frente.`,
      summary: `Fondo de ${measure / 10} cm`,
      operations: [{ op: 'resizeFurniture', axis: 'z', value: measure, rule: 'stretch' }],
    })

  const gap = ['bottom', ...shelves(d).map((p) => p.id)]
  if (/caj[oó]n/.test(text) && gap.length > 1 && d.pieces.some((p) => p.id === 'side-left') && !d.pieces.some((p) => p.role === 'door')) {
    const n = new Set(d.pieces.filter((p) => p.role === 'drawer-front' && p.group).map((p) => p.group)).size + 1
    const bottom = n === 1 ? 'bottom' : gap[n - 1]
    const top = gap[n]
    if (top)
      return adjustment({
        explanation: `Pongo un cajón ${bottom === 'bottom' ? 'entre el piso y el primer entrepaño' : 'en el siguiente hueco entre entrepaños'}, con correderas telescópicas y frente embutido. La caja es de 15 mm atornillada, con fondo de 6 mm clavado; la corredera la elijo según el fondo del mueble.`,
        summary: `Agregar cajón ${n}`,
        operations: [
          {
            op: 'addDrawer',
            group: `drawer-${n}`,
            name: `Cajón ${n}`,
            left: 'side-left.x1',
            right: 'side-right.x0',
            bottom: `${bottom}.y1`,
            top: `${top}.y0`,
            front: 'furniture.z1',
            back: 'back.z1',
            material: 'T15',
            bottomMaterial: 'TR6',
          },
        ],
        decisions: [{ topic: 'drawers', text: 'Cajones con frente embutido y correderas telescópicas; caja de 15 mm' }],
      })
  }

  if (/ancho|anch|espacio/.test(text) && measure)
    return adjustment({
      explanation: `Cambio el ancho total a ${measure / 10} cm. Los laterales se recorren y el piso, el techo y los entrepaños se estiran para llenar el espacio.`,
      summary: `Ensanchar a ${measure / 10} cm`,
      operations: [{ op: 'resizeFurniture', axis: 'x', value: measure, rule: 'stretch' }],
      requirements: { add: [{ id: 'space-width', text: `El espacio mide ${measure / 10} cm de ancho`, type: 'space', axis: 'x', min: null, max: measure }], remove: [] },
    })

  if (/libro|pesad/.test(text))
    return adjustment({
      explanation: 'Marco los entrepaños y el piso para carga de libros. Con eso la revisión calcula cuánto se pandearían.',
      summary: 'Preparar para libros',
      operations: loadedHorizontals(d).map((p): Operation => ({ op: 'changeProperties', id: p.id, name: null, role: null, grain: null, load: 'heavy', support: null, edges: null, confidence: null })),
      requirements: { add: [{ id: 'book-load', text: 'Va a cargar libros', type: 'load', axis: null, min: null, max: null }], remove: [] },
    })

  if (/muro|ancla|vuelco/.test(text) && !d.wallAnchored)
    return adjustment({
      explanation: 'Lo marco para ir anclado al muro: con un kit antivuelco atornillado a la pared ya no se va de frente aunque lo jalen.',
      summary: 'Anclar al muro',
      operations: [{ op: 'setWallAnchored', value: true }],
      decisions: [{ topic: 'anchoring', text: 'Anclado al muro con kit antivuelco por ser alto y poco profundo' }],
    })

  const first = shelves(d)[0]
  if (/baja|sube/.test(text) && first) {
    const delta = (measure ?? 100) * (/baja/.test(text) ? -1 : 1)
    const current = first.y.from ?? first.y.to
    const position = current && current.type !== 'mm' ? { ...current, offset: current.offset + delta } : null
    if (position)
      return adjustment({
        explanation: `${delta < 0 ? 'Bajo' : 'Subo'} ${first.name.toLowerCase()} ${Math.abs(delta) / 10} cm.`,
        summary: `${delta < 0 ? 'Bajar' : 'Subir'} ${first.name.toLowerCase()}`,
        operations: [{ op: 'move', id: first.id, axis: 'y', at: position }],
      })
  }

  if (/refuerz|base/.test(text) && d.pieces.some((p) => p.id === 'kick') && !d.pieces.some((p) => p.id === 'base-brace'))
    return adjustment({
      explanation: 'Agrego un travesaño trasero bajo el piso, con tornillos de bolsillo a los laterales. Junto con el zoclo, el piso queda apoyado adelante y atrás y la base ya no se tuerce.',
      summary: 'Reforzar la base',
      operations: [
        {
          op: 'addPiece',
          piece: makePiece({ id: 'base-brace', name: 'Travesaño trasero', role: 'brace', material: 'T18', normal: 'z', x: extent(ref('side-left.x1'), ref('side-right.x0')), y: extent(ref('furniture.y0'), ref('bottom.y0')), z: startAt(ref('back.z1')) }),
        },
        { op: 'addJoint', joint: makeJoint('j-brace-left', 'base-brace', 'side-left', 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]) },
        { op: 'addJoint', joint: makeJoint('j-brace-right', 'base-brace', 'side-right', 'pocket-screw', [{ hardwareId: 'pocket-screw-1-1/4', count: 2 }]) },
        { op: 'addJoint', joint: makeJoint('j-brace-bottom', 'bottom', 'base-brace', 'butt-screw', [{ hardwareId: 'screw-8x2', count: null }]) },
        { op: 'addJoint', joint: makeJoint('j-brace-back', 'back', 'base-brace', 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }]) },
      ],
      decisions: [{ topic: 'base', text: 'Travesaño trasero bajo el piso además del zoclo' }],
    })

  return adjustment({
    explanation: 'En modo simulado solo entiendo algunos pedidos. Prueba con uno de estos:',
    summary: 'Sin cambios',
    questions: [{ text: 'Pedidos de ejemplo', options: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Hazlo de 50 cm de fondo', 'Agrega un cajón abajo'] }],
  })
}

/** No judgment of its own: it keeps the arithmetic's verdict and gives the usual advice. */
function reviewPurchase(s: ReviewRequest): ReviewResponse {
  const verdict = verdictOf(s.checks)
  return {
    verdict: verdict,
    summary:
      verdict === 'viable'
        ? `Tu ${s.design.name.toLowerCase()} se puede comprar y armar así. (Esto es el modo simulado: conecta un experto real para una revisión con criterio.)`
        : `Antes de comprar hay que resolver lo marcado en las cuentas. (Esto es el modo simulado: conecta un experto real para una revisión con criterio.)`,
    problems: [],
    tips: ['Mide el espesor real de tus hojas antes de cortar: el triplay de 18 mm suele medir un poco menos.', 'Pide los cortes largos en la tienda y deja los chicos para casa.'],
  }
}

export function createSimulated(delay = 900): LLMProvider {
  return {
    id: 'simulated',
    label: 'Simulado',
    async reconstruct(s, signal) {
      await wait(delay * 2, signal)
      const withoutPhotos = s.photos.length === 0 && !s.reading
      const base = chooseFixture(s.measures, s.notes)
      const design = { ...structuredClone(base), dimensions: s.measures ?? base.dimensions }
      const back = design.pieces.find((p) => p.id === 'back')
      if (back) back.confidence = 'low'
      const wantsDrawer = /caj[oó]n/i.test(s.notes) && base === exampleBookcase
      const detail = `${base.notes.charAt(0).toLowerCase()}${base.notes.slice(1)}`
      const value: ReconstructionResponse = {
        explanation: withoutPhotos
          ? `Con tu descripción armé un ${base.name.toLowerCase()} de triplay${s.measures ? ' con tus medidas' : ''}: ${detail} No dijiste cómo va la trasera, así que la dejé en boceto.${wantsDrawer ? ' El cajón lo agrego en cuanto me confirmes.' : ''}`
          : `Veo un ${base.name.toLowerCase()} de triplay. Lo armé con tus medidas; ${detail} No alcanzo a ver cómo va la trasera, así que la dejé en boceto.`,
        design: design,
        questions: [
          { text: BACK_QUESTION, options: ['Clavada', 'En canal', 'No sé'] },
          wantsDrawer
            ? { text: '¿Agrego el cajón que mencionaste?', options: ['Agrega un cajón abajo', 'Sin cajón por ahora'] }
            : { text: '¿Qué vas a guardar principalmente?', options: ['Libros', 'Ropa doblada', 'Decoración'] },
        ],
        requestedPhotos: withoutPhotos || s.photos.some((f) => f.angle === 'inside') ? [] : [{ angle: 'inside', reason: 'Para ver cómo va fijada la trasera' }],
        requirements: [],
        suggestions: ['Que aguante libros pesados', 'Hazlo de 90 cm de ancho', 'Hazlo de 50 cm de fondo'],
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
          explanation: `Armé ${table.use === 'desk' ? 'un escritorio' : `una ${table.name.toLowerCase()}`} de ${table.dimensions.width / 10} × ${table.dimensions.depth / 10} cm y ${table.dimensions.height / 10} cm de alto${table.pedestal.side === 'none' ? '' : `, con una cajonera de ${table.pedestal.drawers} cajones a la ${table.pedestal.side === 'left' ? 'izquierda' : 'derecha'}`}. Todo lo puedes cambiar en la ficha, en la pestaña Mueble.`,
          cabinet: null,
          bed: null,
          table,
          questions: [],
          requestedPhotos: [],
          requirements: [],
          suggestions: table.use === 'desk' ? ['Hazlo de 1.40 m', 'Cajonera del otro lado'] : ['Hazla más larga', 'Con repisa abajo'],
        })
      return response<PlanResponse>({
        explanation: bed
          ? `Armé una cama ${bed.mattress} con base de ${bed.height / 10} cm, ${bed.drawers.side === 'none' ? 'sin cajones' : `${bed.drawers.count} cajones ${bed.drawers.side === 'both' ? 'de cada lado' : `del lado ${bed.drawers.side === 'left' ? 'izquierdo' : 'derecho'}`}`} y ${HEADBOARD[bed.headboard.style]}. Todo lo puedes cambiar en la ficha, en la pestaña Mueble.`
          : '',
        cabinet: null,
        bed,
        table: null,
        questions: bed ? [{ text: '¿Cuánto peso va a cargar la cama?', options: ['Una persona', 'Dos personas'] }] : [],
        requestedPhotos: [],
        requirements: [],
        suggestions: bed ? ['Súbela a 45 cm', 'Cabecera tipo librero', 'Cajones de los dos lados'] : [],
      })
    },
    adjustPlan: null,
    async readPhoto(r, signal) {
      await wait(delay, signal)
      const base = chooseFixture(null, `${r.context} ${r.photo.note ?? ''}`)
      const front = r.photo.angle !== 'side'
      return response<PhotoReading>({
        kind: base.name.toLowerCase(),
        confidence: 'medium',
        description: `Parece un ${base.name.toLowerCase()} de triplay. (Lectura simulada.)`,
        proportions: { height: base.dimensions.height / base.dimensions.width, width: 1, depth: base.dimensions.depth / base.dimensions.width },
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
