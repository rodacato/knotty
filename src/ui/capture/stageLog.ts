import { ATTEMPTS, type Stage } from '../../application/useCases'

export interface StageLine {
  text: string
  /** Epoch milliseconds when the line appeared. */
  at: number
}

export interface StageView {
  name: Stage
  attempt: number
  progress?: { done: number; total: number }
}

/** How many lines the footer keeps: the current one and the last real steps before it. */
export const HISTORY_LINES = 4

/** The line a stage shows; stages the waiting screen never names return null. */
export function stageText(stage: StageView): string | null {
  switch (stage.name) {
    case 'reading-photos':
      return stage.progress ? `Mirando las fotos (${Math.min(stage.progress.done + 1, stage.progress.total)} de ${stage.progress.total})` : 'Mirando las fotos'
    case 'designing':
      return 'Pensando el diseño'
    case 'designing-pieces':
      return 'Diseñando pieza por pieza'
    case 'checking':
      return 'Midiendo que todo cierre'
    case 'structure':
      return 'Revisando la estructura'
    case 'correcting':
      return `Intento ${stage.attempt + 1} de ${ATTEMPTS}: el experto está corrigiendo piezas que no cerraban.`
    default:
      return null
  }
}

/** Adds the stage's line when it is new, and keeps only the last ones. */
export function recordStage(log: StageLine[], stage: StageView, at: number, limit = HISTORY_LINES): StageLine[] {
  const text = stageText(stage)
  if (text === null || log[log.length - 1]?.text === text) return log
  return [...log, { text, at }].slice(-limit)
}

/** Seconds from the start of the wait to a line; the wait starts with the first line ever recorded, which the trimmed log may no longer hold. */
export const secondsSince = (start: number, at: number) => Math.max(0, Math.floor((at - start) / 1000))
