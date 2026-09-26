import type { Design } from '../../design/schema'
import { valueFields, type ChoiceField, type CustomField, type NumberField, type StepperField, type ValueField } from '../../furniture/modules/fields'
import { FurniturePlan, moduleOf } from '../../furniture/modules/plan'
import type { Cell, Column } from '../../furniture/reading/reading'

// The chat requests Knotty understands by itself, without the expert: one clear change to the plan, or a question its own numbers answer.
// Anything else is null and goes to the expert: a wrong guess costs more than a call, so only whole requests that read one way are taken.

export type Topic = 'sheets' | 'cost' | 'measures'

export type Intent =
  /** A question the design's own numbers answer: nothing changes. */
  | { kind: 'question'; topic: Topic }
  /** One field of the plan set to one value; `plan` is the plan with it, the same plan when it already had that value. */
  | { kind: 'edit'; field: string; value: string | number; plan: FurniturePlan }

type Plan = FurniturePlan

/** Lowercase, without accents, without Spanish question marks or a closing period, and without "por favor". */
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[¿¡!?]/g, ' ')
    .replace(/,?\s*\bpor favor\b\s*,?/g, ' ')
    .replace(/\.+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Words that turn a request around or join two of them: the expert reads those. */
const DOUBT = /\b(no|ni|nunca|tampoco|jamas|pero|aunque|tambien|ademas|luego|despues|mientras|excepto|salvo|si|o|y|e)\b|[,;:()"«»]/

/** What comes before the change and says nothing of its own: "hazlo", "que tenga", "mejor". */
const LEAD = String.raw`(?:(?:oye|ok|bueno|ahora|entonces|mejor) )?(?:(?:hazlo|hazla|hazme|dejalo|dejala|ponlo|ponla|que sea|que sean|que tenga|que lleve|que mida|lo quiero|la quiero|quiero que sea|quiero que tenga|quiero|cambialo a|cambiala a|cambialo|cambiala|cambia|cambiale) )?`

const QUESTIONS: [Topic, RegExp][] = [
  ['sheets', /^cuantas hojas(?: de triplay)?(?: (?:necesito|ocupo|lleva|son|se necesitan|se ocupan|voy a necesitar|hay que comprar|tengo que comprar|compro|necesita|ocupa))?(?: en total)?$/],
  ['cost', /^(?:cuanto (?:cuesta|costaria|sale|saldria|me cuesta|me sale|me saldria|me va a costar|va a costar)|que precio tiene|cual es el (?:precio|costo)|que costo tiene)(?: (?:hacerlo|hacerla|armarlo|armarla|el mueble|todo|en total|aproximadamente|mas o menos))?$/],
  ['measures', /^(?:cuanto mide|que medidas tiene|cuales son (?:las|sus) medidas|que tamano tiene|de que tamano es)(?: (?:el mueble|en total))?$/],
]

const NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }
const COUNT = String.raw`\d+|${Object.keys(NUMBER_WORDS).join('|')}`
const countOf = (said: string) => NUMBER_WORDS[said] ?? Number(said)

const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)(?:\s*(mm|milimetros?|cm|centimetros?|mts?|metros?|m)\b)?`

/** An amount in mm. Without a unit only what a carpenter means one way: "1.80" is metres, "90" centimetres, and "10 más" centimetres. */
function toMm(number: string, unit: string | undefined, change: boolean): number | null {
  const n = Number(number.replace(',', '.'))
  if (!(n > 0)) return null
  if (unit) return Math.round(unit.startsWith('mm') || unit.startsWith('mil') ? n : unit.startsWith('c') ? n * 10 : n * 1000)
  const decimal = /[.,]/.test(number)
  if (change) return !decimal && n <= 100 ? n * 10 : null
  if (decimal) return n < 5 ? Math.round(n * 1000) : null
  return n >= 10 && n <= 400 ? n * 10 : null
}

/** Other words for the measures on the form. */
const MEASURE_SYNONYMS: Record<string, string> = { altura: 'alto', anchura: 'ancho', profundidad: 'fondo' }
const MEASURE_WORDS = ['alto', 'ancho', 'fondo', 'largo', ...Object.keys(MEASURE_SYNONYMS)].join('|')
/** Words that grow (+1) or shrink (-1) one measure. */
const ADJECTIVES: Record<string, [string, 1 | -1]> = {
  ancho: ['ancho', 1], ancha: ['ancho', 1], angosto: ['ancho', -1], angosta: ['ancho', -1], estrecho: ['ancho', -1], estrecha: ['ancho', -1],
  alto: ['alto', 1], alta: ['alto', 1], bajo: ['alto', -1], baja: ['alto', -1], chaparro: ['alto', -1], chaparra: ['alto', -1],
  profundo: ['fondo', 1], profunda: ['fondo', 1],
  largo: ['largo', 1], larga: ['largo', 1], corto: ['largo', -1], corta: ['largo', -1],
}
const ADJECTIVE_WORDS = Object.keys(ADJECTIVES).join('|')

const shownFields = (plan: Plan) => valueFields(moduleOf(plan).fields, plan) as ValueField<Plan>[]

/** The outside measures on the plan's form, by the word on each ("ancho", "largo"). */
const measureFields = (plan: Plan) => new Map(shownFields(plan).flatMap((f) => (f.type === 'number' && f.key.startsWith('dimensions.') ? [[normalize(f.label), f] as const] : [])))

/** Outside this, a measure is more likely misread than meant: the expert asks. */
const MEASURE_RANGE = { min: 100, max: 3000 }

function setMeasure(plan: Plan, word: string, mm: number | null, delta = false): Intent | null {
  const field: NumberField<Plan> | undefined = measureFields(plan).get(MEASURE_SYNONYMS[word] ?? word)
  if (!field || mm === null) return null
  const value = delta ? field.get(plan) + mm : mm
  return value >= MEASURE_RANGE.min && value <= MEASURE_RANGE.max ? edit(plan, field.key, value, field.set(plan, value)) : null
}

function byAdjective(plan: Plan, adjective: string, mm: number | null): Intent | null {
  const [word, sign] = ADJECTIVES[adjective]
  return setMeasure(plan, word, mm === null ? null : sign * mm, true)
}

function measureIntent(text: string, plan: Plan): Intent | null | undefined {
  let m = new RegExp(`^${LEAD}(?:de )?${AMOUNT} de (${MEASURE_WORDS})$`).exec(text)
  if (m) return setMeasure(plan, m[3], toMm(m[1], m[2], false))
  m = new RegExp(`^${LEAD}(?:el |la )?(${MEASURE_WORDS}) (?:sea )?(?:de |a |en )?${AMOUNT}$`).exec(text)
  if (m) return setMeasure(plan, m[1], toMm(m[2], m[3], false))
  m = new RegExp(`^${LEAD}(?:un poco )?mas (${ADJECTIVE_WORDS}) (?:por )?${AMOUNT}$`).exec(text)
  if (m) return byAdjective(plan, m[1], toMm(m[2], m[3], true))
  m = new RegExp(`^${LEAD}${AMOUNT} mas (${ADJECTIVE_WORDS})$`).exec(text)
  if (m) return byAdjective(plan, m[3], toMm(m[1], m[2], true))
  m = new RegExp(`^(quitale|quita|reducele|reduce|recortale|recorta|agregale|agrega|aumentale|aumenta|dale|sumale|anadele|anade) ${AMOUNT}(?: mas)? (?:de|al|a lo) (${MEASURE_WORDS})$`).exec(text)
  if (!m) return undefined
  const mm = toMm(m[2], m[3], true)
  return setMeasure(plan, m[4], mm === null ? null : /^(quita|reduc|recort)/.test(m[1]) ? -mm : mm, true)
}

/** A count the chat can change: a stepper on the form, or the openings of a cabinet's grid. */
interface Counter {
  key: string
  /** Normalized, singular and plural: "cajon", "cajones". */
  nouns: [string, string]
  /** What the form says after the noun ("por lado"); one that multiplies ("por …") must be said. */
  qualifier: string | null
  get: () => number
  set: (n: number) => Plan
  min: number
  max: number
}

const singular = (plural: string) => (/[^aeiou]es$/.test(plural) ? plural.slice(0, -2) : plural.replace(/s$/, ''))

function stepperCounter(plan: Plan, field: StepperField<Plan>): Counter {
  const [noun, ...rest] = normalize(field.ariaLabel ?? field.label).split(' ')
  return { key: field.key, nouns: [singular(noun), noun], qualifier: rest.join(' ') || null, get: () => field.get(plan), set: (n) => field.set(plan, n), min: field.min, max: field.max }
}

/** The most shelves, drawers and leaves an opening takes from the chat; more goes to the expert. */
const MAX_IN_OPENING = { shelves: 12, drawers: 8, doors: 2 }

/** A cabinet's grid, only where a count reads one way: the one opening with shelves, the one door, or one column of equal drawers. */
function gridCounters(plan: Plan, field: CustomField<Plan>): Counter[] {
  if (field.component !== 'cabinetColumns') return []
  const columns = field.get(plan)
  const cells = columns.flatMap((c, i) => c.cells.map((cell, j) => ({ cell, i, j })))
  const withCell = (i: number, j: number, cell: Cell): Column[] => columns.map((c, ci) => (ci !== i ? c : { ...c, cells: c.cells.map((x, cj) => (cj === j ? cell : x)) }))
  const counters: Counter[] = []
  const shelved = cells.filter(({ cell }) => cell.content === 'open' || cell.content === 'door')
  if (shelved.length === 1) {
    const { cell, i, j } = shelved[0]
    counters.push({ key: 'columns.shelves', nouns: ['repisa', 'repisas'], qualifier: null, get: () => cell.shelves ?? 0, set: (n) => field.set(plan, withCell(i, j, { ...cell, shelves: n })), min: 0, max: MAX_IN_OPENING.shelves })
  }
  const doors = cells.filter(({ cell }) => cell.content === 'door')
  if (doors.length === 1) {
    const { cell, i, j } = doors[0]
    counters.push({ key: 'columns.doors', nouns: ['puerta', 'puertas'], qualifier: null, get: () => cell.doors ?? 1, set: (n) => field.set(plan, withCell(i, j, { ...cell, doors: n })), min: 1, max: MAX_IN_OPENING.doors })
  }
  const only = columns.length === 1 ? columns[0].cells : []
  if (only.length && only.every((c) => c.content === 'drawer' && c.height === only[0].height))
    counters.push({
      key: 'columns.drawers',
      nouns: ['cajon', 'cajones'],
      qualifier: null,
      get: () => only.length,
      set: (n) => field.set(plan, [{ ...columns[0], cells: Array.from({ length: n }, () => ({ ...only[0] })) }]),
      min: 1,
      max: MAX_IN_OPENING.drawers,
    })
  return counters
}

const countersOf = (plan: Plan) => shownFields(plan).flatMap((f) => (f.type === 'stepper' ? [stepperCounter(plan, f)] : f.type === 'custom' ? gridCounters(plan, f) : []))

const isOther = (amount: string) => amount === 'otro' || amount === 'otra'

function countIntent(text: string, plan: Plan): Intent | null | undefined {
  const counters = countersOf(plan)
  if (!counters.length) return undefined
  const noun = `(${[...new Set(counters.flatMap((c) => c.nouns))].join('|')})`
  const qualifiers = [...new Set(counters.flatMap((c) => (c.qualifier ? [c.qualifier] : [])))]
  const qualifier = qualifiers.length ? `(?: (${qualifiers.join('|')}))?` : '()'
  const add = new RegExp(`^(?:(?:oye|ok|bueno|ahora|mejor) )?(agregale|agrega|anadele|anade|ponle|pon|metele|mete) (otro|otra|${COUNT}) ${noun}${qualifier}( mas)?$`).exec(text)
  const remove = new RegExp(`^(?:quitale|quita|sacale|saca) (${COUNT}) ${noun}${qualifier}$`).exec(text)
  const said = new RegExp(`^${LEAD}(?:con )?(otro|otra|${COUNT}) ${noun}${qualifier}( mas| menos)?$`).exec(text)
  let found: { noun: string; qualifier: string | undefined; target: (current: number) => number }
  if (add) {
    const [, verb, amount, n, q, more] = add
    const k = isOther(amount) ? 1 : countOf(amount)
    // "Pon 2 puertas" says how many; "ponle un cajón" and "agrega dos cajones", how many more.
    const absolute = verb.startsWith('pon') && k > 1 && !more
    found = { noun: n, qualifier: q, target: (current) => (absolute ? k : current + k) }
  } else if (remove) {
    const [, amount, n, q] = remove
    found = { noun: n, qualifier: q, target: (current) => current - countOf(amount) }
  } else if (said) {
    const [, amount, n, q, more] = said
    if (isOther(amount) && more === ' menos') return null
    const k = isOther(amount) ? 1 : countOf(amount)
    found = { noun: n, qualifier: q, target: (current) => (isOther(amount) || more === ' mas' ? current + k : more === ' menos' ? current - k : k) }
  } else return undefined
  const matching = counters.filter((c) => c.nouns.includes(found.noun) && (found.qualifier ? c.qualifier === found.qualifier : !c.qualifier?.startsWith('por ')))
  if (matching.length !== 1) return null
  const [counter] = matching
  const value = found.target(counter.get())
  if (value < counter.min || value > counter.max) return null
  return edit(plan, counter.key, value, counter.set(value))
}

/** "anclado" and "anclada", "embutidos" and "embutidas" read the same. */
const genderless = (phrase: string) =>
  phrase
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/[oa](s?)$/, '*$1') : w))
    .join(' ')

/** Every way the chat names a value of a choice, from the module's own labels: its phrase, or the field's label and the option's. */
function choicePhrases(field: ChoiceField<Plan>): [value: string, phrase: string][] {
  const values = field.options.map(([value]) => value)
  if (values.length === 2 && values.includes('yes') && values.includes('no')) {
    const label = normalize(field.label)
    // "Anclado al muro" is undone "sin anclar".
    const verb = /^\w+[ai]d[oa]\b/.test(label) ? label.split(' ')[0].replace(/([ai])d[oa]$/, (_, v: string) => `${v}r`) : null
    return [['yes', label], ['yes', `con ${label}`], ['no', `sin ${label}`], ...(verb ? [['no', `sin ${verb}`] as [string, string]] : [])]
  }
  const own = field.options.map(([value, text]): [string, string] => {
    const phrase = field.phrases?.[value]
    const words = normalize(phrase ?? text)
    return [value, phrase || /^(con|sin) /.test(words) ? words : `${normalize(field.label)} ${words}`]
  })
  // Between two values, "con X" names the other one "sin X", and the other way around.
  // Among more, "sin X" is the one value that is "sin" something (a base "con patas" undone is the one "sin zoclo": directly on the floor).
  const bare = own.filter(([, p]) => p.startsWith('sin '))
  const complements = own.flatMap(([value, phrase]): [string, string][] => {
    const m = /^(con|sin) (.+)$/.exec(phrase)
    if (!m) return []
    const opposite = `${m[1] === 'con' ? 'sin' : 'con'} ${m[2]}`
    if (own.some(([, p]) => p === opposite)) return []
    if (values.length === 2) {
      const other = values.find((v) => v !== value)!
      return own.some(([v, p]) => v === other && /^(con|sin) /.test(p)) ? [] : [[other, opposite]]
    }
    return m[1] === 'con' && bare.length === 1 && bare[0][0] !== value ? [[bare[0][0], opposite]] : []
  })
  return [...own, ...complements]
}

function choiceIntent(text: string, plan: Plan): Intent | null | undefined {
  const byPhrase = new Map<string, { field: ChoiceField<Plan>; value: string }[]>()
  for (const field of shownFields(plan))
    if (field.type === 'choice')
      for (const [value, phrase] of choicePhrases(field)) {
        // One word ("abierta") says too little on its own.
        if (phrase.split(' ').length < 2) continue
        const key = genderless(phrase)
        byPhrase.set(key, [...(byPhrase.get(key) ?? []), { field, value }])
      }
  const stripped = text.replace(new RegExp(`^${LEAD}`), '')
  // "Quita el zoclo" is "sin zoclo"; "ponle puertas", "con puertas".
  const forms = [text, stripped, stripped.replace(/^(?:quitale|quita|sacale|saca|elimina) (?:el|la|los|las) /, 'sin '), stripped.replace(/^(?:ponle|pon|agregale|agrega) (?:el |la |los |las )?/, 'con ')]
  const found = forms.map((f) => byPhrase.get(genderless(f))).find(Boolean)
  if (!found) return undefined
  if (new Set(found.map((f) => `${f.field.key}=${f.value}`)).size !== 1) return null
  const { field, value } = found[0]
  return edit(plan, field.key, value, field.set(plan, value))
}

/** The builder and the checks judge the result; here it only has to still be a plan. */
const edit = (plan: Plan, field: string, value: string | number, next: Plan): Intent | null => (next === plan || FurniturePlan.safeParse(next).success ? { kind: 'edit', field, value, plan: next } : null)

/** One request Knotty reads alone: a question its numbers answer, or one change to a live plan; null for anything else, several things or a doubt. */
export function parseIntent(request: string, plan: FurniturePlan | null, design: Design | null): Intent | null {
  const text = normalize(request)
  if (!design || !text || text.length > 80) return null
  const question = QUESTIONS.find(([, pattern]) => pattern.test(text.replace(/^y /, '')))
  if (question) return { kind: 'question', topic: question[0] }
  if (!plan || request.includes('?') || DOUBT.test(text)) return null
  for (const read of [measureIntent, countIntent, choiceIntent]) {
    const intent = read(text, plan)
    if (intent !== undefined) return intent
  }
  return null
}
