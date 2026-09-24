import { describe, expect, it } from 'vitest'
import type { ConfiguracionLLM } from '../../../ports/Preferencias'
import { crearBoveda } from './boveda'
import { CONFIGURACION_INICIAL, crearPreferencias } from './configuracion'

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
const conLlave = (guardado: ConfiguracionLLM['guardado']): ConfiguracionLLM => ({
  ...CONFIGURACION_INICIAL,
  activo: 'anthropic',
  guardado,
  conexiones: { ...CONFIGURACION_INICIAL.conexiones, anthropic: { ...CONFIGURACION_INICIAL.conexiones.anthropic, apiKey: LLAVE } },
})

/** Un navegador que recarga: mismos almacenes, preferencias nuevas. Pocas iteraciones para que el test sea rápido. */
const navegador = () => {
  const local = memoria()
  const pestana = memoria()
  return { local, pestana, abrir: () => crearPreferencias(local, pestana, crearBoveda(local, 1000)) }
}

describe('preferencias del LLM', () => {
  it('en memoria: nunca escribe la llave y se pierde al recargar', async () => {
    const n = navegador()
    await n.abrir().guardar(conLlave('memoria'))
    expect(n.local.volcado() + n.pestana.volcado()).not.toContain(LLAVE)
    const recargada = n.abrir()
    expect(recargada.cargar().activo).toBe('anthropic')
    expect(recargada.cargar().conexiones.anthropic.apiKey).toBe('')
  })

  it('en la pestaña: sobrevive a recargar, nunca en localStorage', async () => {
    const n = navegador()
    await n.abrir().guardar(conLlave('pestana'))
    expect(n.local.volcado()).not.toContain(LLAVE)
    expect(n.abrir().cargar().conexiones.anthropic.apiKey).toBe(LLAVE)
  })

  it('cifrada: guardar, recargar, desbloquear y olvidar', async () => {
    const n = navegador()
    await n.abrir().guardar(conLlave('cifrada'), 'frase larga y secreta')
    expect(n.local.volcado()).not.toContain(LLAVE)

    const recargada = n.abrir()
    expect(recargada.boveda()).toBe('bloqueada')
    expect(recargada.cargar().guardado).toBe('cifrada')
    expect(recargada.cargar().conexiones.anthropic.apiKey).toBe('')
    await expect(recargada.desbloquear('otra frase cualquiera')).rejects.toThrow('La frase no es correcta.')
    await recargada.desbloquear('frase larga y secreta')
    expect(recargada.boveda()).toBe('abierta')
    expect(recargada.cargar().conexiones.anthropic.apiKey).toBe(LLAVE)

    const cambio = recargada.cargar()
    await recargada.guardar({ ...cambio, conexiones: { ...cambio.conexiones, openai: { ...cambio.conexiones.openai, apiKey: 'sk-openai-9' } } })
    const otraVez = n.abrir()
    await otraVez.desbloquear('frase larga y secreta')
    expect(otraVez.cargar().conexiones.openai.apiKey).toBe('sk-openai-9')

    otraVez.olvidarLlaves()
    expect(n.abrir().boveda()).toBe('sin-boveda')
  })

  it('pide frase suficiente y no pisa una bóveda bloqueada', async () => {
    const n = navegador()
    await expect(n.abrir().guardar(conLlave('cifrada'), 'corta')).rejects.toThrow('al menos 8')
    await n.abrir().guardar(conLlave('cifrada'), 'frase larga y secreta')
    const bloqueada = n.abrir()
    await bloqueada.guardar({ ...bloqueada.cargar(), activo: 'simulado' }, 'otra frase larga')
    const despues = n.abrir()
    expect(despues.cargar().activo).toBe('simulado')
    await despues.desbloquear('frase larga y secreta')
    expect(despues.cargar().conexiones.anthropic.apiKey).toBe(LLAVE)
  })

  it('pasar de cifrada a memoria borra la bóveda', async () => {
    const n = navegador()
    const p = n.abrir()
    await p.guardar(conLlave('cifrada'), 'frase larga y secreta')
    await p.guardar(conLlave('memoria'))
    expect(n.abrir().boveda()).toBe('sin-boveda')
  })

  it('migra la opción vieja de recordar en la pestaña', () => {
    const n = navegador()
    n.local.setItem('despiece:v1:llm', JSON.stringify({ activo: 'openai', recordarEnPestana: true, conexiones: {} }))
    expect(n.abrir().cargar().guardado).toBe('pestana')
  })
})
