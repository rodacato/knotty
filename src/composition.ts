import { createAnthropic } from './adapters/llm/anthropic'
import { createPreferences } from './adapters/llm/common/configuration'
import { createCompatible } from './adapters/llm/compatibleOpenAI'
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

// Composition root: the only place that knows the concrete adapters.

function providerFor(c: LLMConfiguration): LLMProvider {
  if (c.active === 'anthropic') return createAnthropic(c.connections.anthropic.apiKey, c.connections.anthropic.model)
  if (c.active === 'openai' || c.active === 'shellm') {
    const connection = c.connections[c.active]
    return createCompatible({ provider: c.active, ...connection, label: `${PRESETS[c.active].label} · ${connection.model}` })
  }
  return createSimulated()
}

export async function compose(): Promise<Services> {
  const materials = createJsonCatalog()
  const catalog = await materials.load()
  const preferences = createPreferences()
  dropOldDebugLog()
  const useCases = createUseCases({ llm: () => providerFor(preferences.load()), catalog, promptCatalog: () => applySettings(catalog, materials.settings()), toolLevel: () => materials.settings().toolLevel, repository: createLocalRepository() })
  return { useCases, catalog, materials, images: createCanvasProcessor(), references: createBundledReferences(), preferences, debug: createLocalDebugAccess() }
}
