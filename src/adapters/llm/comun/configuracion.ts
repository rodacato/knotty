import type { ConfiguracionLLM, Preferencias, ProveedorReal } from '../../../ports/Preferencias'
import { modelosAnthropic } from '../anthropic'
import { modelosOpenAI } from '../openai'

// Tomado de ai-town: la configuración se guarda sin llaves; la llave vive en memoria o, si el usuario quiere, en la pestaña.

export const CONFIGURACION_INICIAL: ConfiguracionLLM = {
  activo: 'simulado',
  conexiones: { anthropic: { modelo: 'claude-opus-5', apiKey: '' }, openai: { modelo: '', apiKey: '' } },
  recordarEnPestana: false,
}

const CLAVE = 'despiece:v1:llm'
const CLAVE_LLAVES = 'despiece:v1:llaves'

export function crearPreferencias(): Preferencias {
  return {
    cargar() {
      try {
        const guardada = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<ConfiguracionLLM> | null
        const llaves = JSON.parse(sessionStorage.getItem(CLAVE_LLAVES) ?? '{}') as Partial<Record<ProveedorReal, string>>
        return {
          ...CONFIGURACION_INICIAL,
          ...guardada,
          conexiones: {
            anthropic: { ...CONFIGURACION_INICIAL.conexiones.anthropic, ...guardada?.conexiones?.anthropic, apiKey: llaves.anthropic ?? '' },
            openai: { ...CONFIGURACION_INICIAL.conexiones.openai, ...guardada?.conexiones?.openai, apiKey: llaves.openai ?? '' },
          },
        }
      } catch {
        return CONFIGURACION_INICIAL
      }
    },
    guardar(c) {
      const sinLlaves = { ...c, conexiones: { anthropic: { ...c.conexiones.anthropic, apiKey: '' }, openai: { ...c.conexiones.openai, apiKey: '' } } }
      try {
        localStorage.setItem(CLAVE, JSON.stringify(sinLlaves))
        if (c.recordarEnPestana) sessionStorage.setItem(CLAVE_LLAVES, JSON.stringify({ anthropic: c.conexiones.anthropic.apiKey, openai: c.conexiones.openai.apiKey }))
        else sessionStorage.removeItem(CLAVE_LLAVES)
      } catch {
        /* sin almacenamiento (ventana privada): la configuración dura la sesión */
      }
    },
    modelos: (proveedor, apiKey) => (proveedor === 'anthropic' ? modelosAnthropic(apiKey) : modelosOpenAI(apiKey)),
  }
}
