import { describe, expect, it } from 'vitest'
import saved from './state-v1.fixture.json'
import { migrateState } from './migrate'
import { currentDesign, DesignState } from './state'
import { analyze } from '../analysis'
import { testCatalog } from '../fixtures/catalog.test-util'

// A session saved by format 1, made with the simulated expert and completed by hand with what it does not produce:
// photos the expert asked for, a carpenter's opinion with problems and every kind of operation.

const SPANISH_KEYS = [
  'formato', 'medidas', 'versiones', 'actual', 'requisitos', 'decisiones', 'miniaturas', 'propuesta', 'dictamen', 'diseno', 'resumen', 'motivo',
  'operaciones', 'fecha', 'origen', 'esquema', 'nombre', 'dimensiones', 'anclajeMuro', 'piezas', 'uniones', 'observaciones', 'rol', 'veta', 'carga',
  'apoyo', 'cantos', 'grupo', 'confianza', 'desde', 'hasta', 'largo', 'tipo', 'mas', 'pegamento', 'penetracion', 'herrajes', 'herrajeId', 'cantidad',
  'autor', 'texto', 'preguntas', 'opciones', 'respondida', 'fotosPedidas', 'angulo', 'miniatura', 'respuestas', 'sugerencias', 'criticos',
  'firma', 'veredicto', 'comprobaciones', 'carpintero', 'titulo', 'estado', 'detalle', 'pedido', 'imposible', 'problemas', 'gravedad', 'consejos',
  'tema', 'proveedor', 'modelo', 'eje', 'cota', 'extremo', 'valor', 'regla', 'union', 'pieza', 'nuevoId', 'izquierda', 'derecha', 'abajo', 'arriba',
  'frente', 'fondo', 'materialFondo', 'ancho', 'alto',
]

function keys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keys(v, found))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      found.add(k)
      // Plans were already in English; their keys are not the saved format's.
      if (k !== 'plan') keys(v, found)
    }
  return found
}

describe('migrateState', () => {
  const migrated = DesignState.safeParse(migrateState(saved))

  it('reads a format 1 session as the current format', () => {
    expect(migrated.error?.issues).toBeUndefined()
    expect(migrated.data?.format).toBe(5)
  })

  it('translates the codes kept inside strings: accepted findings, the tray, the trace, checks and photo angles', () => {
    const older = structuredClone(saved) as typeof saved & { trace: unknown[]; tray: unknown[] }
    older.trace.push({ at: '', step: 'adjust', subject: null, attempt: 0, seconds: 1, outputTokens: null, promptId: null, outcome: 'invalid', errors: [{ code: 'E_TRASLAPE', message: 'x' }], repairs: [] })
    older.tray.push({ id: 'notice:finding:critico:R1_FLECHA:piso+R1_FLECHA:techo', kind: 'notice', text: 'x', label: 'x', answers: null })
    const answered = older.chat[1] as { respuestas: string[] }
    answered.respuestas = ['p0', 'f:interior']
    const state = DesignState.parse(migrateState(older))
    expect(state.accepted[0].key).toBe('R1_SAG:piso')
    expect(state.tray.at(-1)?.id).toBe('notice:finding:critical:R1_SAG:piso+R1_SAG:techo')
    expect(state.trace.at(-1)?.errors[0].code).toBe('E_OVERLAP')
    expect(state.review?.checks.map((c) => c.id)).toEqual(['measures', 'sheet', 'structure', 'strips', 'confirmed', 'margin'])
    expect(state.thumbnails[0].angle).toBe('front')
    expect(state.chat[1].answers).toEqual(['p0', 'f:inside'])
  })

  it('leaves no Spanish field names behind', () => {
    const left = [...keys(migrated.data)].filter((k) => SPANISH_KEYS.includes(k))
    expect(left).toEqual([])
  })

  it('keeps the design: the same pieces, joints and geometry', () => {
    const state = migrated.data!
    const before = saved.versiones.find((v) => v.n === saved.actual)!.diseno
    const design = currentDesign(state)
    expect(design.pieces.map((p) => p.id)).toEqual(before.piezas.map((p) => p.id))
    expect(design.joints.map((u) => u.id)).toEqual(before.uniones.map((u) => u.id))
    expect(design.dimensions).toEqual({ width: before.dimensiones.ancho, height: before.dimensiones.alto, depth: before.dimensiones.fondo })
    expect(JSON.stringify([state.versions, state.proposal])).not.toContain('mueble.')
    const analysis = analyze(design, testCatalog, state.requirements)
    expect(analysis.geo?.boxes.size).toBe(before.piezas.length)
  })

  it('translates values too: roles, joints, operations, verdicts and who wrote each message', () => {
    const state = migrated.data!
    const roles = new Set(currentDesign(state).pieces.map((p) => p.role))
    expect([...roles].every((r) => ['side', 'bottom', 'top', 'shelf', 'back', 'kick'].includes(r))).toBe(true)
    expect(state.chat.map((m) => m.author)).toEqual(saved.chat.map((m) => (m.autor === 'usuario' ? 'user' : 'expert')))
    expect(state.chat.find((m) => m.requestedPhotos.length)?.requestedPhotos).toEqual([{ angle: 'inside', reason: 'Ver cómo va la trasera' }])
    expect(state.proposal?.operations[0].op).toBe('resizeFurniture')
    expect(state.versions[0].origin).toMatchObject({ provider: 'simulated', promptId: 'simulated@1' })
    expect(state.review).toMatchObject({ verdict: 'needs-changes', carpenter: { verdict: 'needs-changes', problems: [{ severity: 'medium' }], tips: ['Mide el espesor real'] } })
    expect(state.review?.checks[0]).toMatchObject({ status: 'fail', impossible: true })
    const extras = state.versions.at(-1)!.extras
    expect(extras.map((o) => o.op)).toEqual([
      'addPiece', 'removePiece', 'removeGroup', 'duplicatePiece', 'resize', 'move', 'distribute', 'changeMaterial',
      'changeProperties', 'addJoint', 'changeJoint', 'removeJoint', 'resizeFurniture', 'setWallAnchored', 'addDrawer',
    ])
    expect(extras[0]).toMatchObject({ piece: { support: 'movable', confidence: 'low', load: 'light', grain: 'width', y: { from: { type: 'between', offset: -9 } } } })
    expect(extras[9]).toMatchObject({ joint: { type: 'pocket-screw', glue: true, hardware: [{ hardwareId: 'screw-8x2', count: 2 }] } })
    expect(extras[14]).toMatchObject({ group: 'cajon-1', left: 'lat-izq.x1', back: 'trasera.z1', bottomMaterial: 'TR6' })
  })

  it('leaves the current format as it is', () => {
    expect(migrateState(migrated.data)).toBe(migrated.data)
  })
})
