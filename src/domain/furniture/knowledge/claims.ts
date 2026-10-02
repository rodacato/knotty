import { z } from 'zod'
import { DesignKind } from '../../design/kind'
import { cite, noReference, VALUES } from '../../sources'

// Claims from learning material that must not reach the expert as they were said: each carries a status, and only own-words rules from valid, conditional and corrected entries leave this file.
// Adapters import adviceFor and the types, never CLAIMS; claims.test.ts enforces it. Rule text carries no craft number: a number belongs to a cited row of docs/carpinteria or to a check.

export const CLAIM_STATUS = ['valid', 'conditional', 'corrected', 'excluded'] as const
export type ClaimStatus = (typeof CLAIM_STATUS)[number]

export const CLAIM_SCOPE = [
  'tool-safety', 'tool-availability', 'panel-properties', 'finishing', 'finishing-safety', 'adhesive-timing',
  'joinery-fit', 'joinery-strength', 'dimensions-example', 'dimensions-real', 'load-capacity', 'stability',
  'sanding', 'workflow', 'provenance',
] as const

// Photo reading is deliberately not an operation: it must carry no fabrication knowledge.
export const OPERATIONS = ['plan', 'adjust', 'review', 'fabrication', 'assembly', 'finishing', 'chat'] as const
export const Operation = z.enum(OPERATIONS)
export type Operation = z.infer<typeof Operation>

export const CLAIM_ORIGIN = ['course', 'omission', 'audit', 'docs'] as const

const TEXT = z.string().min(1).max(300)

export const ClaimSchema = z
  .object({
    claimId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    scope: z.enum(CLAIM_SCOPE),
    status: z.enum(CLAIM_STATUS),
    origin: z.enum(CLAIM_ORIGIN),
    kinds: z.union([z.literal('all'), z.array(DesignKind).min(1)]),
    operations: z.union([z.literal('all'), z.array(Operation).min(1)]),
    rule: TEXT.optional(),
    condition: TEXT.optional(),
    missing: TEXT.optional(),
    check: TEXT.optional(),
    correction: TEXT.optional(),
    reference: z.array(z.string().min(1)).default([]),
    docRow: z.string().optional(),
    why: TEXT.optional(),
    replacedBy: z.string().optional(),
    leakPatterns: z.array(z.string().min(3)).default([]),
  })
  .superRefine((c, ctx) => {
    const need = (ok: boolean, message: string) => ok || ctx.addIssue({ code: 'custom', message: `${c.claimId}: ${message}` })
    if (c.status === 'excluded') {
      need(!!c.why && c.leakPatterns.length > 0 && !c.rule, 'excluded needs why and leakPatterns, and no rule')
      return
    }
    need(!!c.rule, 'needs a rule')
    if (c.status === 'conditional') need(!!c.condition && (!!c.missing || !!c.check), 'conditional needs a condition and a missing datum or a check')
    if (c.status === 'corrected') need(!!c.correction && c.reference.length > 0 && !!c.docRow, 'corrected needs correction, reference and docRow')
  })
export type Claim = z.infer<typeof ClaimSchema>

/** What the prompt side may use: own words only, never the claim as it was said. */
export type Advice = { claimId: string; rule: string; condition?: string; missing?: string }

export function adviceFor(kind: DesignKind | null, operation: Operation, claims: readonly Claim[] = CLAIMS): Advice[] {
  return claims.flatMap((c) => {
    if (c.status === 'excluded' || !c.rule) return []
    if (c.kinds !== 'all' && (kind === null || !c.kinds.includes(kind))) return []
    if (c.operations !== 'all' && !c.operations.includes(operation)) return []
    return [{ claimId: c.claimId, rule: c.rule, ...(c.status === 'conditional' ? { condition: c.condition, missing: c.missing } : {}) }]
  })
}

const TITEBOND_FAQ = 'https://www.titebond.com/resources/use/glues/faqs'
const OSMO_SDS = 'https://www.osmouk.com/downloads/polyx-oil-original-safety-data.pdf'
const TRIPLAY = 'docs/carpinteria/triplay.md'
const ACABADOS = 'docs/carpinteria/acabados.md'
const FABRICACION = 'docs/carpinteria/fabricacion-y-armado.md'

const TALL_STORAGE = ['bookcase', 'wardrobe', 'drawers', 'cabinet', 'nightstand', 'sideboard', 'tvStand'] as const

export const CLAIMS: readonly Claim[] = ClaimSchema.array().parse([
  {
    claimId: 'bare-hand-on-spinning-bit', scope: 'tool-safety', status: 'excluded', origin: 'audit', kinds: 'all', operations: 'all',
    why: 'Presents touching a rotating bit as harmless; the expert must never repeat it.',
    replacedBy: 'rotating-bits-contact-hazard',
    leakPatterns: ['con mi mano desnuda toco la broca', 'bare hand on a spinning bit', 'touching a spinning bit is harmless'],
  },
  {
    claimId: 'rotating-bits-contact-hazard', scope: 'tool-safety', status: 'valid', origin: 'docs', kinds: 'all', operations: ['fabrication', 'chat'],
    rule: 'Clamp the piece, unplug the tool before changing or adjusting a bit, and keep gloves, loose sleeves and jewellery away from anything that rotates.',
    docRow: cite('fabricacion-y-armado.md', '7-seguridad', 'Nada de ropa suelta ni joyas'),
  },
  {
    claimId: 'plywood-grain-has-a-strong-axis', scope: 'panel-properties', status: 'corrected', origin: 'course', kinds: 'all', operations: ['plan', 'adjust', 'review'],
    rule: 'Plywood is not equal in both directions: cut shelves and tops with the face grain along the span, because across it they sag much more.',
    correction: 'Plywood has a stiffer direction; the face grain decides how much a shelf sags.',
    reference: [TRIPLAY],
    docRow: cite('triplay.md', 'dirección-de-la-veta', 'a lo largo del claro'),
    check: 'Ask which way the face grain runs on the sheet.',
    leakPatterns: ['sentido fuerte y débil', 'no hay sentido fuerte'],
  },
  {
    claimId: 'plywood-defects-can-be-structural', scope: 'panel-properties', status: 'corrected', origin: 'course', kinds: 'all', operations: ['plan', 'review', 'fabrication'],
    rule: 'Inspect a sheet for hollow edges, separated plies and warp before buying it: some defects are structural, not only cosmetic.',
    correction: 'Not every plywood defect is cosmetic; voids and delamination weaken the sheet.',
    reference: [TRIPLAY],
    docRow: cite('triplay.md', 'defectos-comunes-y-cómo-elegir-la-hoja-en-tienda', 'Deslaminado'),
    check: 'Look along the four edges and tap the face for a hollow sound.',
    leakPatterns: ['problema solo estético', 'no es un problema estructural'],
  },
  {
    claimId: 'plywood-grades-differ-beyond-looks', scope: 'panel-properties', status: 'conditional', origin: 'course', kinds: 'all', operations: ['plan', 'adjust', 'review'],
    rule: 'A face grade describes the faces; sheets of the same grade can still differ in plies, species and thickness tolerance, so do not treat them as interchangeable.',
    condition: 'When a design depends on the sheet, not only on how it looks.',
    missing: 'The product data sheet of the sheet the person is buying.',
    docRow: cite('triplay.md', 'grados-de-tipo-estadounidense-abcd-los-que-usan-home-depot-y-arauco', 'cara/contracara'),
    leakPatterns: ['solo la terminación de las últimas dos capas', 'la diferencia entre todos los contrachapados'],
  },
  {
    claimId: 'plywood-can-still-split-and-delaminate', scope: 'panel-properties', status: 'corrected', origin: 'course', kinds: 'all', operations: ['plan', 'adjust', 'review', 'assembly'],
    rule: 'Plywood resists splitting better than solid wood, but a screw into an edge without a pilot hole can still open it between plies, and a bad sheet can delaminate.',
    correction: 'The claim that plywood cannot split or crack over-generalises; edges open between plies.',
    reference: [FABRICACION],
    docRow: cite('fabricacion-y-armado.md', '6-errores-típicos-de-principiante', 'El canto se abre entre capas'),
    leakPatterns: ['no se puede partir', 'no se puede agrietar'],
  },
  {
    claimId: 'plywood-warps-if-stored-badly', scope: 'panel-properties', status: 'corrected', origin: 'course', kinds: 'all', operations: ['plan', 'fabrication', 'chat'],
    rule: 'Plywood is stable in its plane but it still warps if it is stored leaning on a wall: keep sheets flat and sight along the edges before cutting.',
    correction: 'Dimensional stability is relative; storage and humidity can still bend a sheet.',
    reference: [TRIPLAY],
    docRow: cite('triplay.md', 'humedad-y-clima-en-méxico', 'se alabea si se guarda recargado en la pared'),
    leakPatterns: ['dimensionalmente estable', 'plywood never warps'],
  },
  {
    claimId: 'interfering-joint-is-eased-not-forced', scope: 'joinery-fit', status: 'corrected', origin: 'audit', kinds: 'all', operations: ['assembly', 'chat'],
    rule: 'A joint that seats only with hard blows is too tight: find where it binds and ease that spot, instead of driving it in.',
    correction: 'A mallet seats a joint that already fits; it does not make an interfering one fit.',
    reference: [FABRICACION],
    docRow: noReference('workshop criterion that a joint seats by hand; the reference has no row for it'),
    check: 'Dry fit and look for the contact point before using the mallet.',
  },
  {
    claimId: 'light-tap-to-align-under-clamp', scope: 'joinery-fit', status: 'valid', origin: 'course', kinds: 'all', operations: ['assembly'],
    rule: 'Present the pieces, put the clamp on so they stop moving, and then align with light taps of a rubber mallet; the tap aligns, it does not force.',
  },
  {
    claimId: 'glue-times-come-from-the-product', scope: 'adhesive-timing', status: 'conditional', origin: 'course', kinds: 'all', operations: ['assembly', 'chat'],
    rule: 'Open time, clamp time and time to load depend on the glue and the room temperature, so take them from the product sheet and not from a rule of thumb heard elsewhere.',
    condition: 'Whenever someone asks how long to wait with glue.',
    missing: 'Which glue, and the room temperature.',
    reference: [TITEBOND_FAQ],
    docRow: cite('uniones-y-herrajes.md', '5-pegamentos', 'Carga completa'),
  },
  {
    claimId: 'clamp-release-is-not-loading', scope: 'adhesive-timing', status: 'corrected', origin: 'audit', kinds: 'all', operations: ['assembly', 'chat'],
    rule: 'Removing the clamps, handling the piece and loading the joint are three different moments: wait for the full cure before loading.',
    correction: 'A time observed for taking clamps off is not a time for loading.',
    reference: [TITEBOND_FAQ],
    docRow: cite('uniones-y-herrajes.md', '5-pegamentos', 'No cargar una unión pegada antes de'),
    missing: 'The glue sheet.',
    leakPatterns: ['sacar las prensas y seguir trabajando'],
  },
  {
    claimId: 'dry-fit-before-glue', scope: 'workflow', status: 'valid', origin: 'course', kinds: 'all', operations: ['assembly'],
    rule: 'Rehearse the whole assembly with the clamps before any glue; if something needs force, fix the fit first.',
  },
  {
    claimId: 'oil-soaked-rags-self-heat', scope: 'finishing-safety', status: 'corrected', origin: 'omission', kinds: 'all', operations: ['finishing', 'chat'],
    rule: 'Rags soaked with drying oils can heat up and ignite on their own: spread them flat outside to dry, away from anything flammable, or soak them in water before discarding.',
    correction: 'Finishing guidance often leaves this hazard out; it has to be said.',
    reference: [OSMO_SDS, ACABADOS],
    docRow: cite('acabados.md', '18-seguridad', 'Tender los trapos extendidos o remojarlos en agua'),
    missing: 'The safety data sheet of the product the person will use.',
  },
  {
    claimId: 'natural-finish-still-needs-ventilation', scope: 'finishing-safety', status: 'conditional', origin: 'course', kinds: 'all', operations: ['finishing', 'chat'],
    rule: 'Calling a finish natural does not make it free of vapours or fire risk: ventilate and follow the product sheet.',
    condition: 'When a finish is described as natural or oil-wax.',
    missing: 'Which product, and its sheet.',
    docRow: cite('acabados.md', '18-seguridad', 'Vapores'),
  },
  {
    claimId: 'particle-filter-is-not-a-vapour-filter', scope: 'finishing-safety', status: 'valid', origin: 'course', kinds: 'all', operations: ['finishing', 'chat'],
    rule: 'A dust filter does not stop solvent vapours; for products with solvents the mask needs a cartridge for organic vapours.',
    docRow: cite('acabados.md', '18-seguridad', 'mascarilla con cartucho de'),
  },
  {
    claimId: 'sanding-grits-are-an-example', scope: 'sanding', status: 'conditional', origin: 'course', kinds: 'all', operations: ['finishing', 'fabrication', 'chat'],
    rule: 'A sandpaper sequence in a worked example was chosen for its own boards: start from the real state of the surface and the finish that comes next.',
    condition: 'When asked which sandpaper to use.',
    missing: 'State of the surface and the finish planned.',
    docRow: cite('acabados.md', '21-lijado-por-granos', 'Emparejar cantos, quitar marcas de sierra'),
  },
  {
    claimId: 'no-coarse-sanding-on-plywood-faces', scope: 'sanding', status: 'corrected', origin: 'omission', kinds: 'all', operations: ['finishing', 'fabrication', 'chat'],
    rule: 'Do not start coarse on the faces of plywood: the face veneer can be thinner than a millimetre and sanding through it cannot be repaired.',
    correction: 'Examples that start coarse do it on thick boards; plywood faces are thin.',
    reference: [ACABADOS],
    docRow: cite('acabados.md', '21-lijado-por-granos', 'la chapa del pino puede medir menos de 1 mm'),
    check: 'Ask which plywood it is.',
  },
  {
    claimId: 'sitial-measures-are-one-design', scope: 'dimensions-example', status: 'conditional', origin: 'course', kinds: ['bench'], operations: ['plan', 'adjust', 'review'],
    rule: 'The measures of a seat shown in a worked example came from tests with one body and one use: they are a starting point, not a table.',
    condition: 'When someone designs a seat from those measures.',
    missing: 'Who sits, in what posture, for how long.',
  },
  {
    claimId: 'object-sets-the-measure', scope: 'dimensions-example', status: 'conditional', origin: 'course', kinds: 'all', operations: ['plan', 'adjust', 'review'],
    rule: 'When a piece is built around a specific object such as an instrument, a screen or an appliance, that object sets the measure and a worked example does not.',
    condition: 'When the piece has to hold or fit something.',
    missing: 'The object and its real dimensions.',
  },
  {
    claimId: 'trim-allowance-is-one-build', scope: 'dimensions-example', status: 'conditional', origin: 'course', kinds: ['bench'], operations: ['plan', 'fabrication'],
    rule: 'Leaving a tenon longer than the seat is thick, to trim it flush after assembly, is a choice of that build; decide it from the real thickness.',
    condition: 'When a part is meant to be flushed after gluing.',
    missing: 'Measured thickness of the board.',
  },
  {
    claimId: 'nominal-thickness-is-not-real', scope: 'dimensions-real', status: 'valid', origin: 'docs', kinds: 'all', operations: ['plan', 'adjust', 'review', 'fabrication'],
    rule: 'The thickness printed on a sheet is nominal: measure the real one at several points before cutting grooves or choosing screws.',
    docRow: cite(VALUES, '1-material', 'Espesor real'),
  },
  {
    claimId: 'load-capacity-is-not-computed', scope: 'load-capacity', status: 'conditional', origin: 'omission', kinds: 'all', operations: ['plan', 'adjust', 'review', 'chat'],
    rule: 'Knotty does not give how much a piece of furniture can carry: it checks sag and stability, and passing them is not a certificate of load.',
    condition: 'When someone asks whether a piece will carry a given load.',
    missing: 'Span, load and board.',
    docRow: cite('estructura.md', '1-pandeo-de-repisas', 'Pandeo de repisas'),
  },
  {
    claimId: 'back-panel-is-unspecified', scope: 'stability', status: 'conditional', origin: 'omission', kinds: 'all', operations: ['plan', 'adjust', 'review'],
    rule: 'The back panel decides how much the box resists racking, and a worked example often does not say how thick it is or how it is fixed.',
    condition: 'When a design has a back panel, or when it could have one.',
    missing: 'Back thickness and how it is fixed.',
    docRow: cite('estructura.md', '2-rigidez-y-escuadrado-racking', 'Rigidez y escuadrado (racking)'),
  },
  {
    claimId: 'dowels-in-plywood-edge-are-an-option', scope: 'joinery-strength', status: 'conditional', origin: 'omission', kinds: 'all', operations: ['plan', 'adjust', 'review'],
    rule: 'Dowels into the edge of plywood are one option shown for a light top; do not present them as a joint proven for the load of books.',
    condition: 'When the joint carries a load.',
    missing: 'Load, board and glue.',
    docRow: cite('uniones-y-herrajes.md', '3-catálogo-de-uniones', 'Casi ninguna se hizo en triplay de pino mexicano'),
  },
  {
    claimId: 'router-steps-need-the-tool', scope: 'tool-availability', status: 'conditional', origin: 'course', kinds: 'all', operations: ['plan', 'fabrication', 'chat'],
    rule: 'Steps that use a router or a saw guide are not available with only a drill and a jigsaw: offer another route.',
    condition: 'When the person has not said which tools they own.',
    missing: 'Tools the person owns.',
    docRow: cite('fabricacion-y-armado.md', '11-los-tres-niveles', 'Taller completo'),
  },
  {
    claimId: 'jigsaw-line-on-top-may-not-be-square', scope: 'tool-safety', status: 'valid', origin: 'course', kinds: 'all', operations: ['fabrication', 'chat'],
    rule: 'A jigsaw blade can drift, so the cut underneath may not follow the line you see on top: test on a scrap and check the underside.',
  },
  {
    claimId: 'push-device-is-not-universal', scope: 'tool-safety', status: 'conditional', origin: 'course', kinds: 'all', operations: ['fabrication', 'chat'],
    rule: 'A push block was preferred for the cuts shown on a table saw; that does not prove any home-made device is safe for another cut.',
    condition: 'When someone asks how to push a piece past a blade.',
    missing: 'Which saw and which cut.',
  },
  {
    claimId: 'guard-or-fence-wording', scope: 'tool-safety', status: 'conditional', origin: 'course', kinds: 'all', operations: ['fabrication', 'chat'],
    rule: 'The fence is sometimes called the guard: confirm which part of the saw is meant before giving safety advice about it.',
    condition: 'When a table saw part is named as the guard.',
    check: 'Ask the person to point at the part.',
  },
  {
    claimId: 'splitter-reduces-kickback-only', scope: 'tool-safety', status: 'valid', origin: 'course', kinds: 'all', operations: ['fabrication', 'chat'],
    rule: 'A splitter behind the blade lowers the chance of kickback but does not remove it, and it must never be taken off to make a cut easier.',
  },
  {
    claimId: 'anchor-tall-furniture-to-a-stud-or-solid-wall', scope: 'stability', status: 'valid', origin: 'course', kinds: TALL_STORAGE, operations: ['plan', 'adjust', 'review'],
    rule: 'Tall or top-heavy storage furniture can tip: anchor it to a stud or a solid wall, never only to the thin back panel or to bare drywall, and ask what the wall is made of.',
    condition: 'When the piece is tall or has drawers.',
    missing: 'Wall type.',
    docRow: cite('estructura.md', '63-recomendaciones', 'no solo a la tablaroca'),
  },
  {
    claimId: 'removable-parts-need-play', scope: 'joinery-fit', status: 'conditional', origin: 'course', kinds: 'all', operations: ['plan', 'adjust', 'fabrication', 'assembly'],
    rule: 'A fixed joint can be snug, but a shelf or a door meant to come out or slide needs a little play so it enters and leaves easily.',
    condition: 'When a part has to be removable or sliding.',
    check: 'Measure the real opening before cutting.',
  },
  {
    claimId: 'crossing-offset-is-one-design', scope: 'joinery-fit', status: 'conditional', origin: 'course', kinds: 'all', operations: ['plan', 'fabrication'],
    rule: 'The position of a cross joint in a demonstration stool follows from that design: do not copy it onto another frame without asking where the top ties in.',
    condition: 'When a cross joint is proposed for a different frame.',
    missing: 'Where the top is fixed to the frame.',
  },
  {
    claimId: 'screws-help-seat-one-build', scope: 'joinery-strength', status: 'conditional', origin: 'course', kinds: 'all', operations: ['plan', 'assembly'],
    rule: 'Screws that push a joint home worked in the build shown; that is not a load certification for other versions.',
    condition: 'When the joint carries a person or a load.',
    missing: 'The load the piece will carry.',
  },
  {
    claimId: 'too-much-glue-can-split-a-thin-part', scope: 'workflow', status: 'valid', origin: 'course', kinds: 'all', operations: ['assembly'],
    rule: 'In a thin part, too much glue in a hole can split it when the dowel goes in: use little.',
  },
  {
    claimId: 'corner-clamp-holds-without-pressing', scope: 'workflow', status: 'valid', origin: 'course', kinds: 'all', operations: ['assembly'],
    rule: 'A corner clamp keeps the angle but does not press the parts together; the pressure has to come from another clamp.',
  },
  {
    claimId: 'equal-parts-from-one-reference', scope: 'workflow', status: 'valid', origin: 'course', kinds: 'all', operations: ['fabrication'],
    rule: 'Parts that must be equal come from one reference or one stop, not from measuring the same number again each time.',
  },
  {
    claimId: 'instructor-credentials-and-counts', scope: 'provenance', status: 'excluded', origin: 'course', kinds: 'all', operations: 'all',
    why: 'Biography, years of teaching and student counts are not craft knowledge and cannot be checked.',
    leakPatterns: ['alumnos presenciales', 'llevamos unos cien alumnos', 'years of teaching experience'],
  },
  {
    claimId: 'oil-wax-is-a-preference', scope: 'finishing', status: 'conditional', origin: 'course', kinds: 'all', operations: ['finishing', 'chat'],
    rule: 'Oil-wax is one maker’s taste for easy repair; paint or varnish are equally valid choices.',
    condition: 'When someone asks which finish to use.',
    missing: 'Use of the piece and the product available.',
  },
])
