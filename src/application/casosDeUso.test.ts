import { describe, expect, it } from 'vitest'
import { crearSimulado } from '../adapters/llm/simulado/simulado'
import { catalogo } from '../domain/fixtures/catalogo.test-util'
import { disenoActual, type EstadoDiseno } from '../domain/sesion/estado'
import type { DesignRepository } from '../ports/DesignRepository'
import { RespuestaInvalida, type LLMProvider, type RespuestaAjuste } from '../ports/LLMProvider'
import { crearCasosDeUso } from './casosDeUso'
import { construirContexto } from './contexto'

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
    expect(estado.chat[0].preguntas.flatMap((p) => p.opciones)).toContain('Libros')
    expect(estado.chat[0].fotosPedidas).toEqual([{ angulo: 'interior', motivo: 'Para ver cómo va fijada la trasera' }])
    expect(etapas).toEqual(['mirando-fotos', 'revisando', 'estructura'])
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
    expect(estado.chat[0].fotosPedidas).toEqual([])
    expect(estado.chat[0].texto).toContain('Con tu descripción')
    const opciones = estado.chat[0].preguntas.flatMap((p) => p.opciones ?? [])
    expect(opciones).toContain('Agrega un cajón abajo')
    const conCajon = await c.ajustar(estado, 'Agrega un cajón abajo', senal(), undefined, `${estado.chat[0].id}#p1`)
    expect(disenoActual(conCajon).piezas.some((p) => p.grupo === 'cajon-1')).toBe(true)
  })
})

describe('avisos del proveedor', () => {
  it('llegan al chat junto con la explicación del experto', async () => {
    const simulado = crearSimulado(0)
    const aviso = 'SheLLM no aceptó las fotos, así que el experto trabajó sin verlas.'
    const llm: LLMProvider = { ...simulado, reconstruir: async (s, signal) => ({ ...(await simulado.reconstruir(s, signal)), avisos: [aviso] }) }
    const estado = await libreroInicial(casos(llm))
    expect(estado.chat[0].texto).toContain(aviso)
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
    const estado = await c.ajustar(inicial, 'Te mando la foto: interior', senal(), undefined, `${inicial.chat[0].id}#f:interior`, foto)
    expect(estado.chat[0]).toMatchObject({ respuestas: ['f:interior'], respondida: false })
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
    const estado = await c.ajustar(inicial, 'Libros', senal(), undefined, inicial.chat[0].id)
    expect(estado.chat[0].respondida).toBe(true)
    const porPartes = await c.ajustar(inicial, 'Libros', senal(), undefined, `${inicial.chat[0].id}#p1`)
    expect(porPartes.chat[0]).toMatchObject({ respuestas: ['p1'], respondida: false })
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
