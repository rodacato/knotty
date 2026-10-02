export const HELP: string
export function parseArgs(argv: string[]): { command: 'help' | 'run' | 'replay'; runId?: string; last?: boolean; regrade?: boolean; error?: string }
export function lastRun(root: string): string | null
