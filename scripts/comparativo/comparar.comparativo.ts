import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'vitest'
import datos from '../../public/catalogo/catalogo.json'
import { crearAnthropic } from '../../src/adapters/llm/anthropic'
import { crearCompatible } from '../../src/adapters/llm/compatibleOpenAI'
import { crearSimulado } from '../../src/adapters/llm/simulado/simulado'
import { crearCasosDeUso } from '../../src/application/casosDeUso'
import { analizar } from '../../src/domain/analisis'
import { Catalogo } from '../../src/domain/materiales/catalogo'
import { estimarCompra } from '../../src/domain/materiales/compra'
import { disenoActual, type EstadoDiseno } from '../../src/domain/sesion/estado'
import { revisarViabilidad } from '../../src/domain/viabilidad/viabilidad'
import type { LLMProvider } from '../../src/ports/LLMProvider'
import { CASOS, type Caso } from './casos'

// Corre los pedidos fijos contra cada modelo y califica el resultado con las cuentas de Knotty. Se corre a mano: npm run comparar.

const catalogo = Catalogo.parse(datos)
const env = process.env

/** KNOTTY_MODELOS="anthropic:claude-sonnet-5,openai:gpt-5,shellm:claude" */
function proveedor(spec: string): LLMProvider {
  const [tipo, ...resto] = spec.split(':')
  const modelo = resto.join(':')
  if (tipo === 'anthropic') return crearAnthropic(env.ANTHROPIC_API_KEY ?? '', modelo)
  if (tipo === 'openai') return crearCompatible({ proveedor: 'openai', host: 'https://api.openai.com', apiKey: env.OPENAI_API_KEY ?? '', modelo, etiqueta: spec })
  if (tipo === 'simulado') return crearSimulado(0)
  if (tipo === 'shellm') return crearCompatible({ proveedor: 'shellm', host: env.SHELLM_HOST ?? '', apiKey: env.SHELLM_API_KEY ?? '', modelo, etiqueta: spec })
  throw new Error(`Proveedor desconocido: ${spec}`)
}

interface Llamada {
  segundos: number
  salida: number | null
}

/** Envuelve al proveedor para medir cada llamada: el caso de uso reintenta y cada intento cuenta. */
function medido(llm: LLMProvider, llamadas: Llamada[]): LLMProvider {
  const medir =
    <A extends unknown[], R extends { consumo: { tokensSalida?: number } }>(f: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const inicio = performance.now()
      try {
        const r = await f(...a)
        llamadas.push({ segundos: (performance.now() - inicio) / 1000, salida: r.consumo.tokensSalida ?? null })
        return r
      } catch (e) {
        llamadas.push({ segundos: (performance.now() - inicio) / 1000, salida: null })
        throw e
      }
    }
  return { ...llm, reconstruir: medir(llm.reconstruir.bind(llm)), proponerAjuste: medir(llm.proponerAjuste.bind(llm)), dictaminar: medir(llm.dictaminar.bind(llm)) }
}

interface Resultado {
  modelo: string
  caso: string
  ok: boolean
  error: string | null
  segundos: number
  intentos: number
  tokensSalida: number | null
  piezas: number
  uniones: number
  medidas: string
  medidasRazonables: boolean | null
  criticos: number
  veredicto: string
}

const memoria = () => {
  let e: EstadoDiseno | null = null
  return { cargar: () => e, guardar: (x: EstadoDiseno) => void (e = x), borrar: () => void (e = null) }
}

async function correr(spec: string, caso: Caso): Promise<Resultado> {
  const llamadas: Llamada[] = []
  const casos = crearCasosDeUso({ llm: () => medido(proveedor(spec), llamadas), catalogo, repositorio: memoria() })
  const inicio = performance.now()
  const base = { modelo: spec, caso: caso.id, intentos: 0, tokensSalida: null, piezas: 0, uniones: 0, medidas: '—', medidasRazonables: null, criticos: 0, veredicto: '—' }
  try {
    const estado = await casos.reconstruir({ medidas: caso.medidas, fotos: [], miniaturas: [], notas: caso.notas }, AbortSignal.timeout(6 * 60_000))
    const segundos = (performance.now() - inicio) / 1000
    const diseno = disenoActual(estado)
    const a = analizar(diseno, catalogo)
    const d = diseno.dimensiones
    const razonables = Object.entries(caso.esperado).every(([k, [min, max]]) => d[k as keyof typeof d] >= min && d[k as keyof typeof d] <= max)
    const tokens = llamadas.map((l) => l.salida)
    const resultado = {
      ...base,
      ok: true,
      error: null,
      segundos,
      intentos: llamadas.length,
      tokensSalida: tokens.every((t) => t !== null) ? tokens.reduce((s, t) => s! + t!, 0) : null,
      piezas: diseno.piezas.length,
      uniones: diseno.uniones.length,
      medidas: `${d.alto} × ${d.ancho} × ${d.fondo}`,
      medidasRazonables: razonables,
    }
    if (!a.valido) return { ...resultado, veredicto: 'inválido' }
    const compra = estimarCompra(diseno, a.geo, catalogo)
    const v = revisarViabilidad({ diseno, geo: a.geo, catalogo, compra, hallazgos: a.hallazgos, incumplidos: [] })
    return { ...resultado, criticos: a.hallazgos.filter((h) => h.severidad === 'critico').length, veredicto: v.veredicto }
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message : String(e), segundos: (performance.now() - inicio) / 1000, intentos: llamadas.length }
  }
}

/** Corre de a `n` a la vez, para no pegarle a los límites de cada proveedor. */
async function enLotes<T, R>(items: T[], n: number, f: (x: T) => Promise<R>) {
  const salida: R[] = []
  for (let i = 0; i < items.length; i += n) salida.push(...(await Promise.all(items.slice(i, i + n).map(f))))
  return salida
}

function informe(resultados: Resultado[], etiqueta: string) {
  const fila = (r: Resultado) =>
    `| ${r.modelo} | ${r.caso} | ${r.ok ? 'sí' : `no: ${(r.error ?? '').replace(/\|/g, '/').slice(0, 80)}`} | ${r.segundos.toFixed(0)} | ${r.intentos} | ${r.tokensSalida ?? '—'} | ${r.piezas} | ${r.uniones} | ${r.medidas} | ${r.medidasRazonables === null ? '—' : r.medidasRazonables ? 'sí' : 'NO'} | ${r.criticos} | ${r.veredicto} |`
  const modelos = [...new Set(resultados.map((r) => r.modelo))]
  const resumen = modelos.map((m) => {
    const rs = resultados.filter((r) => r.modelo === m)
    const buenos = rs.filter((r) => r.ok)
    const prom = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
    const tokens = buenos.map((r) => r.tokensSalida).filter((t): t is number => t !== null)
    return `| ${m} | ${buenos.length}/${rs.length} | ${prom(buenos.map((r) => r.segundos)).toFixed(0)} | ${tokens.length ? prom(tokens).toFixed(0) : '—'} | ${buenos.filter((r) => r.medidasRazonables).length}/${buenos.length} | ${buenos.filter((r) => r.veredicto === 'viable').length}/${buenos.length} |`
  })
  return [
    `# Comparativo de modelos: ${etiqueta}`,
    '',
    '| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |',
    '|---|---|---|---|---|---|',
    ...resumen,
    '',
    '| Modelo | Caso | Listo | s | Intentos | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...resultados.map(fila),
    '',
  ].join('\n')
}

it('comparativo de modelos', async () => {
  const modelos = (env.KNOTTY_MODELOS ?? '').split(',').filter(Boolean)
  if (!modelos.length) throw new Error('Define KNOTTY_MODELOS, por ejemplo "anthropic:claude-sonnet-5,shellm:claude".')
  const filtro = env.KNOTTY_CASOS?.split(',')
  const casos = CASOS.filter((c) => !filtro || filtro.includes(c.id))
  const repeticiones = Number(env.KNOTTY_REPETICIONES ?? 1)
  const trabajos = modelos.flatMap((m) => Array.from({ length: repeticiones }, () => casos.map((c) => ({ m, c }))).flat())
  const resultados = await enLotes(trabajos, Number(env.KNOTTY_PARALELO ?? 2), ({ m, c }) => correr(m, c))

  const etiqueta = env.KNOTTY_ETIQUETA ?? 'formato actual'
  const texto = informe(resultados, etiqueta)
  const carpeta = join(import.meta.dirname, 'resultados')
  mkdirSync(carpeta, { recursive: true })
  const archivo = join(carpeta, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${etiqueta.replace(/\W+/g, '-')}.md`)
  writeFileSync(archivo, texto)
  console.log(`\n${texto}\nGuardado en ${archivo}`)
})
