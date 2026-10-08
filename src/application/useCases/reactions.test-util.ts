import { MODULES } from '../../domain/furniture/modules/plan'
import type { TablePlan } from '../../domain/furniture/modules/table'
import type { Requirement } from '../../domain/checks/requirements/requirements'

// What Knotty does with an answer of the expert, right or wrong: each response is written to plant one behavior, never a model's output.
// `expect` is what happens today; `gap` marks the ones where that is the open problem.

export interface Reaction {
  id: string
  request: string
  before: { plan: TablePlan; requirements?: Requirement[] }
  /** What the transport returns, as the expert would write it. */
  response: unknown
  /** The paths the request may change, as `preservation` reads them. */
  allowed: string[]
  expect: {
    outcome: 'applied' | 'pending' | 'answer'
    /** Calls to the expert: 2 is one correction. */
    calls: number
    versions: number
    /** What changed in the person's design outside `allowed`. */
    state: string[]
    /** The same for the proposal that waits, when one does. */
    proposal?: string[]
  }
  gap?: string
}

const variants = new Map(MODULES.table.benchVariants())
const variant = (name: string) => {
  const plan = variants.get(name)
  if (!plan) throw new Error(`no table variant «${name}»`)
  return plan
}

const side = variant('lateral')
const dining = variant('comedor')
const desk = variant('escritorio con 2 cajones a la izquierda')
const widthLimit: Requirement = { id: 'space-width', text: 'Mi espacio mide 130 cm de ancho.', type: 'space', axis: 'x', min: null, max: 1300 }
const withWidth = (plan: TablePlan, width: number): TablePlan => ({ ...plan, dimensions: { ...plan.dimensions, width } })

const reply = (plan: TablePlan | null, extra: object = {}) => ({ explanation: 'Listo, lo cambié.', summary: 'Cambiar la ficha', action: 'plan', table: plan, questions: [], suggestions: ['Cambiar el material', 'Agregar una repisa'], requirements: { add: [], remove: [] }, decisions: [], ...extra })
const answer = (text: string, extra: object = {}) => reply(null, { action: 'answer', explanation: text, ...extra })

export const TABLE_REACTIONS: Reaction[] = [
  {
    id: 'widen-side-table',
    request: 'Ensánchala a 55 cm.',
    before: { plan: side },
    response: reply(withWidth(side, 550)),
    allowed: ['plan.dimensions.width'],
    expect: { outcome: 'applied', calls: 1, versions: 1, state: [] },
  },
  {
    id: 'question-changes-nothing',
    request: '¿Se puede desarmar?',
    before: { plan: dining },
    response: answer('Ahora va pegada; si la quieres desarmable, puedo pasarla a pernos.'),
    allowed: [],
    expect: { outcome: 'answer', calls: 1, versions: 0, state: [] },
  },
  {
    id: 'one-more-drawer-and-two-extra-changes',
    request: 'Ponle un cajón más a la cajonera.',
    before: { plan: desk },
    response: reply({ ...desk, pedestal: { side: 'left', drawers: 3 }, material: 'T15', overhang: 30 }),
    allowed: ['plan.pedestal'],
    gap: 'Knotty applies a change of material and overhang nobody asked for; only the comparison names them.',
    expect: { outcome: 'applied', calls: 1, versions: 1, state: ['plan.material', 'plan.overhang'] },
  },
  {
    id: 'widens-past-the-space-and-drops-it',
    request: 'Hazla un poco más larga.',
    before: { plan: desk, requirements: [widthLimit] },
    response: reply(withWidth(desk, 1500), { requirements: { add: [], remove: ['space-width'] } }),
    allowed: ['plan.dimensions.width'],
    expect: { outcome: 'pending', calls: 1, versions: 0, state: [], proposal: ['requirements.space-width'] },
  },
  {
    id: 'pedestal-on-a-dining-table',
    request: 'Hazla un poco más ancha.',
    before: { plan: dining },
    response: reply({ ...withWidth(dining, 1600), pedestal: { side: 'left', drawers: 2 } }),
    allowed: ['plan.dimensions.width'],
    expect: { outcome: 'answer', calls: 2, versions: 0, state: [] },
  },
  {
    id: 'answer-carrying-a-plan',
    request: 'Hazla de 180.',
    before: { plan: dining },
    response: reply(withWidth(dining, 1800), { action: 'answer', explanation: 'Listo, ya la hice de 180.' }),
    allowed: ['plan.dimensions.width'],
    expect: { outcome: 'answer', calls: 1, versions: 0, state: [] },
  },
  {
    id: 'same-plan-said-as-a-change',
    request: 'Hazla un poco más ancha.',
    before: { plan: dining },
    response: reply(dining),
    allowed: ['plan.dimensions.width'],
    expect: { outcome: 'answer', calls: 1, versions: 0, state: [] },
  },
  {
    id: 'use-changed-without-asking',
    request: 'Hazla un poco más ancha.',
    before: { plan: dining },
    response: reply({ ...withWidth(dining, 1600), use: 'desk' }),
    allowed: ['plan.dimensions.width'],
    gap: 'Knotty applies a change of `use` nobody asked for; only the comparison catches it.',
    expect: { outcome: 'applied', calls: 1, versions: 1, state: ['plan.use'] },
  },
  {
    id: 'length-in-the-wrong-unit',
    request: 'Quiero que quede más corta, como para dos personas.',
    before: { plan: dining },
    response: reply(withWidth(dining, 150)),
    allowed: ['plan.dimensions.width'],
    gap: 'A 150 mm table is valid with no finding; it waits only because it drops two cleats.',
    expect: { outcome: 'pending', calls: 1, versions: 0, state: [], proposal: [] },
  },
  {
    id: 'asks-for-what-the-plan-cannot-say',
    request: 'Ponle una tapa abatible.',
    before: { plan: desk },
    response: reply(null, { action: 'freeform', explanation: 'Eso lo resuelvo pieza por pieza.' }),
    allowed: [],
    expect: { outcome: 'answer', calls: 1, versions: 0, state: [] },
  },
]
