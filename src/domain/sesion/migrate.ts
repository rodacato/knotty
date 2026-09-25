// Reads what an older Knotty saved. Format 1 had its fields and values in Spanish; format 2 has them in English.
// Only names change: the numbers, ids and texts for the person stay as they were.

type Raw = Record<string, unknown>
type Convert = (value: unknown) => unknown

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const list = (convert: Convert): Convert => (v) => (Array.isArray(v) ? v.map(convert) : v)
const nullable = (convert: Convert): Convert => (v) => (v === null ? null : convert(v))
const values = (map: Record<string, string>): Convert => (v) => (typeof v === 'string' ? (map[v] ?? v) : v)

/** Renames the keys it knows, converting their values; keys it does not know pass through unchanged. */
const fields =
  (spec: Record<string, string | [string, Convert]>): Convert =>
  (v) => {
    if (!isObject(v)) return v
    const out: Raw = {}
    for (const [key, value] of Object.entries(v)) {
      const rule = spec[key]
      if (rule === undefined) out[key] = value
      else if (typeof rule === 'string') out[rule] = value
      else out[rule[0]] = rule[1](value)
    }
    return out
  }

const ROLE = values({
  lateral: 'side', piso: 'bottom', techo: 'top', entrepano: 'shelf', divisor: 'divider', trasera: 'back', zoclo: 'kick', faja: 'apron',
  puerta: 'door', 'frente-cajon': 'drawer-front', 'costado-cajon': 'drawer-side', 'fondo-cajon': 'drawer-bottom', refuerzo: 'brace', otro: 'other',
})
const JOINT_TYPE = values({
  'tope-tornillo': 'butt-screw', bolsillo: 'pocket-screw', tarugo: 'dowel', minifix: 'cam-lock', canal: 'dado', rebaje: 'rabbet', escuadra: 'bracket',
  'clavo-pegamento': 'glue-nail', 'soporte-repisa': 'shelf-pin', 'bisagra-cazoleta': 'cup-hinge', corredera: 'drawer-slide',
})
const GRAIN = values({ largo: 'length', ancho: 'width', libre: 'any' })
const LOAD = values({ ninguna: 'none', ligera: 'light', media: 'medium', pesada: 'heavy' })
const SUPPORT = values({ fijo: 'fixed', movil: 'movable' })
const EDGE = values({ frente: 'front', atras: 'back', izq: 'left', der: 'right', arriba: 'top', abajo: 'bottom' })
const LEVEL = values({ alta: 'high', media: 'medium', baja: 'low' })

const dimensions = fields({ ancho: 'width', alto: 'height', fondo: 'depth' })
const position = fields({ tipo: ['type', values({ entre: 'between' })], mas: 'offset' })
const extent = fields({ desde: ['from', nullable(position)], hasta: ['to', nullable(position)], largo: 'length' })
const pieceFields = {
  nombre: 'name',
  rol: ['role', ROLE],
  x: ['x', extent],
  y: ['y', extent],
  z: ['z', extent],
  veta: ['grain', GRAIN],
  carga: ['load', LOAD],
  apoyo: ['support', SUPPORT],
  cantos: ['edges', list(EDGE)],
  grupo: 'group',
  confianza: ['confidence', LEVEL],
} satisfies Record<string, string | [string, Convert]>
const piece = fields(pieceFields)
const joint = fields({
  tipo: ['type', JOINT_TYPE],
  pegamento: 'glue',
  penetracion: 'depth',
  herrajes: ['hardware', list(fields({ herrajeId: 'hardwareId', cantidad: 'count' }))],
})
export const migrateDesign = fields({
  esquema: 'schema',
  nombre: 'name',
  dimensiones: ['dimensions', dimensions],
  anclajeMuro: 'wallAnchored',
  piezas: ['pieces', list(piece)],
  uniones: ['joints', list(joint)],
  observaciones: 'notes',
})

const OPERATION_NAMES: Record<string, string> = {
  agregarPieza: 'addPiece', eliminarPieza: 'removePiece', eliminarGrupo: 'removeGroup', duplicarPieza: 'duplicatePiece', redimensionar: 'resize',
  mover: 'move', distribuir: 'distribute', cambiarEspesor: 'changeMaterial', cambiarPropiedades: 'changeProperties', agregarUnion: 'addJoint',
  cambiarUnion: 'changeJoint', eliminarUnion: 'removeJoint', cambiarDimensionGlobal: 'resizeFurniture', cambiarAnclajeMuro: 'setWallAnchored', agregarCajon: 'addDrawer',
}
const operationFields = fields({
  op: ['op', values(OPERATION_NAMES)],
  pieza: ['piece', piece],
  grupo: 'group',
  nuevoId: 'newId',
  nombre: 'name',
  eje: 'axis',
  cota: ['at', position],
  extremo: ['end', values({ desde: 'from', hasta: 'to' })],
  union: ['joint', joint],
  valor: 'value',
  regla: ['rule', values({ estirar: 'stretch', proporcional: 'proportional' })],
  rol: ['role', nullable(ROLE)],
  veta: ['grain', nullable(GRAIN)],
  carga: ['load', nullable(LOAD)],
  apoyo: ['support', nullable(SUPPORT)],
  cantos: ['edges', nullable(list(EDGE))],
  confianza: ['confidence', nullable(LEVEL)],
  izquierda: 'left',
  derecha: 'right',
  abajo: 'bottom',
  arriba: 'top',
  frente: 'front',
  fondo: 'back',
  materialFondo: 'bottomMaterial',
})
export const migrateOperation = operationFields

const requirement = fields({
  texto: 'text',
  tipo: ['type', values({ espacio: 'space', carga: 'load', herramienta: 'tool', estilo: 'style', otro: 'other' })],
  eje: 'axis',
})
const decision = fields({ tema: 'topic', texto: 'text' })
const origin = fields({ proveedor: 'provider', modelo: 'model' })
const question = fields({ texto: 'text', opciones: 'options' })
const photoRequest = fields({ angulo: 'angle', motivo: 'reason' })
const thumbnail = fields({ angulo: 'angle' })

const version = fields({
  diseno: ['design', migrateDesign],
  resumen: 'summary',
  motivo: 'reason',
  operaciones: 'operations',
  fecha: 'date',
  origen: ['origin', nullable(origin)],
  decisiones: ['decisions', list(decision)],
  extras: ['extras', list(operationFields)],
})

const message = fields({
  autor: ['author', values({ usuario: 'user', experto: 'expert' })],
  texto: 'text',
  fecha: 'date',
  preguntas: ['questions', list(question)],
  respondida: 'answered',
  propuesta: ['proposal', nullable(values({ pendiente: 'pending', aplicada: 'applied', descartada: 'discarded' }))],
  fotosPedidas: ['requestedPhotos', list(photoRequest)],
  miniatura: 'thumbnail',
  respuestas: 'answers',
  sugerencias: 'suggestions',
})

const proposal = fields({
  diseno: ['design', migrateDesign],
  operaciones: ['operations', list(operationFields)],
  resumen: 'summary',
  motivo: 'reason',
  criticos: ['critical', list(fields({ codigo: 'code', mensaje: 'message', piezas: 'pieces' }))],
  requisitos: ['requirements', list(requirement)],
  decisiones: ['decisions', list(decision)],
  origen: ['origin', nullable(origin)],
  extras: ['extras', list(operationFields)],
})

const check = fields({
  titulo: 'title',
  estado: ['status', values({ aviso: 'warning', falla: 'fail' })],
  detalle: 'detail',
  piezas: 'pieces',
  pedido: 'request',
  imposible: 'impossible',
})
const VERDICT = values({ 'con-cambios': 'needs-changes', 'no-viable': 'not-viable' })
const carpenter = fields({
  veredicto: ['verdict', VERDICT],
  resumen: 'summary',
  problemas: ['problems', list(fields({ titulo: 'title', detalle: 'detail', gravedad: ['severity', LEVEL], piezas: 'pieces', pedido: 'request' }))],
  consejos: 'tips',
  origen: ['origin', origin],
})
const review = fields({
  firma: 'signature',
  veredicto: ['verdict', VERDICT],
  comprobaciones: ['checks', list(check)],
  carpintero: ['carpenter', nullable(carpenter)],
  fecha: 'date',
})

const stateV1 = fields({
  formato: ['format', () => 2],
  medidas: ['measures', dimensions],
  versiones: ['versions', list(version)],
  actual: 'current',
  requisitos: ['requirements', list(requirement)],
  decisiones: ['decisions', list(decision)],
  chat: ['chat', list(message)],
  miniaturas: ['thumbnails', list(thumbnail)],
  propuesta: ['proposal', nullable(proposal)],
  dictamen: ['review', nullable(review)],
})

/** Brings a saved session up to the current format; anything it does not recognize is returned as is for the schema to judge. */
export function migrateState(raw: unknown): unknown {
  return isObject(raw) && raw.formato === 1 ? stateV1(raw) : raw
}
