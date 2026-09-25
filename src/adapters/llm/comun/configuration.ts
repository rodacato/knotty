import type { LLMConfiguration, VaultState, Preferences, RealProvider } from '../../../ports/Preferences'
import { MIN_PASSPHRASE } from '../../../ports/Preferences'
import { anthropicModels } from '../anthropic'
import { compatibleModels } from '../compatibleOpenAI'
import { createVault, type Keyring } from './vault'

// Taken from ai-town: the configuration is saved without keys; keys live in memory, in the tab or encrypted with a passphrase.

const PROVIDERS: RealProvider[] = ['anthropic', 'openai', 'shellm']
const STORAGE_KEY = 'despiece:v1:llm'
const TAB_KEY = 'despiece:v1:llaves'

export const INITIAL_CONFIGURATION: LLMConfiguration = {
  activo: 'simulado',
  conexiones: {
    anthropic: { modelo: 'claude-opus-5', apiKey: '', host: 'https://api.anthropic.com' },
    openai: { modelo: '', apiKey: '', host: 'https://api.openai.com' },
    shellm: { modelo: 'claude', apiKey: '', host: 'http://127.0.0.1:6100' },
  },
  guardado: 'memoria',
}

const keyring = (c: LLMConfiguration): Keyring => Object.fromEntries(PROVIDERS.filter((p) => c.conexiones[p].apiKey).map((p) => [p, c.conexiones[p].apiKey]))
const withKeys = (c: LLMConfiguration, keys: Keyring): LLMConfiguration => ({
  ...c,
  conexiones: Object.fromEntries(PROVIDERS.map((p) => [p, { ...c.conexiones[p], apiKey: keys[p] ?? c.conexiones[p].apiKey }])) as LLMConfiguration['conexiones'],
})

function read(storage: Storage, tab: Storage): LLMConfiguration {
  try {
    // `recordarEnPestana` is how older versions saved it: read to migrate it.
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as (Partial<LLMConfiguration> & { recordarEnPestana?: boolean }) | null
    const keys = JSON.parse(tab.getItem(TAB_KEY) ?? '{}') as Keyring
    const base: LLMConfiguration = {
      activo: saved?.activo ?? INITIAL_CONFIGURATION.activo,
      guardado: saved?.guardado ?? (saved?.recordarEnPestana ? 'pestana' : 'memoria'),
      conexiones: Object.fromEntries(PROVIDERS.map((p) => [p, { ...INITIAL_CONFIGURATION.conexiones[p], ...saved?.conexiones?.[p], apiKey: '' }])) as LLMConfiguration['conexiones'],
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
  if (vault.exists()) current = { ...current, guardado: 'cifrada' }

  const state = (): VaultState => (!vault.exists() ? 'sin-boveda' : passphrase === null ? 'bloqueada' : 'abierta')

  return {
    load: () => current,
    vaultState: state,
    async save(c, newPassphrase) {
      if (c.guardado === 'cifrada' && state() === 'sin-boveda') {
        if (!newPassphrase || newPassphrase.length < MIN_PASSPHRASE) throw new Error(`La frase necesita al menos ${MIN_PASSPHRASE} caracteres.`)
        passphrase = newPassphrase
      }
      if (c.guardado !== 'cifrada' && state() === 'abierta') {
        vault.forget()
        passphrase = null
      }
      // With the vault locked it is not sealed again: the keys it keeps would be lost.
      if (c.guardado === 'cifrada' && passphrase !== null) await vault.seal(keyring(c), passphrase)
      current = c
      const withoutKeys = { ...c, conexiones: Object.fromEntries(PROVIDERS.map((p) => [p, { ...c.conexiones[p], apiKey: '' }])) }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(withoutKeys))
        if (c.guardado === 'pestana') tab.setItem(TAB_KEY, JSON.stringify(keyring(c)))
        else tab.removeItem(TAB_KEY)
      } catch {
        /* sin almacenamiento (ventana privada): la configuración dura la sesión */
      }
    },
    async unlock(attempt) {
      const keys = await vault.open(attempt)
      passphrase = attempt
      current = withKeys({ ...current, guardado: 'cifrada' }, keys)
    },
    forgetKeys() {
      vault.forget()
      passphrase = null
      current = { ...current, guardado: 'memoria' }
    },
    listModels: (provider, connection) => (provider === 'anthropic' ? anthropicModels(connection.apiKey) : compatibleModels(connection, provider === 'openai')),
  }
}
