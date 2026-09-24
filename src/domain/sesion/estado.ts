import { z } from 'zod'
import { Diseno, Dimensiones } from '../diseno/esquema'
import { Decision, Origen, Version } from '../historial/historial'
import { Operacion } from '../operaciones/esquema'
import { Requisito } from '../requisitos/requisitos'

// La sesión de diseño completa: lo que se guarda y se recupera al recargar.

export const Pregunta = z.object({
  texto: z.string().min(1),
  opciones: z.array(z.string()).nullable().describe('Respuestas rápidas en botón; null si es abierta'),
})
export type Pregunta = z.infer<typeof Pregunta>

export const FotoPedida = z.object({ angulo: z.string(), motivo: z.string() })
export type FotoPedida = z.infer<typeof FotoPedida>

export const Mensaje = z.object({
  id: z.string(),
  autor: z.enum(['usuario', 'experto']),
  texto: z.string(),
  fecha: z.string(),
  preguntas: z.array(Pregunta),
  respondida: z.boolean(),
  version: z.number().nullable(),
  propuesta: z.enum(['pendiente', 'aplicada', 'descartada']).nullable(),
  error: z.boolean(),
  /** Fotos que el experto pidió en este mensaje; se toman desde el chat. */
  fotosPedidas: z.array(FotoPedida).default([]),
  /** Miniatura de la foto que el usuario mandó con este mensaje. */
  miniatura: z.string().nullable().default(null),
  /** Qué preguntas ("p0") y fotos ("f:interior") de este mensaje ya se respondieron; con todas, queda `respondida`. */
  respuestas: z.array(z.string()).default([]),
})

/** Clave de lo que se responde dentro de un mensaje del experto. */
export const clavePregunta = (indice: number) => `p${indice}`
export const claveFoto = (angulo: string) => `f:${angulo}`

/** Marca respondida una pregunta o foto de un mensaje; `respondeA` es "idMensaje" o "idMensaje#clave". */
export function marcarRespondida(chat: Mensaje[], respondeA: string | null): Mensaje[] {
  if (!respondeA) return chat
  const [id, clave] = respondeA.split('#')
  return chat.map((m) => {
    if (m.id !== id) return m
    if (!clave) return { ...m, respondida: true }
    const respuestas = [...new Set([...m.respuestas, clave])]
    const total = m.preguntas.filter((p) => p.opciones).length + m.fotosPedidas.length
    return { ...m, respuestas, respondida: respuestas.length >= total }
  })
}
export type Mensaje = z.infer<typeof Mensaje>

export const Propuesta = z.object({
  diseno: Diseno,
  operaciones: z.array(Operacion),
  resumen: z.string(),
  motivo: z.string(),
  criticos: z.array(z.object({ codigo: z.string(), mensaje: z.string(), piezas: z.array(z.string()) })),
  requisitos: z.array(Requisito),
  decisiones: z.array(Decision),
  origen: Origen.nullable(),
})
export type Propuesta = z.infer<typeof Propuesta>

export const Miniatura = z.object({ angulo: z.string(), dataUrl: z.string() })
export type Miniatura = z.infer<typeof Miniatura>

export const EstadoDiseno = z.object({
  formato: z.literal(1),
  medidas: Dimensiones,
  versiones: z.array(Version).min(1),
  actual: z.number().int().positive(),
  requisitos: z.array(Requisito),
  decisiones: z.array(Decision),
  chat: z.array(Mensaje),
  miniaturas: z.array(Miniatura),
  propuesta: Propuesta.nullable(),
})
export type EstadoDiseno = z.infer<typeof EstadoDiseno>

export const versionActual = (estado: EstadoDiseno) => estado.versiones.find((v) => v.n === estado.actual) ?? estado.versiones.at(-1)!
export const disenoActual = (estado: EstadoDiseno) => versionActual(estado).diseno
