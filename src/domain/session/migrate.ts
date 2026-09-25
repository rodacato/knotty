// Reads what an older Knotty saved. Format 1 had its fields and values in Spanish; format 2 had them in English but kept
// the codes (rules, errors, severities, checks, photo angles) in Spanish; format 3 kept the catalog's hardware ids and the
// simulated provider in Spanish; format 4 still called the furniture's own faces "mueble"; format 5 still saved the accepted-risks check as "aceptados";
// format 6 saved a cabinet's plan with no kind, the only plan without one; format 7 names every plan's kind.
// Piece ids are the design's own data: the ones saved in Spanish stay as they were and still work.
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
const migrateDesign = fields({
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

// Format 2 → 3: codes live inside strings too (a finding's key is "R1_FLECHA:piso"), so they are replaced as words.
const CODES: Record<string, string> = {
  R1_FLECHA: 'R1_SAG',
  R2_ESPESOR_UNION: 'R2_JOINT_THICKNESS',
  R3_TORNILLOS: 'R3_SCREWS',
  R4_VUELCO: 'R4_TIPPING',
  R5_ESCUADRADO: 'R5_RACKING',
  R6_PUERTAS: 'R6_DOORS',
  R8_VETA: 'R8_GRAIN',
  R9_CAJONES: 'R9_DRAWERS',
  R10_USO: 'R10_USE',
  E_ESQUEMA: 'E_SCHEMA',
  E_ID_DUPLICADO: 'E_DUPLICATE_ID',
  E_PIEZA_INEXISTENTE: 'E_UNKNOWN_PIECE',
  E_UNION_INEXISTENTE: 'E_UNKNOWN_JOINT',
  E_REF_INEXISTENTE: 'E_UNKNOWN_REF',
  E_REF_EJE: 'E_REF_AXIS',
  E_CICLO: 'E_CYCLE',
  E_TRAMO_INVALIDO: 'E_INVALID_EXTENT',
  E_TRASLAPE: 'E_OVERLAP',
  E_FLOTANTE: 'E_FLOATING',
  E_MEDIDA_GLOBAL: 'E_OVERALL_SIZE',
  E_ESPESOR_CATALOGO: 'E_UNKNOWN_MATERIAL',
  E_NO_CABE_EN_HOJA: 'E_TOO_BIG_FOR_SHEET',
  E_UNION_SIN_CONTACTO: 'E_JOINT_WITHOUT_CONTACT',
  E_REQUISITO: 'E_REQUIREMENT',
  E_OPERACION_INVALIDA: 'E_INVALID_OPERATION',
  E_PROVEEDOR: 'E_PROVIDER',
  E_FICHA: 'E_PLAN_ADJUSTMENT',
  A_CONTACTO_SIN_UNION: 'W_CONTACT_WITHOUT_JOINT',
  A_REFERENCIA_CONGELADA: 'W_FROZEN_REFERENCE',
}

const SEVERITIES: Record<string, string> = { critico: 'critical', recomendacion: 'recommendation', detalle: 'detail' }
const CHECKS: Record<string, string> = { medidas: 'measures', hoja: 'sheet', estructura: 'structure', tiras: 'strips', confirmadas: 'confirmed', margen: 'margin' }
const ANGLES: Record<string, string> = { frente: 'front', '3/4': 'three-quarter', lateral: 'side', interior: 'inside', uniones: 'joints' }

const withCodes = (v: unknown) => (typeof v === 'string' ? v.replace(/\b[REA]\d*_[A-Z_]+\b/g, (code) => CODES[code] ?? code) : v)
/** A notice's key carries its severity after "finding:". */
const noticeKey = (v: unknown) => (typeof v === 'string' ? (withCodes(v) as string).replace(/finding:(critico|recomendacion|detalle):/, (_, s: string) => `finding:${SEVERITIES[s]}:`) : v)
const ANGLE = values(ANGLES)
/** "p0" stays; "f:frente" becomes "f:front". */
const answerKey = (v: unknown) => (typeof v === 'string' && v.startsWith('f:') ? `f:${ANGLES[v.slice(2)] ?? v.slice(2)}` : v)

const stateV2 = fields({
  format: ['format', () => 3],
  chat: ['chat', list(fields({ requestedPhotos: ['requestedPhotos', list(fields({ angle: ['angle', ANGLE] }))], answers: ['answers', list(answerKey)] }))],
  thumbnails: ['thumbnails', list(fields({ angle: ['angle', ANGLE] }))],
  proposal: ['proposal', nullable(fields({ critical: ['critical', list(fields({ code: ['code', withCodes] }))] }))],
  review: ['review', nullable(fields({ checks: ['checks', list(fields({ id: ['id', values(CHECKS)] }))] }))],
  trace: ['trace', list(fields({ errors: ['errors', list(fields({ code: ['code', withCodes] }))] }))],
  accepted: ['accepted', list(fields({ key: ['key', withCodes] }))],
  tray: ['tray', list(fields({ id: ['id', noticeKey] }))],
})

// Format 3 → 4: joints name catalog hardware, and origins name the simulated provider.
/** Hardware ids before the catalog moved to English; saved prices use them too. */
export const HARDWARE_IDS_V3: Record<string, string> = {
  'tornillo-8x1': 'screw-8x1',
  'tornillo-8x1-1/4': 'screw-8x1-1/4',
  'tornillo-8x1-1/2': 'screw-8x1-1/2',
  'tornillo-8x2': 'screw-8x2',
  'tornillo-bolsillo-1-1/4': 'pocket-screw-1-1/4',
  'tarugo-8x40': 'dowel-8x40',
  'minifix-15': 'cam-lock-15',
  'soporte-repisa-5': 'shelf-pin-5',
  'bisagra-cazoleta-35-recta': 'cup-hinge-35-full',
  'bisagra-cazoleta-35-codo': 'cup-hinge-35-half',
  'bisagra-cazoleta-35-supercodo': 'cup-hinge-35-inset',
  'corredera-telescopica-30': 'drawer-slide-30',
  'corredera-telescopica-35': 'drawer-slide-35',
  'corredera-telescopica-40': 'drawer-slide-40',
  'corredera-telescopica-45': 'drawer-slide-45',
  'corredera-telescopica-50': 'drawer-slide-50',
  'escuadra-1-1/2': 'bracket-1-1/2',
  'clavo-sin-cabeza-1': 'brad-nail-1',
  'pegamento-blanco': 'white-glue',
  'cubrecanto-19': 'edge-banding-19',
  'pata-niveladora': 'leveling-foot',
  'jaladera': 'handle',
  'kit-antivuelco': 'anti-tip-kit',
}

const hardwareId = values(HARDWARE_IDS_V3)
const jointV3 = fields({ hardware: ['hardware', list(fields({ hardwareId: ['hardwareId', hardwareId] }))] })
const designV3 = fields({ joints: ['joints', list(jointV3)] })
const operationV3 = fields({ joint: ['joint', jointV3] })
const originV3 = fields({ provider: ['provider', values({ simulado: 'simulated' })], promptId: ['promptId', values({ 'simulado@1': 'simulated@1' })] })

const stateV3 = fields({
  format: ['format', () => 4],
  versions: ['versions', list(fields({ design: ['design', designV3], extras: ['extras', list(operationV3)], origin: ['origin', nullable(originV3)] }))],
  proposal: ['proposal', nullable(fields({ design: ['design', designV3], operations: ['operations', list(operationV3)], extras: ['extras', list(operationV3)], origin: ['origin', nullable(originV3)] }))],
  review: ['review', nullable(fields({ carpenter: ['carpenter', nullable(fields({ origin: ['origin', originV3] }))] }))],
})

// Format 4 → 5: the furniture's own faces were "mueble.x0"; any position or operation can refer to them.
const FACE_V4 = /^mueble\.([xyz][01])$/
const faces = (v: unknown): unknown => {
  if (typeof v === 'string') return v.replace(FACE_V4, 'furniture.$1')
  if (Array.isArray(v)) return v.map(faces)
  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, faces(x)]))
  return v
}
const stateV4 = fields({
  format: ['format', () => 5],
  versions: ['versions', list(fields({ design: ['design', faces], extras: ['extras', faces] }))],
  proposal: ['proposal', nullable(fields({ design: ['design', faces], operations: ['operations', faces], extras: ['extras', faces] }))],
})

// Format 5 → 6: the check that lists what the person accepted was saved as "aceptados".
const stateV5 = fields({
  format: ['format', () => 6],
  review: ['review', nullable(fields({ checks: ['checks', list(fields({ id: ['id', values({ aceptados: 'accepted' })] }))] }))],
})

// Format 6 → 7: a plan with no kind is a cabinet's.
const planV6 = (v: unknown) => (isObject(v) && !('kind' in v) ? { kind: 'cabinet', ...v } : v)
const stateV6 = fields({
  format: ['format', () => 7],
  versions: ['versions', list(fields({ plan: ['plan', planV6] }))],
  proposal: ['proposal', nullable(fields({ plan: ['plan', planV6] }))],
})

/** Brings a saved session up to the current format, one format at a time; anything it does not recognize is returned as is for the schema to judge. */
export function migrateState(raw: unknown): unknown {
  let state = raw
  if (isObject(state) && state.formato === 1) state = stateV1(state)
  if (isObject(state) && state.format === 2) state = stateV2(state)
  if (isObject(state) && state.format === 3) state = stateV3(state)
  if (isObject(state) && state.format === 4) state = stateV4(state)
  if (isObject(state) && state.format === 5) state = stateV5(state)
  if (isObject(state) && state.format === 6) state = stateV6(state)
  return state
}
