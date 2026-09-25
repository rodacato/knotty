import type { LLMConfiguration, VaultState, Preferences, RealProvider, Provider, KeyStorage } from '../../../ports/Preferences'
import { MIN_PASSPHRASE } from '../../../ports/Preferences'
import { anthropicModels } from '../anthropic'
import { compatibleModels } from '../compatibleOpenAI'
import { createVault, type Keyring } from './vault'

// Taken from ai-town: the configuration is saved without keys; keys live in memory, in the tab or encrypted with a passphrase.

const PROVIDERS: RealProvider[] = ['anthropic', 'openai', 'shellm']
const STORAGE_KEY = 'despiece:v1:llm'
const TAB_KEY = 'despiece:v1:llaves'

export const INITIAL_CONFIGURATION: LLMConfiguration = {
  active: 'simulated',
  connections: {
    anthropic: { model: 'claude-opus-5', apiKey: '', host: 'https://api.anthropic.com' },
    openai: { model: '', apiKey: '', host: 'https://api.openai.com' },
    shellm: { model: 'claude', apiKey: '', host: 'http://127.0.0.1:6100' },
  },
  keyStorage: 'memory',
}

const keyring = (c: LLMConfiguration): Keyring => Object.fromEntries(PROVIDERS.filter((p) => c.connections[p].apiKey).map((p) => [p, c.connections[p].apiKey]))
const withKeys = (c: LLMConfiguration, keys: Keyring): LLMConfiguration => ({
  ...c,
  connections: Object.fromEntries(PROVIDERS.map((p) => [p, { ...c.connections[p], apiKey: keys[p] ?? c.connections[p].apiKey }])) as LLMConfiguration['connections'],
})

/** How older versions saved it: fields in Spanish, and before that a `recordarEnPestana` flag. */
interface SavedV1 {
  activo?: string
  guardado?: string
  recordarEnPestana?: boolean
  conexiones?: Partial<Record<RealProvider, { modelo?: string; host?: string }>>
}
const OLD_PROVIDER: Record<string, Provider> = { simulado: 'simulated' }
const OLD_STORAGE: Record<string, KeyStorage> = { memoria: 'memory', pestana: 'tab', cifrada: 'encrypted' }

function read(storage: Storage, tab: Storage): LLMConfiguration {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as (Partial<LLMConfiguration> & SavedV1) | null
    const keys = JSON.parse(tab.getItem(TAB_KEY) ?? '{}') as Keyring
    const active = saved?.active ?? (saved?.activo ? (OLD_PROVIDER[saved.activo] ?? (saved.activo as Provider)) : INITIAL_CONFIGURATION.active)
    const keyStorage = saved?.keyStorage ?? (saved?.guardado ? OLD_STORAGE[saved.guardado] : undefined) ?? (saved?.recordarEnPestana ? 'tab' : 'memory')
    const connection = (p: RealProvider) => {
      const now = saved?.connections?.[p]
      const old = saved?.conexiones?.[p]
      return { ...INITIAL_CONFIGURATION.connections[p], ...(old?.host ? { host: old.host } : {}), ...(old?.modelo !== undefined ? { model: old.modelo } : {}), ...now, apiKey: '' }
    }
    const base: LLMConfiguration = {
      active: PROVIDERS.includes(active as RealProvider) || active === 'simulated' ? active : INITIAL_CONFIGURATION.active,
      keyStorage,
      connections: Object.fromEntries(PROVIDERS.map((p) => [p, connection(p)])) as LLMConfiguration['connections'],
    }
    return withKeys(base, keys)
  } catch {
    return INITIAL_CONFIGURATION
  }
}

export function createPreferences(storage: Storage = localStorage, tab: Storage = sessionStorage, vault = createVault(storage)): Preferences {
  let current = read(storage, tab)
  /** The passphrase of an open vault, only in this tab's memory, to encrypt every change again without asking. */
  let passphrase: string | null = null
  if (vault.exists()) current = { ...current, keyStorage: 'encrypted' }

  const state = (): VaultState => (!vault.exists() ? 'none' : passphrase === null ? 'locked' : 'open')

  return {
    load: () => current,
    vaultState: state,
    async save(c, newPassphrase) {
      if (c.keyStorage === 'encrypted' && state() === 'none') {
        if (!newPassphrase || newPassphrase.length < MIN_PASSPHRASE) throw new Error(`La frase necesita al menos ${MIN_PASSPHRASE} caracteres.`)
        passphrase = newPassphrase
      }
      if (c.keyStorage !== 'encrypted' && state() === 'open') {
        vault.forget()
        passphrase = null
      }
      // With the vault locked it is not sealed again: the keys it keeps would be lost.
      if (c.keyStorage === 'encrypted' && passphrase !== null) await vault.seal(keyring(c), passphrase)
      current = c
      const withoutKeys: LLMConfiguration = { ...c, connections: Object.fromEntries(PROVIDERS.map((p) => [p, { ...c.connections[p], apiKey: '' }])) as LLMConfiguration['connections'] }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(withoutKeys))
        if (c.keyStorage === 'tab') tab.setItem(TAB_KEY, JSON.stringify(keyring(c)))
        else tab.removeItem(TAB_KEY)
      } catch {
        /* sin almacenamiento (ventana privada): la configuración dura la sesión */
      }
    },
    async unlock(attempt) {
      const keys = await vault.open(attempt)
      passphrase = attempt
      current = withKeys({ ...current, keyStorage: 'encrypted' }, keys)
    },
    forgetKeys() {
      vault.forget()
      passphrase = null
      current = { ...current, keyStorage: 'memory' }
    },
    listModels: (provider, connection) => (provider === 'anthropic' ? anthropicModels(connection.apiKey) : compatibleModels(connection, provider === 'openai')),
  }
}
