// A development log of everything that happened in a session, to export and study. Never holds API keys.

export type DebugKind = 'llm' | 'action' | 'stage' | 'error' | 'app'

export interface DebugEvent {
  at: string
  kind: DebugKind
  /** One line for the list: what happened. */
  summary: string
  /** Full detail for the export: requests, answers, errors. */
  data?: unknown
  ms?: number
}

export interface DebugLog {
  record(event: Omit<DebugEvent, 'at'>): void
  events(): DebugEvent[]
  clear(): void
  /** Whether the panel is shown; capture happens either way. */
  visible(): boolean
  setVisible(visible: boolean): void
}
