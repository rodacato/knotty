import { describe, expect, it } from 'vitest'
import { createPreferences, INITIAL_CONFIGURATION } from '../../adapters/llm/common/configuration'
import { connectBlocker, planConnect, storageFor, type ConnectInput } from './plan'

const input = (patch: Partial<ConnectInput> = {}): ConnectInput => ({
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-opus-5',
  host: 'https://api.anthropic.com',
  passphrase: '',
  vault: 'none',
  base: INITIAL_CONFIGURATION,
  ...patch,
})

describe('connectBlocker', () => {
  it('says the key is missing before anything else', () => {
    expect(connectBlocker(input())).toBe('Falta tu llave')
    expect(connectBlocker(input({ apiKey: '   ' }))).toBe('Falta tu llave')
  })
  it('is ready with a key and no passphrase', () => {
    expect(connectBlocker(input({ apiKey: 'k' }))).toBeNull()
  })
  it('asks for a model when the provider has none suggested', () => {
    expect(connectBlocker(input({ provider: 'openai', apiKey: 'k', model: '' }))).toBe('Falta elegir un modelo')
  })
  it('rejects a passphrase that is too short, but only when there is a key to protect', () => {
    expect(connectBlocker(input({ apiKey: 'k', passphrase: 'corta' }))).toMatch(/8 caracteres/)
    expect(connectBlocker(input({ apiKey: 'k', passphrase: 'una frase larga' }))).toBeNull()
  })
  it('does not need a key for SheLLM', () => {
    expect(
      connectBlocker(
        input({
          provider: 'shellm',
          model: 'claude',
          host: 'http://127.0.0.1:6100',
        }),
      ),
    ).toBeNull()
    expect(connectBlocker(input({ provider: 'shellm', model: 'claude', host: ' ' }))).toBe('Falta la dirección')
  })
})

describe('storageFor', () => {
  it('keeps the key encrypted only when there is a passphrase, and in the tab otherwise', () => {
    expect(storageFor(input({ apiKey: 'k', passphrase: 'una frase larga' }))).toBe('encrypted')
    expect(storageFor(input({ apiKey: 'k' }))).toBe('tab')
  })
  it('never picks a clear persistent storage', () => {
    for (const passphrase of ['', 'una frase larga'])
      for (const vault of ['none', 'locked', 'open'] as const) expect(['tab', 'encrypted']).toContain(storageFor(input({ apiKey: 'k', passphrase, vault })))
  })
  it('keeps encrypting when the vault is already open', () => {
    expect(storageFor(input({ apiKey: 'k', vault: 'open' }))).toBe('encrypted')
  })
})

describe('planConnect', () => {
  it('activates the provider with its trimmed key and leaves the others alone', () => {
    const plan = planConnect(input({ apiKey: ' sk-1 ' }))
    expect(plan.config.active).toBe('anthropic')
    expect(plan.config.connections.anthropic.apiKey).toBe('sk-1')
    expect(plan.config.connections.openai).toEqual(INITIAL_CONFIGURATION.connections.openai)
    expect(plan.forgetFirst).toBe(false)
  })
  it('forgets locked keys first, since a new key replaces them', () => {
    expect(planConnect(input({ apiKey: 'k', vault: 'locked' })).forgetFirst).toBe(true)
  })
})

describe('connecting through the real preferences', () => {
  const store = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      data,
    } as unknown as Storage & { data: Map<string, string> }
  }
  const stored = (s: { data: Map<string, string> }) => [...s.data.values()].join('\n')

  it('without a passphrase the key is only in the tab storage', async () => {
    const local = store()
    const tab = store()
    const preferences = createPreferences(local, tab)
    const plan = planConnect(input({ apiKey: 'sk-secret-1' }))
    await preferences.save(plan.config, plan.passphrase)
    expect(stored(local)).not.toContain('sk-secret-1')
    expect(stored(tab)).toContain('sk-secret-1')
    expect(preferences.vaultState()).toBe('none')
  })

  it('with a passphrase the key is in neither storage in clear, and opens again with it', async () => {
    const local = store()
    const tab = store()
    const preferences = createPreferences(local, tab)
    const plan = planConnect(input({ apiKey: 'sk-secret-2', passphrase: 'una frase larga' }))
    await preferences.save(plan.config, plan.passphrase)
    expect(stored(local)).not.toContain('sk-secret-2')
    expect(stored(tab)).not.toContain('sk-secret-2')
    const reopened = createPreferences(local, tab)
    expect(reopened.vaultState()).toBe('locked')
    await expect(reopened.unlock('otra frase distinta')).rejects.toThrow(/frase/)
    await reopened.unlock('una frase larga')
    expect(reopened.load().connections.anthropic.apiKey).toBe('sk-secret-2')
  })
})
