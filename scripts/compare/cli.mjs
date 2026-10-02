import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Entry of npm run compare and npm run compare:replay. Vitest takes no custom arguments, so the choices travel as environment.

const here = dirname(fileURLToPath(import.meta.url))
const RUN_ID = /^\d{8}-\d{9}-[0-9a-f]{6,}$/

export const HELP = `Uso:
  npm run compare                                  corre los casos contra el experto de KNOTTY_MODELS (cuesta tokens)
  npm run compare:replay -- <corrida|--last>       repite una corrida guardada sin conexión; imprime REPLAY OK si reproduce sus veredictos
  npm run compare:replay -- <corrida|--last> --regrade
                                                   muestra qué cambia con el calificador actual, sin fallar por eso
  npm run compare -- --help

Variables de entorno de la corrida: KNOTTY_MODELS, KNOTTY_CASES, KNOTTY_REPEAT, KNOTTY_LABEL, KNOTTY_PARALLEL (por host, 2 por omisión), KNOTTY_BASELINE.
Cada corrida queda en scripts/compare/results/<corrida>/. Salida distinta de cero: regresión (1), corrida incompleta o con errores de infraestructura (2).`

/** Turns argv into what to do; `error` is set when the arguments make no sense. */
export function parseArgs(argv) {
  const args = [...argv]
  if (args.includes('--help') || args.includes('-h')) return { command: 'help' }
  const command = args[0] === 'replay' ? 'replay' : 'run'
  if (command === 'run') return args.length && args[0] !== 'run' ? { command, error: `Argumento desconocido: ${args[0]}` } : { command }
  const rest = args.slice(1)
  const regrade = rest.includes('--regrade')
  const targets = rest.filter((a) => a !== '--regrade')
  const unknown = targets.find((a) => a.startsWith('--') && a !== '--last')
  if (unknown) return { command, error: `Opción desconocida: ${unknown}` }
  if (targets.length !== 1) return { command, error: 'Pasa una corrida o --last: npm run compare:replay -- --last' }
  const [target] = targets
  if (target === '--last') return { command, last: true, regrade }
  if (!RUN_ID.test(target)) return { command, error: `«${target}» no es el id de una corrida (por ejemplo 20261002-154501007-abcdef12).` }
  return { command, runId: target, regrade }
}

/** The newest run directory that has a manifest. */
export function lastRun(root) {
  if (!existsSync(root)) return null
  return (
    readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && RUN_ID.test(e.name) && existsSync(join(root, e.name, 'manifest.json')))
      .map((e) => e.name)
      .sort()
      .at(-1) ?? null
  )
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(3)
}

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.command === 'help') return void process.stdout.write(`${HELP}\n`)
  if (parsed.error) return fail(`${parsed.error}\n\n${HELP}`)

  const results = process.env.KNOTTY_RESULTS_DIR ?? join(here, 'results')
  const env = { ...process.env, KNOTTY_COMPARE_TARGET: parsed.command === 'replay' ? 'replay' : 'models' }
  if (parsed.command === 'replay') {
    const runId = parsed.last ? lastRun(results) : parsed.runId
    if (!runId) return fail('No hay corridas guardadas en scripts/compare/results/.')
    if (!existsSync(join(results, runId, 'manifest.json'))) return fail(`No existe la corrida ${runId} en ${results}.`)
    env.KNOTTY_REPLAY_RUN = runId
    if (parsed.regrade) env.KNOTTY_REPLAY_REGRADE = '1'
  }

  const exitDir = mkdtempSync(join(tmpdir(), 'knotty-compare-'))
  env.KNOTTY_EXIT_FILE = join(exitDir, 'exit')
  // The child gets the Ctrl+C too and closes the run on its own; this process only waits for it.
  process.on('SIGINT', () => {})
  const child = spawn(process.execPath, [join(here, '../../node_modules/vitest/vitest.mjs'), 'run', '--config', join(here, 'vitest.config.ts')], { stdio: 'inherit', env })
  child.on('exit', (status) => {
    let code = status ?? 1
    try {
      code = Number(readFileSync(env.KNOTTY_EXIT_FILE, 'utf8'))
    } catch {
      // The run died before it could say: vitest's own status stands.
    }
    rmSync(exitDir, { recursive: true, force: true })
    process.exit(code)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
