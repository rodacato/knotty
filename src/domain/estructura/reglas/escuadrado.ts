import type { Hallazgo, Regla } from '../hallazgo'
import { SUPUESTOS, UNIONES_RIGIDAS } from '../supuestos'

const PERIMETRO = new Set(['lateral', 'piso', 'techo'])
const TRAVESANOS = new Set(['piso', 'techo', 'entrepano', 'faja', 'zoclo'])

/** Un casco sin trasera rígida ni marco rígido se descuadra como paralelogramo al empujarlo de lado. */
export const reglaEscuadrado: Regla = ({ diseno, geo }) => {
  const laterales = diseno.piezas.filter((p) => p.rol === 'lateral').map((p) => p.id)
  if (laterales.length < 2) return []
  const rol = new Map(diseno.piezas.map((p) => [p.id, p.rol]))
  const unidasA = (id: string, filtro: (tipo: string, pegamento: boolean) => boolean) =>
    new Set(diseno.uniones.filter((u) => (u.a === id || u.b === id) && filtro(u.tipo, u.pegamento)).map((u) => (u.a === id ? u.b : u.a)))

  const traseras = diseno.piezas.filter((p) => p.rol === 'trasera')
  const traseraRigida = traseras.some((t) => {
    const espesor = geo.espesores.get(t.id) ?? 0
    const perimetro = (ids: Set<string>) => [...ids].filter((id) => PERIMETRO.has(rol.get(id) ?? 'otro')).length
    if (espesor >= 6) return perimetro(unidasA(t.id, () => true)) >= 3
    return perimetro(unidasA(t.id, (tipo, pegamento) => (tipo === 'rebaje' || tipo === 'canal') && pegamento)) >= 3
  })

  const travesanos = diseno.piezas.filter((p) => TRAVESANOS.has(p.rol) && p.apoyo === 'fijo' && laterales.every((lat) => unidasA(p.id, (tipo) => UNIONES_RIGIDAS.includes(tipo as never)).has(lat)))
  const marcoRigido = travesanos.length >= 2 && travesanos.some((p) => p.rol === 'faja' || p.rol === 'zoclo')

  if (traseraRigida || marcoRigido) return []
  const alto = diseno.dimensiones.alto
  const hallazgo: Hallazgo = {
    codigo: 'R5_ESCUADRADO',
    severidad: alto > SUPUESTOS.altoEscuadradoCritico ? 'critico' : 'recomendacion',
    piezas: laterales,
    mensaje: 'Nada impide que el mueble se descuadre al empujarlo de lado: la trasera no lo amarra y las uniones no forman un marco rígido.',
    datos: { alto, travesanosRigidos: travesanos.length },
    alternativas: [
      { clave: 'trasera-6', descripcion: 'Trasera de 6 mm clavada y pegada a laterales, piso y techo', datos: { material: 'TR6' } },
      { clave: 'trasera-en-rebaje', descripcion: 'Trasera de 3 mm pegada en rebaje de laterales, piso y techo', datos: { tipo: 'rebaje' } },
      { clave: 'faja-rigida', descripcion: 'Faja trasera superior con tornillos de bolsillo a los laterales', datos: { tipo: 'bolsillo' } },
    ],
  }
  return [hallazgo]
}
