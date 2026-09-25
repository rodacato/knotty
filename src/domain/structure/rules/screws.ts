import { roundTo } from '../../diseno/resolve'
import { contactBetween, jointLength } from '../../validation/contact'
import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

const PULGADA = 25.4
const pulgadas = (mm: number) => {
  const octavos = Math.round((mm / PULGADA) * 8)
  const enteras = Math.floor(octavos / 8)
  const resto = octavos % 8
  const fraccion = resto ? { 2: '¼', 4: '½', 6: '¾' }[resto] ?? `${resto}/8` : ''
  return `${enteras || ''}${fraccion}"`
}

/** R3: que el tornillo agarre lo suficiente, que el de bolsillo no se asome y que no quede pegado al extremo de la junta. */
export const screwRule: Rule = ({ design: diseno, geo, catalog: catalogo }) =>
  diseno.uniones.flatMap((u): Finding[] => {
    if (u.tipo !== 'tope-tornillo' && u.tipo !== 'bolsillo') return []
    const a = diseno.piezas.find((p) => p.id === u.a)
    const b = diseno.piezas.find((p) => p.id === u.b)
    const ta = geo.thicknesses.get(u.a)
    const cajaA = geo.boxes.get(u.a)
    const cajaB = geo.boxes.get(u.b)
    if (!a || !b || ta === undefined || !cajaA || !cajaB) return []
    const encontrados: Finding[] = []
    const tornillos = u.herrajes.map((h) => catalogo.herrajes.find((x) => x.id === h.herrajeId)).filter((h) => h?.largo)

    const tb = geo.thicknesses.get(u.b) ?? 0
    // Si se tocan por la cara de b, el tornillo entra de frente en ella: lo que importa es que no se asome del otro lado.
    const porLaCara = contactBetween(u.a, cajaA, u.b, cajaB)?.axis === b.normal
    for (const t of tornillos) {
      const largo = t!.largo!
      if (u.tipo === 'tope-tornillo' && porLaCara) {
        const entra = largo - ta
        if (entra <= tb - 3) continue
        encontrados.push({
          code: 'R3_TORNILLOS',
          severity: 'critico',
          pieces: [u.a, u.b],
          message: `El ${t!.nombre.toLowerCase()} atraviesa ${a.nombre} (${ta} mm) y entra ${roundTo(entra)} mm en la cara de ${b.nombre}, que mide ${tb} mm: se asoma del otro lado.`,
          data: { union: u.id, largo, entra: roundTo(entra), espesor: tb },
          alternatives: [{ key: 'tornillo-mas-corto', description: `Un tornillo de ${pulgadas(ta + tb - 5)} o menos`, data: { largo: ta + tb - 5 } }],
        })
      } else if (u.tipo === 'tope-tornillo') {
        const entra = largo - ta
        if (entra >= ASSUMPTIONS.screws.minPenetration) continue
        const sugerido = catalogo.herrajes
          .filter((h) => h.largo && h.id.startsWith('tornillo-') && !h.id.includes('bolsillo') && h.largo - ta >= ASSUMPTIONS.screws.minPenetration)
          .sort((x, y) => x.largo! - y.largo!)[0]
        encontrados.push({
          code: 'R3_TORNILLOS',
          severity: 'recomendacion',
          pieces: [u.a, u.b],
          message: `El ${t!.nombre.toLowerCase()} atraviesa ${a.nombre} (${ta} mm) y solo entra ${roundTo(entra)} mm en ${b.nombre}; conviene que entre al menos ${ASSUMPTIONS.screws.minPenetration} mm.`,
          data: { union: u.id, largo, entra: roundTo(entra) },
          alternatives: sugerido ? [{ key: 'tornillo-mas-largo', description: `Usar ${sugerido.nombre.toLowerCase()}`, data: { herrajeId: sugerido.id } }] : [],
        })
      } else {
        const maximo = ASSUMPTIONS.screws.pocketScrews.find((f) => ta <= f.upTo)?.length
        if (maximo === undefined || largo <= maximo + 0.5) continue
        encontrados.push({
          code: 'R3_TORNILLOS',
          severity: 'recomendacion',
          pieces: [u.a, u.b],
          message: `En ${a.nombre} de ${ta} mm, un tornillo de bolsillo de ${pulgadas(largo)} puede asomarse; para ese espesor va de ${pulgadas(maximo)}.`,
          data: { union: u.id, largo, maximo },
          alternatives: [{ key: 'tornillo-bolsillo-corto', description: `Tornillo de bolsillo de ${pulgadas(maximo)}`, data: { largo: maximo } }],
        })
      }
    }

    const junta = jointLength(cajaA, cajaB)
    const cantidad = u.herrajes.reduce((n, h) => n + (h.cantidad ?? 2), 0)
    if (u.tipo === 'tope-tornillo' && !porLaCara && junta > 0 && cantidad >= 2 && junta < 2 * ASSUMPTIONS.screws.endDistance + 20)
      encontrados.push({
        code: 'R3_TORNILLOS',
        severity: 'recomendacion',
        pieces: [u.a, u.b],
        message: `La junta entre ${a.nombre} y ${b.nombre} mide ${roundTo(junta, 0)} mm: dos tornillos quedarían a menos de ${ASSUMPTIONS.screws.endDistance} mm del extremo y pueden rajar el canto.`,
        data: { union: u.id, junta: roundTo(junta, 0) },
        alternatives: [
          { key: 'un-tornillo', description: 'Un solo tornillo al centro', data: { cantidad: 1 } },
          { key: 'tarugo', description: 'Tarugo con pegamento', data: { tipo: 'tarugo' } },
        ],
      })
    return encontrados
  })
