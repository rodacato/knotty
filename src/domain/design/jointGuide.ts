import { TOOL_LEVELS, type ToolLevel } from '../materials/tools'
import type { JointType } from './schema'

// What the person reads to choose a joint. Level fit: fabricacion-y-armado.md §1.3; definitions: glosario.md §5;
// resistance, difficulty, visibility and knock-down: uniones-y-herrajes.md §3.2; advantage and disadvantage: §3.3.

/** A cell of §1.3: ✅ `yes`; ⚠️ with a jig `jig`, with care `careful`, or only if the lumberyard does it `shop`; ❌ `no`. */
export type JointFit = 'yes' | 'jig' | 'careful' | 'shop' | 'no'

/** The joints the catalog shows: every structural joint type, plus confirmat, which Knotty does not build yet. */
export type GuideJoint = Extract<JointType, 'butt-screw' | 'pocket-screw' | 'dowel' | 'plugged-dowel' | 'cam-lock' | 'glue-nail' | 'bracket' | 'dado' | 'rabbet' | 'finger'> | 'confirmat'

export interface JointGuide {
  name: string
  definition: string
  /** The tool that asks for it (§1.3), or the one §3.3 names when §1.3 does not list the joint. */
  tool: string
  note: string | null
  /** By level 1, 2 and 3; null when §1.3 does not list it. */
  fit: [JointFit, JointFit, JointFit] | null
  advantage: string | null
  disadvantage: string | null
  resistance: string
  difficulty: string
  visible: string
  knockDown: string
}

export const JOINT_GUIDE: Record<GuideJoint, JointGuide> = {
  'butt-screw': {
    name: 'A tope con tornillo',
    definition: 'El tornillo atraviesa la cara de una pieza y entra por el canto de la otra; con pegamento.',
    tool: 'taladro, avellanador',
    note: 'Con taladro guía para no abrir el canto.',
    fit: ['yes', 'yes', 'yes'],
    advantage: 'Solo pide taladro y avellanador.',
    disadvantage: 'Al canto raja o abre las chapas sin piloto, y en 12 mm solo admite tornillo #6.',
    resistance: 'media (baja al canto de 12 mm)',
    difficulty: 'básica',
    visible: 'cabeza en la cara',
    knockDown: 'sí, pocas veces',
  },
  'pocket-screw': {
    name: 'Tornillo de bolsillo',
    definition: 'Tornillo en un agujero inclinado hecho con plantilla; no se ve por fuera.',
    tool: 'plantilla de bolsillo',
    note: 'Tornillo de rosca gruesa para triplay; largo según el espesor real.',
    fit: ['no', 'yes', 'yes'],
    advantage: 'Fácil, perdona errores y no necesita pegamento.',
    disadvantage: 'En triplay barato la punta puede sacar las chapas por el canto.',
    resistance: 'media-alta',
    difficulty: 'básica',
    visible: 'bolsillo en la cara oculta',
    knockDown: 'sí, pocas veces',
  },
  dowel: {
    name: 'Tarugos',
    definition: 'Cilindros de madera pegados en agujeros alineados de las dos piezas.',
    tool: 'plantilla para tarugos',
    note: 'Pide agujeros alineados en las dos piezas.',
    fit: ['no', 'jig', 'yes'],
    advantage: 'Oculto y, con pegamento, de las más fuertes; es la que mejor resiste el descuadre.',
    disadvantage: 'Los agujeros de las dos piezas tienen que coincidir; no se desarma.',
    resistance: 'alta con pegamento',
    difficulty: 'intermedia (precisión)',
    visible: 'oculta',
    knockDown: 'no (va pegado)',
  },
  'plugged-dowel': {
    name: 'Tarugo con tapón',
    definition: 'Un tarugo pegado que atraviesa la cara de una pieza y entra en el canto de la otra; el agujero se cierra con un tapón de madera, a veces de otro color.',
    tool: 'plantilla para tarugos y tapones de madera',
    note: 'El tapón se corta con una broca de tapones o se compra, y se pega al ras.',
    fit: ['no', 'jig', 'yes'],
    advantage: 'Sin tornillos a la vista y con un detalle de otra madera; el tarugo pegado resiste el descuadre.',
    disadvantage: 'El agujero tiene que quedar alineado y limpio; el tapón al ras se lija al final, y no se desarma.',
    resistance: 'alta con pegamento',
    difficulty: 'intermedia (precisión)',
    visible: 'el tapón, en la cara',
    knockDown: 'no (va pegado)',
  },
  confirmat: {
    name: 'Confirmat',
    definition: 'Tornillo grueso de rosca gruesa, hecho para tableros, que entra por la cara de una pieza al canto de la otra en un agujero escalonado.',
    tool: 'taladro y broca escalonada',
    note: 'No aparece en la tabla de niveles.',
    fit: null,
    advantage: 'Rápido, sin pegamento ni prensas; resiste el descuadre como el tarugo.',
    disadvantage: 'Está hecho para aglomerado y puede abrir el alma del triplay; pide tablero de 16 mm.',
    resistance: 'alta (poca evidencia)',
    difficulty: 'básica con la broca correcta',
    visible: 'cabeza en la cara (con tapón)',
    knockDown: 'sí, varias veces',
  },
  'cam-lock': {
    name: 'Minifix',
    definition: 'Herraje de excéntrica y perno; une y se desarma.',
    tool: 'broca Forstner de 15 mm + plantilla',
    note: 'Para muebles desarmables.',
    fit: ['shop', 'jig', 'yes'],
    advantage: 'Se arma y desarma muchas veces; queda oculto por dentro.',
    disadvantage: 'Sola resiste poco; rinde cuando lleva tarugos al lado.',
    resistance: 'media; sube con tarugos',
    difficulty: 'intermedia',
    visible: 'tapón por dentro',
    knockDown: 'sí, muchas veces',
  },
  'glue-nail': {
    name: 'Clavo y pegamento',
    definition: 'Clavos sin cabeza más cola blanca; típico de la trasera.',
    tool: 'martillo (o clavadora)',
    note: 'Trasera y fondos.',
    fit: ['yes', 'yes', 'yes'],
    advantage: 'Barato y rápido para traseras y fondos de cajón.',
    disadvantage: 'Sin pegamento no es una unión estructural; no se desarma.',
    resistance: 'baja sola; media con pegamento',
    difficulty: 'básica',
    visible: 'puntos casi invisibles',
    knockDown: 'no',
  },
  bracket: {
    name: 'Escuadra metálica',
    definition: 'Placa en L atornillada a las dos piezas por dentro.',
    tool: 'taladro',
    note: 'Por dentro; no escuadra el cuerpo por sí sola.',
    fit: ['yes', 'yes', 'yes'],
    advantage: 'Solo pide taladro y desarmador, y se quita cuando quieras.',
    disadvantage: 'Se ve mucho y no evita que el casco se descuadre.',
    resistance: 'baja al descuadre; buena como apoyo',
    difficulty: 'básica',
    visible: 'muy visible',
    knockDown: 'sí',
  },
  dado: {
    name: 'Ranura',
    definition: 'Una pieza entra en un canal abierto en la otra.',
    tool: 'router o sierra de mesa',
    note: 'Con sierra circular, con varias pasadas.',
    fit: ['shop', 'careful', 'yes'],
    advantage: 'La repisa se apoya en el canal: la carga no depende del tornillo.',
    disadvantage: 'Hay que darle a la maderería el espesor real del triplay.',
    resistance: 'alta para cargar repisas',
    difficulty: 'intermedia',
    visible: 'en el canto si es pasante',
    knockDown: 'no si va pegado',
  },
  rabbet: {
    name: 'Rebaje',
    definition: 'Escalón en la orilla donde asienta otra pieza (típico de traseras).',
    tool: 'router o sierra de mesa',
    note: 'Típico para traseras embutidas.',
    fit: ['no', 'careful', 'yes'],
    advantage: null,
    disadvantage: null,
    resistance: 'media-alta',
    difficulty: 'intermedia',
    visible: 'discreto',
    knockDown: 'no si va pegado',
  },
  finger: {
    name: 'Unión de dedos',
    definition: 'Los dos tableros se cortan en dedos que se alternan y se entran uno en el otro; con pegamento.',
    tool: 'router en mesa o sierra de mesa con plantilla',
    note: 'Dedos del ancho del tablero, más o menos.',
    fit: ['no', 'no', 'yes'],
    advantage: 'Mucha superficie de pegado, y la esquina se ve hecha a propósito.',
    disadvantage: 'Pide precisión: un dedo flojo se nota, y el canto de las chapas queda a la vista.',
    resistance: 'alta con pegamento',
    difficulty: 'intermedia',
    visible: 'los dedos, en la esquina',
    knockDown: 'no',
  },
}

/** The order the catalog shows them in: what anyone can make first, what changes the pieces last. */
export const GUIDE_JOINTS: GuideJoint[] = ['butt-screw', 'pocket-screw', 'dowel', 'plugged-dowel', 'confirmat', 'cam-lock', 'glue-nail', 'bracket', 'dado', 'rabbet', 'finger']

/** How the person's level can make it; null when §1.3 does not say. */
export const jointFit = (joint: GuideJoint, level: ToolLevel): JointFit | null => JOINT_GUIDE[joint].fit?.[level - 1] ?? null

const LEVEL_WAY: Record<JointFit, string> = { yes: '', jig: ' con plantilla', careful: ' con cuidado', shop: ' si la maderería la hace', no: '' }

/** Which levels make it, up to the first that makes it plainly: «Desde nivel 2», «Nivel 2 con plantilla · 3». */
export function levelsText(joint: GuideJoint): string {
  const fit = JOINT_GUIDE[joint].fit
  if (!fit) return 'Nivel sin dato'
  const first = fit.indexOf('yes')
  const before = fit.slice(0, first).flatMap((f, i) => (f === 'no' ? [] : [`${TOOL_LEVELS[i]}${LEVEL_WAY[f]}`]))
  return before.length ? `Nivel ${[...before, TOOL_LEVELS[first]].join(' · ')}` : `Desde nivel ${TOOL_LEVELS[first]}`
}
