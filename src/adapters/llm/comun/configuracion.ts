import type { ConfiguracionLLM, Preferencias, ProveedorReal } from '../../../ports/Preferencias'
import { modelosAnthropic } from '../anthropic'
import { modelosCompatibles } from '../compatibleOpenAI'

// Tomado de ai-town: la configuración se guarda sin llaves; la llave vive en memoria o, si el usuario quiere, en la pestaña.

export const CONFIGURACION_INICIAL: ConfiguracionLLM = {
  activo: 'simulado',
  conexiones: {
    anthropic: { modelo: 'claude-opus-5', apiKey: '', host: 'https://api.anthropic.com' },
    openai: { modelo: '', apiKey: '', host: 'https://api.openai.com' },
    shellm: { modelo: 'claude', apiKey: '', host: 'http://127.0.0.1:6100' },
  },
  recordarEnPestana: false,
}

const PROVEEDORES: ProveedorReal[] = ['anthropic', 'openai', 'shellm']
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
          conexiones: Object.fromEntries(
            PROVEEDORES.map((p) => [p, { ...CONFIGURACION_INICIAL.conexiones[p], ...guardada?.conexiones?.[p], apiKey: llaves[p] ?? '' }]),
          ) as ConfiguracionLLM['conexiones'],
        }
      } catch {
        return CONFIGURACION_INICIAL
      }
    },
    guardar(c) {
      const sinLlaves = { ...c, conexiones: Object.fromEntries(PROVEEDORES.map((p) => [p, { ...c.conexiones[p], apiKey: '' }])) }
      try {
        localStorage.setItem(CLAVE, JSON.stringify(sinLlaves))
        if (c.recordarEnPestana) sessionStorage.setItem(CLAVE_LLAVES, JSON.stringify(Object.fromEntries(PROVEEDORES.map((p) => [p, c.conexiones[p].apiKey]))))
        else sessionStorage.removeItem(CLAVE_LLAVES)
      } catch {
        /* sin almacenamiento (ventana privada): la configuración dura la sesión */
      }
    },
    modelos: (proveedor, conexion) =>
      proveedor === 'anthropic' ? modelosAnthropic(conexion.apiKey) : modelosCompatibles(conexion, proveedor === 'openai'),
  }
}
