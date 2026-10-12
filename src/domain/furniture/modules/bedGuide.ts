import { isDrawerPart, type Design } from '../../design/schema'
import { noReference } from '../../sources'
import type { BedPlan } from './bed'
import { knockDown, levelled, sequence, step, type GuidePhase } from './guide'

const bedSequence = noReference('Knotty’s assembly order for its bed module: frame and supporting rails before the platform; verify the dry assembly and hardware access')

/** The actual bed parts determine the order; a platform never precedes its supporting frame. */
export function bedPhases(plan: BedPlan, design: Design): GuidePhase[] {
  const legs = design.pieces.filter((p) => p.id.startsWith('leg-'))
  const drawers = design.pieces.filter(isDrawerPart)
  const platform = design.pieces.filter((p) => p.id.startsWith('platform') || p.id.startsWith('slat-') || p.id.startsWith('lip-'))
  const later = new Set([...legs, ...drawers, ...platform].map((p) => p.id))
  const frame = design.pieces.filter((p) => !later.has(p.id))
  const ids = (pieces: Design['pieces']) => pieces.map((p) => p.id)
  const apart = !!plan.assembly && plan.assembly !== 'glued'
  const phases: GuidePhase[] = [
    { id: 'prepare', title: 'Antes de armar', pieces: [], steps: [
      step('Revisa la lista de corte, etiqueta cada pieza y marca su cara buena y su frente.', sequence('Revisar la lista de corte, etiquetar piezas')),
      step('Arma en seco, sin pegamento y con prensas, para comprobar que todo coincide.', sequence('Armar sin pegamento con prensas para comprobar que todo coincide')),
      ...(apart ? [step('Da el acabado por piezas antes de unirlas con el herraje desarmable; deja accesibles sus conexiones.', knockDown('permite armar y desarmar sin dañar el triplay'))] : []),
    ] },
    { id: 'legs', title: 'Las patas', pieces: ids(legs), steps: [step('Pega y prensa las capas de cada pata con sus cantos alineados; haz los cortes de perfil indicados antes de montarlas al marco.', bedSequence)] },
    { id: 'frame', title: 'El marco y la cabecera', pieces: ids(frame), steps: [
      step('Presenta los costados y los extremos de la base. Arma la cabecera que lleva este modelo y únela al marco con las conexiones de la tabla de uniones.', bedSequence),
      step('Monta el larguero central, los travesaños y los apoyos que aparecen en el despiece antes de cerrar la plataforma. Conserva acceso al taladro y a las prensas.', bedSequence),
      step('Compara las diagonales del marco sobre un piso plano y corrige el descuadre antes de fijar las uniones.', bedSequence),
    ] },
    { id: 'platform', title: plan.platform === 'slats' ? 'Las tablillas y el borde' : 'La plataforma y el borde', pieces: ids(platform), entersFrom: 'above', steps: [step('Asienta la plataforma o las tablillas sobre todos sus apoyos y fija las conexiones indicadas. Monta el borde retenedor si aparece en el despiece.', bedSequence)] },
    { id: 'drawers', title: 'Los cajones', pieces: ids(drawers), entersFrom: 'front', detail: { title: 'Un cajón, por partes', pieces: ids(drawers.filter((p) => p.group === drawers[0]?.group)) }, steps: [
      step('Fija las correderas a la misma altura en los dos lados. Arma las cajas, coloca sus fondos y monta los frentes después de comprobar el recorrido.', bedSequence),
    ] },
    { id: 'finish', title: 'Acabado', pieces: [], steps: [
      step('Comprueba que el marco asienta sobre todos sus apoyos y que ninguna conexión queda floja.', bedSequence),
      ...(apart ? [] : [step('Lija, sella y da el acabado. Si barnizas, desmonta antes los herrajes.', sequence('Lijar, sellar y dar acabado'))]),
    ] },
    { id: 'install', title: 'En su lugar', pieces: [], steps: [step('Nivela el mueble donde va, en las dos direcciones.', levelled), step('Presenta el colchón real y comprueba su encaje y el acceso a los cajones antes de usar la cama.', bedSequence)] },
  ]
  return phases.filter((p) => p.pieces.length || ['prepare', 'finish', 'install'].includes(p.id))
}
