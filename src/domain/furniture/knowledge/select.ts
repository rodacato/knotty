import type { DesignKind } from '../../design/kind'
import type { Requirement } from '../../checks/requirements/requirements'
import type { ToolLevel } from '../../materials/tools'
import { MODULE_OF_KIND, type FurnitureKind } from '../modules/plan'

export type KnowledgeStage = 'photo' | 'skeleton' | 'plan-adjust' | 'piece' | 'review' | 'reconstruct'

export interface KnowledgeSelection {
  core: 'photo' | 'short' | 'full'
  guide: DesignKind | null
  guideSize: 'full' | 'short'
  tools: ToolLevel | null
}

export interface KnowledgeInput {
  use: DesignKind | null
  module: FurnitureKind | null
  materials: string[]
  toolLevel: ToolLevel
  requirements: Requirement[]
  stage: KnowledgeStage
}

const CORE: Record<KnowledgeStage, KnowledgeSelection['core']> = { photo: 'photo', review: 'short', piece: 'short', 'plan-adjust': 'short', skeleton: 'full', reconstruct: 'full' }
const GUIDE_SIZE: Record<KnowledgeStage, KnowledgeSelection['guideSize']> = { photo: 'short', review: 'short', piece: 'short', 'plan-adjust': 'full', skeleton: 'full', reconstruct: 'full' }

/** Level 1 is store cuts plus a drill, level 2 adds a circular saw, pocket jig and 35 mm bit, level 3 the table saw and router (fabricacion-y-armado.md §1.1). */
const CAPS: { cap: ToolLevel; says: RegExp }[] = [
  { cap: 1, says: /\bsolo (tengo |uso )?(el |un |con )?taladro\b|\bonly (have |got |use )?(a |the |an )?(cordless )?drill\b|\btaladro y (la )?caladora\b|\b(a )?drill and (a )?jigsaw\b/ },
  { cap: 2, says: /\b(sin|no tengo) (un |una |el |la )?(router|ruteadora|sierra de mesa|escuadradora)\b|\bno (router|table saw)\b|\b(without|don'?t have|do not have) (a |an |the )?(router|table saw)\b/ },
]

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The person's setting, only ever lowered by what they said about their tools; text that matches nothing changes nothing. */
function toolsFor(toolLevel: ToolLevel, requirements: Requirement[]): ToolLevel {
  const said = requirements.filter((r) => r.type === 'tool').map((r) => plain(r.text))
  const caps = CAPS.filter(({ says }) => said.some((t) => says.test(t))).map(({ cap }) => cap)
  return Math.min(toolLevel, ...caps) as ToolLevel
}

export function selectKnowledge({ use, module, toolLevel, requirements, stage }: KnowledgeInput): KnowledgeSelection {
  const photo = stage === 'photo'
  const ofUse = use && MODULE_OF_KIND[use]
  const guided = ofUse !== null && (module === null || module === ofUse)
  return {
    core: CORE[stage],
    guide: !photo && guided ? use : null,
    guideSize: GUIDE_SIZE[stage],
    tools: photo ? null : toolsFor(toolLevel, requirements),
  }
}
