import { describe, expect, it } from 'vitest'
import { analyze } from '../domain/analysis'
import { createSimulated } from '../adapters/llm/simulado/simulated'
import { startAt, makePiece, ref, extent } from '../domain/diseno/builders'
import type { BedPlan } from '../domain/modules/bed'
import { DEFAULT_CONSTRUCTION, type CabinetPlan } from '../domain/modules/cabinet'
import type { Design } from '../domain/diseno/schema'
import type { Operation } from '../domain/operaciones/schema'
import { testCatalog } from '../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../domain/fixtures/bookcase'
import { currentDesign, type DesignState } from '../domain/sesion/state'
import type { DesignRepository } from '../ports/DesignRepository'
import { InvalidResponse, type LLMProvider, type PlanAdjustment, type AdjustmentResponse } from '../ports/LLMProvider'
import { createUseCases, currentPlan, reviewSignature } from './useCases'
import { buildContext } from './context'
import { noticeBoard } from './notices'
import { fixesFor } from '../domain/fixes/fixes'
import { answerItem, suggestionItem } from '../domain/tray/tray'

const memoria = (): DesignRepository & { estado: DesignState | null } => ({
  estado: null,
  load() {
    return this.estado
  },
  save(e) {
    this.estado = e
  },
  clear() {
    this.estado = null
  },
})

let id = 0
const casos = (llm: LLMProvider = createSimulated(0)) => {
  const repositorio = memoria()
  return { repositorio, ...createUseCases({ llm: () => llm, catalog: testCatalog, repository: repositorio, now: () => '2026-09-24T10:00:00Z', newId: () => `m${++id}` }) }
}
const senal = () => new AbortController().signal
const MEDIDAS_LIBRERO = { width: 600, height: 1800, depth: 300 }
const ajusteVacio: AdjustmentResponse = { explanation: 'Listo', summary: '', operations: [], questions: [], requestedPhotos: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], acceptedRisks: [] }

async function libreroInicial(c = casos()) {
  return c.reconstruct({ measures: MEDIDAS_LIBRERO, photos: [{ angle: 'front', base64: '' }], thumbnails: [], notes: '' }, senal())
}

describe('reconstruct', () => {
  it('builds version 1 with the expert explanation and questions, and saves it', async () => {
    const c = casos()
    const etapas: string[] = []
    const estado = await c.reconstruct({ measures: MEDIDAS_LIBRERO, photos: [{ angle: 'front', base64: '' }], thumbnails: [], notes: '' }, senal(), (e) => etapas.push(e))
    expect(estado.versions).toHaveLength(1)
    expect(currentDesign(estado).name).toBe('Librero')
    expect(estado.chat[1].questions.flatMap((p) => p.options)).toContain('Libros')
    expect(estado.chat[1].requestedPhotos).toEqual([{ angle: 'interior', reason: 'Para ver cómo va fijada la trasera' }])
    expect(etapas).toEqual(['reading-photos', 'reading-photos', 'designing', 'designing-pieces', 'checking', 'structure'])
    expect(c.repositorio.estado).toEqual(estado)
  })
})

describe('reconstruct without photos', () => {
  it('builds the design from the description, without asking for photos, and offers the drawer as a question', async () => {
    const c = casos()
    const estado = await c.reconstruct(
      { measures: { width: 600, height: 1800, depth: 500 }, photos: [], thumbnails: [], notes: 'Un librero con repisas para libros y un cajón abajo' },
      senal(),
    )
    expect(currentDesign(estado).name).toBe('Librero')
    expect(estado.chat[1].requestedPhotos).toEqual([])
    expect(estado.chat[1].text).toContain('Con tu descripción')
    const opciones = estado.chat[1].questions.flatMap((p) => p.options ?? [])
    expect(opciones).toContain('Agrega un cajón abajo')
    const conCajon = await c.adjust(estado, 'Agrega un cajón abajo', senal(), undefined, `${estado.chat[1].id}#p1`)
    expect(currentDesign(conCajon).pieces.some((p) => p.group === 'cajon-1')).toBe(true)
  })

  it('the description stays in the chat and, without measures, the expert estimates them and says so', async () => {
    const estado = await casos().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un buró sencillo con una repisa' }, senal())
    expect(estado.chat[0]).toMatchObject({ author: 'user', text: 'Un buró sencillo con una repisa\n\nNo sé las medidas.' })
    expect(currentDesign(estado).name).toBe('Buró')
    expect(estado.measures).toEqual(currentDesign(estado).dimensions)
    expect(estado.chat[1].text).toContain('las estimé')
    expect(estado.chat[1].suggestions.length).toBeGreaterThan(0)
  })

  it('the simulated expert does not make up a bookcase when asked for other furniture', async () => {
    await expect(casos().reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Una banca para el recibidor' }, senal())).rejects.toThrow(/conecta un experto real/)
  })
})

describe('provider warnings', () => {
  it('they reach the chat along with the expert explanation', async () => {
    const simulado = createSimulated(0)
    const aviso = 'SheLLM no aceptó las fotos, así que el experto trabajó sin verlas.'
    const llm: LLMProvider = { ...simulado, reconstruct: async (s, signal) => ({ ...(await simulado.reconstruct(s, signal)), warnings: [aviso] }) }
    const estado = await libreroInicial(casos(llm))
    expect(estado.chat[1].text).toContain(aviso)
  })
})

describe('adjust', () => {
  it('"hazlo de 90 cm" stays a pending proposal because of sag, and "divisor" resolves it', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const ancho = await c.adjust(inicial, 'Hazlo de 90 cm de ancho para mi espacio', senal())
    expect(ancho.proposal?.critical.map((x) => x.code)).toContain('R1_SAG')
    expect(ancho.versions).toHaveLength(1)
    expect(ancho.chat.at(-1)?.proposal).toBe('pending')

    const aplicado = c.applyProposal(ancho)
    expect(aplicado.versions).toHaveLength(2)
    expect(currentDesign(aplicado).dimensions.width).toBe(900)
    expect(aplicado.requirements.map((r) => r.id)).toEqual(['espacio-ancho'])

    const conDivisor = await c.adjust(aplicado, 'Agrega un divisor al centro', senal())
    expect(conDivisor.versions).toHaveLength(3)
    expect(currentDesign(conDivisor).pieces.some((p) => p.id === 'divisor')).toBe(true)
    expect(conDivisor.chat.at(-1)?.version).toBe(3)
  })

  it('for a critical finding without options from the expert, it offers the rules alternatives; choosing one resolves everything together', async () => {
    const c = casos()
    const pendiente = await c.adjust(await libreroInicial(c), 'Hazlo de 90 cm de ancho', senal())
    const opciones = pendiente.chat.at(-1)!.questions[0].options!
    expect(opciones).toContain('Agregar un divisor vertical al centro')
    const resuelto = await c.adjust(pendiente, opciones[0], senal(), undefined, pendiente.chat.at(-1)!.id)
    expect(resuelto.proposal).toBeNull()
    expect(currentDesign(resuelto).dimensions.width).toBe(900)
    expect(currentDesign(resuelto).pieces.map((p) => p.id)).toEqual(expect.arrayContaining(['divisor', 'apoyo-piso', 'entrepano-1-der']))
    expect(resuelto.versions.at(-1)?.summary).toBe('Ensanchar con divisor al centro')
  })

  it('a change without critical findings makes a new version', async () => {
    const c = casos()
    const estado = await c.adjust(await libreroInicial(c), 'Refuerza la base', senal())
    expect(estado.versions.map((v) => v.summary)).toEqual(['Reconstrucción desde fotos', 'Reforzar la base'])
    expect(estado.versions[1].operations[0]).toBe('+refuerzo-base')
  })

  it('retries with the errors and, if it fails, says so without applying anything', async () => {
    const pedidos: (string | null)[] = []
    const roto: AdjustmentResponse = {
      explanation: 'Saco el lateral',
      summary: 'Sacar lateral',
      operations: [{ op: 'move', id: 'lat-izq', axis: 'x', at: { type: 'mm', mm: -50 } }],
      questions: [],
      requestedPhotos: [],
      requirements: { add: [], remove: [] },
      decisions: [],
      acceptedRisks: [],
      suggestions: [],
    }
    const simulado = createSimulated(0)
    const llm: LLMProvider = {
      ...simulado,
      async proposeAdjustment(s) {
        pedidos.push(s.correction?.errors ?? null)
        return { value: roto, origin: { promptId: 't', provider: 't', model: 't' }, usage: {} }
      },
    }
    const c = casos(llm)
    const inicial = await libreroInicial(c)
    const estado = await c.adjust(inicial, 'Quita el lateral izquierdo', senal())
    expect(pedidos).toHaveLength(3)
    expect(pedidos[1]).toContain('E_')
    expect(estado.versions).toHaveLength(1)
    expect(estado.chat.at(-1)).toMatchObject({ author: 'expert', error: true })
  })

  it('an answer with an invalid format goes back to be corrected', async () => {
    let llamadas = 0
    const simulado = createSimulated(0)
    const llm: LLMProvider = {
      ...simulado,
      async proposeAdjustment(s, signal) {
        if (llamadas++ === 0) throw new InvalidResponse({ basura: true }, 'falta "operaciones"')
        expect(s.correction?.errors).toBe('falta "operaciones"')
        return simulado.proposeAdjustment(s, signal)
      },
    }
    const c = casos(llm)
    const estado = await c.adjust(await libreroInicial(c), 'Refuerza la base', senal())
    expect(estado.versions).toHaveLength(2)
  })

  it('a provider error stays in the chat', async () => {
    const llm: LLMProvider = {
      ...createSimulated(0),
      proposeAdjustment: async () => {
        throw new Error('La API key no es válida.')
      },
    }
    const c = casos(llm)
    const estado = await c.adjust(await libreroInicial(c), 'Refuerza la base', senal())
    expect(estado.chat.at(-1)).toMatchObject({ text: 'La API key no es válida.', error: true })
  })

  it('a photo the expert asked for travels to the model, confirms the piece and stays as a thumbnail', async () => {
    const vistas: number[] = []
    const simulado = createSimulated(0)
    const llm: LLMProvider = { ...simulado, proposeAdjustment: (s, signal) => (vistas.push(s.photos.length), simulado.proposeAdjustment(s, signal)) }
    const c = casos(llm)
    const inicial = await libreroInicial(c)
    expect(currentDesign(inicial).pieces.find((p) => p.id === 'trasera')?.confidence).toBe('low')
    const foto = { angle: 'interior', base64: 'AAA', thumbnail: 'data:image/jpeg;base64,AAA' }
    const estado = await c.adjust(inicial, 'Te mando la foto: interior', senal(), undefined, `${inicial.chat[1].id}#f:interior`, foto)
    expect(estado.chat[1]).toMatchObject({ answers: ['f:interior'], answered: false })
    expect(vistas).toEqual([1])
    expect(currentDesign(estado).pieces.find((p) => p.id === 'trasera')?.confidence).toBe('high')
    expect(estado.thumbnails.map((m) => m.angle)).toContain('interior')
    expect(estado.chat.at(-2)?.thumbnail).toBe(foto.thumbnail)
  })

  it('confirming a sketched piece by hand makes a version', async () => {
    const c = casos()
    const estado = c.confirmPiece(await libreroInicial(c), 'trasera')
    expect(currentDesign(estado).pieces.find((p) => p.id === 'trasera')?.confidence).toBe('high')
    expect(estado.versions.at(-1)?.summary).toBe('Confirmar trasera')
    expect(c.confirmPiece(estado, 'trasera')).toBe(estado)
  })

  it('answering a question marks it answered', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const estado = await c.adjust(inicial, 'Libros', senal(), undefined, inicial.chat[1].id)
    expect(estado.chat[1].answered).toBe(true)
    const porPartes = await c.adjust(inicial, 'Libros', senal(), undefined, `${inicial.chat[1].id}#p1`)
    expect(porPartes.chat[1]).toMatchObject({ answers: ['p1'], answered: false })
    const juntas = await c.adjust(inicial, 'Libros', senal(), undefined, `${inicial.chat[1].id}#p0,p1`)
    expect(juntas.chat[1].answers).toEqual(['p0', 'p1'])
    expect(estado.requirements.map((r) => r.id)).toContain('carga-libros')
  })
})

describe('versions', () => {
  it('going back to a version makes a new one equal to it', async () => {
    const c = casos()
    const dos = await c.adjust(await libreroInicial(c), 'Refuerza la base', senal())
    const tres = c.backToVersion(dos, 1)
    expect(tres.versions.map((v) => v.n)).toEqual([1, 2, 3])
    expect(currentDesign(tres)).toEqual(tres.versions[0].design)
  })

  it('going back to a version restores its decisions but leaves the requirements alone', async () => {
    const c = casos()
    const conNota = c.addRequirement(await libreroInicial(c), 'Lo voy a pintar')
    const dos = await c.adjust(conNota, 'Refuerza la base', senal())
    expect(dos.decisions).toHaveLength(1)
    const tres = c.backToVersion(dos, 1)
    expect(tres.decisions).toEqual([])
    expect(tres.requirements.map((r) => r.text)).toEqual(['Lo voy a pintar'])
    expect(c.backToVersion(tres, 2).decisions.map((d) => d.topic)).toEqual(['base'])
  })

  it('going back to the current version does nothing', async () => {
    const c = casos()
    const uno = await libreroInicial(c)
    expect(c.backToVersion(uno, 1)).toBe(uno)
  })

  it('the person notes and decisions can be added and removed', async () => {
    const c = casos()
    const conNota = c.addRequirement(await libreroInicial(c), '  Lo voy a pintar de blanco ')
    expect(conNota.requirements).toEqual([expect.objectContaining({ text: 'Lo voy a pintar de blanco', type: 'other' })])
    expect(c.removeRequirement(conNota, conNota.requirements[0].id).requirements).toEqual([])
    const conDecision = await c.adjust(conNota, 'Refuerza la base', senal())
    expect(conDecision.decisions.map((d) => d.topic)).toEqual(['base'])
    expect(c.removeDecision(conDecision, 'base').decisions).toEqual([])
  })

  it('discarding a proposal makes no version', async () => {
    const c = casos()
    const pendiente = await c.adjust(await libreroInicial(c), 'Hazlo de 90 cm de ancho', senal())
    const descartada = c.discardProposal(pendiente)
    expect(descartada.proposal).toBeNull()
    expect(descartada.versions).toHaveLength(1)
    expect(descartada.chat.at(-1)).toMatchObject({ proposal: 'discarded', answered: true })
  })
})

describe('buildContext', () => {
  it('includes design, geometry, review, requirements, log and recent chat', async () => {
    const c = casos()
    const estado = c.applyProposal(await c.adjust(await libreroInicial(c), 'Hazlo de 90 cm de ancho', senal()))
    const texto = buildContext(estado, testCatalog)
    for (const parte of ['## Diseño actual (v2)', 'lat-der: 882–900', 'R1_SAG', 'El espacio mide 90 cm', 'v2: Ensanchar a 90 cm', 'Usuario: Hazlo de 90 cm']) expect(texto).toContain(parte)
  })
})

describe('reviewPurchase', () => {
  it('saves the checks and the carpenter opinion with the version signature', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const estado = c.saveReview(inicial, await c.reviewPurchase(inicial, testCatalog, senal()))
    expect(estado.review).toMatchObject({ verdict: 'viable', error: null, signature: reviewSignature(inicial, testCatalog) })
    expect(estado.review!.checks.find((x) => x.id === 'confirmed')?.status).toBe('warning')
    expect(estado.review!.carpenter?.tips.length).toBeGreaterThan(0)
    expect(c.repositorio.estado?.review).toEqual(estado.review)
    const cambiado = await c.adjust(estado, 'Refuerza la base', senal())
    expect(reviewSignature(cambiado, testCatalog)).not.toBe(estado.review!.signature)
  })

  it('the carpenter cannot approve what the arithmetic marks impossible', async () => {
    const simulado = createSimulated(0)
    const llm: LLMProvider = { ...simulado, reviewPurchase: async (s, signal) => ({ ...(await simulado.reviewPurchase(s, signal)), value: { verdict: 'viable', summary: 'Todo bien', problems: [], tips: [] } }) }
    const c = casos(llm)
    const estrecho = { ...testCatalog, acomodo: { ...testCatalog.acomodo, refilado: 400 } }
    const dictamen = await c.reviewPurchase(await libreroInicial(c), estrecho, senal())
    expect(dictamen.verdict).toBe('not-viable')
  })

  it('if the carpenter does not answer, the arithmetic review stays with the reason', async () => {
    const llm: LLMProvider = { ...createSimulated(0), reviewPurchase: async () => Promise.reject(new Error('No se pudo conectar con SheLLM.')) }
    const c = casos(llm)
    const dictamen = await c.reviewPurchase(await libreroInicial(c), testCatalog, senal())
    expect(dictamen).toMatchObject({ verdict: 'viable', carpenter: null, error: 'No se pudo conectar con SheLLM.' })
  })
})

describe('never throw away a paid design', () => {
  // A shelf floating in the middle, touching nothing: it resolves, but no rule can say where it should go.
  const conFlotante = (d: Design): Design => ({
    ...d,
    pieces: [
      ...d.pieces,
      {
        ...d.pieces.find((p) => p.id === 'entrepano-1')!,
        id: 'entrepano-extra',
        name: 'Entrepaño extra',
        x: { from: ref('lat-izq.x1', 60), to: ref('lat-der.x0', -60), length: null },
        y: { from: ref('entrepano-1.y1', 100), to: null, length: null },
        z: { from: ref('trasera.z1', 60), to: ref('mueble.z1', -60), length: null },
      },
    ],
  })
  const conEncimada = (d: Design): Design => ({ ...d, pieces: [...d.pieces, { ...d.pieces.find((p) => p.id === 'entrepano-1')!, id: 'entrepano-copia', name: 'Entrepaño copia' }] })
  const cambiando = (cambio: (d: Design) => Design): LLMProvider => {
    const simulado = createSimulated(0)
    return { ...simulado, reconstruct: async (s, signal) => { const r = await simulado.reconstruct(s, signal); return { ...r, value: { ...r.value, design: cambio(r.value.design) } } } }
  }
  const encimando = () => cambiando(conFlotante)

  it('an overlap is fixed by rule, without asking the model again', async () => {
    const estado = await libreroInicial(casos(cambiando(conEncimada)))
    expect(currentDesign(estado).pieces.some((p) => p.id === 'entrepano-copia')).toBe(false)
    expect(estado.trace.map((t) => t.step)).toEqual(['read', 'plan', 'reconstruct'])
    expect(estado.trace[2]).toMatchObject({ outcome: 'ok', repairs: ['Quité Entrepaño copia: estaba completa dentro de Entrepaño 1.'] })
    expect(estado.chat[1].text).toContain('Ajusté por mi cuenta un detalle')
  })

  it('after every attempt fails validation, keeps the last design and says what is left', async () => {
    const c = casos(encimando())
    const estado = await libreroInicial(c)
    expect(currentDesign(estado).pieces.some((p) => p.id === 'entrepano-extra')).toBe(true)
    expect(estado.chat[1].text).toContain('quedaron una pieza sin apoyo')
    expect(estado.chat[1].suggestions[0]).toBe('Corrige las piezas marcadas')
    const disenos = estado.trace.filter((t) => t.step === 'reconstruct')
    expect(disenos.map((t) => t.outcome)).toEqual(['invalid', 'invalid', 'invalid'])
    expect(disenos[0].errors[0].code).toBe('E_FLOATING')
  })

  it('a change that fixes the problem is applied, and one that adds a new problem is not', async () => {
    const c = casos(encimando())
    const inicial = await libreroInicial(c)
    const quitar = { ...createSimulated(0), proposeAdjustment: async () => ({ value: { ...ajusteVacio, summary: 'Quitar extra', operations: [{ op: 'removePiece' as const, id: 'entrepano-extra' }] }, origin: { promptId: "p", provider: "x", model: "m" }, usage: {} }) }
    const arreglado = await casos(quitar).adjust(inicial, 'Corrige las piezas marcadas', senal())
    expect(currentDesign(arreglado).pieces.some((p) => p.id === 'entrepano-extra')).toBe(false)
    expect(arreglado.trace.at(-1)).toMatchObject({ step: 'adjust', outcome: 'ok', errors: [] })

    const romper = { ...createSimulated(0), proposeAdjustment: async () => ({ value: { ...ajusteVacio, summary: 'Mover', operations: [{ op: 'move' as const, id: 'lat-izq', axis: 'x' as const, at: { type: 'mm' as const, mm: -50 } }] }, origin: { promptId: "p", provider: "x", model: "m" }, usage: {} }) }
    const peor = await casos(romper).adjust(inicial, 'Mueve el lateral', senal())
    expect(peor.versions).toHaveLength(1)
    expect(peor.chat.at(-1)?.error).toBe(true)
  })

  it('a provider failure carries the trace so far', async () => {
    const llm: LLMProvider = { ...createSimulated(0), reconstruct: async () => Promise.reject(new Error('No se pudo conectar')) }
    await expect(libreroInicial(casos(llm))).rejects.toMatchObject({ message: 'No se pudo conectar', trace: [{ step: 'read', outcome: 'ok' }, { step: 'plan', outcome: 'ok' }, { outcome: 'failed', step: 'reconstruct' }] })
  })
})

describe('photos are read once, in parallel, and not sent again', () => {
  const dosFotos = { measures: MEDIDAS_LIBRERO, photos: [{ angle: 'frente', base64: 'AAA', note: 'la de abajo es puerta' }, { angle: 'lateral', base64: 'BBB' }], thumbnails: [], notes: 'librero' }
  const espiando = (falla: (angulo: string) => boolean = () => false) => {
    const simulado = createSimulated(0)
    const lecturas: string[] = []
    const disenos: { fotos: number; lectura: boolean }[] = []
    const llm: LLMProvider = {
      ...simulado,
      readPhoto: async (r, signal) => {
        lecturas.push(`${r.photo.angle}:${r.photo.note ?? ''}`)
        if (falla(r.photo.angle)) throw new Error('sin conexión')
        return simulado.readPhoto(r, signal)
      },
      reconstruct: async (s, signal) => {
        disenos.push({ fotos: s.photos.length, lectura: !!s.reading })
        return simulado.reconstruct(s, signal)
      },
    }
    return { llm, lecturas, disenos }
  }

  it('reads each photo with its note and designs from the reading, without the images', async () => {
    const { llm, lecturas, disenos } = espiando()
    const estado = await casos(llm).reconstruct(dosFotos, senal())
    expect(lecturas.sort()).toEqual(['frente:la de abajo es puerta', 'lateral:'])
    expect(disenos).toEqual([{ fotos: 0, lectura: true }])
    expect(estado.chat[0].text).toContain('Sobre la foto frente: la de abajo es puerta')
    expect(estado.trace.filter((t) => t.step === 'read').map((t) => t.subject).sort()).toEqual(['Foto frente', 'Foto lateral'])
  })

  it('does not read the same photo twice in a session', async () => {
    const { llm, lecturas } = espiando()
    const c = casos(llm)
    await c.reconstruct(dosFotos, senal())
    await c.reconstruct(dosFotos, senal())
    expect(lecturas).toHaveLength(2)
  })

  it('a photo that cannot be read is retried alone and then left out', async () => {
    const { llm, lecturas, disenos } = espiando((angulo) => angulo === 'lateral')
    await casos(llm).reconstruct(dosFotos, senal())
    expect(lecturas.filter((l) => l.startsWith('lateral'))).toHaveLength(2)
    expect(disenos).toEqual([{ fotos: 0, lectura: true }])
  })

  it('if no photo can be read, the design looks at the photos itself', async () => {
    const { llm, disenos } = espiando(() => true)
    await casos(llm).reconstruct(dosFotos, senal())
    expect(disenos).toEqual([{ fotos: 2, lectura: false }])
  })
})

describe('skeleton first: a cabinet is built by Knotty from its plan', () => {
  const cabinetPlan = {
    name: 'Cajonera',
    dimensions: { width: 500, height: 900, depth: 450 },
    material: 'T18',
    base: 'kick' as const,
    wallMounted: true,
    construction: DEFAULT_CONSTRUCTION,
    columns: [{ width: 1, cells: [0, 1, 2].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }],
  }
  const origen = { promptId: 'esqueleto@5', provider: 'x', model: 'm' }
  const conPlan = (cabinet: typeof cabinetPlan | null, falla = false, bed: BedPlan | null = null) => {
    const simulado = createSimulated(0)
    const llamadas: string[] = []
    const llm: LLMProvider = {
      ...simulado,
      planDesign: async () => {
        llamadas.push('plan')
        if (falla) throw new Error('sin conexión')
        return { value: { explanation: 'Una cajonera de tres cajones.', cabinet, bed, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: ['Hazla más alta'] }, origin: origen, usage: { outputTokens: 400 } }
      },
      reconstruct: async (s, signal) => {
        llamadas.push('diseno')
        return simulado.reconstruct(s, signal)
      },
    }
    return { llm, llamadas }
  }
  const pedido = (notas: string) => ({ measures: null, photos: [], thumbnails: [], notes: notas })

  it('builds the cabinet without asking for pieces, with its drawers and joints', async () => {
    const { llm, llamadas } = conPlan(cabinetPlan)
    const estado = await casos(llm).reconstruct(pedido('Una cajonera de tres cajones'), senal())
    expect(llamadas).toEqual(['plan'])
    const d = currentDesign(estado)
    expect(d.name).toBe('Cajonera')
    expect(new Set(d.pieces.map((p) => p.group).filter(Boolean)).size).toBe(3)
    expect(analyze(d, testCatalog).valid).toBe(true)
    expect(estado.trace.map((t) => [t.step, t.outcome])).toEqual([['plan', 'ok']])
    expect(estado.chat[1].suggestions).toEqual(['Hazla más alta'])
  })

  it('uses the measures the person gave over the plan', async () => {
    const { llm } = conPlan(cabinetPlan)
    const estado = await casos(llm).reconstruct({ ...pedido('Una cajonera'), measures: { width: 600, height: 1000, depth: 500 } }, senal())
    expect(currentDesign(estado).dimensions).toEqual({ width: 600, height: 1000, depth: 500 })
  })

  it('not a cabinet, or the skeleton fails: designs it whole', async () => {
    for (const [cabinet, falla] of [[null, false], [cabinetPlan, true]] as const) {
      const { llm, llamadas } = conPlan(cabinet, falla)
      await casos(llm).reconstruct(pedido('Un librero'), senal())
      expect(llamadas).toEqual(['plan', 'diseno'])
    }
  })

  it('the plan is kept with the version, and the ficha rebuilds it at once without the expert', async () => {
    const { llm, llamadas } = conPlan(cabinetPlan)
    const c = casos(llm)
    const inicial = await c.reconstruct(pedido('Una cajonera de tres cajones'), senal())
    expect(currentPlan(inicial)).toMatchObject({ since: 1, diverged: false })
    const cuatro = { ...(currentPlan(inicial).plan as CabinetPlan), columns: [{ width: 1, cells: [0, 1, 2, 3].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }] }
    const r = c.applyPlan(inicial, { ...cuatro, construction: { ...cuatro.construction, drawerFronts: 'overlay' } })
    if (!r.ok) throw new Error(r.message)
    expect(llamadas).toEqual(['plan'])
    expect(new Set(currentDesign(r.state).pieces.map((p) => p.group).filter(Boolean)).size).toBe(4)
    expect(r.state.chat.at(-1)?.text).toBe('Cambié desde la ficha: frentes de cajón sobrepuestos, 4 cajones.')
    expect(r.state.versions.at(-1)).toMatchObject({ n: 2, summary: 'Ficha: frentes de cajón sobrepuestos, 4 cajones' })
    expect(currentPlan(r.state)).toMatchObject({ since: 2, diverged: false })
  })

  it('after a free-form change the plan is behind; going back to its version restores it', async () => {
    const { llm } = conPlan(cabinetPlan)
    const c = casos(llm)
    const inicial = await c.reconstruct(pedido('Una cajonera de tres cajones'), senal())
    const libre = { ...inicial, versions: [...inicial.versions, { ...inicial.versions[0], n: 2, plan: null }], current: 2 }
    expect(currentPlan(libre)).toMatchObject({ since: 1, diverged: true })
    expect(currentPlan(c.backToVersion(libre, 1))).toMatchObject({ since: 3, diverged: false })
  })

  it('a plan that cannot be built is refused with the reason', async () => {
    const { llm } = conPlan(cabinetPlan)
    const c = casos(llm)
    const inicial = await c.reconstruct(pedido('Una cajonera'), senal())
    const r = c.applyPlan(inicial, { ...currentPlan(inicial).plan!, dimensions: { width: 500, height: 3000, depth: 450 } })
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/más grandes? que la hoja\. Trasera mide 3000/) })
  })

  it('a bench skips the skeleton: it has no ficha yet', async () => {
    const { llm, llamadas } = conPlan(cabinetPlan)
    await expect(casos(llm).reconstruct(pedido('Una banca para el recibidor'), senal())).rejects.toThrow()
    expect(llamadas).toEqual(['diseno'])
  })

  it('a desk goes through its own ficha, with the measures given', async () => {
    const c = casos()
    const estado = await c.reconstruct({ measures: { width: 1300, height: 750, depth: 600 }, photos: [], thumbnails: [], notes: 'Un escritorio con 3 cajones a la izquierda' }, senal())
    expect(currentPlan(estado).plan).toMatchObject({ kind: 'table', use: 'desk', pedestal: { side: 'left', drawers: 3 } })
    const design = currentDesign(estado)
    expect(design.dimensions).toEqual({ width: 1300, height: 750, depth: 600 })
    expect(design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(3)
  })

  it('a bed goes through its own ficha and Knotty builds it, measures from the mattress', async () => {
    const bed: BedPlan = { kind: 'bed', name: 'Cama individual', mattress: 'individual', material: 'T18', height: 400, drawers: { side: 'left', count: 3, position: 'head' }, headboard: { style: 'storage', height: 1100, depth: 250, shelves: 2 } }
    const { llm, llamadas } = conPlan(null, false, bed)
    const estado = await casos(llm).reconstruct(pedido('Una cama individual con cajones y cabecera librero'), senal())
    expect(llamadas).toEqual(['plan'])
    expect(currentPlan(estado).plan).toMatchObject({ kind: 'bed', mattress: 'individual' })
    const design = currentDesign(estado)
    expect(design.pieces.filter((p) => p.role === 'drawer-front')).toHaveLength(3)
    expect(design.dimensions).toEqual({ width: 250 + 1900 + 20 + 18, height: 1100, depth: 1010 })
  })
})

describe('the ficha stays alive: chat edits it, and free changes ride on top', () => {
  const drawers = (n: number) => ({
    name: 'Cajonera',
    dimensions: { width: 500, height: 900, depth: 450 },
    material: 'T18',
    base: 'kick' as const,
    wallMounted: true,
    construction: DEFAULT_CONSTRUCTION,
    columns: [{ width: 1, cells: Array.from({ length: n }, () => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }],
  })
  const origen = { promptId: 'x', provider: 'x', model: 'm' }
  const hanger = makePiece({ id: 'liston', name: 'Listón de colgar', role: 'brace', material: 'T18', normal: 'z', x: extent(ref('lat-izq.x1'), ref('lat-der.x0')), y: extent(null, ref('techo.y0'), 80), z: startAt(ref('trasera.z1')) })
  const expert = (adjust: Partial<PlanAdjustment> | null, operations: Operation[] = []) => {
    const simulado = createSimulated(0)
    const calls: string[] = []
    const llm: LLMProvider = {
      ...simulado,
      planDesign: async () => ({ value: { explanation: 'Cajonera.', cabinet: drawers(3), bed: null, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: [] }, origin: origen, usage: {} }),
      adjustPlan: adjust
        ? async () => {
            calls.push('ficha')
            return { value: { explanation: 'Listo.', summary: 'Cambio', action: 'plan', cabinet: null, bed: null, table: null, questions: [], suggestions: [], requirements: { add: [], remove: [] }, decisions: [], ...adjust }, origin: origen, usage: {} }
          }
        : null,
      proposeAdjustment: async () => {
        calls.push('piezas')
        return { value: { ...ajusteVacio, summary: 'Agregar listón', operations: operations }, origin: origen, usage: {} }
      },
    }
    return { llm, calls }
  }
  const start = async (llm: LLMProvider) => {
    const c = casos(llm)
    return { c, inicial: await c.reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Una cajonera' }, senal()) }
  }

  it('a change the ficha can express comes back as a new ficha, with no pieces asked', async () => {
    const { llm, calls } = expert({ action: 'plan', cabinet: drawers(4), summary: 'Agregar un cajón' })
    const { c, inicial } = await start(llm)
    const estado = await c.adjust(inicial, 'Ponle un cajón más', senal())
    expect(calls).toEqual(['ficha'])
    expect(currentPlan(estado)).toMatchObject({ since: 2, diverged: false })
    expect(new Set(currentDesign(estado).pieces.map((p) => p.group).filter(Boolean)).size).toBe(4)
  })

  it('a question gets an answer and no new version', async () => {
    const { llm, calls } = expert({ action: 'answer', explanation: 'Las correderas son de 40 cm.' })
    const { c, inicial } = await start(llm)
    const estado = await c.adjust(inicial, '¿De qué largo son las correderas?', senal())
    expect(calls).toEqual(['ficha'])
    expect(estado.versions).toHaveLength(1)
    expect(estado.chat.at(-1)?.text).toBe('Las correderas son de 40 cm.')
  })

  it('what the ficha cannot express goes piece by piece and rides on top as an extra that survives the ficha', async () => {
    const { llm, calls } = expert({ action: 'freeform' }, [{ op: 'addPiece', piece: hanger }])
    const { c, inicial } = await start(llm)
    const conListon = await c.adjust(inicial, 'Ponle un listón para colgarla', senal())
    expect(calls).toEqual(['ficha', 'piezas'])
    expect(currentPlan(conListon)).toMatchObject({ diverged: false, extras: [{ op: 'addPiece' }] })
    const r = c.applyPlan(conListon, { ...drawers(3), dimensions: { width: 600, height: 900, depth: 450 } })
    if (!r.ok) throw new Error(r.message)
    expect(currentDesign(r.state).pieces.some((p) => p.id === 'liston')).toBe(true)
    expect(analyze(currentDesign(r.state), testCatalog).valid).toBe(true)
  })

  it('an extra that no longer applies to the new ficha is left out, and said', async () => {
    const { llm } = expert({ action: 'freeform' }, [{ op: 'removeGroup', group: 'cajon-3' }])
    const { c, inicial } = await start(llm)
    const sinTercero = await c.adjust(inicial, 'Quita el cajón de arriba y deja el hueco', senal())
    const r = c.applyPlan(sinTercero, drawers(2))
    if (!r.ok) throw new Error(r.message)
    expect(r.notes.join(' ')).toContain('ya no aplica')
    expect(currentPlan(r.state).extras).toEqual([])
  })

  it('a ficha that cannot be built falls back to pieces', async () => {
    const { llm, calls } = expert({ action: 'plan', cabinet: { ...drawers(3), dimensions: { width: 500, height: 3000, depth: 450 } } }, [{ op: 'addPiece', piece: hanger }])
    const { c, inicial } = await start(llm)
    await c.adjust(inicial, 'Hazla de 3 metros', senal())
    expect(calls).toEqual(['ficha', 'piezas'])
  })
})

describe('editing a piece by hand, without the expert', () => {
  const box = (estado: DesignState, id: string) => {
    const a = analyze(currentDesign(estado), testCatalog)
    if (!a.valid) throw new Error(a.errors[0].message)
    return a.geo.boxes.get(id)!
  }
  const start = () => {
    const c = casos()
    return { c, inicial: c.fromExample(exampleBookcase) }
  }

  it('moves a shelf and changes its thickness, each in one version', () => {
    const { c, inicial } = start()
    const moved = c.editPiece(inicial, 'entrepano-1', { kind: 'move', axis: 'y', delta: 50 })
    if (!moved.ok) throw new Error(moved.message)
    expect(box(moved.state, 'entrepano-1').y0).toBe(box(inicial, 'entrepano-1').y0 + 50)
    expect(moved.state.chat.at(-1)?.text).toBe('Cambié a mano: Mover entrepaño 1 50 mm.')
    const thinner = c.editPiece(moved.state, 'entrepano-1', { kind: 'thickness', material: 'T15' })
    if (!thinner.ok) throw new Error(thinner.message)
    expect(box(thinner.state, 'entrepano-1').y1 - box(thinner.state, 'entrepano-1').y0).toBe(15)
    expect(thinner.state.versions.map((v) => v.n)).toEqual([1, 2, 3])
  })

  it('a shelf longer than its opening is refused, and widening the whole piece is offered', () => {
    const { c, inicial } = start()
    const r = c.editPiece(inicial, 'entrepano-1', { kind: 'length', axis: 'x', value: 700 })
    expect(r).toMatchObject({ ok: false, alternatives: [{ axis: 'x', value: 736, label: 'Cambiar el ancho del mueble en +136 mm' }] })
    if (r.ok) return
    const wider = c.resizeFurniture(inicial, 'x', r.alternatives[0].value)
    if (!wider.ok) throw new Error(wider.message)
    expect(currentDesign(wider.state).dimensions.width).toBe(736)
    expect(box(wider.state, 'entrepano-1').x1 - box(wider.state, 'entrepano-1').x0).toBe(700)
  })

  it('on a design with a ficha, the hand edit rides on top as an extra, and widening goes through the ficha', async () => {
    const plan = { name: 'Librero', dimensions: { width: 600, height: 1800, depth: 300 }, material: 'T18', base: 'kick' as const, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'open' as const, shelves: 3, doors: null }] }] }
    const simulado = createSimulated(0)
    const c = casos({ ...simulado, planDesign: async () => ({ value: { explanation: 'Librero.', cabinet: plan, bed: null, table: null, questions: [], requestedPhotos: [], requirements: [], suggestions: [] }, origin: { promptId: 'x', provider: 'x', model: 'm' }, usage: {} }) })
    const inicial = await c.reconstruct({ measures: null, photos: [], thumbnails: [], notes: 'Un librero' }, senal())
    const moved = c.editPiece(inicial, 'c1-h1-rep-1', { kind: 'move', axis: 'y', delta: 40 })
    if (!moved.ok) throw new Error(moved.message)
    expect(currentPlan(moved.state)).toMatchObject({ diverged: false, extras: [{ op: 'move', id: 'c1-h1-rep-1' }] })
    const wider = c.resizeFurniture(moved.state, 'x', 800)
    if (!wider.ok) throw new Error(wider.message)
    expect((currentPlan(wider.state).plan as CabinetPlan).dimensions.width).toBe(800)
    expect(currentPlan(wider.state).extras).toHaveLength(1)
  })
})

describe('trust: nothing structural goes unasked, and any change can be undone in parts', () => {
  const answering = (valor: Partial<AdjustmentResponse>) => {
    const simulado = createSimulated(0)
    return casos({ ...simulado, proposeAdjustment: async () => ({ value: { ...ajusteVacio, summary: 'Cambio', ...valor }, origin: { promptId: 'x', provider: 'x', model: 'm' }, usage: {} }) })
  }
  const removeKick: Operation[] = [{ op: 'removePiece', id: 'zoclo' }]

  it('taking away structure that was not asked for waits for the person, and one click applies it', () => {
    const c = answering({ operations: removeKick })
    return c.adjust(c.fromExample(exampleBookcase), 'Hazlo más ligero', senal()).then((estado) => {
      expect(estado.versions).toHaveLength(1)
      expect(estado.proposal?.holds[0]).toMatch(/^Quiere quitar Zoclo/)
      const aplicado = c.applyProposal(estado)
      expect(currentDesign(aplicado).pieces.some((p) => p.id === 'zoclo')).toBe(false)
    })
  })

  it('when the person asks to remove it, it just happens', async () => {
    const c = answering({ operations: removeKick })
    const estado = await c.adjust(c.fromExample(exampleBookcase), 'Quita el zoclo', senal())
    expect(estado.versions).toHaveLength(2)
  })

  it('changes that come with questions wait for the answers', async () => {
    const c = answering({ operations: [{ op: 'changeMaterial', ids: ['entrepano-1'], material: 'T15' }], questions: [{ text: '¿Cuánto peso?', options: ['Poco', 'Mucho'] }] })
    const estado = await c.adjust(c.fromExample(exampleBookcase), 'Adelgaza la repisa', senal())
    expect(estado.versions).toHaveLength(1)
    expect(estado.proposal?.holds).toEqual(['Hizo preguntas: el cambio espera tus respuestas.'])
  })

  it('brings back one piece from before an older change, and undoes a whole change', () => {
    const c = casos()
    const inicial = c.fromExample(exampleBookcase)
    const sinRepisas = c.editPiece(inicial, 'entrepano-2', { kind: 'thickness', material: 'T15' })
    if (!sinRepisas.ok) throw new Error(sinRepisas.message)
    const movida = c.editPiece(sinRepisas.state, 'entrepano-1', { kind: 'move', axis: 'y', delta: 30 })
    if (!movida.ok) throw new Error(movida.message)
    const regresada = c.restoreFromVersion(movida.state, 2, ['entrepano-2'])
    if (!regresada.ok) throw new Error(regresada.message)
    const d = currentDesign(regresada.state)
    expect(d.pieces.find((p) => p.id === 'entrepano-2')?.material).toBe('T18')
    expect(regresada.state.chat.at(-1)?.text).toBe('Regresé Entrepaño 2 como estaba antes de la v2.')
    const deshecha = c.undoChange(regresada.state, regresada.state.current)
    if (!deshecha.ok) throw new Error(deshecha.message)
    expect(currentDesign(deshecha.state).pieces.find((p) => p.id === 'entrepano-2')?.material).toBe('T15')
  })
})

describe('notices: one place for what waits for a decision', () => {
  const wide = { ...exampleBookcase, dimensions: { ...exampleBookcase.dimensions, width: 1100 } }

  it('a finding is pending until it is fixed by Knotty (and then shows as resolved) or accepted as it is', () => {
    const c = casos()
    const inicial = c.fromExample(wide)
    const board = noticeBoard(inicial, testCatalog)
    const sag = board.pending.find((n) => n.title === 'Entrepaños que se pandean')!
    expect(sag).toBeTruthy()

    const aceptado = c.acceptNotice(inicial, sag.findings, sag.title)
    expect(noticeBoard(aceptado, testCatalog).pending.some((n) => n.key === sag.key)).toBe(false)
    expect(noticeBoard(aceptado, testCatalog).accepted.map((n) => n.key)).toContain(sag.key)
    expect(noticeBoard(c.reopenNotice(aceptado, sag.findings), testCatalog).pending.some((n) => n.key === sag.key)).toBe(true)

    const fix = fixesFor(currentDesign(inicial), testCatalog, sag.findings[0]).find((f) => f.key === 'divisor-al-centro')!
    const resuelto = c.applyFix(inicial, fix)
    expect(resuelto.chat.at(-1)?.text).toBe(`Resolví: ${fix.label}.`)
    const piece = currentDesign(inicial).pieces.find((p) => p.id === sag.findings[0].pieces[0])!.name
    expect(noticeBoard(resuelto, testCatalog).resolved).toContain(`Entrepaños que se pandean: ${piece}`)
  })

  it('what the person accepted is not a failure in the verdict, but it is said', async () => {
    const c = casos()
    const inicial = c.fromExample({ ...exampleBookcase, wallAnchored: false })
    const vuelco = noticeBoard(inicial, testCatalog).pending.find((n) => n.title === 'Riesgo de vuelco')!
    const aceptado = c.acceptNotice(inicial, vuelco.findings, vuelco.title)
    const dictamen = await c.reviewPurchase(aceptado, testCatalog, senal())
    expect(dictamen.checks.find((x) => x.id === 'aceptados')?.detail).toBe('Lo dejaste así, bajo tu riesgo: Riesgo de vuelco.')
  })

  it("the expert's pending proposal and unanswered questions are notices too", async () => {
    const inicial = await libreroInicial(casos())
    const board = noticeBoard(inicial, testCatalog)
    expect(board.pending.filter((n) => n.kind === 'question').map((n) => n.message)).toContain('¿Qué vas a guardar principalmente?')
  })
})

describe('the tray: decisions for the expert go in one request', () => {
  it('sends answers and notices together, marks the questions answered and empties the tray', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const expert = inicial.chat[1]
    const [question] = expert.questions
    let estado = c.toggleTray(inicial, answerItem(expert.id, 0, question.text, question.options![0]))
    estado = c.toggleTray(estado, suggestionItem('Refuerza la base'))
    expect(c.repositorio.estado?.tray).toHaveLength(2)
    const sent = await c.sendTray(estado, 'Y hazlo de 80 cm de ancho', senal())
    const request = sent.chat.filter((m) => m.author === 'user').at(-1)!
    expect(request.text).toBe(`Te mando todo junto:\n1. ${question.text} ${question.options![0]}\n2. Refuerza la base\n3. Y hazlo de 80 cm de ancho`)
    expect(sent.chat.find((m) => m.id === expert.id)!.answers).toContain('p0')
    expect(sent.tray).toEqual([])
  })
})
