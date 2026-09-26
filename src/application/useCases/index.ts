import type { AdjustmentResponse } from '../../ports/LLMProvider'
import { createAdjust } from './adjust'
import { createEdits } from './edits'
import { createHistory } from './history'
import { createKit, type Dependencies } from './kit'
import { createProposals } from './proposals'
import { createReconstruct } from './reconstruct'
import { createReview } from './review'
import { createSession } from './session'

export { ATTEMPTS, type Stage, type OnProgress } from './kit'
export { ExpertError } from './expertCall'
export { currentPlan } from './currentPlan'
export { reviewSignature } from './review'
export type { SentPhoto } from './adjust'
export type { PieceEdit, PieceEditResult } from './edits'

/** Every use case over one session: each group lives in its own module and shares the kit (clock, chat, saving, versions). */
export function createUseCases(deps: Dependencies) {
  const kit = createKit(deps)
  const { reconstruct, fromExample } = createReconstruct(kit)
  const { adjust } = createAdjust(kit)
  const { applyProposal, answerWithFix, discardProposal } = createProposals(kit)
  const { backToVersion, restoreFromVersion, undoChange } = createHistory(kit)
  const { confirmPiece, applyPlan, editPiece, resizeFurniture, applyFix } = createEdits(kit)
  const { reviewPurchase, saveReview } = createReview(kit)
  const { load, newDesign, adopt, addRequirement, removeRequirement, removeDecision, acceptNotice, reopenNotice, toggleTray, sendTray, pendingQuestions } = createSession(kit, adjust)

  return {
    reconstruct,
    adjust,
    applyProposal,
    answerWithFix,
    discardProposal,
    backToVersion,
    confirmPiece,
    addRequirement,
    removeRequirement,
    removeDecision,
    fromExample,
    newDesign,
    reviewPurchase,
    saveReview,
    applyPlan,
    restoreFromVersion,
    undoChange,
    acceptNotice,
    reopenNotice,
    applyFix,
    toggleTray,
    adopt,
    sendTray,
    editPiece,
    resizeFurniture,
    load,
    pendingQuestions,
  }
}

export type UseCases = ReturnType<typeof createUseCases>
export type { AdjustmentResponse as RespuestaAjuste }
