import { lifts, slides } from '../../design/doors'
import { isDrawerPart, type Design, type Piece } from '../../design/schema'
import { cite } from '../../sources'
import type { CabinetPlan } from './cabinet'
import type { GuidePhase, GuideStep } from './guide'

// The order a cabinet goes together in, phase by phase: the sequence of fabricacion-y-armado.md §3, with what this cabinet has and nothing it does not.
// Loose shelves go in before the doors close over them.

const FABRICATION = 'fabricacion-y-armado.md'
const sequence = (row: string) => cite(FABRICATION, '3-secuencia-de-armado-típica-de-un-cuerpo', row)
const knockDown = (row: string) => cite(FABRICATION, '84-muebles-desarmables', row)

const step = (text: string, source: string): GuideStep => ({ text, source })
const listed = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0])

type Stage = 'body' | 'back' | 'base' | 'drawers' | 'doors' | 'shelves'

/** Where each piece goes on: what is not a back, a base, a drawer, a front or a loose shelf is part of the body. */
function stageOf(piece: Piece): Stage {
  if (isDrawerPart(piece)) return 'drawers'
  if (piece.role === 'door') return 'doors'
  if (piece.role === 'back') return 'back'
  if (piece.role === 'kick' || piece.role === 'apron' || piece.id.startsWith('leg-')) return 'base'
  if (piece.role === 'shelf' && piece.support === 'movable') return 'shelves'
  return 'body'
}

/** A glued cabinet is finished once assembled; one that comes apart, piece by piece before its final assembly. */
export function cabinetPhases(plan: CabinetPlan, design: Design): GuidePhase[] {
  const at = (stage: Stage) => design.pieces.filter((p) => stageOf(p) === stage)
  const ids = (stage: Stage) => at(stage).map((p) => p.id)
  const apart = !!plan.assembly && plan.assembly !== 'glued'
  const doors = at('doors')
  const hinged = doors.filter((d) => !slides(design, d.id) && !lifts(design, d.id))
  const sliding = doors.filter((d) => slides(design, d.id))
  const lids = doors.filter((d) => lifts(design, d.id))
  const handles = [design.pulls, ...Object.values(design.pullsOf ?? {})].includes('handle')
  const body = at('body')
  const drawers = at('drawers')
  const oneDrawer = drawers.filter((p) => p.group === drawers[0]?.group)

  const flat = [
    ...(at('shelves').length ? ['los agujeros de los soportes de repisa'] : []),
    ...(hinged.length ? ['las cazoletas de las puertas y las placas de bisagra'] : []),
    ...(at('drawers').length ? ['las correderas en los laterales'] : []),
    ...(design.joints.some((u) => u.type === 'pocket-screw') ? ['los agujeros de bolsillo'] : []),
  ]

  const phases: GuidePhase[] = [
    {
      id: 'prepare',
      title: 'Antes de armar',
      pieces: [],
      steps: [
        step('Revisa la lista de corte, etiqueta cada pieza y marca su cara buena y su frente.', sequence('Revisar la lista de corte, etiquetar piezas')),
        ...(flat.length ? [step(`Con las piezas acostadas, perfora ${listed(flat)}: es más fácil y más preciso que con el mueble armado.`, sequence('Es más fácil y preciso con la pieza acostada'))] : []),
        step(
          plan.edges === 'exposed' ? 'Lija las caras interiores: después cuesta más llegar.' : 'Pon el cubrecanto en los cantos que se ven y lija las caras interiores: después cuesta más llegar.',
          sequence('Poner cubrecanto a los cantos visibles y lijar las caras interiores'),
        ),
        ...(apart ? [step('Como este mueble es desarmable, dale el acabado a cada pieza, acostada, antes del armado final.', sequence('Un mueble desarmable (§8.4) se acaba por piezas'))] : []),
        step('Arma en seco, sin pegamento y con prensas, para comprobar que todo coincide.', sequence('Armar sin pegamento con prensas para comprobar que todo coincide')),
      ],
    },
    {
      id: 'body',
      title: 'El cuerpo',
      pieces: ids('body'),
      steps: [
        apart
          ? step('Une las partes del cuerpo con su herraje, sin pegamento: así se arma y se desarma sin dañar el triplay.', knockDown('permite armar y desarmar sin dañar el triplay'))
          : step('Une el piso a los laterales con la unión que elegiste para el cuerpo. A tope: pegamento en el canto, prensas, taladro guía, avellanar y atornillar desde la cara del lateral.', sequence('Pegamento en el canto, prensas, taladro guía, avellanar y atornillar desde la cara del lateral')),
        ...(body.some((p) => p.role === 'divider' || p.role === 'shelf') ? [step('Sigue con los divisores y las repisas fijas, en el orden en que los alcances con el taladro.', sequence('En el orden que se puedan alcanzar con el taladro'))] : []),
        step('Cierra con el techo o la cubierta, igual que el piso.', sequence('Igual que el piso.')),
      ],
    },
    {
      id: 'square',
      title: at('back').length ? 'Escuadrar y poner la trasera' : 'Escuadrar',
      pieces: ids('back'),
      seenFrom: 'back',
      entersFrom: 'back',
      steps: [
        step('Mide las dos diagonales del frente; si no son iguales, aprieta una prensa en la diagonal larga hasta igualarlas. Revisa también por atrás.', sequence('Medir las dos diagonales del frente')),
        ...(at('back').length ? [step('Con el cuerpo a escuadra, pega y clava la trasera en todo el perímetro: al quedar fija, mantiene la escuadra.', sequence('Con el cuerpo a escuadra, pegar y clavar la trasera en todo el perímetro'))] : []),
      ],
    },
    { id: 'base', title: 'La base', pieces: ids('base'), entersFrom: 'below', detail: { title: plan.base === 'kick' ? 'El zoclo, por partes' : 'La base, por partes', pieces: ids('base') }, steps: [step(plan.base === 'kick' ? 'Pon el zoclo, remetido al frente.' : 'Pon las patas, con sus faldones.', sequence('**Zoclo o patas**'))] },
    {
      id: 'drawers',
      title: 'Los cajones',
      pieces: ids('drawers'),
      entersFrom: 'front',
      detail: { title: oneDrawer.length < drawers.length ? 'Un cajón, por partes: los demás se arman igual' : 'El cajón, por partes', pieces: oneDrawer.map((p) => p.id) },
      steps: [
        step('Fija las correderas en el cuerpo, con escuadra y a la altura marcada: la misma en los dos lados.', sequence('Con escuadra y a la altura marcada')),
        step('Arma la caja de cada cajón (costados, contrafrente y trasera), ponle el fondo y móntala en sus correderas. Al final, el frente, atornillado desde adentro.', sequence('Armar la caja (costados, contrafrente, trasera)')),
      ],
    },
    { id: 'shelves', title: 'Las repisas', pieces: ids('shelves'), entersFrom: 'front', steps: [step('Pon los soportes en sus agujeros y asienta las repisas.', sequence('agujeros de soportes de repisa'))] },
    {
      id: 'doors',
      title: !lids.length ? 'Las puertas' : hinged.length || sliding.length ? 'Las puertas y las tapas' : 'Las tapas',
      pieces: ids('doors'),
      steps: [
        ...(hinged.length ? [step('Monta las bisagras en cada puerta, cuélgala y ajústala: a los lados, en profundidad y en altura.', sequence('Montar bisagras en la puerta, colgar y ajustar'))] : []),
        ...(lids.length ? [step('Monta la bisagra de cada tapa, cuélgala y ajústala.', sequence('Montar bisagras en la puerta, colgar y ajustar'))] : []),
        ...(sliding.length ? [step('Las hojas corredizas entran ahora: levanta cada una dentro de la ranura de arriba, que es la más honda, y bájala a la de abajo.', sequence('cada hoja se levanta dentro de la ranura de arriba'))] : []),
      ],
    },
    {
      id: 'finish',
      title: 'Acabado',
      pieces: [],
      steps: [
        ...(handles ? [step('Marca las jaladeras con una plantilla de papel o cartón, para que todas queden a la misma altura.', sequence('Plantilla de papel o cartón para que todas queden a la misma altura'))] : []),
        ...(apart ? [] : [step('Lija, sella y da el acabado. Si barnizas, desmonta antes los herrajes.', sequence('Lijar, sellar y dar acabado'))]),
      ],
    },
    {
      id: 'install',
      title: 'En su lugar',
      pieces: [],
      steps: [
        step('Nivela el mueble donde va, en las dos direcciones, antes de ajustar las bisagras.', cite(FABRICATION, '91-nivelar', 'nivel de burbuja en dos direcciones')),
        ...(design.wallAnchored ? [step('Ánclalo al muro, como dice su ficha.', cite(FABRICATION, '92-anclar-al-muro-antivuelco', 'evita lesiones y muertes por vuelco'))] : []),
      ],
    },
  ]
  const built = new Set(['prepare', 'square', 'finish', 'install'])
  return phases.filter((phase) => phase.steps.length && (phase.pieces.length || built.has(phase.id)))
}
