import type { Design } from '../../design/schema'
import { boardsFor, type Catalog } from '../../materials/catalog'
import { valueFields, type ChoiceField, type CustomField, type MaterialField, type NumberField, type StepperField, type ValueField } from '../modules/fields'
import { FurniturePlan, moduleOf } from '../modules/plan'
import type { PlanCell, PlanColumn } from '../modules/cabinet'

// The chat requests Knotty understands by itself, without the expert: one clear change to the plan or a few joined ones, or a question its own numbers answer.
// Anything else is null and goes to the expert: a wrong guess costs more than a call, so only whole requests that read one way are taken.

export type Topic = 'sheets' | 'cost' | 'measures'

export type Intent =
  /** A question the design's own numbers answer: nothing changes. */
  | { kind: 'question'; topic: Topic }
  /** One field of the plan set to one value; `plan` is the plan with it, the same plan when it already had that value. */
  | { kind: 'edit'; field: string; value: string | number; plan: FurniturePlan }
  /** Several changes in one request, each to a field of its own; `plan` is the plan with all of them. */
  | { kind: 'several'; edits: { field: string; value: string | number }[]; plan: FurniturePlan }
  /** A request that reads two ways; `options` are requests, in Spanish, that each read one way. */
  | { kind: 'unclear'; options: string[] }

type Plan = FurniturePlan

/** Lowercase, without accents, without Spanish question marks or a closing period, and without "por favor" or "porfa". */
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[¿¡!?]/g, ' ')
    .replace(/,?\s*\b(?:por favor|porfa)\b\s*,?/g, ' ')
    .replace(/\.+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Words that turn a request around or join two of them: the expert reads those. */
const DOUBT = /\b(no|ni|nunca|tampoco|jamas|pero|aunque|tambien|ademas|luego|despues|mientras|excepto|salvo|si|o|y|e)\b|[,;:()"«»]/

/** What comes before the change and says nothing of its own: "hazlo", "que tenga", "mejor". */
const OPENING = String.raw`(?:(?:oye|ok|bueno|ahora|entonces|mejor|solo) )?`
const LEAD = String.raw`${OPENING}(?:(?:hazlo|hazla|hazme|dejalo|dejala|dejale|ponlo|ponla|que sea|que sean|que tenga|que lleve|que mida|que quede|lo quiero|la quiero|quiero que sea|quiero que tenga|quiero que quede|quiero|cambialo a|cambiala a|cambialo|cambiala|cambia|cambiale) )?`

const QUESTIONS: [Topic, RegExp][] = [
  ['sheets', /^(?:cuant[oa]s (?:hojas|laminas|triplays)|cuanto triplay)(?: de triplay)?(?: (?:necesito|ocupo|lleva|son|se necesitan|se ocupan|voy a necesitar|hay que comprar|tengo que comprar|compro|necesita|ocupa))?(?: en total)?$/],
  ['cost', /^(?:(?:en )?cuanto (?:cuesta|costaria|sale|saldria|me cuesta|me sale|me saldria|me va a costar|va a costar)|que precio tiene|cual es el (?:precio|costo)|que costo tiene)(?: (?:hacerlo|hacerla|armarlo|armarla|el mueble|todo|en total|aproximadamente|mas o menos|asi como esta))?$/],
  ['measures', /^(?:cuanto mide|que medidas tiene|cuales son (?:las|sus) medidas|que tamano tiene|de que tamano es|de que medidas? es)(?: (?:el mueble|en total))?$/],
]

const NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }
export const COUNT = String.raw`\d+|${Object.keys(NUMBER_WORDS).join('|')}`
export const countOf = (said: string) => NUMBER_WORDS[said] ?? Number(said)

const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)(?:\s*(mm|milimetros?|cm|centimetros?|mts?|metros?|m)\b)?`
/** The thicknesses a board is asked for in words. */
const THICKNESS_WORDS: Record<string, number> = { doce: 12, quince: 15, dieciocho: 18 }

const METRE_PARTS: Record<string, number> = { 'y medio': 50, diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 }
const SPELLED_METRES = new RegExp(String.raw`(?<![.,\d])\b(?:(un|dos|tres|\d) )?metros?(?: (${Object.keys(METRE_PARTS).join('|')}|\d\d))?\b(?! ?\d)`, 'g')

/** Metres said in words, as the digits a measure is read from: "un metro y medio" is "1.5 m", "metro veinte" is "1.2 m". */
const spelledMetres = (text: string) =>
  text
    .replace(/\bmedio metro\b/g, '0.5 m')
    .replace(SPELLED_METRES, (said: string, count: string | undefined, part: string | undefined) => (!part && (!count || /\d/.test(count)) ? said : `${((count ? countOf(count) : 1) * 100 + (part ? (METRE_PARTS[part] ?? Number(part)) : 0)) / 100} m`))

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
const MEASURE_SYNONYMS: Record<string, string> = { altura: 'alto', anchura: 'ancho', profundidad: 'fondo', hondo: 'fondo' }
const MEASURE_WORDS = ['alto', 'ancho', 'fondo', 'largo', ...Object.keys(MEASURE_SYNONYMS)].join('|')
/** Words that grow (+1) or shrink (-1) one measure. */
const ADJECTIVES: Record<string, [string, 1 | -1]> = {
  ancho: ['ancho', 1], ancha: ['ancho', 1], angosto: ['ancho', -1], angosta: ['ancho', -1], estrecho: ['ancho', -1], estrecha: ['ancho', -1],
  alto: ['alto', 1], alta: ['alto', 1], bajo: ['alto', -1], baja: ['alto', -1], chaparro: ['alto', -1], chaparra: ['alto', -1],
  profundo: ['fondo', 1], profunda: ['fondo', 1], hondo: ['fondo', 1], honda: ['fondo', 1],
  largo: ['largo', 1], larga: ['largo', 1], corto: ['largo', -1], corta: ['largo', -1],
}
const ADJECTIVE_WORDS = Object.keys(ADJECTIVES).join('|')
/** "Bajito" and "angostita" are "bajo" and "angosta". */
const adjectiveOf = (said: string): [string, 1 | -1] | undefined => ADJECTIVES[said] ?? ADJECTIVES[said.replace(/it([oa])$/, '$1')]
/** Verbs that move one measure up (+1) or down (-1), without their pronoun: "súbela", "bájalo". With "le" ("bájale") they do not say which. */
const MOVES: Record<string, [string, 1 | -1]> = { sube: ['alto', 1], baja: ['alto', -1], alarga: ['largo', 1], acorta: ['largo', -1], ensancha: ['ancho', 1], angosta: ['ancho', -1] }
const MOVE_WORDS = Object.keys(MOVES).join('|')

const shownFields = (plan: Plan) => valueFields(moduleOf(plan).fields, plan) as ValueField<Plan>[]

/** The outside measures on the plan's form, by the word on each ("ancho", "largo"). */
const measureFields = (plan: Plan) => new Map(shownFields(plan).flatMap((f) => (f.type === 'number' && f.key.startsWith('dimensions.') ? [[normalize(f.label), f] as const] : [])))

/** The field a measure word names; "largo" on a form without it is the width, only on a piece wider than it is tall and deep. */
function measureField(plan: Plan, said: string): NumberField<Plan> | undefined {
  const fields = measureFields(plan)
  const word = MEASURE_SYNONYMS[said] ?? said
  const width = fields.get('ancho')
  const widest = !!width && [...fields.values()].every((f) => f === width || f.get(plan) < width.get(plan))
  return fields.get(word) ?? (word === 'largo' && widest ? width : undefined)
}

/** Outside this, a measure is more likely misread than meant: the expert asks. */
const MEASURE_RANGE = { min: 100, max: 3000 }

/** A whole number without a unit is centimetres only near what the measure is now: "de 300 de alto" on a 55 cm nightstand is not 3 m. */
const NEAR = { least: 0.4, most: 2.5 }

function toMeasure(plan: Plan, word: string, number: string, unit: string | undefined, guessed = !unit && !/[.,]/.test(number)): Intent | null {
  const mm = toMm(number, unit, false)
  const current = measureField(plan, word)?.get(plan)
  if (guessed && mm !== null && current !== undefined && (mm < current * NEAR.least || mm > current * NEAR.most)) return null
  return setMeasure(plan, word, mm)
}

function setMeasure(plan: Plan, word: string, mm: number | null, delta = false): Intent | null {
  const field = measureField(plan, word)
  if (!field || mm === null) return null
  const value = delta ? field.get(plan) + mm : mm
  return value >= MEASURE_RANGE.min && value <= MEASURE_RANGE.max ? edit(plan, field.key, value, field.set(plan, value)) : null
}

function byAdjective(plan: Plan, adjective: string, mm: number | null): Intent | null {
  const [word, sign] = ADJECTIVES[adjective]
  return setMeasure(plan, word, mm === null ? null : sign * mm, true)
}

/** The measure set to an amount, only if that moves it the way the words say. */
function towards(plan: Plan, [word, sign]: [string, 1 | -1], number: string, unit: string | undefined): Intent | null {
  const intent = toMeasure(plan, word, number, unit)
  const current = measureField(plan, word)?.get(plan)
  return intent?.kind === 'edit' && current !== undefined && Math.sign(Number(intent.value) - current) === sign ? intent : null
}

/** A cabinet hung on the wall: "súbela 10 cm" there is where it hangs, not how tall it is. */
const hangs = (plan: Plan) => 'wallMounted' in plan && plan.wallMounted && 'base' in plan && plan.base === 'floor'

/** "Súbela 3 cm" moves a measure by that much; "súbela a 78", to it, and only the way the verb says. */
function byMove(plan: Plan, [word, sign]: [string, 1 | -1], to: boolean, number: string, unit: string | undefined): Intent | null {
  if (word === 'alto' && hangs(plan)) return null
  if (to) return towards(plan, [word, sign], number, unit)
  const mm = toMm(number, unit, true)
  return setMeasure(plan, word, mm === null ? null : sign * mm, true)
}

/** "Más bajo, de 60 cm de alto" says one measure twice: the comma there joins nothing. */
function towardIntent(text: string, plan: Plan): Intent | null | undefined {
  const m = new RegExp(String.raw`^${LEAD}(?:un poco )?mas (\w+), (?:de )?${AMOUNT}(?: de (${MEASURE_WORDS}))?$`).exec(text)
  const adjective = m && adjectiveOf(m[1])
  if (!m || !adjective) return undefined
  return m[4] && measureField(plan, m[4]) !== measureField(plan, adjective[0]) ? null : towards(plan, adjective, m[2], m[3])
}

/** A measure of a part, from a field that says its range: "Alto de las patas" reads "patas de 20 cm" and "bájale las patas a 10 cm". */
function partIntent(text: string, plan: Plan): Intent | null | undefined {
  for (const field of shownFields(plan)) {
    if (field.type !== 'number' || field.min === undefined || field.max === undefined) continue
    const label = new RegExp(String.raw`^(${MEASURE_WORDS}) de (?:el |la |los |las )?(\w+)$`).exec(normalize(field.label))
    if (!label) continue
    const [, measure, part] = label
    const said = new RegExp(`^${LEAD}(?:el |la |los |las )?${part} (?:de |a )${AMOUNT}(?: de ${measure})?$`).exec(text)
    const moved = new RegExp(`^(${MOVE_WORDS})le (?:el |la |los |las )${part} a ${AMOUNT}$`).exec(text)
    const mm = said ? toMm(said[1], said[2], false) : moved ? toMm(moved[2], moved[3], false) : undefined
    if (mm === undefined) continue
    if (mm === null || mm < field.min || mm > field.max) return null
    if (moved && (MOVES[moved[1]][0] !== measure || Math.sign(mm - field.get(plan)) !== MOVES[moved[1]][1])) return null
    return edit(plan, field.key, mm, field.set(plan, mm))
  }
  return undefined
}

function measureIntent(text: string, plan: Plan): Intent | null | undefined {
  let m = new RegExp(`^${LEAD}(?:de |a )?${AMOUNT} de (${MEASURE_WORDS})$`).exec(text)
  if (m) return toMeasure(plan, m[3], m[1], m[2])
  // "Ponle 50 cm de fondo" is that measure only near what it has; far from it, it may be how much more.
  m = new RegExp(`^ponle ${AMOUNT} de (${MEASURE_WORDS})$`).exec(text)
  if (m) return toMeasure(plan, m[3], m[1], m[2], true)
  m = new RegExp(`^${LEAD}(?:de )?(?:el |la )?(${MEASURE_WORDS}) (?:sea )?(?:de |a |en )?${AMOUNT}$`).exec(text)
  if (m) return toMeasure(plan, m[1], m[2], m[3])
  m = new RegExp(`^${LEAD}(?:un poco )?mas (${ADJECTIVE_WORDS}) (?:por )?${AMOUNT}$`).exec(text)
  if (m) return byAdjective(plan, m[1], toMm(m[2], m[3], true))
  m = new RegExp(`^${LEAD}${AMOUNT} mas (${ADJECTIVE_WORDS})$`).exec(text)
  if (m) return byAdjective(plan, m[3], toMm(m[1], m[2], true))
  m = new RegExp(`^(${MOVE_WORDS})(?:la|lo)?( a)? ${AMOUNT}$`).exec(text)
  if (m) return byMove(plan, MOVES[m[1]], !!m[2], m[3], m[4])
  m = new RegExp(`^(quitale|quita|reducele|reduce|recortale|recorta|achicalo|achicala|achicale|achica|agregale|agrega|aumentale|aumenta|dale|sumale|anadele|anade) ${AMOUNT}(?: mas)? (?:de|al|a lo) (${MEASURE_WORDS})$`).exec(text)
  if (!m) return partIntent(text, plan)
  const mm = toMm(m[2], m[3], true)
  return setMeasure(plan, m[4], mm === null ? null : /^(quita|reduc|recort|achic)/.test(m[1]) ? -mm : mm, true)
}

/** The board of the one material on the form, by its thickness ("triplay de 15") or its id ("T15"), among those the form offers. */
function materialIntent(text: string, plan: Plan, catalog: Catalog): Intent | null | undefined {
  const fields = shownFields(plan).filter((f): f is MaterialField<Plan> => f.type === 'material')
  if (fields.length !== 1) return undefined
  const [field] = fields
  const boards = boardsFor(catalog, field.use)
  const said = text.replace(new RegExp(`^${LEAD}`), '')
  const thick = new RegExp(String.raw`^(?:(?:de|en|con|ponle|usa|material) )?${normalize(field.label)}(?: de)? (\d+|${Object.keys(THICKNESS_WORDS).join('|')})(?: mm)?$`).exec(said)
  const board = thick ? boards.find((b) => b.thickness === (THICKNESS_WORDS[thick[1]] ?? Number(thick[1]))) : boards.find((b) => new RegExp(`^(?:(?:a|de|en|material) )?${b.id.toLowerCase()}$`).test(said))
  if (!thick && !board) return undefined
  return board ? edit(plan, field.key, board.id, field.set(plan, board.id)) : null
}

/** A count the chat can change: a stepper on the form, or the openings of a cabinet's grid. */
interface Counter {
  key: string
  /** Normalized, singular and plural: "cajon", "cajones". */
  nouns: [string, string]
  /** The same two as a person reads them: "cajón", "cajones". */
  shown: [string, string]
  /** What the form says after the noun ("por lado"); one that multiplies ("por …") must be said. */
  qualifier: string | null
  get: () => number
  set: (n: number) => Plan
  min: number
  max: number
}

const singular = (plural: string) => (plural.endsWith('ones') ? `${plural.slice(0, -4)}ón` : /[^aeiou]es$/.test(plural) ? plural.slice(0, -2) : plural.replace(/s$/, ''))
const nounsOf = (plural: string): Pick<Counter, 'nouns' | 'shown'> => ({ nouns: [normalize(singular(plural)), normalize(plural)], shown: [singular(plural), plural] })

function stepperCounter(plan: Plan, field: StepperField<Plan>): Counter {
  const [noun, ...rest] = (field.ariaLabel ?? field.label).toLowerCase().split(' ')
  return { key: field.key, ...nounsOf(noun), qualifier: normalize(rest.join(' ')) || null, get: () => field.get(plan), set: (n) => field.set(plan, n), min: field.min, max: field.max }
}

/** The most shelves, drawers and leaves an opening takes from the chat; more goes to the expert. */
const MAX_IN_OPENING = { shelves: 12, drawers: 8, doors: 2 }

/** A cabinet's grid, only where a count reads one way: the one opening with shelves, the one door, or one column of equal drawers. */
function gridCounters(plan: Plan, field: CustomField<Plan>): Counter[] {
  if (field.component !== 'cabinetColumns') return []
  const columns = field.get(plan)
  const cells = columns.flatMap((c, i) => c.cells.map((cell, j) => ({ cell, i, j })))
  const withCell = (i: number, j: number, cell: PlanCell): PlanColumn[] => columns.map((c, ci) => (ci !== i ? c : { ...c, cells: c.cells.map((x, cj) => (cj === j ? cell : x)) }))
  const counters: Counter[] = []
  const shelved = cells.filter(({ cell }) => cell.content === 'open' || cell.content === 'door')
  if (shelved.length === 1) {
    const { cell, i, j } = shelved[0]
    counters.push({ key: 'columns.shelves', ...nounsOf('repisas'), qualifier: null, get: () => cell.shelves ?? 0, set: (n) => field.set(plan, withCell(i, j, { ...cell, shelves: n })), min: 0, max: MAX_IN_OPENING.shelves })
  }
  const doors = cells.filter(({ cell }) => cell.content === 'door')
  if (doors.length === 1) {
    const { cell, i, j } = doors[0]
    counters.push({ key: 'columns.doors', ...nounsOf('puertas'), qualifier: null, get: () => cell.doors ?? 1, set: (n) => field.set(plan, withCell(i, j, { ...cell, doors: n })), min: 1, max: MAX_IN_OPENING.doors })
  }
  const only = columns.length === 1 ? columns[0].cells : []
  if (only.length && only.every((c) => c.content === 'drawer' && c.height === only[0].height))
    counters.push({
      key: 'columns.drawers',
      ...nounsOf('cajones'),
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
  const add = new RegExp(`^(?:(?:oye|ok|bueno|ahora|mejor) )?(agregale|agrega|anadele|anade|ponle|pon|metele|mete) (otro|otra|${COUNT}) ${noun}${qualifier}( mas)?(?: adentro)?$`).exec(text)
  const remove = new RegExp(`^(?:quitale|quita|sacale|saca) (${COUNT}) ${noun}${qualifier}$`).exec(text)
  const said = new RegExp(`^(${LEAD}(?:con )?)(otro|otra|${COUNT})( sol[oa])? ${noun}${qualifier}( mas| menos| nada mas)?$`).exec(text)
  /** What the count becomes: `set` to that many, `add` that many, `put` (to that many, unless it has them: then the words do not say), or `either`. */
  let found: { noun: string; qualifier: string | undefined; k: number; how: 'set' | 'add' | 'put' | 'either' }
  if (add) {
    const [, verb, amount, n, q, more] = add
    const k = isOther(amount) ? 1 : countOf(amount)
    // "Ponle un cajón" and "agrega dos cajones" say how many more; "pon 2 cajones", how many.
    found = { noun: n, qualifier: q, k, how: verb.startsWith('pon') && k > 1 && !more ? 'put' : 'add' }
  } else if (remove) {
    const [, amount, n, q] = remove
    found = { noun: n, qualifier: q, k: -countOf(amount), how: 'add' }
  } else if (said) {
    const [, lead, amount, sole, n, q, more] = said
    const only = !!sole || more === ' nada mas'
    if (isOther(amount) && (only || more === ' menos')) return null
    const k = isOther(amount) ? 1 : countOf(amount)
    // "Con una repisa" and "una sola repisa" say how many; "una repisa" alone, one or one more.
    const how = only ? 'set' : isOther(amount) || more ? 'add' : k === 1 && !lead ? 'either' : 'set'
    found = { noun: n, qualifier: q, k: more === ' menos' ? -k : k, how }
  } else return undefined
  const matching = counters.filter((c) => c.nouns.includes(found.noun) && (found.qualifier ? c.qualifier === found.qualifier : !c.qualifier?.startsWith('por ')))
  if (matching.length !== 1) return null
  const [counter] = matching
  const inRange = (value: number) => value >= counter.min && value <= counter.max
  const total = found.k
  const added = counter.get() + found.k
  const how = found.how === 'put' ? (total > counter.get() ? 'set' : 'either') : found.how
  const readings = how === 'set' ? [total] : how === 'add' ? [added] : [...new Set([total, added])].filter(inRange)
  if (readings.length === 2) {
    const named = `${found.k} ${counter.shown[found.k === 1 ? 0 : 1]}${found.qualifier ? ` ${found.qualifier}` : ''}`
    return { kind: 'unclear', options: [`Que tenga ${named}`, `Agrégale ${named}`] }
  }
  const [value] = readings
  return value !== undefined && inRange(value) ? edit(plan, counter.key, value, counter.set(value)) : null
}

/** "anclado" and "anclada", "embutidos" and "embutidas" read the same. */
const genderless = (phrase: string) =>
  phrase
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/[oa](s?)$/, '*$1') : w))
    .join(' ')

/** Other words for the ones on the forms, so a request and a label meet in the same ones. */
const SAME: [RegExp, string][] = [
  [/\b(a|de) la pared\b/g, '$1l muro'],
  [/\bentrepano(s?)\b/g, 'repisa$1'],
  [/\bpatitas\b/g, 'patas'],
  [/\b(?:manija|tirador|jaladera)(?:e?s)?\b/g, 'jaladeras'],
  [/\b(?:unero|hendidura)\b/g, 'muesca'],
  [/\b(?:tapa trasera|respaldo)\b/g, 'trasera'],
  [/\btapa (?:de arriba|superior)\b/g, 'cubierta'],
  [/\bajustables\b/g, 'moviles'],
  [/\bplan([oa]s)\b/g, 'lis$1'],
  [/\bderechas\b/g, 'rectas'],
  [/\b(?:por )?a?(fuera|dentro)\b/g, 'a$1'],
  [/\buni(?:on|ones) de dedos\b/g, 'dedos'],
  [/\bde(?:l| los)? cajon(?:es)?\b/g, 'de cajon'],
  [/\b(?:metid[oa]s )?al ras(?: del mueble)?\b/g, 'embutidos'],
  [/\bde correr\b/g, 'corredizas'],
  [/\b(?:ensamble|que se arme) con\b/g, 'desarmable con'],
  [/\bcola\b/g, 'pegamento'],
  [/\btornillo\b/g, 'tornillos'],
]
const same = (text: string) => SAME.reduce((t, [said, word]) => t.replace(said, word), text)

/** What a phrase is found by: the forms' words, without gender or articles. */
const keyOf = (phrase: string) => genderless(same(phrase).replace(/\b(?:el|la|los|las|un|una) /g, ''))

/** Ways of asking that share no word with a form, as the phrase a form has; one that no form of the plan has is not read. */
const IDIOMS = new Map(
  Object.entries({
    'fijo al muro': 'anclado al muro',
    'fijalo al muro': 'anclado al muro',
    'con muesca': 'muesca para abrir',
    'muesca en lugar de jaladeras': 'muesca para abrir',
    'muesca para abrir': 'jaladeras muesca',
    'sin jaladeras': 'jaladeras ninguna',
    'con jaladeras': 'jaladeras jaladera',
    'cubierta encima': 'techo cubierta encima',
    'cubierta con dedos': 'techo cubierta con dedos',
    'que se vean las bisagras': 'bisagras afuera',
    'bisagras a la izquierda': 'bisagras izquierda',
    'bisagras a la derecha': 'bisagras derecha',
    'bisagras del lado izquierdo': 'bisagras izquierda',
    'bisagras del lado derecho': 'bisagras derecha',
    'poder mover las repisas': 'repisas moviles',
    'cajones embutidos': 'frentes de cajon embutidos',
    'cajones sobrepuestos': 'frentes de cajon sobrepuestos',
    'cajones con dedos': 'esquinas de cajon de dedos',
    'esquinas de cajon con dedos': 'esquinas de cajon de dedos',
    'cajones atornillados en las esquinas': 'esquinas de cajon atornilladas',
    'esquinas de cajon con tornillos': 'esquinas de cajon atornilladas',
    'ranuras a los frentes': 'frentes ranurados',
    'con zoclo abajo': 'con zoclo',
    'zoclo por patas': 'con patas',
    'a ras de piso': 'sin zoclo',
    'ensamble fijo con pegamento': 'armado fijo, con pegamento',
    'todo pegado': 'armado fijo, con pegamento',
    'con pernos': 'desarmable con pernos',
    'con minifix': 'desarmable con minifix',
    'con tornillos minifix': 'desarmable con minifix',
  }).map(([said, phrase]) => [keyOf(said), keyOf(phrase)]),
)

/** Every way the chat names a value of a choice, from the module's own labels: its phrase, or the field's label and the option's. */
function choicePhrases(field: ChoiceField<Plan>): [value: string, phrase: string][] {
  const values = field.options.map(([value]) => value)
  if (values.length === 2 && values.includes('yes') && values.includes('no')) {
    const label = normalize(field.label)
    const [first, ...rest] = label.split(' ')
    const where = rest.join(' ')
    const stem = /[ai]d[oa]$/.test(first) ? first.replace(/d[oa]$/, '') : null
    // "Anclado al muro" is asked for "ánclalo al muro", and undone "sin anclar" or "desánclalo del muro".
    const verbs: [string, string][] = stem ? [['no', `sin ${stem}r`], ['no', `sin ${stem}r ${where}`], ['yes', `${stem}lo ${where}`], ['no', `des${stem}lo ${where.replace(/^al /, 'del ')}`]] : []
    return [['yes', label], ['yes', `con ${label}`], ['no', `sin ${label}`], ...verbs]
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

/** A door wider than this goes in two leaves (uniones-y-herrajes.md, "Ancho máximo de una hoja"). */
const WIDEST_LEAF = 600

const PUT_DOORS = new RegExp(`^${OPENING}(?:ponle|pon|agregale|agrega|cierralo con|cierrala con|que tenga|que lleve|con) puertas( (?:a|en) (?:todos )?los huecos(?: abiertos)?)?$`)
const NO_DOORS = new RegExp(`^${OPENING}(?:(?:quitale|quita|sacale|saca) las puertas|sin puertas)$`)
const IN_TWO = new RegExp(`^${OPENING}(?:(?:dividel[oa]|partel[oa]|separal[oa]) en (?:dos|2)(?: columnas| partes)?(?: con una (?:tabla|division) vertical)?|(?:ponle|pon|agregale|agrega|con) (?:una |un )?(?:division|divisor|tabla) vertical|(?:de|en|con) (?:dos|2) columnas)(?: (?:en|al) (?:medio|centro)| a la mitad)?$`)

/** What a cabinet's openings take without saying where: doors on every open one, no doors, or two columns out of its one. A split cell, a chest or a void says more than these words do. */
function openingsIntent(text: string, plan: Plan): Intent | null | undefined {
  const field = shownFields(plan).find((f): f is CustomField<Plan> => f.type === 'custom' && f.component === 'cabinetColumns')
  if (!field || !('dimensions' in plan)) return undefined
  const [doors, none, two] = [PUT_DOORS.exec(text), NO_DOORS.test(text), IN_TWO.test(text)]
  if (!doors && !none && !two) return undefined
  const columns = field.get(plan)
  const cells = columns.flatMap((c) => c.cells)
  if (cells.some((c) => c.columns || c.content === 'chest' || c.content === 'void')) return null
  const has = (content: PlanCell['content']) => cells.some((c) => c.content === content)
  const leaves = (among: PlanColumn[], column: PlanColumn) => ((plan.dimensions.width * column.width) / among.reduce((n, c) => n + c.width, 0) > WIDEST_LEAF ? 2 : 1)
  const withCells = (among: PlanColumn[], change: (cell: PlanCell, column: PlanColumn) => PlanCell) => among.map((column) => ({ ...column, cells: column.cells.map((cell) => change(cell, column)) }))
  const to = (value: string, next: PlanColumn[]) => edit(plan, field.key, value, field.set(plan, next))
  if (none) return has('door') ? to('remove the doors', withCells(columns, (cell) => (cell.content === 'door' ? { ...cell, content: 'open', doors: null } : cell))) : undefined
  if (doors) {
    // "Ponle puertas" on a piece that has some does not say where the new ones go; "a los huecos abiertos" does.
    if (!has('open') || (has('door') && !doors[1])) return null
    const whole = cells.every((c) => c.content === 'open')
    return to(whole ? 'doors on the whole front' : 'doors on the open niches', withCells(columns, (cell, column) => (cell.content === 'open' ? { ...cell, content: 'door', doors: leaves(columns, column) } : cell)))
  }
  if (columns.length !== 1) return null
  const halves = [columns[0], columns[0]].map((c) => ({ ...c, width: 1 }))
  return to('split into two columns', withCells(halves, (cell, column) => (cell.content === 'door' ? { ...cell, doors: leaves(halves, column) } : { ...cell })))
}

function choiceIntent(text: string, plan: Plan): Intent | null | undefined {
  const byPhrase = new Map<string, { field: ChoiceField<Plan>; value: string }[]>()
  for (const field of shownFields(plan))
    if (field.type === 'choice')
      for (const [value, phrase] of choicePhrases(field)) {
        // One word ("abierta") says too little on its own.
        if (phrase.trim().split(' ').length < 2) continue
        const key = keyOf(phrase)
        byPhrase.set(key, [...(byPhrase.get(key) ?? []), { field, value }])
      }
  const stripped = text.replace(new RegExp(`^${LEAD}`), '').replace(/ (?:mejor|para (?:poder )?desarmarl[oa])$/, '')
  const forms = [
    text,
    stripped,
    // "Quita el zoclo" is "sin zoclo"; "ponle puertas" and "que tenga puertas", "con puertas".
    stripped.replace(/^(?:quitale|quita|sacale|saca|elimina) (?:el|la|los|las) /, 'sin '),
    stripped.replace(/^(?:ponle|pon|agregale|agrega) (?:el |la |los |las )?/, 'con '),
    text.replace(new RegExp(`^${OPENING}(?:que tenga|que lleve|quiero que tenga|quiero) `), 'con '),
    // "Ponle las puertas sobrepuestas", "con puertas corredizas" and "que las puertas queden al ras" say the value after the part.
    stripped.replace(/^(?:ponle|pon|agregale|agrega|con) /, ''),
    text.replace(new RegExp(String.raw`^${OPENING}que (?:el |la |los |las )?(\w+) (?:sea|sean|quede|queden|vaya|vayan) `), '$1 '),
  ]
  const lookUp = (key: string | undefined): { field: ChoiceField<Plan>; value: string }[] | undefined => (key === undefined ? undefined : (byPhrase.get(key) ?? lookUp(IDIOMS.get(key))))
  const hit = forms.map((form) => ({ form, found: lookUp(keyOf(form)) })).find((h) => h.found)
  if (!hit?.found) return undefined
  if (new Set(hit.found.map((f) => `${f.field.key}=${f.value}`)).size !== 1) return null
  const { field, value } = hit.found[0]
  return hasNone(plan, field, hit.form) ? edit(plan, field.key, field.get(plan), plan) : edit(plan, field.key, value, field.set(plan, value))
}

/** "Sin zoclo" on a piece that stands on legs takes nothing away: it never had one. */
function hasNone(plan: Plan, field: ChoiceField<Plan>, said: string): boolean {
  const m = /^sin (.+)$/.exec(said)
  const withIt = m && choicePhrases(field).find(([, p]) => keyOf(p) === keyOf(`con ${m[1]}`))
  return !!withIt && field.get(plan) !== withIt[0]
}

/** The builder and the checks judge the result; here it only has to still be a plan. */
const edit = (plan: Plan, field: string, value: string | number, next: Plan): Intent | null => (next === plan || FurniturePlan.safeParse(next).success ? { kind: 'edit', field, value, plan: next } : null)

/** What joins two changes in one request: "y", a comma, or both. */
const JOINED = /\s*,\s*(?:[ye]\s+)?|\s+[ye]\s+/
const MOST_CHANGES = 3

/** One change, read whole: null for a doubt or for more than one thing. */
function oneChange(text: string, plan: Plan, catalog: Catalog): Intent | null {
  const toward = towardIntent(text, plan)
  if (toward !== undefined) return toward
  if (DOUBT.test(text)) return null
  for (const read of [measureIntent, materialIntent, countIntent, openingsIntent, choiceIntent]) {
    const intent = read(text, plan, catalog)
    if (intent !== undefined) return intent
  }
  return null
}

/** Changes joined by "y" or a comma, each read against the plan the one before leaves: taken only if every one reads one way and none touches the field of another. */
function severalChanges(text: string, plan: Plan, catalog: Catalog): Intent | null {
  const parts = text.split(JOINED)
  if (parts.length > MOST_CHANGES) return null
  const edits: Extract<Intent, { kind: 'several' }>['edits'] = []
  let next = plan
  for (const part of parts) {
    const intent = oneChange(part, next, catalog)
    if (intent?.kind !== 'edit') return null
    const said = edits.find((e) => e.field === intent.field)
    if (said && said.value !== intent.value) return null
    // The same change said twice ("armado fijo, pegado") is one.
    if (!said) edits.push({ field: intent.field, value: intent.value })
    next = intent.plan
  }
  return edits.length === 1 ? { kind: 'edit', ...edits[0], plan: next } : { kind: 'several', edits, plan: next }
}

/** One request Knotty reads alone: a question its numbers answer, or a change or a few to a live plan; null for anything else or a doubt. */
export function parseIntent(request: string, plan: FurniturePlan | null, design: Design | null, catalog: Catalog): Intent | null {
  const text = same(spelledMetres(normalize(request)))
  if (!design || !text || text.length > 80) return null
  const question = QUESTIONS.find(([, pattern]) => pattern.test(text.replace(/^(?:oye )?(?:y )?/, '')))
  if (question) return { kind: 'question', topic: question[0] }
  if (!plan || request.includes('?')) return null
  return towardIntent(text, plan) === undefined && JOINED.test(text) ? severalChanges(text, plan, catalog) : oneChange(text, plan, catalog)
}
