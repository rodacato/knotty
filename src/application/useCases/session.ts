import type { DesignState, Question } from '../../domain/session/state'
import { findingKey, type Finding } from '../../domain/structure/finding'
import { toggleInTray, trayRequest, type TrayItem } from '../../domain/tray/tray'
import type { Kit, OnProgress } from './kit'

type Adjust = (state: DesignState, request: string, signal: AbortSignal, onProgress?: OnProgress, answering?: string | null) => Promise<DesignState>

/** The session around the design: loading and starting over, notes and decisions, accepted notices and the tray. */
export function createSession(kit: Kit, adjust: Adjust) {
  const { repository, now, newId, save } = kit

  const load = () => repository.load()

  function newDesign() {
    repository.clear()
  }

  /** A session made elsewhere (a bench run) becomes the one the person works on. */
  function adopt(state: DesignState): DesignState {
    return save(state)
  }

  function addRequirement(state: DesignState, text: string): DesignState {
    const clean = text.trim()
    if (!clean) return state
    const id = `nota-${newId().slice(0, 8)}`
    return save({ ...state, requirements: [...state.requirements, { id, text: clean, type: 'other', axis: null, min: null, max: null }] })
  }

  const removeRequirement = (state: DesignState, id: string) => save({ ...state, requirements: state.requirements.filter((r) => r.id !== id) })
  const removeDecision = (state: DesignState, topic: string) => save({ ...state, decisions: state.decisions.filter((d) => d.topic !== topic) })

  /** The person leaves a finding as it is: it stops counting as pending and the verdict mentions it. */
  function acceptNotice(state: DesignState, findings: Finding[], title: string): DesignState {
    const keys = new Set(state.accepted.map((a) => a.key))
    const added = findings.map(findingKey).filter((k) => !keys.has(k)).map((key) => ({ key, title, at: now() }))
    return save({ ...state, accepted: [...state.accepted, ...added] })
  }

  function reopenNotice(state: DesignState, findings: Finding[]): DesignState {
    const keys = new Set(findings.map(findingKey))
    return save({ ...state, accepted: state.accepted.filter((a) => !keys.has(a.key)) })
  }

  function toggleTray(state: DesignState, item: TrayItem): DesignState {
    return save({ ...state, tray: toggleInTray(state.tray, item) })
  }

  /** Everything in the tray, plus what was typed, in one request; its questions are marked answered. */
  function sendTray(state: DesignState, typed: string, signal: AbortSignal, onProgress?: OnProgress): Promise<DesignState> {
    const { text, answers } = trayRequest(state.tray, typed)
    return adjust({ ...state, tray: [] }, text, signal, onProgress, answers)
  }

  const pendingQuestions = (state: DesignState): Question[] => state.chat.filter((m) => !m.answered).flatMap((m) => m.questions)

  return { load, newDesign, adopt, addRequirement, removeRequirement, removeDecision, acceptNotice, reopenNotice, toggleTray, sendTray, pendingQuestions }
}
