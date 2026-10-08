import { writeFileSync } from 'node:fs'
import data from '../../../public/catalog/catalog.json'
import { createAnthropic } from '../../../src/adapters/llm/anthropic'
import { createCompatible } from '../../../src/adapters/llm/compatibleOpenAI'
import { createSimulated } from '../../../src/adapters/llm/simulated/simulated'
import { Catalog } from '../../../src/domain/materials/catalog'
import type { LLMProvider } from '../../../src/ports/LLMProvider'
import { loadKeys } from './keys'

// What the targets that call an expert share: which provider a spec means, what it needs from the environment, and how a run says its exit code.

loadKeys()

export const env = process.env

/** Settings come from the environment; the Spanish names older .env files use still work. */
export const setting = (name: string, older: string) => env[name] ?? env[older]

export const catalog = Catalog.parse(data)

/** KNOTTY_MODELS="anthropic:claude-sonnet-5,openai:gpt-5,shellm:claude" */
export function provider(spec: string): LLMProvider {
  const [kind, ...rest] = spec.split(':')
  const model = rest.join(':')
  if (kind === 'anthropic') return createAnthropic(env.ANTHROPIC_API_KEY ?? '', model)
  if (kind === 'openai') return createCompatible({ provider: 'openai', host: 'https://api.openai.com', apiKey: env.OPENAI_API_KEY ?? '', model, label: spec })
  if (kind === 'simulated') return createSimulated(0)
  if (kind === 'shellm') return createCompatible({ provider: 'shellm', host: env.SHELLM_HOST ?? '', apiKey: env.SHELLM_API_KEY ?? '', model, label: spec })
  throw new Error(`Unknown provider: ${spec}`)
}

/** Where the calls go, for the manifest and the per-host limit: the host alone, never a path, key or credentials. */
export function hostOf(spec: string): string {
  const kind = spec.split(':')[0]
  if (kind === 'anthropic') return 'api.anthropic.com'
  if (kind === 'openai') return 'api.openai.com'
  if (kind === 'simulated') return 'simulated'
  try {
    return new URL(env.SHELLM_HOST ?? '').host || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** What each provider needs from the environment: checked before any case runs, so a missing key fails in a second and not once per case. */
const NEEDS: Record<string, string[]> = { anthropic: ['ANTHROPIC_API_KEY'], openai: ['OPENAI_API_KEY'], shellm: ['SHELLM_HOST'], simulated: [] }

export function preflight(models: string[]) {
  if (!models.length) throw new Error('Set KNOTTY_MODELS, for example "anthropic:claude-sonnet-5,shellm:claude".')
  for (const spec of models) {
    const kind = spec.split(':')[0]
    if (!(kind in NEEDS)) throw new Error(`Unknown provider: ${spec}`)
    const missing = NEEDS[kind].filter((name) => !env[name])
    if (missing.length) throw new Error(`${spec} needs ${missing.join(' and ')} in .env (or the environment); nothing was run.`)
  }
}

export const modelsFromEnv = () => (setting('KNOTTY_MODELS', 'KNOTTY_MODELOS') ?? '').split(',').filter(Boolean)

/** The code is the only exit code vitest cannot carry: the entry point reads it from here. */
export function reportExit(code: number) {
  if (env.KNOTTY_EXIT_FILE) writeFileSync(env.KNOTTY_EXIT_FILE, String(code))
}
