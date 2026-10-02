import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HELP, lastRun, parseArgs } from './cli.mjs'

const RUN = '20261002-154501007-abcdef12'
const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('parseArgs', () => {
  it('runs the live bench with no arguments', () => {
    expect(parseArgs([])).toEqual({ command: 'run' })
    expect(parseArgs(['run'])).toEqual({ command: 'run' })
  })

  it('replays a run by id or the last one, with or without regrade', () => {
    expect(parseArgs(['replay', RUN])).toEqual({ command: 'replay', runId: RUN, regrade: false })
    expect(parseArgs(['replay', '--last'])).toEqual({ command: 'replay', last: true, regrade: false })
    expect(parseArgs(['replay', '--regrade', '--last'])).toEqual({ command: 'replay', last: true, regrade: true })
  })

  it('resumes a run by id or the last one, with the retry mode', () => {
    expect(parseArgs(['resume', '--last'])).toEqual({ command: 'resume', last: true, mode: 'resume' })
    expect(parseArgs(['resume', RUN, '--retry-infra'])).toEqual({ command: 'resume', runId: RUN, mode: 'retry-infra' })
    expect(parseArgs(['resume', '--retry-failed', '--last'])).toEqual({ command: 'resume', last: true, mode: 'retry-failed' })
    expect(parseArgs(['resume', '--last', '--retry-infra', '--retry-failed']).error).toMatch(/no los dos/)
    expect(parseArgs(['resume', '--last', '--accept']).error).toMatch(/Opción desconocida/)
  })

  it('promotes only with --accept', () => {
    expect(parseArgs(['promote', '--last'])).toEqual({ command: 'promote', last: true, accept: false })
    expect(parseArgs(['promote', RUN, '--accept'])).toEqual({ command: 'promote', runId: RUN, accept: true })
    expect(parseArgs(['promote']).error).toMatch(/--last/)
  })

  it('takes concurrency levels and the acknowledgement for the high ones', () => {
    expect(parseArgs(['concurrency', '2,4'])).toEqual({ command: 'concurrency', levels: '2,4', allowSix: false })
    expect(parseArgs(['concurrency', '2,4,6', '--allow-6'])).toEqual({ command: 'concurrency', levels: '2,4,6', allowSix: true })
    expect(parseArgs(['concurrency']).error).toMatch(/niveles/)
    expect(parseArgs(['concurrency', 'a,b']).error).toMatch(/no son niveles/)
  })

  it('runs the hard suite, and lists it with --list', () => {
    expect(parseArgs(['hard'])).toEqual({ command: 'hard', list: false })
    expect(parseArgs(['hard', '--list'])).toEqual({ command: 'hard', list: true })
    expect(parseArgs(['hard', 'C01']).error).toMatch(/Argumento desconocido/)
    expect(parseArgs(['hard', '--accept']).error).toMatch(/Opción desconocida/)
  })

  it('asks for help and refuses what it does not understand', () => {
    expect(parseArgs(['--help'])).toEqual({ command: 'help' })
    expect(parseArgs(['replay', '--help'])).toEqual({ command: 'help' })
    expect(parseArgs(['replay']).error).toMatch(/--last/)
    expect(parseArgs(['replay', RUN, '--last']).error).toBeDefined()
    expect(parseArgs(['replay', '../etc/passwd']).error).toMatch(/no es el id/)
    expect(parseArgs(['replay', '--fast', RUN]).error).toMatch(/Opción desconocida/)
    expect(parseArgs(['replya']).error).toMatch(/desconocido/)
  })
})

describe('compare:hard', () => {
  it('refuses, runs nothing and says why when the private directory is absent', () => {
    const missing = join(tmpdir(), 'knotty-cli-no-bank')
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'cli.mjs'), 'hard', '--list'], { encoding: 'utf8', env: { ...process.env, KNOTTY_HARD_DIR: missing } })
    expect(r.status).toBe(3)
    expect(r.stdout).toMatch(/No se encontró la batería privada.*No se corrió nada/)
  })
})

describe('lastRun', () => {
  it('picks the newest directory that has a manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'knotty-cli-'))
    dirs.push(root)
    expect(lastRun(join(root, 'none'))).toBeNull()
    for (const id of [RUN, '20261002-154502000-0a0b0c0d']) {
      mkdirSync(join(root, id))
      writeFileSync(join(root, id, 'manifest.json'), '{}')
    }
    mkdirSync(join(root, '20261003-000000000-ffffffff'))
    expect(lastRun(root)).toBe('20261002-154502000-0a0b0c0d')
  })
})

describe('the entry point', () => {
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [join(import.meta.dirname, 'cli.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } })

  it('prints its help and exits 0', () => {
    const r = run(['--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toBe(`${HELP}\n`)
  })

  it('refuses bad arguments with exit 3 for every command, before starting anything', () => {
    for (const args of [['resume'], ['promote', 'nope'], ['concurrency'], ['concurrency', 'x'], ['resume', '--last', '--retry-infra', '--retry-failed']]) expect(run(args).status).toBe(3)
    const empty = mkdtempSync(join(tmpdir(), 'knotty-cli-'))
    dirs.push(empty)
    expect(run(['resume', '--last'], { KNOTTY_RESULTS_DIR: empty }).stderr).toMatch(/No hay corridas/)
    expect(run(['promote', RUN], { KNOTTY_RESULTS_DIR: empty }).stderr).toMatch(/No existe la corrida/)
  })

  it('refuses a malformed or missing run id before starting anything', () => {
    const empty = mkdtempSync(join(tmpdir(), 'knotty-cli-'))
    dirs.push(empty)
    expect(run(['replay', 'nope']).status).toBe(3)
    const missing = run(['replay', RUN], { KNOTTY_RESULTS_DIR: empty })
    expect(missing.status).toBe(3)
    expect(missing.stderr).toMatch(/No existe la corrida/)
    expect(run(['replay', '--last'], { KNOTTY_RESULTS_DIR: empty }).stderr).toMatch(/No hay corridas/)
  })
})
