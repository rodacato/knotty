import { crearAnthropic } from './adapters/llm/anthropic'
import { crearPreferencias } from './adapters/llm/comun/configuracion'
import { crearCompatible } from './adapters/llm/compatibleOpenAI'
import { crearSimulado } from './adapters/llm/simulado/simulado'
import { crearCatalogoJson } from './adapters/catalogo/json'
import { createLocalDebugLog } from './adapters/debug/localDebugLog'
import { withDebugLog } from './adapters/debug/loggedProvider'
import { crearProcesadorCanvas } from './adapters/imagen/canvas'
import { crearRepositorioLocal } from './adapters/persistencia/localStorage'
import { createBench } from './application/bench/bench'
import { crearCasosDeUso } from './application/casosDeUso'
import type { LLMProvider } from './ports/LLMProvider'
import { PRESETS, type ConfiguracionLLM } from './ports/Preferencias'
import type { Servicios } from './ui/servicios'

// Raíz de composición: el único lugar que conoce los adapters concretos.

function proveedorPara(c: ConfiguracionLLM): LLMProvider {
  if (c.activo === 'anthropic') return crearAnthropic(c.conexiones.anthropic.apiKey, c.conexiones.anthropic.modelo)
  if (c.activo === 'openai' || c.activo === 'shellm') {
    const conexion = c.conexiones[c.activo]
    return crearCompatible({ proveedor: c.activo, ...conexion, etiqueta: `${PRESETS[c.activo].etiqueta} · ${conexion.modelo}` })
  }
  return crearSimulado()
}

/** Development mode starts the app twice; the log notes one opening per page load. */
let opened = false

export async function componer(): Promise<Servicios> {
  const materiales = crearCatalogoJson()
  const catalogo = await materiales.cargar()
  const preferencias = crearPreferencias()
  const debug = createLocalDebugLog()
  if (!opened) debug.record({ kind: 'app', summary: `Knotty ${__APP_COMMIT__} abierto`, data: { commit: __APP_COMMIT__, userAgent: navigator.userAgent, viewport: `${innerWidth}×${innerHeight}` } })
  opened = true
  const expert = () => withDebugLog(proveedorPara(preferencias.cargar()), debug)
  const casos = crearCasosDeUso({ llm: expert, catalogo, repositorio: crearRepositorioLocal() })
  // The bench talks to the same expert, through the log: raw answers from a bench run land there too.
  const bench = createBench({ llm: expert, catalog: catalogo })
  return { casos, catalogo, materiales, imagenes: crearProcesadorCanvas(), preferencias, debug, bench }
}
