import type { DesignKind } from '../domain/design/kind'
import { kindOf } from '../domain/furniture/kind'
import { selectKnowledge, type KnowledgeSelection, type KnowledgeStage } from '../domain/furniture/knowledge/select'
import { MODULE_OF_KIND } from '../domain/furniture/modules/plan'
import type { ToolLevel } from '../domain/materials/tools'
import { currentDesign, type DesignState } from '../domain/session/state'
import { currentPlan } from './useCases/currentPlan'

/** What the expert should be given for the design in hand: its kind, the module it was built with, its materials and the person's tools. */
export function knowledgeFor(state: DesignState, toolLevel: ToolLevel, stage: KnowledgeStage): KnowledgeSelection {
  const design = currentDesign(state)
  const known = kindOf(design).kind
  return selectKnowledge({
    use: known === 'unknown' ? null : known,
    module: currentPlan(state).plan?.kind ?? null,
    materials: [...new Set(design.pieces.map((p) => p.material))],
    toolLevel,
    requirements: state.requirements,
    stage,
  })
}

/** Before there is a design: what the person or the photos say the furniture is, and the module that kind would be built with. */
export const knowledgeForNew = (use: DesignKind | null, toolLevel: ToolLevel, stage: KnowledgeStage): KnowledgeSelection =>
  selectKnowledge({ use, module: use && MODULE_OF_KIND[use], materials: [], toolLevel, requirements: [], stage })
