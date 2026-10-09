import { useMemo } from 'react'
import { noticeBoard } from '../../application/notices'
import { analyze, type Analysis } from '../../domain/checks/analysis'
import { differences } from '../../domain/design/diff'
import type { Design } from '../../domain/design/schema'
import { previousUsableVersion } from '../../domain/session/history/history'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { draftOf, hiddenIn, useStore, visibleDesign } from '../store'

// What the Studio shows of a session, worked out from the session and from what the person is looking at.

type Looking = { viewedVersion: number | null; showProposal: boolean; preview: { design: Design; draft?: boolean } | null }

/** The design on screen, and the one it is compared with the current design as a proposal: a previewed fix first, then the expert's proposal, never an old version. */
export function shownOf(state: DesignState, { viewedVersion, showProposal, preview }: Looking): { design: Design; proposal: Design | null } {
  const design = preview?.design ?? visibleDesign({ state, viewedVersion, showProposal }) ?? currentDesign(state)
  const proposal = preview?.design ?? (viewedVersion === null && state.proposal && showProposal ? state.proposal.design : null)
  return { design, proposal }
}

export type Overlay = 'notices' | 'history'

/** What a header button leaves open: it closes its overlay only while that one is in sight; one covered by the piece sheet is shown, never closed unseen. */
export const overlayAfter = (open: Overlay | null, asked: Overlay, covered: boolean): Overlay | null => (open === asked && !covered ? null : asked)

/** What is on screen in place of the current design, as the person is told; null while it is the current one. */
export function shownInstead(state: DesignState, looking: Looking): string | null {
  const { design, proposal } = shownOf(state, looking)
  if (design === currentDesign(state)) return null
  if (looking.preview) return looking.preview.draft ? 'los cambios de la ficha sin aplicar' : 'una solución sin aplicar'
  return proposal ? 'la propuesta sin aplicar' : `la v${looking.viewedVersion}`
}

/** What a proposal adds and changes; nothing while either design is not a piece of furniture yet. */
export function proposalChanges(current: Design, currentAnalysis: Analysis, proposal: Design | null, shownAnalysis: Analysis): { added: string[]; changed: string[] } {
  if (!proposal || !currentAnalysis.valid || !shownAnalysis.valid) return { added: [], changed: [] }
  return differences(current, currentAnalysis.geo.boxes, proposal, shownAnalysis.geo.boxes)
}

/** The pieces the design's errors name, plus the flagged ones it still has. */
export function markedPieces(design: Design, analysis: Analysis, flagged: string[]): string[] {
  const has = (id: unknown): id is string => typeof id === 'string' && design.pieces.some((p) => p.id === id)
  const errors = analysis.valid ? [] : analysis.errors
  return [...new Set([...errors.flatMap((e) => Object.values(e.data ?? {}).filter(has)), ...flagged.filter(has)])]
}

export function useStudioView(state: DesignState) {
  const { catalog } = useServices()
  const viewedVersion = useStore((s) => s.viewedVersion)
  const showProposal = useStore((s) => s.showProposal)
  const fix = useStore((s) => s.preview)
  const draft = useStore(draftOf)
  // The plan being changed shows in 3D like a fix, until it is applied or discarded; never over an old version.
  const preview = fix ?? (draft?.design && viewedVersion === null ? { design: draft.design, label: 'Cambios de la ficha sin aplicar', draft: true } : null)
  const flagged = useStore((s) => s.flagged)
  const selection = useStore((s) => s.selection)
  const hiddenIds = useStore((s) => s.hidden)
  const focus = useStore((s) => s.focus)

  const current = currentDesign(state)
  const currentAnalysis = useMemo(() => analyze(current, catalog), [current, catalog])
  const { design: shown, proposal } = shownOf(state, { viewedVersion, showProposal, preview })
  const board = useMemo(() => noticeBoard(state, catalog, currentAnalysis), [state, catalog, currentAnalysis])
  const shownAnalysis = useMemo(() => (shown === current ? currentAnalysis : analyze(shown, catalog)), [shown, current, catalog, currentAnalysis])
  const changes = useMemo(() => proposalChanges(current, currentAnalysis, proposal, shownAnalysis), [proposal, current, currentAnalysis, shownAnalysis])
  const geo = shownAnalysis.geo ?? null

  return {
    current,
    currentAnalysis,
    shown,
    /** Its geometry; null when it could not even be resolved, and the 3D has nothing to draw. */
    geo,
    proposal,
    instead: shownInstead(state, { viewedVersion, showProposal, preview }),
    preview,
    board,
    changes,
    problems: shownAnalysis.valid ? [] : shownAnalysis.errors,
    marked: markedPieces(shown, shownAnalysis, flagged),
    /** The last version that can be drawn, to go back to when this one cannot. */
    previousVersion: geo ? null : previousUsableVersion(state.versions, state.current, (v) => analyze(v.design, catalog).valid),
    toConfirm: current.pieces.filter((p) => p.confidence === 'low'),
    viewedVersion,
    selection,
    showsPiece: !!geo && shown.pieces.some((p) => p.id === selection),
    editable: viewedVersion === null && !proposal,
    hidden: hiddenIn(hiddenIds, shown),
    focusedPiece: focus && focus === selection ? shown.pieces.find((p) => p.id === focus) : undefined,
  }
}

export type StudioView = ReturnType<typeof useStudioView>
