import { describe, expect, it } from 'vitest'
import { analizar } from '../domain/analisis'
import { crearSimulado } from '../adapters/llm/simulado/simulado'
import { desde, pieza, ref, tramo } from '../domain/diseno/construir'
import { DEFAULT_CONSTRUCTION } from '../domain/modules/cabinet'
import type { Diseno } from '../domain/diseno/esquema'
import type { Operacion } from '../domain/operaciones/esquema'
import { catalogo } from '../domain/fixtures/catalogo.test-util'
import { librero } from '../domain/fixtures/librero'
import { disenoActual, type EstadoDiseno } from '../domain/sesion/estado'
import type { DesignRepository } from '../ports/DesignRepository'
import { RespuestaInvalida, type LLMProvider, type PlanAdjustment, type RespuestaAjuste } from '../ports/LLMProvider'
import { crearCasosDeUso, currentPlan, firmaDictamen } from './casosDeUso'
import { construirContexto } from './contexto'
import { noticeBoard } from './notices'
import { fixesFor } from '../domain/fixes/fixes'
import { answerItem, suggestionItem } from '../domain/tray/tray'

const memoria = (): DesignRepository & { estado: EstadoDiseno | null } => ({
  estado: null,
  cargar() {
    return this.estado
  },
  guardar(e) {
    this.estado = e
  },
  borrar() {
    this.estado = null
  },
})

let id = 0
const casos = (llm: LLMProvider = crearSimulado(0)) => {
  const repositorio = memoria()
  return { repositorio, ...crearCasosDeUso({ llm: () => llm, catalogo, repositorio, ahora: () => '2026-09-24T10:00:00Z', nuevoId: () => `m${++id}` }) }
}
const senal = () => new AbortController().signal
const MEDIDAS_LIBRERO = { ancho: 600, alto: 1800, fondo: 300 }
const ajusteVacio: RespuestaAjuste = { explicacion: 'Listo', resumen: '', operaciones: [], preguntas: [], fotosSolicitadas: [], sugerencias: [], requisitos: { agregar: [], quitar: [] }, decisiones: [], aceptaRiesgo: [] }

async function libreroInicial(c = casos()) {
  return c.reconstruir({ medidas: MEDIDAS_LIBRERO, fotos: [{ angulo: 'frente', base64: '' }], miniaturas: [], notas: '' }, senal())
}

describe('reconstruir', () => {
  it('arma la versión 1 con la explicación y preguntas del experto, y la guarda', async () => {
    const c = casos()
    const etapas: string[] = []
    const estado = await c.reconstruir({ medidas: MEDIDAS_LIBRERO, fotos: [{ angulo: 'frente', base64: '' }], miniaturas: [], notas: '' }, senal(), (e) => etapas.push(e))
    expect(estado.versiones).toHaveLength(1)
    expect(disenoActual(estado).nombre).toBe('Librero')
    expect(estado.chat[1].preguntas.flatMap((p) => p.opciones)).toContain('Libros')
    expect(estado.chat[1].fotosPedidas).toEqual([{ angulo: 'interior', motivo: 'Para ver cómo va fijada la trasera' }])
    expect(etapas).toEqual(['leyendo-fotos', 'leyendo-fotos', 'disenando-piezas', 'revisando', 'estructura'])
    expect(c.repositorio.estado).toEqual(estado)
  })
})

describe('reconstruir sin fotos', () => {
  it('arma el diseño con la descripción, sin pedir fotos, y ofrece el cajón como pregunta', async () => {
    const c = casos()
    const estado = await c.reconstruir(
      { medidas: { ancho: 600, alto: 1800, fondo: 500 }, fotos: [], miniaturas: [], notas: 'Un librero con repisas para libros y un cajón abajo' },
      senal(),
    )
    expect(disenoActual(estado).nombre).toBe('Librero')
    expect(estado.chat[1].fotosPedidas).toEqual([])
    expect(estado.chat[1].texto).toContain('Con tu descripción')
    const opciones = estado.chat[1].preguntas.flatMap((p) => p.opciones ?? [])
    expect(opciones).toContain('Agrega un cajón abajo')
    const conCajon = await c.ajustar(estado, 'Agrega un cajón abajo', senal(), undefined, `${estado.chat[1].id}#p1`)
    expect(disenoActual(conCajon).piezas.some((p) => p.grupo === 'cajon-1')).toBe(true)
  })

  it('la descripción queda en el chat y, sin medidas, el experto las estima y lo dice', async () => {
    const estado = await casos().reconstruir({ medidas: null, fotos: [], miniaturas: [], notas: 'Un buró sencillo con una repisa' }, senal())
    expect(estado.chat[0]).toMatchObject({ autor: 'usuario', texto: 'Un buró sencillo con una repisa\n\nNo sé las medidas.' })
    expect(disenoActual(estado).nombre).toBe('Buró')
    expect(estado.medidas).toEqual(disenoActual(estado).dimensiones)
    expect(estado.chat[1].texto).toContain('las estimé')
    expect(estado.chat[1].sugerencias.length).toBeGreaterThan(0)
  })

  it('el simulado no inventa un librero cuando le piden otro mueble', async () => {
    await expect(casos().reconstruir({ medidas: null, fotos: [], miniaturas: [], notas: 'Una cama individual con cabecera' }, senal())).rejects.toThrow(/conecta un experto real/)
  })
})

describe('avisos del proveedor', () => {
  it('llegan al chat junto con la explicación del experto', async () => {
    const simulado = crearSimulado(0)
    const aviso = 'SheLLM no aceptó las fotos, así que el experto trabajó sin verlas.'
    const llm: LLMProvider = { ...simulado, reconstruir: async (s, signal) => ({ ...(await simulado.reconstruir(s, signal)), avisos: [aviso] }) }
    const estado = await libreroInicial(casos(llm))
    expect(estado.chat[1].texto).toContain(aviso)
  })
})

describe('ajustar', () => {
  it('"hazlo de 90 cm" queda como propuesta pendiente por la flecha, y "divisor" la resuelve', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const ancho = await c.ajustar(inicial, 'Hazlo de 90 cm de ancho para mi espacio', senal())
    expect(ancho.propuesta?.criticos.map((x) => x.codigo)).toContain('R1_FLECHA')
    expect(ancho.versiones).toHaveLength(1)
    expect(ancho.chat.at(-1)?.propuesta).toBe('pendiente')

    const aplicado = c.aplicarPropuesta(ancho)
    expect(aplicado.versiones).toHaveLength(2)
    expect(disenoActual(aplicado).dimensiones.ancho).toBe(900)
    expect(aplicado.requisitos.map((r) => r.id)).toEqual(['espacio-ancho'])

    const conDivisor = await c.ajustar(aplicado, 'Agrega un divisor al centro', senal())
    expect(conDivisor.versiones).toHaveLength(3)
    expect(disenoActual(conDivisor).piezas.some((p) => p.id === 'divisor')).toBe(true)
    expect(conDivisor.chat.at(-1)?.version).toBe(3)
  })

  it('ante un crítico sin opciones del experto, ofrece las alternativas del motor; elegir una resuelve todo junto', async () => {
    const c = casos()
    const pendiente = await c.ajustar(await libreroInicial(c), 'Hazlo de 90 cm de ancho', senal())
    const opciones = pendiente.chat.at(-1)!.preguntas[0].opciones!
    expect(opciones).toContain('Agregar un divisor vertical al centro')
    const resuelto = await c.ajustar(pendiente, opciones[0], senal(), undefined, pendiente.chat.at(-1)!.id)
    expect(resuelto.propuesta).toBeNull()
    expect(disenoActual(resuelto).dimensiones.ancho).toBe(900)
    expect(disenoActual(resuelto).piezas.map((p) => p.id)).toEqual(expect.arrayContaining(['divisor', 'apoyo-piso', 'entrepano-1-der']))
    expect(resuelto.versiones.at(-1)?.resumen).toBe('Ensanchar con divisor al centro')
  })

  it('un cambio sin críticos crea una versión nueva', async () => {
    const c = casos()
    const estado = await c.ajustar(await libreroInicial(c), 'Refuerza la base', senal())
    expect(estado.versiones.map((v) => v.resumen)).toEqual(['Reconstrucción desde fotos', 'Reforzar la base'])
    expect(estado.versiones[1].operaciones[0]).toBe('+refuerzo-base')
  })

  it('reintenta con los errores y, si no lo logra, lo dice sin aplicar nada', async () => {
    const pedidos: (string | null)[] = []
    const roto: RespuestaAjuste = {
      explicacion: 'Saco el lateral',
      resumen: 'Sacar lateral',
      operaciones: [{ op: 'mover', id: 'lat-izq', eje: 'x', cota: { tipo: 'mm', mm: -50 } }],
      preguntas: [],
      fotosSolicitadas: [],
      requisitos: { agregar: [], quitar: [] },
      decisiones: [],
      aceptaRiesgo: [],
      sugerencias: [],
    }
    const simulado = crearSimulado(0)
    const llm: LLMProvider = {
      ...simulado,
      async proponerAjuste(s) {
        pedidos.push(s.correccion?.errores ?? null)
        return { valor: roto, origen: { promptId: 't', proveedor: 't', modelo: 't' }, consumo: {} }
      },
    }
    const c = casos(llm)
    const inicial = await libreroInicial(c)
    const estado = await c.ajustar(inicial, 'Quita el lateral izquierdo', senal())
    expect(pedidos).toHaveLength(3)
    expect(pedidos[1]).toContain('E_')
    expect(estado.versiones).toHaveLength(1)
    expect(estado.chat.at(-1)).toMatchObject({ autor: 'experto', error: true })
  })

  it('una respuesta con formato inválido se reenvía para corregir', async () => {
    let llamadas = 0
    const simulado = crearSimulado(0)
    const llm: LLMProvider = {
      ...simulado,
      async proponerAjuste(s, signal) {
        if (llamadas++ === 0) throw new RespuestaInvalida({ basura: true }, 'falta "operaciones"')
        expect(s.correccion?.errores).toBe('falta "operaciones"')
        return simulado.proponerAjuste(s, signal)
      },
    }
    const c = casos(llm)
    const estado = await c.ajustar(await libreroInicial(c), 'Refuerza la base', senal())
    expect(estado.versiones).toHaveLength(2)
  })

  it('un error del proveedor queda en el chat', async () => {
    const llm: LLMProvider = {
      ...crearSimulado(0),
      proponerAjuste: async () => {
        throw new Error('La API key no es válida.')
      },
    }
    const c = casos(llm)
    const estado = await c.ajustar(await libreroInicial(c), 'Refuerza la base', senal())
    expect(estado.chat.at(-1)).toMatchObject({ texto: 'La API key no es válida.', error: true })
  })

  it('una foto que pidió el experto viaja al LLM, confirma la pieza y queda como miniatura', async () => {
    const vistas: number[] = []
    const simulado = crearSimulado(0)
    const llm: LLMProvider = { ...simulado, proponerAjuste: (s, signal) => (vistas.push(s.fotos.length), simulado.proponerAjuste(s, signal)) }
    const c = casos(llm)
    const inicial = await libreroInicial(c)
    expect(disenoActual(inicial).piezas.find((p) => p.id === 'trasera')?.confianza).toBe('baja')
    const foto = { angulo: 'interior', base64: 'AAA', miniatura: 'data:image/jpeg;base64,AAA' }
    const estado = await c.ajustar(inicial, 'Te mando la foto: interior', senal(), undefined, `${inicial.chat[1].id}#f:interior`, foto)
    expect(estado.chat[1]).toMatchObject({ respuestas: ['f:interior'], respondida: false })
    expect(vistas).toEqual([1])
    expect(disenoActual(estado).piezas.find((p) => p.id === 'trasera')?.confianza).toBe('alta')
    expect(estado.miniaturas.map((m) => m.angulo)).toContain('interior')
    expect(estado.chat.at(-2)?.miniatura).toBe(foto.miniatura)
  })

  it('confirmar a mano una pieza en boceto crea una versión', async () => {
    const c = casos()
    const estado = c.confirmarPieza(await libreroInicial(c), 'trasera')
    expect(disenoActual(estado).piezas.find((p) => p.id === 'trasera')?.confianza).toBe('alta')
    expect(estado.versiones.at(-1)?.resumen).toBe('Confirmar trasera')
    expect(c.confirmarPieza(estado, 'trasera')).toBe(estado)
  })

  it('responder una pregunta la marca como respondida', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const estado = await c.ajustar(inicial, 'Libros', senal(), undefined, inicial.chat[1].id)
    expect(estado.chat[1].respondida).toBe(true)
    const porPartes = await c.ajustar(inicial, 'Libros', senal(), undefined, `${inicial.chat[1].id}#p1`)
    expect(porPartes.chat[1]).toMatchObject({ respuestas: ['p1'], respondida: false })
    const juntas = await c.ajustar(inicial, 'Libros', senal(), undefined, `${inicial.chat[1].id}#p0,p1`)
    expect(juntas.chat[1].respuestas).toEqual(['p0', 'p1'])
    expect(estado.requisitos.map((r) => r.id)).toContain('carga-libros')
  })
})

describe('versiones', () => {
  it('volver a una versión crea una nueva igual a aquella', async () => {
    const c = casos()
    const dos = await c.ajustar(await libreroInicial(c), 'Refuerza la base', senal())
    const tres = c.volverAVersion(dos, 1)
    expect(tres.versiones.map((v) => v.n)).toEqual([1, 2, 3])
    expect(disenoActual(tres)).toEqual(tres.versiones[0].diseno)
  })

  it('volver a una versión restaura sus decisiones pero no toca los requisitos', async () => {
    const c = casos()
    const conNota = c.agregarRequisito(await libreroInicial(c), 'Lo voy a pintar')
    const dos = await c.ajustar(conNota, 'Refuerza la base', senal())
    expect(dos.decisiones).toHaveLength(1)
    const tres = c.volverAVersion(dos, 1)
    expect(tres.decisiones).toEqual([])
    expect(tres.requisitos.map((r) => r.texto)).toEqual(['Lo voy a pintar'])
    expect(c.volverAVersion(tres, 2).decisiones.map((d) => d.tema)).toEqual(['base'])
  })

  it('volver a la versión actual no hace nada', async () => {
    const c = casos()
    const uno = await libreroInicial(c)
    expect(c.volverAVersion(uno, 1)).toBe(uno)
  })

  it('las notas del usuario y las decisiones se pueden agregar y quitar', async () => {
    const c = casos()
    const conNota = c.agregarRequisito(await libreroInicial(c), '  Lo voy a pintar de blanco ')
    expect(conNota.requisitos).toEqual([expect.objectContaining({ texto: 'Lo voy a pintar de blanco', tipo: 'otro' })])
    expect(c.quitarRequisito(conNota, conNota.requisitos[0].id).requisitos).toEqual([])
    const conDecision = await c.ajustar(conNota, 'Refuerza la base', senal())
    expect(conDecision.decisiones.map((d) => d.tema)).toEqual(['base'])
    expect(c.quitarDecision(conDecision, 'base').decisiones).toEqual([])
  })

  it('descartar una propuesta no crea versión', async () => {
    const c = casos()
    const pendiente = await c.ajustar(await libreroInicial(c), 'Hazlo de 90 cm de ancho', senal())
    const descartada = c.descartarPropuesta(pendiente)
    expect(descartada.propuesta).toBeNull()
    expect(descartada.versiones).toHaveLength(1)
    expect(descartada.chat.at(-1)).toMatchObject({ propuesta: 'descartada', respondida: true })
  })
})

describe('construirContexto', () => {
  it('incluye diseño, geometría, revisión, requisitos, bitácora y chat reciente', async () => {
    const c = casos()
    const estado = c.aplicarPropuesta(await c.ajustar(await libreroInicial(c), 'Hazlo de 90 cm de ancho', senal()))
    const texto = construirContexto(estado, catalogo)
    for (const parte of ['## Diseño actual (v2)', 'lat-der: 882–900', 'R1_FLECHA', 'El espacio mide 90 cm', 'v2: Ensanchar a 90 cm', 'Usuario: Hazlo de 90 cm']) expect(texto).toContain(parte)
  })
})

describe('dictaminar', () => {
  it('guarda las comprobaciones y la opinión del carpintero con la firma de la versión', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const estado = c.guardarDictamen(inicial, await c.dictaminar(inicial, catalogo, senal()))
    expect(estado.dictamen).toMatchObject({ veredicto: 'viable', error: null, firma: firmaDictamen(inicial, catalogo) })
    expect(estado.dictamen!.comprobaciones.find((x) => x.id === 'confirmadas')?.estado).toBe('aviso')
    expect(estado.dictamen!.carpintero?.consejos.length).toBeGreaterThan(0)
    expect(c.repositorio.estado?.dictamen).toEqual(estado.dictamen)
    const cambiado = await c.ajustar(estado, 'Refuerza la base', senal())
    expect(firmaDictamen(cambiado, catalogo)).not.toBe(estado.dictamen!.firma)
  })

  it('el carpintero no puede aprobar lo que las cuentas marcan imposible', async () => {
    const simulado = crearSimulado(0)
    const llm: LLMProvider = { ...simulado, dictaminar: async (s, signal) => ({ ...(await simulado.dictaminar(s, signal)), valor: { veredicto: 'viable', resumen: 'Todo bien', problemas: [], consejos: [] } }) }
    const c = casos(llm)
    const estrecho = { ...catalogo, acomodo: { ...catalogo.acomodo, refilado: 400 } }
    const dictamen = await c.dictaminar(await libreroInicial(c), estrecho, senal())
    expect(dictamen.veredicto).toBe('no-viable')
  })

  it('si el carpintero no contesta, queda el dictamen de las cuentas con el motivo', async () => {
    const llm: LLMProvider = { ...crearSimulado(0), dictaminar: async () => Promise.reject(new Error('No se pudo conectar con SheLLM.')) }
    const c = casos(llm)
    const dictamen = await c.dictaminar(await libreroInicial(c), catalogo, senal())
    expect(dictamen).toMatchObject({ veredicto: 'viable', carpintero: null, error: 'No se pudo conectar con SheLLM.' })
  })
})

describe('never throw away a paid design', () => {
  // A shelf floating in the middle, touching nothing: it resolves, but no rule can say where it should go.
  const conFlotante = (d: Diseno): Diseno => ({
    ...d,
    piezas: [
      ...d.piezas,
      {
        ...d.piezas.find((p) => p.id === 'entrepano-1')!,
        id: 'entrepano-extra',
        nombre: 'Entrepaño extra',
        x: { desde: ref('lat-izq.x1', 60), hasta: ref('lat-der.x0', -60), largo: null },
        y: { desde: ref('entrepano-1.y1', 100), hasta: null, largo: null },
        z: { desde: ref('trasera.z1', 60), hasta: ref('mueble.z1', -60), largo: null },
      },
    ],
  })
  const conEncimada = (d: Diseno): Diseno => ({ ...d, piezas: [...d.piezas, { ...d.piezas.find((p) => p.id === 'entrepano-1')!, id: 'entrepano-copia', nombre: 'Entrepaño copia' }] })
  const cambiando = (cambio: (d: Diseno) => Diseno): LLMProvider => {
    const simulado = crearSimulado(0)
    return { ...simulado, reconstruir: async (s, signal) => { const r = await simulado.reconstruir(s, signal); return { ...r, valor: { ...r.valor, diseno: cambio(r.valor.diseno) } } } }
  }
  const encimando = () => cambiando(conFlotante)

  it('an overlap is fixed by rule, without asking the model again', async () => {
    const estado = await libreroInicial(casos(cambiando(conEncimada)))
    expect(disenoActual(estado).piezas.some((p) => p.id === 'entrepano-copia')).toBe(false)
    expect(estado.trace.map((t) => t.step)).toEqual(['read', 'reconstruct'])
    expect(estado.trace[1]).toMatchObject({ outcome: 'ok', repairs: ['Quité Entrepaño copia: estaba completa dentro de Entrepaño 1.'] })
    expect(estado.chat[1].texto).toContain('Ajusté por mi cuenta un detalle')
  })

  it('after every attempt fails validation, keeps the last design and says what is left', async () => {
    const c = casos(encimando())
    const estado = await libreroInicial(c)
    expect(disenoActual(estado).piezas.some((p) => p.id === 'entrepano-extra')).toBe(true)
    expect(estado.chat[1].texto).toContain('quedaron una pieza sin apoyo')
    expect(estado.chat[1].sugerencias[0]).toBe('Corrige las piezas marcadas')
    const disenos = estado.trace.filter((t) => t.step === 'reconstruct')
    expect(disenos.map((t) => t.outcome)).toEqual(['invalid', 'invalid', 'invalid'])
    expect(disenos[0].errors[0].code).toBe('E_FLOTANTE')
  })

  it('a change that fixes the problem is applied, and one that adds a new problem is not', async () => {
    const c = casos(encimando())
    const inicial = await libreroInicial(c)
    const quitar = { ...crearSimulado(0), proponerAjuste: async () => ({ valor: { ...ajusteVacio, resumen: 'Quitar extra', operaciones: [{ op: 'eliminarPieza' as const, id: 'entrepano-extra' }] }, origen: { promptId: 'p', proveedor: 'x', modelo: 'm' }, consumo: {} }) }
    const arreglado = await casos(quitar).ajustar(inicial, 'Corrige las piezas marcadas', senal())
    expect(disenoActual(arreglado).piezas.some((p) => p.id === 'entrepano-extra')).toBe(false)
    expect(arreglado.trace.at(-1)).toMatchObject({ step: 'adjust', outcome: 'ok', errors: [] })

    const romper = { ...crearSimulado(0), proponerAjuste: async () => ({ valor: { ...ajusteVacio, resumen: 'Mover', operaciones: [{ op: 'mover' as const, id: 'lat-izq', eje: 'x' as const, cota: { tipo: 'mm' as const, mm: -50 } }] }, origen: { promptId: 'p', proveedor: 'x', modelo: 'm' }, consumo: {} }) }
    const peor = await casos(romper).ajustar(inicial, 'Mueve el lateral', senal())
    expect(peor.versiones).toHaveLength(1)
    expect(peor.chat.at(-1)?.error).toBe(true)
  })

  it('a provider failure carries the trace so far', async () => {
    const llm: LLMProvider = { ...crearSimulado(0), reconstruir: async () => Promise.reject(new Error('No se pudo conectar')) }
    await expect(libreroInicial(casos(llm))).rejects.toMatchObject({ message: 'No se pudo conectar', trace: [{ step: 'read', outcome: 'ok' }, { outcome: 'failed', step: 'reconstruct' }] })
  })
})

describe('photos are read once, in parallel, and not sent again', () => {
  const dosFotos = { medidas: MEDIDAS_LIBRERO, fotos: [{ angulo: 'frente', base64: 'AAA', note: 'la de abajo es puerta' }, { angulo: 'lateral', base64: 'BBB' }], miniaturas: [], notas: 'librero' }
  const espiando = (falla: (angulo: string) => boolean = () => false) => {
    const simulado = crearSimulado(0)
    const lecturas: string[] = []
    const disenos: { fotos: number; lectura: boolean }[] = []
    const llm: LLMProvider = {
      ...simulado,
      readPhoto: async (r, signal) => {
        lecturas.push(`${r.photo.angulo}:${r.photo.note ?? ''}`)
        if (falla(r.photo.angulo)) throw new Error('sin conexión')
        return simulado.readPhoto(r, signal)
      },
      reconstruir: async (s, signal) => {
        disenos.push({ fotos: s.fotos.length, lectura: !!s.lectura })
        return simulado.reconstruir(s, signal)
      },
    }
    return { llm, lecturas, disenos }
  }

  it('reads each photo with its note and designs from the reading, without the images', async () => {
    const { llm, lecturas, disenos } = espiando()
    const estado = await casos(llm).reconstruir(dosFotos, senal())
    expect(lecturas.sort()).toEqual(['frente:la de abajo es puerta', 'lateral:'])
    expect(disenos).toEqual([{ fotos: 0, lectura: true }])
    expect(estado.chat[0].texto).toContain('Sobre la foto frente: la de abajo es puerta')
    expect(estado.trace.filter((t) => t.step === 'read').map((t) => t.subject).sort()).toEqual(['Foto frente', 'Foto lateral'])
  })

  it('does not read the same photo twice in a session', async () => {
    const { llm, lecturas } = espiando()
    const c = casos(llm)
    await c.reconstruir(dosFotos, senal())
    await c.reconstruir(dosFotos, senal())
    expect(lecturas).toHaveLength(2)
  })

  it('a photo that cannot be read is retried alone and then left out', async () => {
    const { llm, lecturas, disenos } = espiando((angulo) => angulo === 'lateral')
    await casos(llm).reconstruir(dosFotos, senal())
    expect(lecturas.filter((l) => l.startsWith('lateral'))).toHaveLength(2)
    expect(disenos).toEqual([{ fotos: 0, lectura: true }])
  })

  it('if no photo can be read, the design looks at the photos itself', async () => {
    const { llm, disenos } = espiando(() => true)
    await casos(llm).reconstruir(dosFotos, senal())
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
  const origen = { promptId: 'esqueleto@2', proveedor: 'x', modelo: 'm' }
  const conPlan = (cabinet: typeof cabinetPlan | null, falla = false) => {
    const simulado = crearSimulado(0)
    const llamadas: string[] = []
    const llm: LLMProvider = {
      ...simulado,
      planDesign: async () => {
        llamadas.push('plan')
        if (falla) throw new Error('sin conexión')
        return { valor: { explicacion: 'Una cajonera de tres cajones.', cabinet, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: ['Hazla más alta'] }, origen, consumo: { tokensSalida: 400 } }
      },
      reconstruir: async (s, signal) => {
        llamadas.push('diseno')
        return simulado.reconstruir(s, signal)
      },
    }
    return { llm, llamadas }
  }
  const pedido = (notas: string) => ({ medidas: null, fotos: [], miniaturas: [], notas })

  it('builds the cabinet without asking for pieces, with its drawers and joints', async () => {
    const { llm, llamadas } = conPlan(cabinetPlan)
    const estado = await casos(llm).reconstruir(pedido('Una cajonera de tres cajones'), senal())
    expect(llamadas).toEqual(['plan'])
    const d = disenoActual(estado)
    expect(d.nombre).toBe('Cajonera')
    expect(new Set(d.piezas.map((p) => p.grupo).filter(Boolean)).size).toBe(3)
    expect(analizar(d, catalogo).valido).toBe(true)
    expect(estado.trace.map((t) => [t.step, t.outcome])).toEqual([['plan', 'ok']])
    expect(estado.chat[1].sugerencias).toEqual(['Hazla más alta'])
  })

  it('uses the measures the person gave over the plan', async () => {
    const { llm } = conPlan(cabinetPlan)
    const estado = await casos(llm).reconstruir({ ...pedido('Una cajonera'), medidas: { ancho: 600, alto: 1000, fondo: 500 } }, senal())
    expect(disenoActual(estado).dimensiones).toEqual({ ancho: 600, alto: 1000, fondo: 500 })
  })

  it('not a cabinet, or the skeleton fails: designs it whole', async () => {
    for (const [cabinet, falla] of [[null, false], [cabinetPlan, true]] as const) {
      const { llm, llamadas } = conPlan(cabinet, falla)
      await casos(llm).reconstruir(pedido('Un librero'), senal())
      expect(llamadas).toEqual(['plan', 'diseno'])
    }
  })

  it('the plan is kept with the version, and the ficha rebuilds it at once without the expert', async () => {
    const { llm, llamadas } = conPlan(cabinetPlan)
    const c = casos(llm)
    const inicial = await c.reconstruir(pedido('Una cajonera de tres cajones'), senal())
    expect(currentPlan(inicial)).toMatchObject({ since: 1, diverged: false })
    const cuatro = { ...currentPlan(inicial).plan!, columns: [{ width: 1, cells: [0, 1, 2, 3].map(() => ({ height: 1, content: 'drawer' as const, shelves: null, doors: null })) }] }
    const r = c.applyPlan(inicial, { ...cuatro, construction: { ...cuatro.construction, drawerFronts: 'overlay' } })
    if (!r.ok) throw new Error(r.message)
    expect(llamadas).toEqual(['plan'])
    expect(new Set(disenoActual(r.estado).piezas.map((p) => p.grupo).filter(Boolean)).size).toBe(4)
    expect(r.estado.chat.at(-1)?.texto).toBe('Cambié desde la ficha: frentes de cajón sobrepuestos, 4 cajones.')
    expect(r.estado.versiones.at(-1)).toMatchObject({ n: 2, resumen: 'Ficha: frentes de cajón sobrepuestos, 4 cajones' })
    expect(currentPlan(r.estado)).toMatchObject({ since: 2, diverged: false })
  })

  it('after a free-form change the plan is behind; going back to its version restores it', async () => {
    const { llm } = conPlan(cabinetPlan)
    const c = casos(llm)
    const inicial = await c.reconstruir(pedido('Una cajonera de tres cajones'), senal())
    const libre = { ...inicial, versiones: [...inicial.versiones, { ...inicial.versiones[0], n: 2, plan: null }], actual: 2 }
    expect(currentPlan(libre)).toMatchObject({ since: 1, diverged: true })
    expect(currentPlan(c.volverAVersion(libre, 1))).toMatchObject({ since: 3, diverged: false })
  })

  it('a plan that cannot be built is refused with the reason', async () => {
    const { llm } = conPlan(cabinetPlan)
    const c = casos(llm)
    const inicial = await c.reconstruir(pedido('Una cajonera'), senal())
    const r = c.applyPlan(inicial, { ...currentPlan(inicial).plan!, dimensions: { width: 500, height: 3000, depth: 450 } })
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/más grandes? que la hoja\. Trasera mide 3000/) })
  })

  it('a bed, a desk or a table skips the skeleton', async () => {
    const { llm, llamadas } = conPlan(cabinetPlan)
    await expect(casos(llm).reconstruir(pedido('Una cama individual con cabecera'), senal())).rejects.toThrow()
    expect(llamadas).toEqual(['diseno'])
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
  const origen = { promptId: 'x', proveedor: 'x', modelo: 'm' }
  const hanger = pieza({ id: 'liston', nombre: 'Listón de colgar', rol: 'refuerzo', material: 'T18', normal: 'z', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: tramo(null, ref('techo.y0'), 80), z: desde(ref('trasera.z1')) })
  const expert = (adjust: Partial<PlanAdjustment> | null, operaciones: Operacion[] = []) => {
    const simulado = crearSimulado(0)
    const calls: string[] = []
    const llm: LLMProvider = {
      ...simulado,
      planDesign: async () => ({ valor: { explicacion: 'Cajonera.', cabinet: drawers(3), preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] }, origen, consumo: {} }),
      adjustPlan: adjust
        ? async () => {
            calls.push('ficha')
            return { valor: { explicacion: 'Listo.', resumen: 'Cambio', action: 'plan', plan: null, preguntas: [], sugerencias: [], requisitos: { agregar: [], quitar: [] }, decisiones: [], ...adjust }, origen, consumo: {} }
          }
        : null,
      proponerAjuste: async () => {
        calls.push('piezas')
        return { valor: { ...ajusteVacio, resumen: 'Agregar listón', operaciones }, origen, consumo: {} }
      },
    }
    return { llm, calls }
  }
  const start = async (llm: LLMProvider) => {
    const c = casos(llm)
    return { c, inicial: await c.reconstruir({ medidas: null, fotos: [], miniaturas: [], notas: 'Una cajonera' }, senal()) }
  }

  it('a change the ficha can express comes back as a new ficha, with no pieces asked', async () => {
    const { llm, calls } = expert({ action: 'plan', plan: drawers(4), resumen: 'Agregar un cajón' })
    const { c, inicial } = await start(llm)
    const estado = await c.ajustar(inicial, 'Ponle un cajón más', senal())
    expect(calls).toEqual(['ficha'])
    expect(currentPlan(estado)).toMatchObject({ since: 2, diverged: false })
    expect(new Set(disenoActual(estado).piezas.map((p) => p.grupo).filter(Boolean)).size).toBe(4)
  })

  it('a question gets an answer and no new version', async () => {
    const { llm, calls } = expert({ action: 'answer', explicacion: 'Las correderas son de 40 cm.' })
    const { c, inicial } = await start(llm)
    const estado = await c.ajustar(inicial, '¿De qué largo son las correderas?', senal())
    expect(calls).toEqual(['ficha'])
    expect(estado.versiones).toHaveLength(1)
    expect(estado.chat.at(-1)?.texto).toBe('Las correderas son de 40 cm.')
  })

  it('what the ficha cannot express goes piece by piece and rides on top as an extra that survives the ficha', async () => {
    const { llm, calls } = expert({ action: 'freeform' }, [{ op: 'agregarPieza', pieza: hanger }])
    const { c, inicial } = await start(llm)
    const conListon = await c.ajustar(inicial, 'Ponle un listón para colgarla', senal())
    expect(calls).toEqual(['ficha', 'piezas'])
    expect(currentPlan(conListon)).toMatchObject({ diverged: false, extras: [{ op: 'agregarPieza' }] })
    const r = c.applyPlan(conListon, { ...drawers(3), dimensions: { width: 600, height: 900, depth: 450 } })
    if (!r.ok) throw new Error(r.message)
    expect(disenoActual(r.estado).piezas.some((p) => p.id === 'liston')).toBe(true)
    expect(analizar(disenoActual(r.estado), catalogo).valido).toBe(true)
  })

  it('an extra that no longer applies to the new ficha is left out, and said', async () => {
    const { llm } = expert({ action: 'freeform' }, [{ op: 'eliminarGrupo', grupo: 'cajon-3' }])
    const { c, inicial } = await start(llm)
    const sinTercero = await c.ajustar(inicial, 'Quita el cajón de arriba y deja el hueco', senal())
    const r = c.applyPlan(sinTercero, drawers(2))
    if (!r.ok) throw new Error(r.message)
    expect(r.notes.join(' ')).toContain('ya no aplica')
    expect(currentPlan(r.estado).extras).toEqual([])
  })

  it('a ficha that cannot be built falls back to pieces', async () => {
    const { llm, calls } = expert({ action: 'plan', plan: { ...drawers(3), dimensions: { width: 500, height: 3000, depth: 450 } } }, [{ op: 'agregarPieza', pieza: hanger }])
    const { c, inicial } = await start(llm)
    await c.ajustar(inicial, 'Hazla de 3 metros', senal())
    expect(calls).toEqual(['ficha', 'piezas'])
  })
})

describe('editing a piece by hand, without the expert', () => {
  const box = (estado: EstadoDiseno, id: string) => {
    const a = analizar(disenoActual(estado), catalogo)
    if (!a.valido) throw new Error(a.errores[0].mensaje)
    return a.geo.cajas.get(id)!
  }
  const start = () => {
    const c = casos()
    return { c, inicial: c.desdeEjemplo(librero) }
  }

  it('moves a shelf and changes its thickness, each in one version', () => {
    const { c, inicial } = start()
    const moved = c.editPiece(inicial, 'entrepano-1', { kind: 'move', axis: 'y', delta: 50 })
    if (!moved.ok) throw new Error(moved.message)
    expect(box(moved.estado, 'entrepano-1').y0).toBe(box(inicial, 'entrepano-1').y0 + 50)
    expect(moved.estado.chat.at(-1)?.texto).toBe('Cambié a mano: Mover entrepaño 1 50 mm.')
    const thinner = c.editPiece(moved.estado, 'entrepano-1', { kind: 'thickness', material: 'T15' })
    if (!thinner.ok) throw new Error(thinner.message)
    expect(box(thinner.estado, 'entrepano-1').y1 - box(thinner.estado, 'entrepano-1').y0).toBe(15)
    expect(thinner.estado.versiones.map((v) => v.n)).toEqual([1, 2, 3])
  })

  it('a shelf longer than its opening is refused, and widening the whole piece is offered', () => {
    const { c, inicial } = start()
    const r = c.editPiece(inicial, 'entrepano-1', { kind: 'length', axis: 'x', value: 700 })
    expect(r).toMatchObject({ ok: false, alternatives: [{ axis: 'x', value: 736, label: 'Cambiar el ancho del mueble en +136 mm' }] })
    if (r.ok) return
    const wider = c.resizeFurniture(inicial, 'x', r.alternatives[0].value)
    if (!wider.ok) throw new Error(wider.message)
    expect(disenoActual(wider.estado).dimensiones.ancho).toBe(736)
    expect(box(wider.estado, 'entrepano-1').x1 - box(wider.estado, 'entrepano-1').x0).toBe(700)
  })

  it('on a design with a ficha, the hand edit rides on top as an extra, and widening goes through the ficha', async () => {
    const plan = { name: 'Librero', dimensions: { width: 600, height: 1800, depth: 300 }, material: 'T18', base: 'kick' as const, wallMounted: true, construction: DEFAULT_CONSTRUCTION, columns: [{ width: 1, cells: [{ height: 1, content: 'open' as const, shelves: 3, doors: null }] }] }
    const simulado = crearSimulado(0)
    const c = casos({ ...simulado, planDesign: async () => ({ valor: { explicacion: 'Librero.', cabinet: plan, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] }, origen: { promptId: 'x', proveedor: 'x', modelo: 'm' }, consumo: {} }) })
    const inicial = await c.reconstruir({ medidas: null, fotos: [], miniaturas: [], notas: 'Un librero' }, senal())
    const moved = c.editPiece(inicial, 'c1-h1-rep-1', { kind: 'move', axis: 'y', delta: 40 })
    if (!moved.ok) throw new Error(moved.message)
    expect(currentPlan(moved.estado)).toMatchObject({ diverged: false, extras: [{ op: 'mover', id: 'c1-h1-rep-1' }] })
    const wider = c.resizeFurniture(moved.estado, 'x', 800)
    if (!wider.ok) throw new Error(wider.message)
    expect(currentPlan(wider.estado).plan?.dimensions.width).toBe(800)
    expect(currentPlan(wider.estado).extras).toHaveLength(1)
  })
})

describe('trust: nothing structural goes unasked, and any change can be undone in parts', () => {
  const answering = (valor: Partial<RespuestaAjuste>) => {
    const simulado = crearSimulado(0)
    return casos({ ...simulado, proponerAjuste: async () => ({ valor: { ...ajusteVacio, resumen: 'Cambio', ...valor }, origen: { promptId: 'x', proveedor: 'x', modelo: 'm' }, consumo: {} }) })
  }
  const removeKick: Operacion[] = [{ op: 'eliminarPieza', id: 'zoclo' }]

  it('taking away structure that was not asked for waits for the person, and one click applies it', () => {
    const c = answering({ operaciones: removeKick })
    return c.ajustar(c.desdeEjemplo(librero), 'Hazlo más ligero', senal()).then((estado) => {
      expect(estado.versiones).toHaveLength(1)
      expect(estado.propuesta?.holds[0]).toMatch(/^Quiere quitar Zoclo/)
      const aplicado = c.aplicarPropuesta(estado)
      expect(disenoActual(aplicado).piezas.some((p) => p.id === 'zoclo')).toBe(false)
    })
  })

  it('when the person asks to remove it, it just happens', async () => {
    const c = answering({ operaciones: removeKick })
    const estado = await c.ajustar(c.desdeEjemplo(librero), 'Quita el zoclo', senal())
    expect(estado.versiones).toHaveLength(2)
  })

  it('changes that come with questions wait for the answers', async () => {
    const c = answering({ operaciones: [{ op: 'cambiarEspesor', ids: ['entrepano-1'], material: 'T15' }], preguntas: [{ texto: '¿Cuánto peso?', opciones: ['Poco', 'Mucho'] }] })
    const estado = await c.ajustar(c.desdeEjemplo(librero), 'Adelgaza la repisa', senal())
    expect(estado.versiones).toHaveLength(1)
    expect(estado.propuesta?.holds).toEqual(['Hizo preguntas: el cambio espera tus respuestas.'])
  })

  it('brings back one piece from before an older change, and undoes a whole change', () => {
    const c = casos()
    const inicial = c.desdeEjemplo(librero)
    const sinRepisas = c.editPiece(inicial, 'entrepano-2', { kind: 'thickness', material: 'T15' })
    if (!sinRepisas.ok) throw new Error(sinRepisas.message)
    const movida = c.editPiece(sinRepisas.estado, 'entrepano-1', { kind: 'move', axis: 'y', delta: 30 })
    if (!movida.ok) throw new Error(movida.message)
    const regresada = c.restoreFromVersion(movida.estado, 2, ['entrepano-2'])
    if (!regresada.ok) throw new Error(regresada.message)
    const d = disenoActual(regresada.estado)
    expect(d.piezas.find((p) => p.id === 'entrepano-2')?.material).toBe('T18')
    expect(regresada.estado.chat.at(-1)?.texto).toBe('Regresé Entrepaño 2 como estaba antes de la v2.')
    const deshecha = c.undoChange(regresada.estado, regresada.estado.actual)
    if (!deshecha.ok) throw new Error(deshecha.message)
    expect(disenoActual(deshecha.estado).piezas.find((p) => p.id === 'entrepano-2')?.material).toBe('T15')
  })
})

describe('notices: one place for what waits for a decision', () => {
  const wide = { ...librero, dimensiones: { ...librero.dimensiones, ancho: 1100 } }

  it('a finding is pending until it is fixed by Knotty (and then shows as resolved) or accepted as it is', () => {
    const c = casos()
    const inicial = c.desdeEjemplo(wide)
    const board = noticeBoard(inicial, catalogo)
    const sag = board.pending.find((n) => n.title === 'Entrepaños que se pandean')!
    expect(sag).toBeTruthy()

    const aceptado = c.acceptNotice(inicial, sag.findings, sag.title)
    expect(noticeBoard(aceptado, catalogo).pending.some((n) => n.key === sag.key)).toBe(false)
    expect(noticeBoard(aceptado, catalogo).accepted.map((n) => n.key)).toContain(sag.key)
    expect(noticeBoard(c.reopenNotice(aceptado, sag.findings), catalogo).pending.some((n) => n.key === sag.key)).toBe(true)

    const fix = fixesFor(disenoActual(inicial), catalogo, sag.findings[0]).find((f) => f.key === 'divisor-al-centro')!
    const resuelto = c.applyFix(inicial, fix)
    expect(resuelto.chat.at(-1)?.texto).toBe(`Resolví: ${fix.label}.`)
    const piece = disenoActual(inicial).piezas.find((p) => p.id === sag.findings[0].piezas[0])!.nombre
    expect(noticeBoard(resuelto, catalogo).resolved).toContain(`Entrepaños que se pandean: ${piece}`)
  })

  it('what the person accepted is not a failure in the verdict, but it is said', async () => {
    const c = casos()
    const inicial = c.desdeEjemplo({ ...librero, anclajeMuro: false })
    const vuelco = noticeBoard(inicial, catalogo).pending.find((n) => n.title === 'Riesgo de vuelco')!
    const aceptado = c.acceptNotice(inicial, vuelco.findings, vuelco.title)
    const dictamen = await c.dictaminar(aceptado, catalogo, senal())
    expect(dictamen.comprobaciones.find((x) => x.id === 'aceptados')?.detalle).toBe('Lo dejaste así, bajo tu riesgo: Riesgo de vuelco.')
  })

  it("the expert's pending proposal and unanswered questions are notices too", async () => {
    const inicial = await libreroInicial(casos())
    const board = noticeBoard(inicial, catalogo)
    expect(board.pending.filter((n) => n.kind === 'question').map((n) => n.message)).toContain('¿Qué vas a guardar principalmente?')
  })
})

describe('the tray: decisions for the expert go in one request', () => {
  it('sends answers and notices together, marks the questions answered and empties the tray', async () => {
    const c = casos()
    const inicial = await libreroInicial(c)
    const expert = inicial.chat[1]
    const [question] = expert.preguntas
    let estado = c.toggleTray(inicial, answerItem(expert.id, 0, question.texto, question.opciones![0]))
    estado = c.toggleTray(estado, suggestionItem('Refuerza la base'))
    expect(c.repositorio.estado?.tray).toHaveLength(2)
    const sent = await c.sendTray(estado, 'Y hazlo de 80 cm de ancho', senal())
    const request = sent.chat.filter((m) => m.autor === 'usuario').at(-1)!
    expect(request.texto).toBe(`Te mando todo junto:\n1. ${question.texto} ${question.opciones![0]}\n2. Refuerza la base\n3. Y hazlo de 80 cm de ancho`)
    expect(sent.chat.find((m) => m.id === expert.id)!.respuestas).toContain('p0')
    expect(sent.tray).toEqual([])
  })
})
