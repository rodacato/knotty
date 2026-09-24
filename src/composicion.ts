import { crearAnthropic } from './adapters/llm/anthropic'
import { crearPreferencias } from './adapters/llm/comun/configuracion'
import { crearOpenAI } from './adapters/llm/openai'
import { crearSimulado } from './adapters/llm/simulado/simulado'
import { crearCatalogoJson } from './adapters/catalogo/json'
import { crearProcesadorCanvas } from './adapters/imagen/canvas'
import { crearRepositorioLocal } from './adapters/persistencia/localStorage'
import { crearCasosDeUso } from './application/casosDeUso'
import type { LLMProvider } from './ports/LLMProvider'
import type { ConfiguracionLLM } from './ports/Preferencias'
import type { Servicios } from './ui/servicios'

// Raíz de composición: el único lugar que conoce los adapters concretos.

function proveedorPara(c: ConfiguracionLLM): LLMProvider {
  if (c.activo === 'anthropic') return crearAnthropic(c.conexiones.anthropic.apiKey, c.conexiones.anthropic.modelo)
  if (c.activo === 'openai') return crearOpenAI(c.conexiones.openai.apiKey, c.conexiones.openai.modelo)
  return crearSimulado()
}

export async function componer(): Promise<Servicios> {
  const catalogo = await crearCatalogoJson().cargar()
  const guardadas = crearPreferencias()
  let configuracion = guardadas.cargar()
  const preferencias = {
    ...guardadas,
    cargar: () => configuracion,
    guardar(c: ConfiguracionLLM) {
      configuracion = c
      guardadas.guardar(c)
    },
  }
  const casos = crearCasosDeUso({ llm: () => proveedorPara(configuracion), catalogo, repositorio: crearRepositorioLocal() })
  return { casos, catalogo, imagenes: crearProcesadorCanvas(), preferencias }
}
