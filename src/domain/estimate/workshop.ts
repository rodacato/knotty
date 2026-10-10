import { slides } from '../design/doors'
import type { Design, JointType } from '../design/schema'
import { cite, type Source } from '../sources'

// What to ask the lumberyard for and what to have at hand, read off the design: its pieces, its edges and the joints it has. Nothing here is computed; each line is a row of docs/carpinteria.

export interface Advice {
  /** For the person. It carries no number the reference row does not have. */
  text: string
  source: Source
}

const FABRICATION = 'fabricacion-y-armado.md'
const yard = (row: string) => cite(FABRICATION, '12-lo-que-se-puede-pedir-en-lugar-de-comprar-herramienta', row)
const asking = (row: string) => cite(FABRICATION, '22-qué-pedir-y-qué-no', row)
const byJoint = (row: string) => cite(FABRICATION, '13-uniones-que-permite-cada-nivel', row)
const gear = (row: string) => cite(FABRICATION, '71-equipo-de-protección-personal', row)

const advice = (text: string, source: Source): Advice => ({ text, source })

const jointsOf = (design: Design) => new Set<JointType>(design.joints.map((u) => u.type))
const grooved = (design: Design) => design.joints.some((u) => u.type === 'dado' || u.type === 'rabbet')

/** What the lumberyard can do, of what this design needs: the cuts always, the rest only when the design has it. */
export function atTheYard(design: Design): Advice[] {
  const joints = jointsOf(design)
  const fronts = design.pieces.some((p) => p.role === 'drawer-front' || (p.role === 'door' && !slides(design, p.id)))
  return [
    advice('Antes de ir, llama o manda un mensaje con la lista y pregunta el precio por corte, si refilan la hoja y si pueden cortar respetando la veta.', cite(FABRICATION, '21-dónde-cortar-en-méxico', 'precio por corte, si refilan la hoja')),
    advice('Pide todos los cortes rectos de la lista.', asking('todos los cortes rectos del cuerpo')),
    ...(design.pieces.some((p) => p.edges.length) ? [advice('Pide el cubrecanto de los cantos que se ven: la lista dice cuáles.', asking('el cubrecanto de los cantos visibles'))] : []),
    ...(joints.has('cup-hinge') ? [advice('Si no tienes broca para cazoletas, pide la perforación para las bisagras de las puertas.', yard('perforación para bisagras'))] : []),
    ...(grooved(design) ? [advice('Si no tienes router ni sierra de mesa, pide las ranuras.', yard('ranuras para traseras y fondos de cajón'))] : []),
    ...(joints.has('shelf-pin') ? [advice('Pregunta si perforan los agujeros de los soportes de repisa; si no, se hacen con plantilla.', byJoint('con plantilla o perforado en maderería'))] : []),
    advice('Pide que etiqueten las piezas.', yard('etiquetado de piezas')),
    ...(fronts ? [advice('Si puedes, deja para el final las puertas y los frentes de cajón: se miden sobre el cuerpo ya armado y escuadrado.', asking('Se miden sobre el cuerpo ya armado y escuadrado'))] : []),
  ]
}

/** The tool each kind of joint asks for, beyond the drill everything needs. */
const TOOLS: Partial<Record<JointType, Advice>> = {
  'pocket-screw': advice('Plantilla de bolsillo, para los tornillos de bolsillo.', byJoint('Tornillo de rosca gruesa para triplay')),
  dowel: advice('Plantilla para tarugos: pide agujeros alineados en las dos piezas.', byJoint('Pide agujeros alineados en las dos piezas')),
  'plugged-dowel': advice('Plantilla para tarugos y tapones de madera.', byJoint('plantilla para tarugos y tapones de madera')),
  'cam-lock': advice('Broca Forstner de 15 mm y su plantilla, para los minifix.', byJoint('broca Forstner de 15 mm + plantilla')),
  'connector-bolt': advice('Broca de paso y llave Allen, para los pernos.', cite('uniones-y-herrajes.md', '32-tabla-por-unión', 'broca de paso, Forstner, llave Allen')),
  'cup-hinge': advice('Broca Forstner de 35 mm con tope de profundidad, para las cazoletas de las bisagras.', byJoint('broca Forstner de 35 mm + tope')),
  'shelf-pin': advice('Plantilla de perforación, para los agujeros de los soportes de repisa.', byJoint('taladro + plantilla de perforación de 32 mm')),
  finger: advice('Router en mesa o sierra de mesa con plantilla, para las esquinas de dedos.', byJoint('router en mesa o sierra de mesa con plantilla')),
}

/** What to have at hand to build this design: the least kit, the tool of each joint it has, and what protects the person. */
export function toolsFor(design: Design): Advice[] {
  const joints = jointsOf(design)
  return [
    advice(`Taladro atornillador con brocas para madera y avellanador, puntas de desarmador, flexómetro, escuadra de carpintero, lápiz, prensas, martillo${design.joints.some((u) => u.glue) ? ', lija y pegamento blanco' : ' y lija'}.`, cite(FABRICATION, '11-los-tres-niveles', 'Taladro atornillador con brocas para madera')),
    ...(Object.keys(TOOLS) as JointType[]).flatMap((type) => (joints.has(type) ? [TOOLS[type]!] : [])),
    ...(grooved(design) ? [advice('Router o sierra de mesa, para las ranuras y los rebajes, si no los pides en la maderería.', byJoint('solo si la maderería la hace'))] : []),
    advice('Lentes de seguridad, siempre que uses una máquina.', gear('siempre que haya máquina')),
    advice('Respirador, no cubrebocas de tela, para el polvo de lijar y de cortar.', gear('no cubrebocas de tela')),
  ]
}
