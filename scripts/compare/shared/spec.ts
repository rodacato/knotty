import type { Effort } from '../../../src/adapters/llm/anthropic'

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'off']

/** An Anthropic model may carry its effort after `@`: «anthropic:claude-haiku-5-5@low». */
export function anthropicSpec(model: string): { model: string; effort?: Effort } {
  const [name, effort] = model.split('@')
  if (effort === undefined) return { model: name }
  if (!EFFORTS.includes(effort as Effort)) throw new Error(`Unknown effort «${effort}» in ${model}: use ${EFFORTS.join(', ')}.`)
  return { model: name, effort: effort as Effort }
}
