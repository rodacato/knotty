// Tomado de ai-town: la configuración se guarda sin llaves; la llave vive en memoria o, si el usuario quiere, en la pestaña.

export type Proveedor = 'simulado' | 'anthropic' | 'openai'
export type ProveedorReal = Exclude<Proveedor, 'simulado'>

export interface Conexion {
  modelo: string
  apiKey: string
}

export interface ConfiguracionLLM {
  activo: Proveedor
  conexiones: Record<ProveedorReal, Conexion>
  /** Recordar las llaves en esta pestaña (sessionStorage) al recargar. */
  recordarEnPestana: boolean
}

export const PRESETS: Record<Proveedor, { etiqueta: string; descripcion: string; modeloSugerido: string }> = {
  simulado: { etiqueta: 'Simulado', descripcion: 'Respuestas fijas para probar sin API. Gratis y sin conexión.', modeloSugerido: '' },
  anthropic: { etiqueta: 'Claude', descripcion: 'API de Anthropic con tu API key.', modeloSugerido: 'claude-opus-5' },
  openai: { etiqueta: 'OpenAI', descripcion: 'API de OpenAI con tu API key. Elige un modelo con visión.', modeloSugerido: '' },
}

export const CONFIGURACION_INICIAL: ConfiguracionLLM = {
  activo: 'simulado',
  conexiones: { anthropic: { modelo: 'claude-opus-5', apiKey: '' }, openai: { modelo: '', apiKey: '' } },
  recordarEnPestana: false,
}

const CLAVE = 'despiece:v1:llm'
const CLAVE_LLAVES = 'despiece:v1:llaves'

export function cargarConfiguracion(): ConfiguracionLLM {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<ConfiguracionLLM> | null
    const llaves = JSON.parse(sessionStorage.getItem(CLAVE_LLAVES) ?? '{}') as Partial<Record<ProveedorReal, string>>
    const base = { ...CONFIGURACION_INICIAL, ...guardada }
    return {
      ...base,
      conexiones: {
        anthropic: { ...CONFIGURACION_INICIAL.conexiones.anthropic, ...guardada?.conexiones?.anthropic, apiKey: llaves.anthropic ?? '' },
        openai: { ...CONFIGURACION_INICIAL.conexiones.openai, ...guardada?.conexiones?.openai, apiKey: llaves.openai ?? '' },
      },
    }
  } catch {
    return CONFIGURACION_INICIAL
  }
}

export function guardarConfiguracion(c: ConfiguracionLLM) {
  const sinLlaves = { ...c, conexiones: { anthropic: { ...c.conexiones.anthropic, apiKey: '' }, openai: { ...c.conexiones.openai, apiKey: '' } } }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sinLlaves))
    if (c.recordarEnPestana) sessionStorage.setItem(CLAVE_LLAVES, JSON.stringify({ anthropic: c.conexiones.anthropic.apiKey, openai: c.conexiones.openai.apiKey }))
    else sessionStorage.removeItem(CLAVE_LLAVES)
  } catch {
    /* sin almacenamiento (ventana privada): la configuración dura la sesión */
  }
}

/** Qué le falta al proveedor activo para poder contestar; null si está listo. */
export function faltante(c: ConfiguracionLLM): string | null {
  if (c.activo === 'simulado') return null
  const conexion = c.conexiones[c.activo]
  if (!conexion.apiKey) return `Falta la API key de ${PRESETS[c.activo].etiqueta}.`
  if (!conexion.modelo) return 'Falta elegir un modelo.'
  return null
}

export const etiquetaActiva = (c: ConfiguracionLLM) => (c.activo === 'simulado' ? 'Simulado' : `${PRESETS[c.activo].etiqueta} · ${c.conexiones[c.activo].modelo || 'sin modelo'}`)
