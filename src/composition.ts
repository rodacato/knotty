import { createAnthropic } from './adapters/llm/anthropic'
import { createPreferences } from './adapters/llm/comun/configuration'
import { createCompatible } from './adapters/llm/compatibleOpenAI'
import { createSimulated } from './adapters/llm/simulado/simulated'
import { createJsonCatalog } from './adapters/catalogo/json'
import { createLocalDebugLog } from './adapters/debug/localDebugLog'
import { withDebugLog } from './adapters/debug/loggedProvider'
import { createCanvasProcessor } from './adapters/imagen/canvas'
import { createLocalRepository } from './adapters/persistencia/localStorage'
import { createBench } from './application/bench/bench'
import { createUseCases } from './application/useCases'
import type { LLMProvider } from './ports/LLMProvider'
import { PRESETS, type LLMConfiguration } from './ports/Preferences'
import type { Services } from './ui/services'

// Composition root: the only place that knows the concrete adapters.

function providerFor(c: LLMConfiguration): LLMProvider {
  if (c.activo === 'anthropic') return createAnthropic(c.conexiones.anthropic.apiKey, c.conexiones.anthropic.modelo)
  if (c.activo === 'openai' || c.activo === 'shellm') {
    const connection = c.conexiones[c.activo]
    return createCompatible({ provider: c.activo, ...connection, label: `${PRESETS[c.activo].label} · ${connection.modelo}` })
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
