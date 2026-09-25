// The model provider's configuration. Keys never leave the device. Its fields are what is saved; `configuration.ts` also reads the older Spanish ones.

export type Provider = 'simulated' | 'anthropic' | 'openai' | 'shellm'
export type RealProvider = Exclude<Provider, 'simulated'>

export interface Connection {
  model: string
  apiKey: string
  /** Solo SheLLM: dónde corre. */
  host: string
}

/** Where keys live: in memory only, in this tab, or encrypted in the browser with a passphrase. */
export type KeyStorage = 'memory' | 'tab' | 'encrypted'
export type VaultState = 'none' | 'locked' | 'open'

export interface LLMConfiguration {
  active: Provider
  connections: Record<RealProvider, Connection>
  keyStorage: KeyStorage
}

export interface Preferences {
  load(): LLMConfiguration
  /** `passphrase` is only needed to create the vault the first time keys are saved encrypted. */
  save(c: LLMConfiguration, passphrase?: string): Promise<void>
  vaultState(): VaultState
  /** Fails if the passphrase is not the right one. */
  unlock(passphrase: string): Promise<void>
  forgetKeys(): void
  listModels(provider: RealProvider, connection: Connection): Promise<string[]>
}

export const MIN_PASSPHRASE = 8

export const PRESETS: Record<Provider, { label: string; description: string; suggestedModel: string; needsKey: boolean }> = {
  simulated: { label: 'Simulado', description: 'Respuestas fijas para probar sin API. Gratis y sin conexión.', suggestedModel: '', needsKey: false },
  anthropic: { label: 'Claude', description: 'API de Anthropic con tu API key.', suggestedModel: 'claude-opus-5', needsKey: true },
  openai: { label: 'OpenAI', description: 'API de OpenAI con tu API key. Elige un modelo con visión.', suggestedModel: '', needsKey: true },
  shellm: { label: 'SheLLM', description: 'Tu suscripción de Claude Code o Codex como API, corriendo en tu máquina.', suggestedModel: 'claude', needsKey: false },
}

export const SHELLM_URL = 'https://rodacato.github.io/SheLLM/'

/** What the active provider lacks to answer; null when it is ready. */
export function missing(c: LLMConfiguration): string | null {
  if (c.active === 'simulated') return null
  const connection = c.connections[c.active]
  if (PRESETS[c.active].needsKey && !connection.apiKey) return `Falta la API key de ${PRESETS[c.active].label}.`
  if (!connection.host.trim()) return 'Falta la dirección de SheLLM.'
  if (!connection.model) return 'Falta elegir un modelo.'
  return null
}

export const activeLabel = (c: LLMConfiguration) => (c.active === 'simulated' ? 'Simulado' : `${PRESETS[c.active].label} · ${c.connections[c.active].model || 'sin modelo'}`)
