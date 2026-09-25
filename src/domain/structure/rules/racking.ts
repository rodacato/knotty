import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS, RIGID_JOINTS } from '../assumptions'

const PERIMETRO = new Set(['lateral', 'piso', 'techo'])
const TRAVESANOS = new Set(['piso', 'techo', 'entrepano', 'faja', 'zoclo'])

/** Un casco sin trasera rígida ni marco rígido se descuadra como paralelogramo al empujarlo de lado. */
export const rackingRule: Rule = ({ design: diseno, geo }) => {
  const laterales = diseno.piezas.filter((p) => p.rol === 'lateral').map((p) => p.id)
  if (laterales.length < 2) return []
  const rol = new Map(diseno.piezas.map((p) => [p.id, p.rol]))
  const unidasA = (id: string, filtro: (tipo: string, pegamento: boolean) => boolean) =>
    new Set(diseno.uniones.filter((u) => (u.a === id || u.b === id) && filtro(u.tipo, u.pegamento)).map((u) => (u.a === id ? u.b : u.a)))

  // A full board in the back plane braces like a back: the spine of a bed base, screwed to both ends and the platform.
  const traseras = diseno.piezas.filter((p) => p.rol === 'trasera' || (p.rol === 'divisor' && p.normal === 'z'))
  const traseraRigida = traseras.some((t) => {
    const espesor = geo.thicknesses.get(t.id) ?? 0
    const perimetro = (ids: Set<string>) => [...ids].filter((id) => PERIMETRO.has(rol.get(id) ?? 'otro')).length
    if (espesor >= 6) return perimetro(unidasA(t.id, () => true)) >= 3
    return perimetro(unidasA(t.id, (tipo, pegamento) => (tipo === 'rebaje' || tipo === 'canal') && pegamento)) >= 3
  })

  const travesanos = diseno.piezas.filter((p) => TRAVESANOS.has(p.rol) && p.apoyo === 'fijo' && laterales.every((lat) => unidasA(p.id, (tipo) => RIGID_JOINTS.includes(tipo as never)).has(lat)))
  const marcoRigido = travesanos.length >= 2 && travesanos.some((p) => p.rol === 'faja' || p.rol === 'zoclo')

  if (traseraRigida || marcoRigido) return []
  // What racks is the box the sides make: in a cabinet the whole height, under a bed's headboard only the base.
  const alto = Math.max(...laterales.map((id) => geo.boxes.get(id)?.y1 ?? 0)) || diseno.dimensiones.alto
  const hallazgo: Finding = {
    code: 'R5_ESCUADRADO',
    severity: alto > ASSUMPTIONS.criticalRackingHeight ? 'critico' : 'recomendacion',
    pieces: laterales,
    message: 'Nada impide que el mueble se descuadre al empujarlo de lado: la trasera no lo amarra y las uniones no forman un marco rígido.',
    data: { alto, travesanosRigidos: travesanos.length },
    alternatives: [
      { key: 'trasera-6', description: 'Trasera de 6 mm clavada y pegada a laterales, piso y techo', data: { material: 'TR6' } },
      { key: 'trasera-en-rebaje', description: 'Trasera de 3 mm pegada en rebaje de laterales, piso y techo', data: { tipo: 'rebaje' } },
      { key: 'faja-rigida', description: 'Faja trasera superior con tornillos de bolsillo a los laterales', data: { tipo: 'bolsillo' } },
    ],
  }
  return [hallazgo]
}
