import type { Pulls } from '../../design/schema'
import { ASSUMPTIONS } from '../../assumptions'

// How the fronts of a module are opened, and what the person reads about what is cut into them (the cuts themselves are in design/frontCuts.ts).

/** How a front sits: inside its opening, over the edges around it, sliding in its grooves, or lying as a lid. */
export type FrontMount = 'inset' | 'overlay' | 'sliding' | 'lid'

/** How a front is opened: as its plan says. When it says nothing, an inset front takes a notch, since it has no edge to pull by; any other is left as it is. */
export const pullFor = (said: Pulls | undefined, mount: FrontMount): Pulls => said ?? (mount === 'inset' ? 'notch' : 'none')

/** What the person reads when some fronts are opened by a notch: nothing to buy, a router cut. */
export const notchNote = (fronts: number) => `Muesca para abrir en el canto de ${fronts} ${fronts === 1 ? 'frente' : 'frentes'}: se fresa con router, no se compra nada.`

const mm = (n: number) => String(Math.round(n * 10) / 10)
/** What the person reads when doors slide: nothing to buy, two grooves per leaf, and why the one above is deeper. */
export const slidingNote = (leaves: number, board: number) => {
  const into = board * ASSUMPTIONS.sliding.engagement
  return `${leaves === 1 ? 'Puerta corrediza' : `${leaves} puertas corredizas`} sin bisagras: cada hoja corre en una ranura del tablero de abajo, de ${mm(into)} mm de hondo, y otra del de arriba, de ${mm(2 * into)} mm, para meterla y sacarla levantándola. Las ranuras se fresan con router antes de armar, un poco más anchas que la hoja.`
}

/** What the person reads when there is a rod to hang clothes from: what it is cut from and where its flanges go. */
export const rodNote = (rods: number) =>
  `${rods === 1 ? 'Tubo para colgar' : `${rods} tubos para colgar`}: se ${rods === 1 ? 'corta' : 'cortan'} con segueta al ancho del hueco y ${rods === 1 ? 'va' : 'van'} con una brida atornillada a cada costado, al centro del fondo.`

/** What the person reads when a chest opens from above: what holds each lid, and why it goes to a strip and not to the back. */
export const lidNote = (lids: number) =>
  `${lids === 1 ? 'Tapa abatible' : `${lids} tapas abatibles`} hacia arriba: cada una va con bisagra de piano a la tira fija de atrás, no a la trasera, y un compás de fricción atornillado al costado la detiene abierta (dos, uno por costado, en una tapa pesada). Antes de abrirla hay que quitar lo que tenga encima.`
