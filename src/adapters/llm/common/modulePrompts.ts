import { z } from 'zod'
import { MODULES, type FurnitureKind } from '../../../domain/furniture/modules/plan'

// What the skeleton and plan-adjust prompts say about each module that has no prose of its own: written from its descriptor and its schema's descriptions.

/** Modules whose sections the prompts write by hand, tuned with `npm run compare`; any other gets its section from here. */
export const WRITTEN_BY_HAND: readonly FurnitureKind[] = ['cabinet', 'bed', 'table']


const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
/** "a shoe rack (a shallow box…)" → "The shoe rack". */
const title = (what: string) => what.replace(/ \(.*\)$/, '').replace(/^an? /, 'The ')

/** What the values of a field are, when its description does not say: "open or doors", "true or false". */
function valuesOf(schema: z.ZodType): string | null {
  if (schema instanceof z.ZodEnum) return schema.options.map((o) => `"${String(o)}"`).join(' or ')
  if (schema instanceof z.ZodLiteral) return `always "${String(schema.value)}"`
  if (schema instanceof z.ZodBoolean) return 'true or false'
  return null
}

/** One bullet per field, nested objects indented under theirs, in the order of the schema. */
function fieldLines(schema: z.ZodObject, indent = ''): string[] {
  return Object.entries(schema.shape).flatMap(([key, field]) => {
    const f = field as z.ZodType
    const values = valuesOf(f)
    const words = values && f.description ? `${values}; ${lower(f.description)}` : (values ?? f.description)
    const line = `${indent}- \`${key}\`${words ? `: ${words}` : ''}.`
    return f instanceof z.ZodObject && !f.description ? [`${indent}- \`${key}\`:`, ...fieldLines(f, `${indent}  `)] : [line]
  })
}

const schemaOf = (kind: FurnitureKind) => MODULES[kind].schema as unknown as z.ZodObject

/** The skeleton's line for a generated module, in its list of what the app builds. */
export const modulePick = (kind: FurnitureKind) => `- ${capitalized(MODULES[kind].expert.what)}. It goes in \`${kind}\`.`

/** The skeleton's section for a generated module: every field of its plan with what it means. */
export const moduleGuide = (kind: FurnitureKind) => [`## ${title(MODULES[kind].expert.what)} (\`${kind}\`)`, '', ...fieldLines(schemaOf(kind))].join('\n')

/** What plan-adjust says of a generated module: one line with the fields its plan has. */
export const moduleSummary = (kind: FurnitureKind) =>
  `- ${capitalized(MODULES[kind].expert.what)}, \`kind\` "${kind}": ${Object.keys(schemaOf(kind).shape).filter((k) => k !== 'kind').map((k) => `\`${k}\``).join(', ')}. It goes in \`${kind}\`.`
