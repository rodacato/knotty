import type { Catalogo } from '../../../domain/materiales/catalogo'
import ajuste from '../prompts/ajuste.v4.md?raw'
import dictamen from '../prompts/dictamen.v1.md?raw'
import reconstruccion from '../prompts/reconstruccion.v4.md?raw'
import sistema from '../prompts/sistema.v3.md?raw'

interface Prompt {
  id: string
  texto: string
}

function leer(crudo: string): Prompt {
  const encabezado = /^---\n([\s\S]*?)\n---\n/.exec(crudo)
  const id = /id:\s*(\S+)/.exec(encabezado?.[1] ?? '')?.[1] ?? 'sin-id'
  return { id, texto: crudo.slice(encabezado?.[0].length ?? 0).trim() }
}

const SISTEMA = leer(sistema)
export const RECONSTRUCCION = leer(reconstruccion)
export const AJUSTE = leer(ajuste)
export const DICTAMEN = leer(dictamen)

function describirCatalogo(c: Catalogo) {
  return [
    'Materiales:',
    ...c.materiales.map((m) => `- ${m.id}: ${m.nombre}, ${m.espesor} mm (${m.tipo})`),
    'Herrajes:',
    ...c.herrajes.map((h) => `- ${h.id}: ${h.nombre}`),
  ].join('\n')
}

/** Sistema + tarea: estable entre llamadas para aprovechar el caché del proveedor. */
export const sistemaPara = (tarea: Prompt, catalogo: Catalogo) => `${SISTEMA.texto.replace('{{catalogo}}', describirCatalogo(catalogo))}\n\n${tarea.texto}`
export const idPrompt = (tarea: Prompt) => `${SISTEMA.id}+${tarea.id}`
