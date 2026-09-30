import { MIN_PASSPHRASE, PRESETS, type KeyStorage, type LLMConfiguration, type RealProvider, type VaultState } from '../../ports/Preferences'

export interface ConnectInput {
  provider: RealProvider
  apiKey: string
  model: string
  host: string
  passphrase: string
  vault: VaultState
  base: LLMConfiguration
}

const needsKey = (i: ConnectInput) => PRESETS[i.provider].needsKey

/** What the person still has to give before connecting; null when ready. */
export function connectBlocker(i: ConnectInput): string | null {
  const key = i.apiKey.trim()
  if (needsKey(i) && !key) return 'Falta tu llave'
  if (!i.model.trim()) return 'Falta elegir un modelo'
  if (!i.host.trim()) return 'Falta la dirección'
  if (i.vault !== 'open' && key && i.passphrase && i.passphrase.length < MIN_PASSPHRASE) return `La frase necesita ${MIN_PASSPHRASE} caracteres`
  return null
}

/** With a passphrase the key is kept encrypted; without one it only lasts this tab. Never in clear in the browser. */
export function storageFor(i: ConnectInput): KeyStorage {
  if (i.vault === 'open') return 'encrypted'
  return i.apiKey.trim() && i.passphrase ? 'encrypted' : 'tab'
}

export interface ConnectPlan {
  config: LLMConfiguration
  /** Only read by preferences when a new vault is created. */
  passphrase: string
  /** Saved keys that stay locked are replaced, so they are forgotten first. */
  forgetFirst: boolean
}

export function planConnect(i: ConnectInput): ConnectPlan {
  const connection = {
    ...i.base.connections[i.provider],
    apiKey: i.apiKey.trim(),
    model: i.model.trim(),
    host: i.host.trim(),
  }
  return {
    config: {
      ...i.base,
      active: i.provider,
      keyStorage: storageFor(i),
      connections: { ...i.base.connections, [i.provider]: connection },
    },
    passphrase: i.passphrase,
    forgetFirst: i.vault === 'locked',
  }
}
