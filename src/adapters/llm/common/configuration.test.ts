import { describe, expect, it } from 'vitest'
import type { LLMConfiguration } from '../../../ports/Preferences'
import { createVault } from './vault'
import { INITIAL_CONFIGURATION, createPreferences } from './configuration'

function memoryStorage(): Storage & { dump: () => string } {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
    dump: () => JSON.stringify([...data]),
  }
}

const KEY = 'sk-ant-secreta-123'
const withKey = (storage: LLMConfiguration['keyStorage']): LLMConfiguration => ({
  ...INITIAL_CONFIGURATION,
  active: 'anthropic',
  keyStorage: storage,
  connections: { ...INITIAL_CONFIGURATION.connections, anthropic: { ...INITIAL_CONFIGURATION.connections.anthropic, apiKey: KEY } },
})

/** A browser that reloads: same storages, fresh preferences. Few iterations so the test runs fast. */
const browser = () => {
  const local = memoryStorage()
  const tab = memoryStorage()
  return { local, tab, open: () => createPreferences(local, tab, createVault(local, 1000)) }
}

describe('model preferences', () => {
  it('in memory: never writes the key and loses it on reload', async () => {
    const n = browser()
    await n.open().save(withKey('memory'))
    expect(n.local.dump() + n.tab.dump()).not.toContain(KEY)
    const reloaded = n.open()
    expect(reloaded.load().active).toBe('anthropic')
    expect(reloaded.load().connections.anthropic.apiKey).toBe('')
  })

  it('in the tab: survives a reload, never in localStorage', async () => {
    const n = browser()
    await n.open().save(withKey('tab'))
    expect(n.local.dump()).not.toContain(KEY)
    expect(n.open().load().connections.anthropic.apiKey).toBe(KEY)
  })

  it('encrypted: save, reload, unlock and forget', async () => {
    const n = browser()
    await n.open().save(withKey('encrypted'), 'frase larga y secreta')
    expect(n.local.dump()).not.toContain(KEY)

    const reloaded = n.open()
    expect(reloaded.vaultState()).toBe('locked')
    expect(reloaded.load().keyStorage).toBe('encrypted')
    expect(reloaded.load().connections.anthropic.apiKey).toBe('')
    await expect(reloaded.unlock('otra frase cualquiera')).rejects.toThrow('La frase no es correcta.')
    await reloaded.unlock('frase larga y secreta')
    expect(reloaded.vaultState()).toBe('open')
    expect(reloaded.load().connections.anthropic.apiKey).toBe(KEY)

    const change = reloaded.load()
    await reloaded.save({ ...change, connections: { ...change.connections, openai: { ...change.connections.openai, apiKey: 'sk-openai-9' } } })
    const again = n.open()
    await again.unlock('frase larga y secreta')
    expect(again.load().connections.openai.apiKey).toBe('sk-openai-9')

    again.forgetKeys()
    expect(n.open().vaultState()).toBe('none')
  })

  it('asks for a long enough passphrase and does not overwrite a locked vault', async () => {
    const n = browser()
    await expect(n.open().save(withKey('encrypted'), 'corta')).rejects.toThrow('al menos 8')
    await n.open().save(withKey('encrypted'), 'frase larga y secreta')
    const locked = n.open()
    await locked.save({ ...locked.load(), active: 'simulated' }, 'otra frase larga')
    const after = n.open()
    expect(after.load().active).toBe('simulated')
    await after.unlock('frase larga y secreta')
    expect(after.load().connections.anthropic.apiKey).toBe(KEY)
  })

  it('going from encrypted to memory deletes the vault', async () => {
    const n = browser()
    const p = n.open()
    await p.save(withKey('encrypted'), 'frase larga y secreta')
    await p.save(withKey('memory'))
    expect(n.open().vaultState()).toBe('none')
  })

  it('migrates the old remember-in-tab option', () => {
    const n = browser()
    n.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'openai', recordarEnPestana: true, conexiones: {} }))
    expect(n.open().load().keyStorage).toBe('tab')
  })

  it('reads what the version with Spanish fields saved', () => {
    const n = browser()
    n.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'shellm', guardado: 'pestana', conexiones: { shellm: { modelo: 'claude-x', apiKey: '', host: 'http://otra:6100' } } }))
    const config = n.open().load()
    expect(config).toMatchObject({ active: 'shellm', keyStorage: 'tab', connections: { shellm: { model: 'claude-x', host: 'http://otra:6100' } } })
    const other = browser()
    other.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'simulado', guardado: 'memoria', conexiones: {} }))
    expect(other.open().load()).toMatchObject({ active: 'simulated', keyStorage: 'memory' })
  })

  it('opens a vault sealed by the version with Spanish fields', async () => {
    const n = browser()
    await n.open().save(withKey('encrypted'), 'frase larga y secreta')
    // The older version kept it under its own key and with its fields in Spanish.
    const sealed = JSON.parse(n.local.getItem('knotty:vault')!)
    n.local.removeItem('knotty:vault')
    n.local.setItem('despiece:v1:boveda', JSON.stringify({ v: 1, iter: sealed.iterations, sal: sealed.salt, iv: sealed.iv, datos: sealed.data }))
    const reopened = n.open()
    await reopened.unlock('frase larga y secreta')
    expect(reopened.load().connections.anthropic.apiKey).toBe(KEY)
  })

  it('moves what the older version saved to the new keys, keys and vault included', async () => {
    const n = browser()
    await n.open().save(withKey('encrypted'), 'frase larga y secreta')
    for (const [key, older] of [['knotty:vault', 'despiece:v1:boveda'], ['knotty:expert', 'despiece:v1:llm']]) {
      n.local.setItem(older, n.local.getItem(key)!)
      n.local.removeItem(key)
    }
    const reopened = n.open()
    expect(reopened.vaultState()).toBe('locked')
    await reopened.unlock('frase larga y secreta')
    expect(reopened.load().connections.anthropic.apiKey).toBe(KEY)
    expect(n.local.getItem('despiece:v1:boveda')).toBeNull()
    expect(n.local.getItem('knotty:vault')).not.toBeNull()
  })
})
