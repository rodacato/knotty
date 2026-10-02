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
