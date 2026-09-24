import { z } from 'zod'

// Los modos estrictos de Anthropic y OpenAI aceptan un subconjunto de JSON Schema; Zod re-valida lo que se quita aquí.
const NO_SOPORTADAS = ['pattern', 'format', 'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', '$schema']

function limpiar(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(limpiar)
  if (!nodo || typeof nodo !== 'object') return nodo
  const salida: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(nodo)) {
    if (NO_SOPORTADAS.includes(clave)) continue
    if (clave === 'oneOf') salida.anyOf = limpiar(valor)
    else if (clave === 'const') salida.enum = [valor]
    else salida[clave] = limpiar(valor)
  }
  if (salida.type === 'object' && salida.properties) {
    salida.additionalProperties = false
    salida.required = Object.keys(salida.properties as object)
  }
  return salida
}

export const esquemaEstricto = (esquema: z.ZodType) => limpiar(z.toJSONSchema(esquema, { io: 'output', unrepresentable: 'any' })) as Record<string, unknown>

export const describirProblemas = (error: z.ZodError) =>
  error.issues
    .slice(0, 12)
    .map((i) => `- ${i.path.join('.') || '(raíz)'}: ${i.message}`)
    .join('\n')
