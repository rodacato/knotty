import { redondear } from '../../diseno/resolver'
import { contactBetween, jointLength } from '../../validation/contact'
import type { Hallazgo, Regla } from '../hallazgo'
import { SUPUESTOS } from '../supuestos'

const PULGADA = 25.4
const pulgadas = (mm: number) => {
  const octavos = Math.round((mm / PULGADA) * 8)
  const enteras = Math.floor(octavos / 8)
  const resto = octavos % 8
  const fraccion = resto ? { 2: '¼', 4: '½', 6: '¾' }[resto] ?? `${resto}/8` : ''
  return `${enteras || ''}${fraccion}"`
}

/** R3: que el tornillo agarre lo suficiente, que el de bolsillo no se asome y que no quede pegado al extremo de la junta. */
export const reglaTornillos: Regla = ({ diseno, geo, catalogo }) =>
  diseno.uniones.flatMap((u): Hallazgo[] => {
    if (u.tipo !== 'tope-tornillo' && u.tipo !== 'bolsillo') return []
    const a = diseno.piezas.find((p) => p.id === u.a)
    const b = diseno.piezas.find((p) => p.id === u.b)
    const ta = geo.espesores.get(u.a)
    const cajaA = geo.cajas.get(u.a)
    const cajaB = geo.cajas.get(u.b)
    if (!a || !b || ta === undefined || !cajaA || !cajaB) return []
    const encontrados: Hallazgo[] = []
    const tornillos = u.herrajes.map((h) => catalogo.herrajes.find((x) => x.id === h.herrajeId)).filter((h) => h?.largo)

    const tb = geo.espesores.get(u.b) ?? 0
    // Si se tocan por la cara de b, el tornillo entra de frente en ella: lo que importa es que no se asome del otro lado.
    const porLaCara = contactBetween(u.a, cajaA, u.b, cajaB)?.axis === b.normal
    for (const t of tornillos) {
      const largo = t!.largo!
      if (u.tipo === 'tope-tornillo' && porLaCara) {
        const entra = largo - ta
        if (entra <= tb - 3) continue
        encontrados.push({
          codigo: 'R3_TORNILLOS',
          severidad: 'critico',
          piezas: [u.a, u.b],
          mensaje: `El ${t!.nombre.toLowerCase()} atraviesa ${a.nombre} (${ta} mm) y entra ${redondear(entra)} mm en la cara de ${b.nombre}, que mide ${tb} mm: se asoma del otro lado.`,
          datos: { union: u.id, largo, entra: redondear(entra), espesor: tb },
          alternativas: [{ clave: 'tornillo-mas-corto', descripcion: `Un tornillo de ${pulgadas(ta + tb - 5)} o menos`, datos: { largo: ta + tb - 5 } }],
        })
      } else if (u.tipo === 'tope-tornillo') {
        const entra = largo - ta
        if (entra >= SUPUESTOS.tornillos.penetracionMinima) continue
        const sugerido = catalogo.herrajes
          .filter((h) => h.largo && h.id.startsWith('tornillo-') && !h.id.includes('bolsillo') && h.largo - ta >= SUPUESTOS.tornillos.penetracionMinima)
          .sort((x, y) => x.largo! - y.largo!)[0]
        encontrados.push({
          codigo: 'R3_TORNILLOS',
          severidad: 'recomendacion',
          piezas: [u.a, u.b],
          mensaje: `El ${t!.nombre.toLowerCase()} atraviesa ${a.nombre} (${ta} mm) y solo entra ${redondear(entra)} mm en ${b.nombre}; conviene que entre al menos ${SUPUESTOS.tornillos.penetracionMinima} mm.`,
          datos: { union: u.id, largo, entra: redondear(entra) },
          alternativas: sugerido ? [{ clave: 'tornillo-mas-largo', descripcion: `Usar ${sugerido.nombre.toLowerCase()}`, datos: { herrajeId: sugerido.id } }] : [],
        })
      } else {
        const maximo = SUPUESTOS.tornillos.bolsilloMaximo.find((f) => ta <= f.hasta)?.largo
        if (maximo === undefined || largo <= maximo + 0.5) continue
        encontrados.push({
          codigo: 'R3_TORNILLOS',
          severidad: 'recomendacion',
          piezas: [u.a, u.b],
          mensaje: `En ${a.nombre} de ${ta} mm, un tornillo de bolsillo de ${pulgadas(largo)} puede asomarse; para ese espesor va de ${pulgadas(maximo)}.`,
          datos: { union: u.id, largo, maximo },
          alternativas: [{ clave: 'tornillo-bolsillo-corto', descripcion: `Tornillo de bolsillo de ${pulgadas(maximo)}`, datos: { largo: maximo } }],
        })
      }
    }

    const junta = jointLength(cajaA, cajaB)
    const cantidad = u.herrajes.reduce((n, h) => n + (h.cantidad ?? 2), 0)
    if (u.tipo === 'tope-tornillo' && !porLaCara && junta > 0 && cantidad >= 2 && junta < 2 * SUPUESTOS.tornillos.distanciaExtremo + 20)
      encontrados.push({
        codigo: 'R3_TORNILLOS',
        severidad: 'recomendacion',
        piezas: [u.a, u.b],
        mensaje: `La junta entre ${a.nombre} y ${b.nombre} mide ${redondear(junta, 0)} mm: dos tornillos quedarían a menos de ${SUPUESTOS.tornillos.distanciaExtremo} mm del extremo y pueden rajar el canto.`,
        datos: { union: u.id, junta: redondear(junta, 0) },
        alternativas: [
          { clave: 'un-tornillo', descripcion: 'Un solo tornillo al centro', datos: { cantidad: 1 } },
          { clave: 'tarugo', descripcion: 'Tarugo con pegamento', datos: { tipo: 'tarugo' } },
        ],
      })
    return encontrados
  })
