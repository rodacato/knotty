import type { AdjustmentResponse } from '../../ports/LLMProvider'
import { createAdjust } from './adjust'
import { createEdits } from './edits'
import { createFinish } from './finish'
import { createHistory } from './history'
import { createKit, type Dependencies } from './kit'
import { createProposals } from './proposals'
import { createReconstruct } from './reconstruct'
import { createReview } from './review'
import { createSaving } from './saving'
import { createSession } from './session'
import { createWorkshop } from './workshop'

export { ATTEMPTS, type Stage, type OnProgress } from './kit'
export { ExpertError } from './expertCall'
export { currentPlan } from './currentPlan'
export { reviewSignature } from './review'
export type { PieceEdit, PieceEditResult } from './edits'
export type { WorkshopResult } from './workshop'

/** Every use case over one session: each group lives in its own module and shares the kit (clock, chat, saving, versions). */
export function createUseCases(deps: Dependencies) {
  const kit = createKit(deps)
  const { reconstruct, redoAs, fromExample, openExample, readPhoto } = createReconstruct(kit)
  const { adjust } = createAdjust(kit)
  const { applyProposal, proposalFix, applyProposalWithFix, answerWithFix, discardProposal } = createProposals(kit)
  const { backToVersion, restoreFromVersion, undoChange } = createHistory(kit)
  const { confirmPiece, applyPlan, chooseKind, editPiece, resizeFurniture, applyFix, applyFixes } = createEdits(kit)
  const { reviewPurchase, saveReview } = createReview(kit)
  const { chooseFinish } = createFinish(kit)
  const { lockField, findSavings } = createSaving(kit)
  const { load, newDesign, adopt, addRequirement, removeRequirement, removeDecision, acceptNotice, reopenNotice, dismissQuestion, reopenQuestion, toggleTray, sendTray, pendingQuestions } = createSession(kit, adjust)
  const { chooseJoint, chooseEdgeProfiles } = createWorkshop(kit)

  return {
    reconstruct,
    readPhoto,
    redoAs,
    chooseKind,
    adjust,
    applyProposal,
    proposalFix,
    applyProposalWithFix,
    answerWithFix,
    discardProposal,
    backToVersion,
    confirmPiece,
    addRequirement,
    removeRequirement,
    removeDecision,
    fromExample,
    openExample,
    newDesign,
    reviewPurchase,
    saveReview,
    applyPlan,
    restoreFromVersion,
    undoChange,
    acceptNotice,
    reopenNotice,
    dismissQuestion,
    reopenQuestion,
    applyFix,
    applyFixes,
    toggleTray,
    adopt,
    sendTray,
    editPiece,
    resizeFurniture,
    chooseFinish,
    lockField,
    findSavings,
    chooseJoint,
    chooseEdgeProfiles,
    load,
    pendingQuestions,
  }
}

export type UseCases = ReturnType<typeof createUseCases>
export type { AdjustmentResponse as RespuestaAjuste }
