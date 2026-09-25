import { z } from 'zod'

// Anthropic's and OpenAI's strict modes take a subset of JSON Schema; Zod validates again what is dropped here.
const UNSUPPORTED = ['pattern', 'format', 'minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', '$schema']

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean)
  if (!node || typeof node !== 'object') return node
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED.includes(key)) continue
    if (key === 'oneOf') output.anyOf = clean(value)
    else if (key === 'const') output.enum = [value]
    else output[key] = clean(value)
  }
  if (output.type === 'object' && output.properties) {
    output.additionalProperties = false
    output.required = Object.keys(output.properties as object)
  }
  return output
}

export const strictSchema = (schema: z.ZodType) => clean(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })) as Record<string, unknown>

export const describeProblems = (error: z.ZodError) =>
  error.issues
    .slice(0, 12)
    .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
