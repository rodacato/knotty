import { isDrawerPart, type Design, type Piece } from '../../design/schema'
import { anchored, knockDown, levelled, sequence, step, tableSequence, type GuidePhase } from './guide'
import type { TablePlan } from './table'

// The order a table, a desk or a bench goes together in: the sequence of fabricacion-y-armado.md §3.1. Its frame is squared before the top goes on, since no back holds it square; a desk's pedestal comes first, for the frame joins it.

type Stage = 'legs' | 'frame' | 'pedestal' | 'low' | 'top' | 'drawers'

/** Where each piece goes on: what is not a leg, the pedestal with its own end, something low, the top or a drawer is part of the frame. */
function stageOf(piece: Piece, plan: TablePlan): Stage {
  if (isDrawerPart(piece)) return 'drawers'
  if (piece.role === 'top') return 'top'
  if (piece.id.startsWith('leg-')) return 'legs'
  if (piece.id.startsWith('ped-') || piece.id === `side-${plan.pedestal.side}`) return 'pedestal'
  if (piece.id.startsWith('stretcher-') || piece.id === 'low-shelf' || piece.id.startsWith('shelf-leg-')) return 'low'
  return 'frame'
}

/** Glued, it is finished once assembled; one that comes apart, piece by piece before its final assembly. */
export function tablePhases(plan: TablePlan, design: Design): GuidePhase[] {
  const at = (stage: Stage) => design.pieces.filter((p) => stageOf(p, plan) === stage)
  const ids = (stage: Stage) => at(stage).map((p) => p.id)
  const apart = !!plan.assembly && plan.assembly !== 'glued'
  const drawers = at('drawers')
  const oneDrawer = drawers.filter((p) => p.group === drawers[0]?.group)
  const pocket = design.joints.some((u) => u.type === 'pocket-screw')
  const handles = [design.pulls, ...Object.values(design.pullsOf ?? {})].includes('handle')
  const low = at('low')
  const ends = at('frame').filter((p) => p.role === 'side').length
  const joined = [...(at('legs').length ? ['a las patas'] : []), ...(ends ? [ends > 1 ? 'a los costados' : 'al costado'] : []), ...(at('pedestal').length ? ['a la cajonera'] : [])].join(' y ')

  const phases: GuidePhase[] = [
    {
      id: 'prepare',
      title: 'Antes de armar',
      pieces: [],
      steps: [
        step('Revisa la lista de corte, etiqueta cada pieza y marca su cara buena y su frente.', sequence('Revisar la lista de corte, etiquetar piezas')),
        ...(pocket || drawers.length
          ? [step(`Con las piezas acostadas, perfora ${[...(drawers.length ? ['las correderas en los laterales'] : []), ...(pocket ? ['los agujeros de bolsillo'] : [])].join(' y ')}: es más fácil y más preciso que con el mueble armado.`, sequence('Es más fácil y preciso con la pieza acostada'))]
          : []),
        step(
          plan.edges === 'exposed' ? 'Lija las caras interiores: después cuesta más llegar.' : 'Pon el cubrecanto en los cantos que se ven y lija las caras interiores: después cuesta más llegar.',
          sequence('Poner cubrecanto a los cantos visibles y lijar las caras interiores'),
        ),
        ...(apart ? [step('Como este mueble es desarmable, dale el acabado a cada pieza, acostada, antes del armado final.', sequence('Un mueble desarmable (§8.4) se acaba por piezas'))] : []),
        step('Arma en seco, sin pegamento y con prensas, para comprobar que todo coincide.', sequence('Armar sin pegamento con prensas para comprobar que todo coincide')),
      ],
    },
    {
      id: 'legs',
      title: 'Las patas',
      pieces: ids('legs'),
      steps: [step('Une las capas de cada pata, cara con cara y con los cantos alineados: la pata entra al bastidor ya como una sola pieza.', tableSequence('Unir las capas de cada pata, cara con cara y con los cantos alineados'))],
    },
    {
      id: 'pedestal',
      title: 'La cajonera',
      pieces: ids('pedestal'),
      steps: [step('Arma primero la cajonera, como un cuerpo chico: su piso y sus separadores entre el costado y el costado interior, con su fondo y su zoclo. El bastidor se une a ella.', tableSequence('Se arma como un cuerpo chico'))],
    },
    {
      id: 'frame',
      title: 'El bastidor',
      pieces: ids('frame'),
      steps: [
        ...(apart ? [step('Une las partes del bastidor con su herraje, sin pegamento: así se arma y se desarma sin dañar el triplay.', knockDown('permite armar y desarmar sin dañar el triplay'))] : []),
        step(`Sobre una superficie plana, une los faldones ${joined}${at('frame').some((p) => p.id.startsWith('rail-')) ? '; después, los travesaños entre los faldones largos' : ''}.`, tableSequence('Unir los faldones a las patas, a los costados o a la cajonera, sobre una superficie plana')),
        step(apart ? 'Mide las dos diagonales del bastidor, de esquina a esquina, e iguálalas.' : 'Mide las dos diagonales del bastidor, de esquina a esquina, e iguálalas con una prensa en la diagonal larga, antes de que pegue el pegamento.', tableSequence('Medir las dos diagonales del bastidor, de esquina a esquina')),
      ],
    },
    {
      id: 'low',
      title: low.some((p) => p.id === 'low-shelf') ? 'La repisa baja' : 'Los travesaños bajos',
      pieces: ids('low'),
      steps: [step(`Pon ${low.some((p) => p.id === 'low-shelf') ? 'la repisa baja' : 'los travesaños bajos'} ahora, con la mesa todavía sin cubierta, que es cuando mejor se alcanza.`, tableSequence('Con la mesa todavía sin cubierta'))],
    },
    {
      id: 'top',
      title: 'La cubierta',
      pieces: ids('top'),
      entersFrom: 'above',
      steps: [step('Asienta la cubierta sobre el bastidor ya escuadrado, céntrala midiendo lo que sobresale de cada lado y fíjala al bastidor.', tableSequence('Asentarla sobre el bastidor ya escuadrado'))],
    },
    {
      id: 'drawers',
      title: 'Los cajones',
      pieces: ids('drawers'),
      entersFrom: 'front',
      detail: { title: oneDrawer.length < drawers.length ? 'Un cajón, por partes: los demás se arman igual' : 'El cajón, por partes', pieces: oneDrawer.map((p) => p.id) },
      steps: [
        step('Fija las correderas en la cajonera, con escuadra y a la altura marcada: la misma en los dos lados.', sequence('Con escuadra y a la altura marcada')),
        step('Arma la caja de cada cajón (costados, contrafrente y trasera), ponle el fondo y móntala en sus correderas. Al final, el frente, atornillado desde adentro.', sequence('Armar la caja (costados, contrafrente, trasera)')),
      ],
    },
    {
      id: 'finish',
      title: 'Acabado',
      pieces: [],
      steps: [
        step('Revisa que no cojee sobre un piso plano, antes del acabado: todavía se puede corregir.', tableSequence('Sobre un piso plano, antes del acabado')),
        ...(handles ? [step('Marca las jaladeras con una plantilla de papel o cartón, para que todas queden a la misma altura.', sequence('Plantilla de papel o cartón para que todas queden a la misma altura'))] : []),
        ...(apart ? [] : [step('Lija, sella y da el acabado. Si barnizas, desmonta antes los herrajes.', sequence('Lijar, sellar y dar acabado'))]),
      ],
    },
    {
      id: 'install',
      title: 'En su lugar',
      pieces: [],
      steps: [step('Nivela el mueble donde va, en las dos direcciones.', levelled), ...(design.wallAnchored ? [step('Ánclalo al muro, como dice su ficha.', anchored)] : [])],
    },
  ]
  const built = new Set(['prepare', 'finish', 'install'])
  return phases.filter((phase) => phase.steps.length && (phase.pieces.length || built.has(phase.id)))
}
