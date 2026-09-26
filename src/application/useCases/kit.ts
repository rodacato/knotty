import { analyze } from '../../domain/analysis'
import type { Design } from '../../domain/design/schema'
import { abbreviate, pruneVersions, type Origin } from '../../domain/history/history'
import type { Catalog } from '../../domain/materials/catalog'
import type { FurniturePlan } from '../../domain/modules/plan'
import type { Operation } from '../../domain/operations/schema'
import type { Requirement } from '../../domain/requirements/requirements'
import { currentDesign, type DesignState, type Message } from '../../domain/session/state'
import type { Finding } from '../../domain/structure/finding'
import type { DesignRepository } from '../../ports/DesignRepository'
import type { LLMProvider } from '../../ports/LLMProvider'

// What every use case shares: the dependencies, the clock, chat messages, saving and adding a version.

export type Stage = 'reading-photos' | 'designing' | 'designing-pieces' | 'proposing' | 'checking' | 'structure' | 'correcting' | 'reviewing-criticals'
export type OnProgress = (stage: Stage, attempt: number, progress?: { done: number; total: number }) => void

export const ATTEMPTS = 3

export interface Dependencies {
  llm: () => LLMProvider
  catalog: Catalog
  repository: DesignRepository
  now?: () => string
  newId?: () => string
}

export function createKit(deps: Dependencies) {
  const { catalog, repository } = deps
  const now = deps.now ?? (() => new Date().toISOString())
  const newId = deps.newId ?? (() => crypto.randomUUID())

  const message = (author: Message['author'], text: string, extra: Partial<Message> = {}): Message => ({
    id: newId(),
    author,
    text: text,
    date: now(),
    questions: [],
    answered: false,
    version: null,
    proposal: null,
    error: false,
    requestedPhotos: [],
    thumbnail: null,
    answers: [],
    suggestions: [],
    solutions: [],
    ...extra,
  })

  const save = (state: DesignState) => {
    repository.save(state)
    return state
  }

  function addVersion(
    state: DesignState,
    design: Design,
    data: { summary: string; reason: string; operations: Operation[]; origin: Origin | null; plan?: FurniturePlan | null; extras?: Operation[] },
  ): DesignState {
    const n = Math.max(...state.versions.map((v) => v.n)) + 1
    // The finish is the person's: a design rebuilt from the plan or written by the expert comes without it and keeps the current one.
    const finish = design.finish ?? currentDesign(state).finish
    const versions = pruneVersions([
      ...state.versions,
      { n, design: finish && !design.finish ? { ...design, finish } : design, summary: data.summary, reason: data.reason, operations: data.operations.map(abbreviate), date: now(), origin: data.origin, decisions: state.decisions, plan: data.plan ?? null, extras: data.plan ? (data.extras ?? []) : [] },
    ])
    return { ...state, versions: versions, current: n, proposal: null, chat: state.chat.map((m) => (m.proposal === 'pending' ? { ...m, proposal: 'discarded' as const, answered: true } : m)) }
  }

  /** A chat note on the version just made, which it points to. */
  const noted = (state: DesignState, author: Message['author'], text: string): DesignState => ({ ...state, chat: [...state.chat, message(author, text, { version: state.current })] })

  const findingsOf = (design: Design, requirements: Requirement[]): Finding[] => {
    const a = analyze(design, catalog, requirements)
    return a.valid ? a.findings : []
  }

  return { llm: () => deps.llm(), catalog, repository, now, newId, message, save, addVersion, noted, findingsOf }
}

export type Kit = ReturnType<typeof createKit>
