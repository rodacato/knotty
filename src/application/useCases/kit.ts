import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { abbreviate, pruneVersions, type Origin } from '../../domain/session/history/history'
import type { Catalog } from '../../domain/materials/catalog'
import { DEFAULT_TOOL_LEVEL, type ToolLevel } from '../../domain/materials/tools'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { Operation } from '../../domain/editing/operations/schema'
import type { Requirement } from '../../domain/checks/requirements/requirements'
import { knownKind, settleKind, withKind } from '../../domain/furniture/kind'
import { currentDesign, type DesignState, type Message } from '../../domain/session/state'
import type { Finding } from '../../domain/checks/structure/finding'
import type { DesignRepository } from '../../ports/DesignRepository'
import type { LLMProvider } from '../../ports/LLMProvider'

// What every use case shares: the dependencies, the clock, chat messages, saving and adding a version.

export type Stage = 'reading-photos' | 'designing' | 'designing-pieces' | 'proposing' | 'checking' | 'structure' | 'correcting' | 'reviewing-criticals'
export type OnProgress = (stage: Stage, attempt: number, progress?: { done: number; total: number }) => void

export const ATTEMPTS = 3

export interface Dependencies {
  llm: () => LLMProvider
  catalog: Catalog
  /** The catalog the expert reads, with the person's settings applied; read on every call so an edit in Materiales reaches the next prompt. */
  promptCatalog?: () => Catalog
  /** The person's tool level, read on every call like the catalog; the app default when nobody says. */
  toolLevel?: () => ToolLevel
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
    failure: null,
    thumbnail: null,
    answers: [],
    dismissed: [],
    suggestions: [],
    solutions: [],
    alone: false,
    ...extra,
  })

  const save = (state: DesignState) => {
    repository.save(state)
    return state
  }

  function addVersion(
    state: DesignState,
    design: Design,
    /** `asItWas`: the design is a version that already was, so nothing of the current one is carried into it. */
    data: { summary: string; reason: string; operations: Operation[]; origin: Origin | null; plan?: FurniturePlan | null; extras?: Operation[]; asItWas?: boolean },
  ): DesignState {
    const n = Math.max(...state.versions.map((v) => v.n)) + 1
    const previous = currentDesign(state)
    // The finish is the person's: a design rebuilt from the plan or written by the expert comes without it and keeps the current one.
    const finish = design.finish ?? previous.finish
    // So are the edge profiles, on the pieces that are still there.
    const edgeProfiles = design.edgeProfiles ?? previous.edgeProfiles?.filter((c) => design.pieces.some((p) => p.id === c.piece))
    const personal = { ...design, ...(finish && { finish }), ...(edgeProfiles?.length && { edgeProfiles }) }
    // So is the kind, unless the new design says it with at least as much trust: a cabinet rebuilt from its plan does not know it is a bookcase.
    const kept = data.asItWas ? design : withKind(personal, settleKind(knownKind(previous), knownKind(design)))
    const versions = pruneVersions([
      ...state.versions,
      { n, design: kept, summary: data.summary, reason: data.reason, operations: data.operations.map(abbreviate), date: now(), origin: data.origin, decisions: state.decisions, plan: data.plan ?? null, extras: data.plan ? (data.extras ?? []) : [] },
    ])
    return { ...state, versions: versions, current: n, proposal: null, chat: state.chat.map((m) => (m.proposal === 'pending' ? { ...m, proposal: 'discarded' as const, answered: true } : m)) }
  }

  /** A chat note on the version just made, which it points to. */
  const noted = (state: DesignState, author: Message['author'], text: string, extra: Partial<Message> = {}): DesignState => ({ ...state, chat: [...state.chat, message(author, text, { version: state.current, ...extra })] })

  const findingsOf = (design: Design, requirements: Requirement[]): Finding[] => {
    const a = analyze(design, catalog, requirements)
    return a.valid ? a.findings : []
  }

  const promptCatalog = () => deps.promptCatalog?.() ?? catalog
  const toolLevel = () => deps.toolLevel?.() ?? DEFAULT_TOOL_LEVEL
  return { llm: () => deps.llm(), catalog, promptCatalog, toolLevel, repository, now, newId, message, save, addVersion, noted, findingsOf }
}

export type Kit = ReturnType<typeof createKit>
