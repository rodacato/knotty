import type { ConfiguracionLLM, EstadoBoveda, Preferencias, ProveedorReal } from '../../../ports/Preferencias'
import { FRASE_MINIMA } from '../../../ports/Preferencias'
import { modelosAnthropic } from '../anthropic'
import { modelosCompatibles } from '../compatibleOpenAI'
import { crearBoveda, type Llavero } from './boveda'

// Tomado de ai-town: la configuración se guarda sin llaves; las llaves viven en memoria, en la pestaña o cifradas con una frase.

const PROVEEDORES: ProveedorReal[] = ['anthropic', 'openai', 'shellm']
const CLAVE = 'despiece:v1:llm'
const CLAVE_PESTANA = 'despiece:v1:llaves'

export const CONFIGURACION_INICIAL: ConfiguracionLLM = {
  activo: 'simulado',
  conexiones: {
    anthropic: { modelo: 'claude-opus-5', apiKey: '', host: 'https://api.anthropic.com' },
    openai: { modelo: '', apiKey: '', host: 'https://api.openai.com' },
    shellm: { modelo: 'claude', apiKey: '', host: 'http://127.0.0.1:6100' },
  },
  guardado: 'memoria',
}

const llavero = (c: ConfiguracionLLM): Llavero => Object.fromEntries(PROVEEDORES.filter((p) => c.conexiones[p].apiKey).map((p) => [p, c.conexiones[p].apiKey]))
const conLlaves = (c: ConfiguracionLLM, llaves: Llavero): ConfiguracionLLM => ({
  ...c,
  conexiones: Object.fromEntries(PROVEEDORES.map((p) => [p, { ...c.conexiones[p], apiKey: llaves[p] ?? c.conexiones[p].apiKey }])) as ConfiguracionLLM['conexiones'],
})

function leer(almacen: Storage, pestana: Storage): ConfiguracionLLM {
  try {
    const guardada = JSON.parse(almacen.getItem(CLAVE) ?? 'null') as (Partial<ConfiguracionLLM> & { recordarEnPestana?: boolean }) | null
    const llaves = JSON.parse(pestana.getItem(CLAVE_PESTANA) ?? '{}') as Llavero
    const base: ConfiguracionLLM = {
      activo: guardada?.activo ?? CONFIGURACION_INICIAL.activo,
      guardado: guardada?.guardado ?? (guardada?.recordarEnPestana ? 'pestana' : 'memoria'),
      conexiones: Object.fromEntries(PROVEEDORES.map((p) => [p, { ...CONFIGURACION_INICIAL.conexiones[p], ...guardada?.conexiones?.[p], apiKey: '' }])) as ConfiguracionLLM['conexiones'],
    }
    return conLlaves(base, llaves)
  } catch {
    return CONFIGURACION_INICIAL
  }
}

export function crearPreferencias(almacen: Storage = localStorage, pestana: Storage = sessionStorage, boveda = crearBoveda(almacen)): Preferencias {
  let actual = leer(almacen, pestana)
  /** La frase de una bóveda abierta, solo en la memoria de esta pestaña, para volver a cifrar cada cambio sin preguntar. */
  let frase: string | null = null
  if (boveda.existe()) actual = { ...actual, guardado: 'cifrada' }

  const estado = (): EstadoBoveda => (!boveda.existe() ? 'sin-boveda' : frase === null ? 'bloqueada' : 'abierta')

  return {
    cargar: () => actual,
    boveda: estado,
    async guardar(c, nuevaFrase) {
      if (c.guardado === 'cifrada' && estado() === 'sin-boveda') {
        if (!nuevaFrase || nuevaFrase.length < FRASE_MINIMA) throw new Error(`La frase necesita al menos ${FRASE_MINIMA} caracteres.`)
        frase = nuevaFrase
      }
      if (c.guardado !== 'cifrada' && estado() === 'abierta') {
        boveda.olvidar()
        frase = null
      }
      // Con la bóveda bloqueada no se vuelve a sellar: se perderían las llaves que guarda.
      if (c.guardado === 'cifrada' && frase !== null) await boveda.sellar(llavero(c), frase)
      actual = c
      const sinLlaves = { ...c, conexiones: Object.fromEntries(PROVEEDORES.map((p) => [p, { ...c.conexiones[p], apiKey: '' }])) }
      try {
        almacen.setItem(CLAVE, JSON.stringify(sinLlaves))
        if (c.guardado === 'pestana') pestana.setItem(CLAVE_PESTANA, JSON.stringify(llavero(c)))
        else pestana.removeItem(CLAVE_PESTANA)
      } catch {
        /* sin almacenamiento (ventana privada): la configuración dura la sesión */
      }
    },
    async desbloquear(intento) {
      const llaves = await boveda.abrir(intento)
      frase = intento
      actual = conLlaves({ ...actual, guardado: 'cifrada' }, llaves)
    },
    olvidarLlaves() {
      boveda.olvidar()
      frase = null
      actual = { ...actual, guardado: 'memoria' }
    },
    modelos: (proveedor, conexion) => (proveedor === 'anthropic' ? modelosAnthropic(conexion.apiKey) : modelosCompatibles(conexion, proveedor === 'openai')),
  }
}
