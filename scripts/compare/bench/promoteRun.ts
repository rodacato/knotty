import { existsSync } from 'node:fs'
import { standingAgainst } from '../../../src/application/bench/against'
import { KNOWN_FAILURES } from '../../../src/application/bench/knownFailures'
import { baselineOf, canPromote } from '../../../src/application/bench/promote'
import { readBaselineFile, readRunResults, writeBaselineFile } from './baselineFile'
import type { RunStore } from '../shared/store'

// Turns a saved run into the baseline, only when asked to and only when the run can be trusted. A dry run is the default.

export interface PromoteReport {
  /** The run could be promoted: nothing blocks it, whether or not it was accepted. */
  promotable: boolean
  written: boolean
  lines: string[]
  exitCode: number
}

export function promoteRun(options: { store: RunStore; baselinePath: string; accept: boolean }): PromoteReport {
  const { store, baselinePath, accept } = options
  const { manifest, results, rows } = readRunResults(store)
  const current = existsSync(baselinePath) ? readBaselineFile(baselinePath) : null
  const { jobs: _jobs, ...identity } = manifest
  const verdict = canPromote({ manifest, results, baseline: current, accept: true })
  const diff = current ? standingAgainst(current, { manifest: identity, trials: results }, { known: KNOWN_FAILURES }) : null

  const lines = [
    `Promoción de la corrida ${manifest.runId} («${manifest.label}») a ${baselinePath}${accept ? '' : ' (simulacro: no se escribe nada)'}`,
    ...(verdict.ok ? ['Puede promoverse.'] : ['No puede promoverse:', ...verdict.reasons.map((r) => `  - ${r}`)]),
    ...(verdict.notes.length ? ['Notas:', ...verdict.notes.map((n) => `  - ${n}`)] : []),
    '',
    ...(diff ? ['Diferencias con la base actual:', ...diff.lines.filter(Boolean)] : [current ? '' : 'No hay base actual: esta sería la primera.']),
  ]

  if (!verdict.ok) return { promotable: false, written: false, lines: [...lines, '', 'No se escribió nada.'], exitCode: 1 }
  if (!accept) return { promotable: true, written: false, lines: [...lines, '', 'No se escribió nada: agrega --accept para fijar esta corrida como la base.'], exitCode: 0 }

  writeBaselineFile(baselinePath, baselineOf(manifest, rows))
  return { promotable: true, written: true, lines: [...lines, '', `Base escrita en ${baselinePath}. Súbela a git en el PR que cambia lo que ve el experto: la base solo cambia con ese commit.`], exitCode: 0 }
}
