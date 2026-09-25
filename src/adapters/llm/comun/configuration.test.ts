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
const conLlave = (guardado: LLMConfiguration['guardado']): LLMConfiguration => ({
  ...INITIAL_CONFIGURATION,
  activo: 'anthropic',
  guardado,
  conexiones: { ...INITIAL_CONFIGURATION.conexiones, anthropic: { ...INITIAL_CONFIGURATION.conexiones.anthropic, apiKey: LLAVE } },
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
    await n.abrir().save(conLlave('memoria'))
    expect(n.local.volcado() + n.pestana.volcado()).not.toContain(LLAVE)
    const recargada = n.abrir()
    expect(recargada.load().activo).toBe('anthropic')
    expect(recargada.load().conexiones.anthropic.apiKey).toBe('')
  })

  it('in the tab: survives a reload, never in localStorage', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('pestana'))
    expect(n.local.volcado()).not.toContain(LLAVE)
    expect(n.abrir().load().conexiones.anthropic.apiKey).toBe(LLAVE)
  })

  it('cifrada: guardar, recargar, desbloquear y olvidar', async () => {
    const n = navegador()
    await n.abrir().save(conLlave('cifrada'), 'frase larga y secreta')
    expect(n.local.volcado()).not.toContain(LLAVE)

    const recargada = n.abrir()
    expect(recargada.vaultState()).toBe('bloqueada')
    expect(recargada.load().guardado).toBe('cifrada')
    expect(recargada.load().conexiones.anthropic.apiKey).toBe('')
    await expect(recargada.unlock('otra frase cualquiera')).rejects.toThrow('La frase no es correcta.')
    await recargada.unlock('frase larga y secreta')
    expect(recargada.vaultState()).toBe('abierta')
    expect(recargada.load().conexiones.anthropic.apiKey).toBe(LLAVE)

    const cambio = recargada.load()
    await recargada.save({ ...cambio, conexiones: { ...cambio.conexiones, openai: { ...cambio.conexiones.openai, apiKey: 'sk-openai-9' } } })
    const otraVez = n.abrir()
    await otraVez.unlock('frase larga y secreta')
    expect(otraVez.load().conexiones.openai.apiKey).toBe('sk-openai-9')

    otraVez.forgetKeys()
    expect(n.abrir().vaultState()).toBe('sin-boveda')
  })

  it('asks for a long enough passphrase and does not overwrite a locked vault', async () => {
    const n = navegador()
    await expect(n.abrir().save(conLlave('cifrada'), 'corta')).rejects.toThrow('al menos 8')
    await n.abrir().save(conLlave('cifrada'), 'frase larga y secreta')
    const bloqueada = n.abrir()
    await bloqueada.save({ ...bloqueada.load(), activo: 'simulado' }, 'otra frase larga')
    const despues = n.abrir()
    expect(despues.load().activo).toBe('simulado')
    await despues.unlock('frase larga y secreta')
    expect(despues.load().conexiones.anthropic.apiKey).toBe(LLAVE)
  })

  it('going from encrypted to memory deletes the vault', async () => {
    const n = navegador()
    const p = n.abrir()
    await p.save(conLlave('cifrada'), 'frase larga y secreta')
    await p.save(conLlave('memoria'))
    expect(n.abrir().vaultState()).toBe('sin-boveda')
  })

  it('migrates the old remember-in-tab option', () => {
    const n = navegador()
    n.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'openai', recordarEnPestana: true, conexiones: {} }))
    expect(n.abrir().load().guardado).toBe('pestana')
  })
})
