import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../furniture/fixtures/bookcase'
import { testCatalog } from '../../furniture/fixtures/catalog.test-util'
import { MODULES, buildPlan, type FurniturePlan } from '../../furniture/modules/plan'
import { answerQuestion } from './answers'
import { normalize, parseIntent, type Intent } from './intent'

// Spanish requests and what Knotty reads in them without the expert; null is the expert's.

const variant = (kind: keyof typeof MODULES, name: string) => {
  const found = (MODULES[kind].benchVariants() as [string, FurniturePlan][]).find(([n]) => n === name)
  if (!found) throw new Error(`no variant ${name}`)
  return found[1]
}
const plans = {
  bookcase: variant('cabinet', 'librero'),
  drawers: variant('cabinet', 'cajonera'),
  wallCabinet: variant('cabinet', 'alacena'),
  tv: variant('cabinet', 'mueble de TV'),
  shoeRack: variant('shoeRack', 'abierta'),
  desk: variant('table', 'escritorio con 2 cajones a la izquierda'),
  dining: variant('table', 'comedor'),
  bed: variant('bed', 'individual, cabecera librero, cajones del lado izquierdo hacia la cabecera'),
  bedBoth: variant('bed', 'individual, sin cabecera, cajones de los dos lados hacia la cabecera'),
}
type PlanName = keyof typeof plans

/** The intent without the resulting plan, to read in a table. */
const read = (request: string, name: PlanName | null): Omit<Extract<Intent, { kind: 'edit' }>, 'plan'> | Intent | null => {
  const plan = name ? plans[name] : null
  const intent = parseIntent(request, plan, plan ? buildPlan(plan, testCatalog).design : exampleBookcase)
  if (intent?.kind !== 'edit') return intent
  const { plan: _, ...rest } = intent
  return rest
}

const edit = (field: string, value: string | number) => ({ kind: 'edit', field, value })
const fieldOf = (intent: Intent | null) => (intent?.kind === 'edit' ? intent.field : null)

describe('parseIntent', () => {
  const understood: [string, PlanName, ReturnType<typeof edit>][] = [
    // Overall measures, from the words on the form.
    ['Hazlo de 90 cm de ancho', 'bookcase', edit('dimensions.width', 900)],
    ['hazlo de 90 de ancho', 'bookcase', edit('dimensions.width', 900)],
    ['1.80 de alto', 'bookcase', edit('dimensions.height', 1800)],
    ['Que mida 2 m de alto.', 'bookcase', edit('dimensions.height', 2000)],
    ['35 cm de fondo', 'bookcase', edit('dimensions.depth', 350)],
    ['Cambia el ancho a 750 mm', 'bookcase', edit('dimensions.width', 750)],
    ['más angosto 10 cm', 'bookcase', edit('dimensions.width', 500)],
    ['Hazlo 5 cm más bajo', 'bookcase', edit('dimensions.height', 1750)],
    ['quítale 10 cm de alto', 'bookcase', edit('dimensions.height', 1700)],
    ['Hazla de 1.60 m de largo', 'dining', edit('dimensions.width', 1600)],
    ['más larga 20 cm', 'dining', edit('dimensions.width', 1700)],
    // Counts, from the steppers and the cabinet's grid.
    ['agrega un cajón', 'drawers', edit('columns.drawers', 4)],
    ['Ponle un cajón más', 'drawers', edit('columns.drawers', 4)],
    ['quita un cajón', 'drawers', edit('columns.drawers', 2)],
    ['5 cajones', 'drawers', edit('columns.drawers', 5)],
    ['4 repisas', 'bookcase', edit('columns.shelves', 4)],
    ['otra repisa', 'bookcase', edit('columns.shelves', 5)],
    ['una repisa menos', 'bookcase', edit('columns.shelves', 3)],
    ['que tenga 6 repisas', 'bookcase', edit('columns.shelves', 6)],
    ['pon 2 puertas', 'wallCabinet', edit('columns.doors', 2)],
    ['una puerta', 'wallCabinet', edit('columns.doors', 1)],
    ['5 niveles', 'shoeRack', edit('levels', 5)],
    ['agrega un nivel', 'shoeRack', edit('levels', 5)],
    ['agrega un cajón', 'desk', edit('pedestal.drawers', 3)],
    ['3 cajones por lado', 'bed', edit('drawers.count', 3)],
    ['3 repisas', 'bed', edit('headboard.shelves', 3)],
    // Choices, from the module's labels.
    ['Sin zoclo', 'bookcase', edit('base', 'floor')],
    ['quita el zoclo', 'bookcase', edit('base', 'floor')],
    ['sin trasera', 'bookcase', edit('construction.back', 'none')],
    ['repisas fijas', 'bookcase', edit('construction.shelves', 'fixed')],
    ['puertas embutidas', 'wallCabinet', edit('construction.doors', 'inset')],
    ['sin anclar', 'bookcase', edit('wallMounted', 'no')],
    ['anclado al muro', 'bookcase', edit('wallMounted', 'yes')],
    ['anclada al muro', 'shoeRack', edit('wallMounted', 'yes')],
    ['con puertas', 'shoeRack', edit('front', 'doors')],
    ['ponle puertas', 'shoeRack', edit('front', 'doors')],
    ['sin puertas', 'shoeRack', edit('front', 'open')],
    ['con asiento arriba', 'shoeRack', edit('seat', 'yes')],
    ['Cabecera lisa', 'bed', edit('headboard.style', 'plain')],
    ['sin cabecera', 'bed', edit('headboard.style', 'none')],
    ['cajones de los dos lados', 'bed', edit('drawers.side', 'both')],
    ['colchón matrimonial', 'bed', edit('mattress', 'matrimonial')],
    ['cajonera a la derecha', 'desk', edit('pedestal.side', 'right')],
    ['sin cajonera', 'desk', edit('pedestal.side', 'none')],
    ['con repisa baja', 'dining', edit('shelf', 'yes')],
  ]
  it.each(understood)('«%s» on the %s', (request, name, expected) => expect(read(request, name)).toEqual(expected))

  const questions: [string, string][] = [
    ['¿cuántas hojas?', 'sheets'],
    ['¿Cuántas hojas de triplay necesito?', 'sheets'],
    ['cuanto cuesta', 'cost'],
    ['¿Y cuánto me va a costar?', 'cost'],
    ['¿Cuánto mide?', 'measures'],
    ['¿qué medidas tiene?', 'measures'],
  ]
  it.each(questions)('«%s» is a question about %s, with or without a plan', (request, topic) => {
    expect(read(request, 'bookcase')).toEqual({ kind: 'question', topic })
    expect(read(request, null)).toEqual({ kind: 'question', topic })
  })

  const forTheExpert: [string, PlanName | null][] = [
    // Doubt, negation or more than one thing.
    ['no le pongas cajones', 'drawers'],
    ['No, sin zoclo', 'bookcase'],
    ['90 de ancho y con puertas', 'shoeRack'],
    ['sin zoclo, y más alto', 'bookcase'],
    ['¿sin zoclo?', 'bookcase'],
    ['hazlo de 90 o 100 de ancho', 'bookcase'],
    // Words it does not know, or a request that does not say enough.
    ['hazlo más bonito', 'bookcase'],
    ['Hazla de 120 cm', 'drawers'],
    ['hazlo más angosto', 'bookcase'],
    ['Hazla de 3 metros', 'drawers'],
    ['600 de ancho', 'bookcase'],
    ['Agrega un cajón abajo', 'bookcase'],
    ['agrega un cajón', 'bookcase'],
    ['agrega cajones', 'drawers'],
    ['Quita el cajón de arriba y deja el hueco', 'drawers'],
    ['Ponle un listón para colgarla', 'drawers'],
    ['¿cuánto cuesta la corredera?', 'bookcase'],
    ['abierta', 'shoeRack'],
    ['Que aguante libros pesados', 'bookcase'],
    // Ambiguous in this plan: several openings, drawers on both sides, a measure the form does not have.
    ['4 repisas', 'tv'],
    ['agrega un cajón', 'bedBoth'],
    ['3 cajones', 'bed'],
    ['de 1 m de ancho', 'dining'],
    ['más ancho 10 cm', 'bed'],
    ['pon 3 puertas', 'wallCabinet'],
    ['20 cajones', 'drawers'],
    ['5 cm de ancho', 'bookcase'],
    ['hazlo de 4 m de alto', 'bookcase'],
    // Out of the form's range, or without a plan.
    ['sin zoclo', null],
    ['Hazlo de 90 cm de ancho', null],
  ]
  it.each(forTheExpert)('«%s» on the %s goes to the expert', (request, name) => expect(read(request, name)).toBeNull())

  it('asking for what the plan already has gives the same plan back', () => {
    const intent = parseIntent('con zoclo', plans.bookcase, buildPlan(plans.bookcase, testCatalog).design)
    expect(intent).toMatchObject({ kind: 'edit', field: 'base', value: 'kick' })
    expect(intent?.kind === 'edit' && intent.plan).toBe(plans.bookcase)
  })

  it('reads accents, capitals, "por favor" and a closing period the same', () => {
    expect(normalize('¡Hazlo de 90 CM de ancho, por favor!')).toBe('hazlo de 90 cm de ancho')
    expect(read('Sin zoclo, por favor.', 'bookcase')).toEqual(edit('base', 'floor'))
  })

  it('the phrases come from each module\'s labels: every variant with a base understands «sin zoclo» and «con zoclo», and the others do not', () => {
    const read = Object.values(MODULES).flatMap((module) =>
      (module.benchVariants() as [string, FurniturePlan][]).flatMap(([, plan]) => ['sin zoclo', 'con zoclo'].map((phrase) => ({ base: 'base' in plan, field: fieldOf(parseIntent(phrase, plan, buildPlan(plan, testCatalog).design)) }))),
    )
    expect(read.filter((r) => r.base !== (r.field === 'base'))).toEqual([])
    expect(read.some((r) => !r.base)).toBe(true)
  })
})

describe('answerQuestion', () => {
  const design = buildPlan(plans.bookcase, testCatalog).design
  it('counts the sheets from the purchase estimate', () => {
    expect(answerQuestion('sheets', design, testCatalog, plans.bookcase)).toMatch(/^\d+ hojas de triplay: \d+ de Triplay de pino 18 mm.* y \d+ de Triplay de pino 6 mm \(trasera\)\./)
  })
  it('gives the approximate cost, split in plywood and the rest', () => {
    expect(answerQuestion('cost', design, testCatalog, plans.bookcase)).toMatch(/^Unos \$[\d,]+: \$[\d,]+ de triplay \(\d+ hojas\) y \$[\d,]+ de herrajes, cubrecanto\. Son precios de referencia/)
  })
  it('says the measures, or the module note when they come from the plan', () => {
    expect(answerQuestion('measures', design, testCatalog, plans.bookcase)).toBe('Mide 1800 × 600 × 300 mm (alto, ancho, fondo): 180 cm de alto, 60 cm de ancho y 30 cm de fondo.')
    expect(answerQuestion('measures', buildPlan(plans.bed, testCatalog).design, testCatalog, plans.bed)).toMatch(/^Las medidas salen del colchón individual/)
  })
})
