import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

// Las llaves van en .env (ignorado por git), nunca en la línea de comandos ni en el código.
if (existsSync('.env')) process.loadEnvFile('.env')

// Con KNOTTY_CRUDO=1 guarda el stream tal como llegó, para reportar al proveedor una respuesta rota.
if (process.env.KNOTTY_CRUDO) {
  const original = globalThis.fetch
  let n = 0
  globalThis.fetch = async (url, init) => {
    const r = await original(url, init)
    if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) return r
    const texto = await r.text()
    const carpeta = join(import.meta.dirname, 'resultados', 'crudo')
    mkdirSync(carpeta, { recursive: true })
    writeFileSync(join(carpeta, `${Date.now()}-${++n}.sse`), texto)
    return new Response(texto, { status: r.status, headers: r.headers })
  }
}

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
  /** Si esta llamada fue un reintento, los errores del intento anterior. */
  corrige: string[]
}

/** Envuelve al proveedor para medir cada llamada: el caso de uso reintenta y cada intento cuenta. */
function medido(llm: LLMProvider, llamadas: Llamada[]): LLMProvider {
  const medir =
    <A extends unknown[], R extends { consumo: { tokensSalida?: number } }>(f: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const inicio = performance.now()
      const previa = (a[0] as { correccion?: { errores: unknown } | null }).correccion?.errores
      const corrige = Array.isArray(previa) ? previa.map((e: { codigo: string }) => e.codigo) : typeof previa === 'string' ? [previa.slice(0, 40)] : []
      try {
        const r = await f(...a)
        llamadas.push({ segundos: (performance.now() - inicio) / 1000, salida: r.consumo.tokensSalida ?? null, corrige })
        return r
      } catch (e) {
        llamadas.push({ segundos: (performance.now() - inicio) / 1000, salida: null, corrige })
        throw e
      }
    }
  return {
    ...llm,
    reconstruir: medir(llm.reconstruir.bind(llm)),
    proponerAjuste: medir(llm.proponerAjuste.bind(llm)),
    dictaminar: medir(llm.dictaminar.bind(llm)),
    readPhoto: medir(llm.readPhoto.bind(llm)),
    planDesign: llm.planDesign ? medir(llm.planDesign.bind(llm)) : null,
  }
}

const commit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return '—'
  }
}

interface Resultado {
  prompt: string | null
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
  /** Qué reglas dieron los críticos, para saber si es interpretación del modelo o algo que las reglas deberían resolver. */
  reglas: string
  /** Por qué hubo reintentos: los códigos de error que se le devolvieron al modelo. */
  correcciones: string
  /** Lo que Knotty arregló por reglas sin volver al modelo. */
  reparaciones: number
  veredicto: string
}

/** Cada diseño se guarda (fuera de git) para revisar después qué armó el modelo. */
function guardarDiseno(spec: string, caso: string, estado: EstadoDiseno) {
  const carpeta = join(import.meta.dirname, 'resultados', 'disenos')
  mkdirSync(carpeta, { recursive: true })
  writeFileSync(join(carpeta, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${spec.replace(/\W+/g, '-')}-${caso}.json`), JSON.stringify(estado, null, 2))
}

const memoria = () => {
  let e: EstadoDiseno | null = null
  return { cargar: () => e, guardar: (x: EstadoDiseno) => void (e = x), borrar: () => void (e = null) }
}

async function correr(spec: string, caso: Caso): Promise<Resultado> {
  const llamadas: Llamada[] = []
  const casos = crearCasosDeUso({ llm: () => medido(proveedor(spec), llamadas), catalogo, repositorio: memoria() })
  const inicio = performance.now()
  const base = { prompt: null, modelo: spec, caso: caso.id, intentos: 0, tokensSalida: null, piezas: 0, uniones: 0, medidas: '—', medidasRazonables: null, criticos: 0, reglas: '', correcciones: '', reparaciones: 0, veredicto: '—' }
  try {
    const estado = await casos.reconstruir({ medidas: caso.medidas, fotos: [], miniaturas: [], notas: caso.notas }, AbortSignal.timeout(15 * 60_000))
    const segundos = (performance.now() - inicio) / 1000
    const diseno = disenoActual(estado)
    const a = analizar(diseno, catalogo)
    const d = diseno.dimensiones
    const razonables = Object.entries(caso.esperado).every(([k, [min, max]]) => d[k as keyof typeof d] >= min && d[k as keyof typeof d] <= max)
    const tokens = llamadas.map((l) => l.salida)
    const resultado = {
      ...base,
      prompt: estado.versiones[0].origen?.promptId ?? null,
      ok: true,
      error: null,
      segundos,
      intentos: llamadas.length,
      correcciones: [...new Set(llamadas.flatMap((l) => l.corrige))].join(' '),
      reparaciones: estado.trace.reduce((n, t) => n + t.repairs.length, 0),
      tokensSalida: tokens.every((t) => t !== null) ? tokens.reduce((s, t) => s! + t!, 0) : null,
      piezas: diseno.piezas.length,
      uniones: diseno.uniones.length,
      medidas: `${d.alto} × ${d.ancho} × ${d.fondo}`,
      medidasRazonables: razonables,
    }
    guardarDiseno(spec, caso.id, estado)
    if (!a.valido) return { ...resultado, veredicto: 'inválido' }
    const compra = estimarCompra(diseno, a.geo, catalogo)
    const v = revisarViabilidad({ diseno, geo: a.geo, catalogo, compra, hallazgos: a.hallazgos, incumplidos: [] })
    const criticos = a.hallazgos.filter((h) => h.severidad === 'critico')
    return { ...resultado, criticos: criticos.length, reglas: [...new Set(criticos.map((h) => h.codigo))].join(' '), veredicto: v.veredicto }
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
    `| ${r.modelo} | ${r.caso} | ${r.ok ? 'sí' : `no: ${(r.error ?? '').replace(/\|/g, '/').slice(0, 80)}`} | ${r.segundos.toFixed(0)} | ${r.intentos}${r.correcciones ? ` (${r.correcciones})` : ''} | ${r.reparaciones} | ${r.tokensSalida ?? '—'} | ${r.piezas} | ${r.uniones} | ${r.medidas} | ${r.medidasRazonables === null ? '—' : r.medidasRazonables ? 'sí' : 'NO'} | ${r.criticos}${r.reglas ? ` (${r.reglas})` : ''} | ${r.veredicto} |`
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
    `Commit ${commit()} · prompts ${[...new Set(resultados.map((r) => r.prompt).filter(Boolean))].join(', ') || '—'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |',
    '|---|---|---|---|---|---|',
    ...resumen,
    '',
    '| Modelo | Caso | Listo | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
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
