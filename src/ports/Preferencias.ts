// La configuración del proveedor de LLM. Las llaves nunca salen del dispositivo.

export type Proveedor = 'simulado' | 'anthropic' | 'openai' | 'shellm'
export type ProveedorReal = Exclude<Proveedor, 'simulado'>

export interface Conexion {
  modelo: string
  apiKey: string
  /** Solo SheLLM: dónde corre. */
  host: string
}

export interface ConfiguracionLLM {
  activo: Proveedor
  conexiones: Record<ProveedorReal, Conexion>
  /** Recordar las llaves en esta pestaña al recargar. */
  recordarEnPestana: boolean
}

export interface Preferencias {
  cargar(): ConfiguracionLLM
  guardar(c: ConfiguracionLLM): void
  modelos(proveedor: ProveedorReal, conexion: Conexion): Promise<string[]>
}

export const PRESETS: Record<Proveedor, { etiqueta: string; descripcion: string; modeloSugerido: string; pideLlave: boolean }> = {
  simulado: { etiqueta: 'Simulado', descripcion: 'Respuestas fijas para probar sin API. Gratis y sin conexión.', modeloSugerido: '', pideLlave: false },
  anthropic: { etiqueta: 'Claude', descripcion: 'API de Anthropic con tu API key.', modeloSugerido: 'claude-opus-5', pideLlave: true },
  openai: { etiqueta: 'OpenAI', descripcion: 'API de OpenAI con tu API key. Elige un modelo con visión.', modeloSugerido: '', pideLlave: true },
  shellm: { etiqueta: 'SheLLM', descripcion: 'Tu suscripción de Claude Code o Codex como API, corriendo en tu máquina.', modeloSugerido: 'claude', pideLlave: false },
}

export const SHELLM_URL = 'https://rodacato.github.io/SheLLM/'

/** Qué le falta al proveedor activo para contestar; null si está listo. */
export function faltante(c: ConfiguracionLLM): string | null {
  if (c.activo === 'simulado') return null
  const conexion = c.conexiones[c.activo]
  if (PRESETS[c.activo].pideLlave && !conexion.apiKey) return `Falta la API key de ${PRESETS[c.activo].etiqueta}.`
  if (!conexion.host.trim()) return 'Falta la dirección de SheLLM.'
  if (!conexion.modelo) return 'Falta elegir un modelo.'
  return null
}

export const etiquetaActiva = (c: ConfiguracionLLM) => (c.activo === 'simulado' ? 'Simulado' : `${PRESETS[c.activo].etiqueta} · ${c.conexiones[c.activo].modelo || 'sin modelo'}`)
