import { createAnthropic } from './adapters/llm/anthropic'
import { createPreferences } from './adapters/llm/common/configuration'
import { createCompatible } from './adapters/llm/compatibleOpenAI'
import { createSimulated } from './adapters/llm/simulated/simulated'
import { createJsonCatalog } from './adapters/catalog/json'
import { createLocalDebugLog } from './adapters/debug/localDebugLog'
import { withDebugLog } from './adapters/debug/loggedProvider'
import { createCanvasProcessor } from './adapters/image/canvas'
import { createLocalRepository } from './adapters/persistence/localStorage'
import { createBench } from './application/bench/bench'
import { createUseCases } from './application/useCases'
import type { LLMProvider } from './ports/LLMProvider'
import { PRESETS, type LLMConfiguration } from './ports/Preferences'
import type { Services } from './ui/services'

// Composition root: the only place that knows the concrete adapters.

function providerFor(c: LLMConfiguration): LLMProvider {
  if (c.active === 'anthropic') return createAnthropic(c.connections.anthropic.apiKey, c.connections.anthropic.model)
  if (c.active === 'openai' || c.active === 'shellm') {
    const connection = c.connections[c.active]
    return createCompatible({ provider: c.active, ...connection, label: `${PRESETS[c.active].label} · ${connection.model}` })
  }
  return createSimulated()
}

/** Development mode starts the app twice; the log notes one opening per page load. */
let opened = false

export async function compose(): Promise<Services> {
  const materials = createJsonCatalog()
  const catalog = await materials.load()
  const preferences = createPreferences()
  const debug = createLocalDebugLog()
  if (!opened) debug.record({ kind: 'app', summary: `Knotty ${__APP_COMMIT__} abierto`, data: { commit: __APP_COMMIT__, userAgent: navigator.userAgent, viewport: `${innerWidth}×${innerHeight}` } })
  opened = true
  const expert = () => withDebugLog(providerFor(preferences.load()), debug)
  const useCases = createUseCases({ llm: expert, catalog, repository: createLocalRepository() })
  // The bench talks to the same expert, through the log: raw answers from a bench run land there too.
  const bench = createBench({ llm: expert, catalog })
  return { useCases, catalog, materials, images: createCanvasProcessor(), preferences, debug, bench }
}
