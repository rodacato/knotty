import { createGzipDesignFileCodec } from '../../adapters/designFile/gzip'
import { noLibrary } from '../../adapters/persistence/library'
import { createSimulated } from '../../adapters/llm/simulated/simulated'
import { createUseCases } from '../../application/useCases'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { testReferences } from '../../domain/furniture/fixtures/references.test-util'
import { NO_SETTINGS } from '../../domain/materials/catalog'
import type { DesignState } from '../../domain/session/state'
import type { LLMProvider } from '../../ports/LLMProvider'
import type { Services } from '../services'

export function testServices(expert: LLMProvider = createSimulated(0)) {
  let saved: DesignState | null = null
  const repository = { load: () => saved, save: (state: DesignState) => void (saved = state), clear: () => void (saved = null) }
  const services: Services = {
    useCases: createUseCases({ llm: () => expert, catalog: testCatalog, repository }),
    catalog: testCatalog,
    materials: { load: async () => testCatalog, settings: () => NO_SETTINGS, saveSettings: () => {} },
    preferences: {
      load: () => ({ active: 'simulated', keyStorage: 'memory', connections: { anthropic: { model: '', host: '', apiKey: '' }, openai: { model: '', host: '', apiKey: '' }, shellm: { model: '', host: '', apiKey: '' } } }),
      vaultState: () => 'none',
    } as Services['preferences'],
    images: {} as Services['images'],
    files: createGzipDesignFileCodec('test'),
    library: noLibrary,
    references: testReferences,
    debug: { visible: () => false, setVisible: () => {} },
  }
  return { services, repository }
}
