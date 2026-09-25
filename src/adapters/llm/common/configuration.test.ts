import { describe, expect, it } from 'vitest'
import type { LLMConfiguration } from '../../../ports/Preferences'
import { createVault } from './vault'
import { INITIAL_CONFIGURATION, createPreferences } from './configuration'

function memoria(): Storage & { volcado: () => string } {
  const datos = new Map<string, string>()
  return {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    get length() {
      return datos.size
    },
    volcado: () => JSON.stringify([...datos]),
  }
}

const LLAVE = 'sk-ant-secreta-123'
const conLlave = (guardado: LLMConfiguration['keyStorage']): LLMConfiguration => ({
  ...INITIAL_CONFIGURATION,
  active: 'anthropic',
  keyStorage: guardado,
  connections: { ...INITIAL_CONFIGURATION.connections, anthropic: { ...INITIAL_CONFIGURATION.connections.anthropic, apiKey: LLAVE } },
})

/** Un navegador que recarga: mismos almacenes, preferencias nuevas. Pocas iteraciones para que el test sea rápido. */
const navegador = () => {
  const local = memoria()
  const pestana = memoria()
  return { local, pestana, abrir: () => createPreferences(local, pestana, createVault(local, 1000)) }
}

describe('model preferences', () => {
  it('in memory: never writes the key and loses it on reload', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('memory'))
    expect(n.local.volcado() + n.pestana.volcado()).not.toContain(LLAVE)
    const recargada = n.abrir()
    expect(recargada.load().active).toBe('anthropic')
    expect(recargada.load().connections.anthropic.apiKey).toBe('')
  })

  it('in the tab: survives a reload, never in localStorage', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('tab'))
    expect(n.local.volcado()).not.toContain(LLAVE)
    expect(n.abrir().load().connections.anthropic.apiKey).toBe(LLAVE)
  })

  it('cifrada: guardar, recargar, desbloquear y olvidar', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('encrypted'), 'frase larga y secreta')
    expect(n.local.volcado()).not.toContain(LLAVE)

    const recargada = n.abrir()
    expect(recargada.vaultState()).toBe('locked')
    expect(recargada.load().keyStorage).toBe('encrypted')
    expect(recargada.load().connections.anthropic.apiKey).toBe('')
    await expect(recargada.unlock('otra frase cualquiera')).rejects.toThrow('La frase no es correcta.')
    await recargada.unlock('frase larga y secreta')
    expect(recargada.vaultState()).toBe('open')
    expect(recargada.load().connections.anthropic.apiKey).toBe(LLAVE)

    const cambio = recargada.load()
    await recargada.save({ ...cambio, connections: { ...cambio.connections, openai: { ...cambio.connections.openai, apiKey: 'sk-openai-9' } } })
    const otraVez = n.abrir()
    await otraVez.unlock('frase larga y secreta')
    expect(otraVez.load().connections.openai.apiKey).toBe('sk-openai-9')

    otraVez.forgetKeys()
    expect(n.abrir().vaultState()).toBe('none')
  })

  it('asks for a long enough passphrase and does not overwrite a locked vault', async () => {
    const n = navegador()
    await expect(n.abrir().save(conLlave('encrypted'), 'corta')).rejects.toThrow('al menos 8')
    await n.abrir().save(conLlave('encrypted'), 'frase larga y secreta')
    const bloqueada = n.abrir()
    await bloqueada.save({ ...bloqueada.load(), active: 'simulated' }, 'otra frase larga')
    const despues = n.abrir()
    expect(despues.load().active).toBe('simulated')
    await despues.unlock('frase larga y secreta')
    expect(despues.load().connections.anthropic.apiKey).toBe(LLAVE)
  })

  it('going from encrypted to memory deletes the vault', async () => {
    const n = navegador()
    const p = n.abrir()
    await p.save(conLlave('encrypted'), 'frase larga y secreta')
    await p.save(conLlave('memory'))
    expect(n.abrir().vaultState()).toBe('none')
  })

  it('migrates the old remember-in-tab option', () => {
    const n = navegador()
    n.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'openai', recordarEnPestana: true, conexiones: {} }))
    expect(n.abrir().load().keyStorage).toBe('tab')
  })

  it('reads what the version with Spanish fields saved', () => {
    const n = navegador()
    n.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'shellm', guardado: 'pestana', conexiones: { shellm: { modelo: 'claude-x', apiKey: '', host: 'http://otra:6100' } } }))
    const config = n.abrir().load()
    expect(config).toMatchObject({ active: 'shellm', keyStorage: 'tab', connections: { shellm: { model: 'claude-x', host: 'http://otra:6100' } } })
    const other = navegador()
    other.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'simulado', guardado: 'memoria', conexiones: {} }))
    expect(other.abrir().load()).toMatchObject({ active: 'simulated', keyStorage: 'memory' })
  })

  it('opens a vault sealed by the version with Spanish fields', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('encrypted'), 'frase larga y secreta')
    // The older version kept it under its own key and with its fields in Spanish.
    const sealed = JSON.parse(n.local.getItem('knotty:vault')!)
    n.local.removeItem('knotty:vault')
    n.local.setItem('despiece:v1:boveda', JSON.stringify({ v: 1, iter: sealed.iterations, sal: sealed.salt, iv: sealed.iv, datos: sealed.data }))
    const reopened = n.abrir()
    await reopened.unlock('frase larga y secreta')
    expect(reopened.load().connections.anthropic.apiKey).toBe(LLAVE)
  })

  it('moves what the older version saved to the new keys, keys and vault included', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('encrypted'), 'frase larga y secreta')
    for (const [key, older] of [['knotty:vault', 'despiece:v1:boveda'], ['knotty:expert', 'despiece:v1:llm']]) {
      n.local.setItem(older, n.local.getItem(key)!)
      n.local.removeItem(key)
    }
    const reopened = n.abrir()
    expect(reopened.vaultState()).toBe('locked')
    await reopened.unlock('frase larga y secreta')
    expect(reopened.load().connections.anthropic.apiKey).toBe(LLAVE)
    expect(n.local.getItem('despiece:v1:boveda')).toBeNull()
    expect(n.local.getItem('knotty:vault')).not.toBeNull()
  })
})
