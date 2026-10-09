import { createAnthropic } from './adapters/llm/anthropic'
import { createPreferences } from './adapters/llm/common/configuration'
import { createCompatible } from './adapters/llm/compatibleOpenAI'
import { createAbsent } from './adapters/llm/absent/absent'
import { createSimulated } from './adapters/llm/simulated/simulated'
import { applySettings } from './domain/materials/catalog'
import { createJsonCatalog } from './adapters/catalog/json'
import { createLocalDebugAccess, dropOldDebugLog } from './adapters/debug/access'
import { createCanvasProcessor } from './adapters/image/canvas'
import { createLocalRepository } from './adapters/persistence/localStorage'
import { createBundledReferences } from './adapters/references/store'
import { createUseCases } from './application/useCases'
import type { LLMProvider } from './ports/LLMProvider'
import { PRESETS, type LLMConfiguration } from './ports/Preferences'
import type { Services } from './ui/services'
import { useStore } from './ui/store'

// Composition root: the only place that knows the concrete adapters.

/** The simulated expert answers only for whoever chose it in this session: without a key it is nobody, not a stand-in. */
function providerFor(c: LLMConfiguration, simulatedChosen: boolean): LLMProvider {
  if (c.active === 'anthropic') return createAnthropic(c.connections.anthropic.apiKey, c.connections.anthropic.model)
  if (c.active === 'openai' || c.active === 'shellm') {
    const connection = c.connections[c.active]
    return createCompatible({ provider: c.active, ...connection, label: `${PRESETS[c.active].label} · ${connection.model}` })
  }
  return simulatedChosen ? createSimulated() : createAbsent()
}

export async function compose(): Promise<Services> {
  const materials = createJsonCatalog()
  const catalog = await materials.load()
  const preferences = createPreferences()
  dropOldDebugLog()
  const useCases = createUseCases({ llm: () => providerFor(preferences.load(), useStore.getState().simulatedChosen), catalog, promptCatalog: () => applySettings(catalog, materials.settings()), toolLevel: () => materials.settings().toolLevel, repository: createLocalRepository() })
  return { useCases, catalog, materials, images: createCanvasProcessor(), references: createBundledReferences(), preferences, debug: createLocalDebugAccess() }
}
