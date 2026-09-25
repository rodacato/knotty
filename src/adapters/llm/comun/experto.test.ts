import { describe, expect, it } from 'vitest'
import { catalogo } from '../../../domain/fixtures/catalogo.test-util'
import { librero } from '../../../domain/fixtures/librero'
import { RespuestaAjuste, RespuestaDictamen, RespuestaInvalida } from '../../../ports/LLMProvider'
import { esquemaEstricto } from './esquemaJson'
import { crearExperto, type Contenido, type Transporte } from './experto'

function recorrer(nodo: unknown, visitar: (n: Record<string, unknown>) => void) {
  if (Array.isArray(nodo)) return nodo.forEach((n) => recorrer(n, visitar))
  if (!nodo || typeof nodo !== 'object') return
  visitar(nodo as Record<string, unknown>)
  Object.values(nodo).forEach((v) => recorrer(v, visitar))
}

describe('esquemaEstricto', () => {
  it.each([RespuestaAjuste, RespuestaDictamen])('deja un esquema aceptable para los modos estrictos', (tipo) => {
    recorrer(esquemaEstricto(tipo), (n) => {
      for (const prohibida of ['oneOf', 'pattern', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'const', '$schema']) expect(n).not.toHaveProperty(prohibida)
      if (n.type === 'object' && n.properties) {
        expect(n.additionalProperties).toBe(false)
        expect(n.required).toEqual(Object.keys(n.properties as object))
      }
    })
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
    const { experto, llamadas } = falso({ explicacion: 'x', diseno: librero, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] })
    const r = await experto.reconstruir({ medidas: librero.dimensiones, fotos: [{ angulo: 'frente', base64: 'AAA' }], notas: 'para libros', catalogo, correccion: null }, new AbortController().signal)
    expect(r.valor.diseno.nombre).toBe('Librero')
    expect(r.origen.promptId).toBe('sistema@4+reconstruccion@5')
    expect(llamadas[0].sistema).toContain('T18: Triplay de pino 18 mm')
    expect(llamadas[0].contenido).toEqual([
      { tipo: 'texto', texto: 'Medidas del mueble: ancho 600 mm, alto 1800 mm, fondo 300 mm.\nNotas de la persona: para libros' },
      { tipo: 'texto', texto: 'Foto 1: frente' },
      { tipo: 'imagen', base64: 'AAA' },
    ])
  })

  it('sin fotos manda la descripción y le dice al experto que diseñe con ella', async () => {
    const { experto, llamadas } = falso({ explicacion: 'x', diseno: librero, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] })
    await experto.reconstruir({ medidas: librero.dimensiones, fotos: [], notas: 'librero de 5 repisas', catalogo, correccion: null }, new AbortController().signal)
    expect(llamadas[0].contenido).toEqual([{ tipo: 'texto', texto: expect.stringContaining('No hay fotos: diseña a partir de esta descripción') }])
    expect(llamadas[0].contenido[0]).toMatchObject({ texto: expect.stringContaining('Descripción: librero de 5 repisas') })
  })

  it('el dictamen manda el contexto con la revisión y usa el prompt del carpintero', async () => {
    const { experto, llamadas } = falso({ veredicto: 'con-cambios', resumen: 'Sube la repisa', problemas: [], consejos: ['Mide el espesor'] })
    const r = await experto.dictaminar({ contexto: '## Diseño', revision: '## Lista de corte', diseno: librero, comprobaciones: [], catalogo }, new AbortController().signal)
    expect(r.valor.veredicto).toBe('con-cambios')
    expect(r.origen.promptId).toBe('sistema@4+dictamen@1')
    expect(llamadas[0].sistema).toContain('dictamen antes de comprar')
    expect(llamadas[0].contenido).toEqual([{ tipo: 'texto', texto: '## Diseño\n\n## Lista de corte' }])
  })

  it('una respuesta que no cumple el esquema lanza RespuestaInvalida con los problemas', async () => {
    const { experto } = falso({ explicacion: 'x', operaciones: [{ op: 'volar' }] })
    const promesa = experto.proponerAjuste({ contexto: '', peticion: 'x', diseno: librero, propuesta: null, fotos: [], catalogo, correccion: null }, new AbortController().signal)
    await expect(promesa).rejects.toBeInstanceOf(RespuestaInvalida)
    await expect(promesa).rejects.toMatchObject({ problemas: expect.stringContaining('resumen') })
  })
})
