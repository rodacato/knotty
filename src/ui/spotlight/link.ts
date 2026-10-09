import type { Design } from '../../domain/design/schema'
import type { Base, Example } from '../../domain/furniture/examples'
import { FurniturePlan } from '../../domain/furniture/modules/plan'
import { FinishId } from '../../domain/materials/finishes'

type Linked = Extract<Example, { plan: FurniturePlan }>
type Place = Pick<Location, 'origin' | 'pathname'>

const FICHA = 'ficha'

/** Something a link says of a ficha that goes for the whole piece of furniture, without changing its shape. */
interface LinkOption {
  param: string
  /** Its value in a design; undefined when it has none. */
  of(plan: FurniturePlan, design: Design): string | undefined
  /** The example with that value; null when Knotty does not know the value. */
  set(example: Linked, value: string): Linked | null
}

/** An option that is a field of the plan; a module without the field leaves it out. */
const planField = (param: string, field: 'assembly' | 'material'): LinkOption => ({
  param,
  of: (plan) => (plan as { assembly?: string; material?: string })[field],
  set(example, value) {
    const plan = FurniturePlan.safeParse({ ...example.plan, [field]: value })
    return plan.success ? { ...example, plan: plan.data } : null
  },
})

/** Each one is a word of the address: `?ficha=KC-MES-03&acabado=danish-oil&armado=bolts`. A new option of the whole piece is a line here. */
export const LINK_OPTIONS: LinkOption[] = [
  {
    param: 'acabado',
    of: (_, design) => design.finish,
    set(example, value) {
      const finish = FinishId.safeParse(value)
      return finish.success ? { ...example, finish: finish.data } : null
    },
  },
  planField('armado', 'assembly'),
  planField('material', 'material'),
]

/** The address that opens a ficha by its code, with the options given, on whatever address the app is served from. */
export function fichaLink(code: string, options: Record<string, string> = {}, at: Place = location): string {
  return `${at.origin}${at.pathname}?${new URLSearchParams({ [FICHA]: code, ...options })}`
}

/** The options a design has that its ficha does not ship with. */
export function optionsOf(plan: FurniturePlan, design: Design, shipped: { plan: FurniturePlan; design: Design }): Record<string, string> {
  return Object.fromEntries(LINK_OPTIONS.flatMap(({ param, of }) => (of(plan, design) !== undefined && of(plan, design) !== of(shipped.plan, shipped.design) ? [[param, of(plan, design)!]] : [])))
}

/** What an address says, read once: the words after the ? and after the # are one set, so a link may put any of them in either. */
const wordsOf = ({ search, hash }: Pick<Location, 'search' | 'hash'>) => new URLSearchParams([...new URLSearchParams(search), ...new URLSearchParams(hash.replace(/^#/, ''))])

/** The same address without the words that asked for a ficha; the rest stays where it was. */
function without(part: string, lead: '?' | '#'): string {
  const words = new URLSearchParams(part.replace(/^[?#]/, ''))
  const asked = [FICHA, ...LINK_OPTIONS.map((o) => o.param)].filter((param) => words.has(param))
  if (!asked.length) return part
  for (const param of asked) words.delete(param)
  const rest = words.toString()
  return rest ? `${lead}${rest}` : ''
}

/** The ficha an address asks for with the options it gives, and the address without asking; null when it names no ficha. An option Knotty does not know, or that `fits` refuses, is left as the ficha has it. */
export function linkedFicha(at: Pick<Location, 'search' | 'hash'>, bases: readonly Base[], fits: (example: Linked) => boolean = () => true): { example: Linked | null; search: string; hash: string } | null {
  const words = wordsOf(at)
  const code = words.get(FICHA)?.trim().toUpperCase()
  if (!code) return null
  const rest = { search: without(at.search, '?'), hash: without(at.hash, '#') }
  const base = bases.find((b) => b.code === code)
  if (!base) return { example: null, ...rest }
  const example = LINK_OPTIONS.reduce<Linked>((so, option) => {
    const value = words.get(option.param)
    const next = value ? option.set(so, value) : null
    return next && fits(next) ? next : so
  }, base)
  return { example, ...rest }
}
