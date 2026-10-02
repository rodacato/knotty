export const HELP: string

export interface Parsed {
  command: 'help' | 'run' | 'replay' | 'resume' | 'promote' | 'concurrency'
  runId?: string
  last?: boolean
  regrade?: boolean
  accept?: boolean
  mode?: 'resume' | 'retry-infra' | 'retry-failed'
  levels?: string
  allowSix?: boolean
  error?: string
}

export function parseArgs(argv: string[]): Parsed
export function lastRun(root: string): string | null
