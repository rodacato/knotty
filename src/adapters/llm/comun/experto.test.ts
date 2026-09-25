import { describe, expect, it } from 'vitest'
import { testCatalog } from '../../../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../../../domain/fixtures/bookcase'
import { PlanAdjustment, RespuestaAjuste, RespuestaDictamen, RespuestaInvalida, RespuestaPlan } from '../../../ports/LLMProvider'
import { DEFAULT_CONSTRUCTION } from '../../../domain/modules/cabinet'
import { PhotoReading } from '../../../domain/reading/reading'
import { esquemaEstricto } from './esquemaJson'
import { crearExperto, type Contenido, type Transporte } from './experto'
import { AJUSTE, DICTAMEN, LECTURA, RECONSTRUCCION, sistemaPara } from './prompts'

function recorrer(nodo: unknown, visitar: (n: Record<string, unknown>) => void) {
  if (Array.isArray(nodo)) return nodo.forEach((n) => recorrer(n, visitar))
  if (!nodo || typeof nodo !== 'object') return
  visitar(nodo as Record<string, unknown>)
  Object.values(nodo).forEach((v) => recorrer(v, visitar))
}

describe('esquemaEstricto', () => {
  it.each([RespuestaAjuste, RespuestaDictamen, PhotoReading, RespuestaPlan, PlanAdjustment])('deja un esquema aceptable para los modos estrictos', (tipo) => {
    recorrer(esquemaEstricto(tipo), (n) => {
      for (const prohibida of ['oneOf', 'pattern', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'const', '$schema']) expect(n).not.toHaveProperty(prohibida)
      if (n.type === 'object' && n.properties) {
        expect(n.additionalProperties).toBe(false)
        expect(n.required).toEqual(Object.keys(n.properties as object))
      }
    })
  })
})

describe('prompts', () => {
  // El sistema viaja en cada llamada: si crece de golpe, algo se coló (por ejemplo, un catálogo enorme).
  it.each([RECONSTRUCCION, AJUSTE, DICTAMEN, LECTURA])('el sistema de $id se mantiene chico', (tarea) => {
    expect(new TextEncoder().encode(sistemaPara(tarea, testCatalog)).length).toBeLessThan(64 * 1024)
  })
})

describe('crearExperto', () => {
  const falso = (json: unknown) => {
    const llamadas: { sistema: string; contenido: Contenido[] }[] = []
    const t: Transporte = {
      proveedor: 'prueba',
      modelo: 'm',
      async completarJSON(sistema, contenido) {
        llamadas.push({ sistema, contenido })
        return { json, consumo: {} }
      },
    }
    return { experto: crearExperto(t, 'Prueba'), llamadas }
  }

  it('manda medidas, etiquetas de ángulo e imágenes, con el catálogo en el sistema', async () => {
    const { experto, llamadas } = falso({ explicacion: 'x', diseno: exampleBookcase, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] })
    const r = await experto.reconstruir({ medidas: exampleBookcase.dimensiones, fotos: [{ angulo: 'frente', base64: 'AAA' }], notas: 'para libros', lectura: null, catalogo: testCatalog, correccion: null }, new AbortController().signal)
    expect(r.valor.diseno.nombre).toBe('Librero')
    expect(r.origen.promptId).toBe('sistema@4+reconstruccion@6')
    expect(llamadas[0].sistema).toContain('T18: Triplay de pino 18 mm')
    expect(llamadas[0].contenido).toEqual([
      { tipo: 'texto', texto: 'Medidas del mueble: ancho 600 mm, alto 1800 mm, fondo 300 mm.\nNotas de la persona: para libros' },
      { tipo: 'texto', texto: 'Foto 1: frente' },
      { tipo: 'imagen', base64: 'AAA' },
    ])
  })

  it('sin fotos manda la descripción y le dice al experto que diseñe con ella', async () => {
    const { experto, llamadas } = falso({ explicacion: 'x', diseno: exampleBookcase, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] })
    await experto.reconstruir({ medidas: exampleBookcase.dimensiones, fotos: [], notas: 'librero de 5 repisas', lectura: null, catalogo: testCatalog, correccion: null }, new AbortController().signal)
    expect(llamadas[0].contenido).toEqual([{ tipo: 'texto', texto: expect.stringContaining('No hay fotos: diseña a partir de esta descripción') }])
    expect(llamadas[0].contenido[0]).toMatchObject({ texto: expect.stringContaining('Descripción: librero de 5 repisas') })
  })

  it('el dictamen manda el contexto con la revisión y usa el prompt del carpintero', async () => {
    const { experto, llamadas } = falso({ veredicto: 'con-cambios', resumen: 'Sube la repisa', problemas: [], consejos: ['Mide el espesor'] })
    const r = await experto.dictaminar({ contexto: '## Diseño', revision: '## Lista de corte', diseno: exampleBookcase, comprobaciones: [], catalogo: testCatalog }, new AbortController().signal)
    expect(r.valor.veredicto).toBe('con-cambios')
    expect(r.origen.promptId).toBe('sistema@4+dictamen@1')
    expect(llamadas[0].sistema).toContain('dictamen antes de comprar')
    expect(llamadas[0].contenido).toEqual([{ tipo: 'texto', texto: '## Diseño\n\n## Lista de corte' }])
  })

  it('reads a photo with its own short prompt, its note and the person context', async () => {
    const { experto, llamadas } = falso({ kind: 'librero', confidence: 'high', description: 'Un librero', proportions: null, base: 'kick', topOverhangs: null, columns: null, details: [], doubts: [] })
    const r = await experto.readPhoto({ photo: { angulo: 'frente', base64: 'AAA', note: 'la de abajo es puerta' }, context: 'librero para libros' }, new AbortController().signal)
    expect(r.valor.base).toBe('kick')
    expect(r.origen.promptId).toBe('lectura@1')
    expect(llamadas[0].sistema).toContain('mueble principal')
    expect(llamadas[0].sistema).not.toContain('T18')
    expect(llamadas[0].contenido).toEqual([
      { tipo: 'texto', texto: 'Foto: frente. La persona dice de esta foto: la de abajo es puerta\nLo que la persona busca: librero para libros' },
      { tipo: 'imagen', base64: 'AAA' },
    ])
  })

  it('with a reading, the design request carries it and no images', async () => {
    const { experto, llamadas } = falso({ explicacion: 'x', diseno: exampleBookcase, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] })
    const lectura = { kind: 'librero', confidence: 'high' as const, description: 'Un librero', proportions: null, base: null, topOverhangs: null, columns: null, details: [], doubts: [] }
    await experto.reconstruir({ medidas: exampleBookcase.dimensiones, fotos: [], notas: '', lectura, catalogo: testCatalog, correccion: null }, new AbortController().signal)
    expect(llamadas[0].contenido).toHaveLength(1)
    expect(llamadas[0].contenido[0]).toMatchObject({ texto: expect.stringContaining('No te mando las fotos: ya se leyeron') })
  })

  it('asks for the skeleton with its own short prompt and the board thicknesses of the catalog', async () => {
    const { experto, llamadas } = falso({ explicacion: 'x', cabinet: null, bed: null, table: null, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] })
    const r = await experto.planDesign!({ medidas: null, fotos: [], notas: 'una cama', lectura: null, catalogo: testCatalog, correccion: null }, new AbortController().signal)
    expect(r.valor.cabinet).toBeNull()
    expect(r.origen.promptId).toBe('esqueleto@4')
    expect(llamadas[0].sistema).toContain('"T18" (18 mm)')
    expect(llamadas[0].sistema).not.toContain('{{materiales}}')
  })

  it('edits the ficha with its own short prompt: the context, the current plan and the request', async () => {
    const { experto, llamadas } = falso({ explicacion: 'x', resumen: 'r', action: 'answer', plan: null, bed: null, table: null, preguntas: [], sugerencias: [], requisitos: { agregar: [], quitar: [] }, decisiones: [] })
    const plan = { name: 'Buró', dimensions: { width: 450, height: 550, depth: 400 }, material: 'T18', base: 'floor' as const, wallMounted: false, construction: DEFAULT_CONSTRUCTION, columns: [] }
    const r = await experto.adjustPlan!({ contexto: '## Diseño', peticion: '¿Aguanta?', plan, catalogo: testCatalog }, new AbortController().signal)
    expect(r.origen.promptId).toBe('ajuste-ficha@3')
    expect(llamadas[0].sistema).toContain('"T15" (15 mm)')
    expect(llamadas[0].contenido[0]).toMatchObject({ texto: expect.stringMatching(/## Diseño[\s\S]*## Ficha actual\n\{"name":"Buró"[\s\S]*## Pedido de la persona\n¿Aguanta\?/) })
  })

  it('una respuesta que no cumple el esquema lanza RespuestaInvalida con los problemas', async () => {
    const { experto } = falso({ explicacion: 'x', operaciones: [{ op: 'volar' }] })
    const promesa = experto.proponerAjuste({ contexto: '', peticion: 'x', diseno: exampleBookcase, propuesta: null, fotos: [], catalogo: testCatalog, correccion: null }, new AbortController().signal)
    await expect(promesa).rejects.toBeInstanceOf(RespuestaInvalida)
    await expect(promesa).rejects.toMatchObject({ problemas: expect.stringContaining('resumen') })
  })
})
