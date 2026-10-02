import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Entry of the npm run compare:* commands. Vitest takes no custom arguments, so the choices travel as environment.

const here = dirname(fileURLToPath(import.meta.url))
const RUN_ID = /^\d{8}-\d{9}-[0-9a-f]{6,}$/

export const HELP = `Uso:
  npm run compare                                  corre los casos contra el experto de KNOTTY_MODELS (cuesta tokens)
  npm run compare:replay -- <corrida|--last>       repite una corrida guardada sin conexión; imprime REPLAY OK si reproduce sus veredictos
  npm run compare:replay -- <corrida|--last> --regrade
                                                   muestra qué cambia con el calificador actual, sin fallar por eso
  npm run compare:resume -- <corrida|--last>       corre solo lo pendiente de una corrida compatible (mismo commit, estado, calificador, prompts y catálogo)
  npm run compare:resume -- <corrida|--last> --retry-infra
                                                   además reintenta los trabajos que fallaron por infraestructura
  npm run compare:resume -- <corrida|--last> --retry-failed
                                                   además repite las regresiones y las fallas conocidas (a propósito)
  npm run compare:promote -- <corrida|--last>      simulacro: qué cambiaría en la base y qué lo impide; no escribe nada
  npm run compare:promote -- <corrida|--last> --accept
                                                   fija la corrida como base (scripts/compare/baseline.json) si nada lo impide
  npm run compare:concurrency -- 2,4[,6]           la misma batería a cada nivel de concurrencia, uno tras otro, y una tabla (cuesta tokens)
                                                   los niveles 5 y 6 piden --allow-6; más de 6 se rechaza
  npm run compare:hard                             las 16 preguntas difíciles contra el contrato real; los datos son privados y se leen al correr (cuesta tokens)
  npm run compare:hard -- --list                   ids, soporte y conteos, sin conexión y sin texto
  npm run compare -- --help

Variables de entorno de la corrida: KNOTTY_MODELS, KNOTTY_CASES, KNOTTY_REPEAT, KNOTTY_LABEL, KNOTTY_PARALLEL (por host, 2 por omisión),
KNOTTY_BASELINE (corrida, archivo o none; por omisión scripts/compare/baseline.json), KNOTTY_PROMOTE_TO (otro archivo para promote).
Suite difícil: KNOTTY_HARD_DIR (carpeta privada; por omisión contexto-carpinteria/docs/evaluacion-persona/), KNOTTY_HARD_TRIALS_CRITICAL (3) y KNOTTY_HARD_TRIALS (1).
Cada corrida queda en scripts/compare/results/<corrida>/. Salida: 0 pasa (o solo fallas conocidas), 1 regresión, 2 corrida incompleta o con errores de infraestructura, 3 argumentos inválidos.`

const COMMANDS = ['run', 'replay', 'resume', 'promote', 'concurrency', 'hard']
const FLAGS = { replay: ['--regrade'], resume: ['--retry-infra', '--retry-failed'], promote: ['--accept'], concurrency: ['--allow-6'], hard: ['--list'] }

/** Turns argv into what to do; `error` is set when the arguments make no sense. */
export function parseArgs(argv) {
  const args = [...argv]
  if (args.includes('--help') || args.includes('-h')) return { command: 'help' }
  const command = COMMANDS.includes(args[0]) ? args[0] : 'run'
  if (command === 'run') return args.length && args[0] !== 'run' ? { command, error: `Argumento desconocido: ${args[0]}` } : { command }

  const rest = args.slice(1)
  const flags = FLAGS[command]
  const unknown = rest.find((a) => a.startsWith('--') && a !== '--last' && !flags.includes(a))
  if (unknown) return { command, error: `Opción desconocida: ${unknown}` }
  const targets = rest.filter((a) => !a.startsWith('--') || a === '--last')

  if (command === 'hard') {
    if (targets.length) return { command, error: `Argumento desconocido: ${targets[0]}` }
    return { command, list: rest.includes('--list') }
  }

  if (command === 'concurrency') {
    if (targets.length !== 1) return { command, error: 'Pasa los niveles separados por coma: npm run compare:concurrency -- 2,4' }
    if (!/^\d+(,\d+)*$/.test(targets[0])) return { command, error: `«${targets[0]}» no son niveles de concurrencia (por ejemplo 2,4).` }
    return { command, levels: targets[0], allowSix: rest.includes('--allow-6') }
  }

  if (targets.length !== 1) return { command, error: `Pasa una corrida o --last: npm run compare:${command} -- --last` }
  const [target] = targets
  if (target !== '--last' && !RUN_ID.test(target)) return { command, error: `«${target}» no es el id de una corrida (por ejemplo 20261002-154501007-abcdef12).` }
  const which = target === '--last' ? { last: true } : { runId: target }

  if (command === 'replay') return { command, ...which, regrade: rest.includes('--regrade') }
  if (command === 'promote') return { command, ...which, accept: rest.includes('--accept') }
  if (rest.includes('--retry-infra') && rest.includes('--retry-failed')) return { command, error: 'Elige --retry-infra o --retry-failed, no los dos.' }
  return { command, ...which, mode: rest.includes('--retry-infra') ? 'retry-infra' : rest.includes('--retry-failed') ? 'retry-failed' : 'resume' }
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

const TARGET = { run: 'models', replay: 'replay', resume: 'resume', promote: 'promote', concurrency: 'concurrency', hard: 'hard' }

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.command === 'help') return void process.stdout.write(`${HELP}\n`)
  if (parsed.error) return fail(`${parsed.error}\n\n${HELP}`)

  const results = process.env.KNOTTY_RESULTS_DIR ?? join(here, 'results')
  const env = { ...process.env, KNOTTY_COMPARE_TARGET: TARGET[parsed.command] }
  if (parsed.command === 'hard') {
    if (parsed.list) env.KNOTTY_HARD_LIST = '1'
  } else if (parsed.command === 'concurrency') {
    env.KNOTTY_CONCURRENCY_LEVELS = parsed.levels
    if (parsed.allowSix) env.KNOTTY_ALLOW_6 = '1'
  } else if (parsed.command !== 'run') {
    const runId = parsed.last ? lastRun(results) : parsed.runId
    if (!runId) return fail('No hay corridas guardadas en scripts/compare/results/.')
    if (!existsSync(join(results, runId, 'manifest.json'))) return fail(`No existe la corrida ${runId} en ${results}.`)
    if (parsed.command === 'replay') {
      env.KNOTTY_REPLAY_RUN = runId
      if (parsed.regrade) env.KNOTTY_REPLAY_REGRADE = '1'
    }
    if (parsed.command === 'resume') {
      env.KNOTTY_RESUME_RUN = runId
      env.KNOTTY_RESUME_MODE = parsed.mode
    }
    if (parsed.command === 'promote') {
      env.KNOTTY_PROMOTE_RUN = runId
      if (parsed.accept) env.KNOTTY_PROMOTE_ACCEPT = '1'
    }
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
