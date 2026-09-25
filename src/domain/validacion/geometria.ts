import { DIMENSION_DE_EJE, EJES, type Diseno } from '../diseno/esquema'
import { medidasCara, redondear, type Geometria } from '../diseno/resolver'
import { hojaUtil, materialPorId, type Catalogo } from '../materiales/catalogo'
import { contactos, mismoPar, separacionEntre, TOLERANCIA_CONTACTO, type Contacto } from './contacto'
import { error, type AvisoDiseno, type ErrorDiseno } from './errores'

const TOLERANCIA_MEDIDA = 1
/** Separación máxima entre cajón y mueble que una corredera puede salvar. */
const HUECO_CORREDERA = 20
/** An inset door hangs in its opening with this much gap all around: its hinge joins pieces that do not touch. */
const HINGE_GAP = 4
const SIN_AVISO_DE_UNION = new Set(['puerta', 'frente-cajon'])

export interface ValidacionGeometrica {
  errores: ErrorDiseno[]
  avisos: AvisoDiseno[]
  contactos: Contacto[]
}

export function validarGeometria(diseno: Diseno, geo: Geometria, catalogo: Catalogo): ValidacionGeometrica {
  const errores: ErrorDiseno[] = []
  const avisos: AvisoDiseno[] = []
  const todos = contactos(geo.cajas)
  const porId = new Map(diseno.piezas.map((p) => [p.id, p]))

  const cajas = [...geo.cajas.values()]
  for (const eje of EJES) {
    const minimo = Math.min(...cajas.map((c) => c[`${eje}0`]))
    const maximo = Math.max(...cajas.map((c) => c[`${eje}1`]))
    const esperado = diseno.dimensiones[DIMENSION_DE_EJE[eje]]
    if (cajas.length && (Math.abs(minimo) > TOLERANCIA_MEDIDA || Math.abs(maximo - esperado) > TOLERANCIA_MEDIDA))
      errores.push(
        error('E_MEDIDA_GLOBAL', `Las piezas ocupan de ${redondear(minimo)} a ${redondear(maximo)} mm en ${DIMENSION_DE_EJE[eje]}, pero el mueble mide ${esperado} mm.`, {
          eje,
          desde: redondear(minimo),
          hasta: redondear(maximo),
          esperado,
        }),
      )
  }

  for (const u of diseno.uniones) {
    const faltan = [u.a, u.b].filter((id) => !porId.has(id))
    if (faltan.length) {
      errores.push(error('E_PIEZA_INEXISTENTE', `La unión "${u.id}" refiere ${faltan.map((f) => `"${f}"`).join(' y ')}, que no existe.`, { union: u.id, piezas: faltan }))
      continue
    }
    if (u.tipo === 'corredera') {
      const hueco = separacionEntre(geo.cajas.get(u.a)!, geo.cajas.get(u.b)!)
      if (!hueco || hueco.eje !== 'x' || hueco.distancia > HUECO_CORREDERA)
        errores.push(error('E_UNION_SIN_CONTACTO', `La corredera "${u.id}" necesita a "${u.a}" y "${u.b}" uno frente al otro a lo ancho, a menos de ${HUECO_CORREDERA} mm.`, { union: u.id, a: u.a, b: u.b }))
      continue
    }
    if (u.tipo === 'bisagra-cazoleta' && !todos.some((c) => mismoPar(c, u.a, u.b))) {
      const gap = separacionEntre(geo.cajas.get(u.a)!, geo.cajas.get(u.b)!)
      if (!gap || gap.distancia > HINGE_GAP)
        errores.push(error('E_UNION_SIN_CONTACTO', `La bisagra "${u.id}" necesita a "${u.a}" junto a "${u.b}", a menos de ${HINGE_GAP} mm.`, { union: u.id, a: u.a, b: u.b }))
      continue
    }
    if (!todos.some((c) => mismoPar(c, u.a, u.b)))
      errores.push(error('E_UNION_SIN_CONTACTO', `La unión "${u.id}" junta "${u.a}" y "${u.b}", pero no se tocan.`, { union: u.id, a: u.a, b: u.b }))
  }

  const conexiones = todos.filter((c) => {
    if (c.eje) return true
    const permitido = diseno.uniones.some((u) => mismoPar(u, c.a, c.b) && u.penetracion !== null && c.profundidad <= u.penetracion + TOLERANCIA_CONTACTO)
    if (!permitido) errores.push(error('E_TRASLAPE', `"${c.a}" y "${c.b}" se enciman ${redondear(c.profundidad)} mm.`, { a: c.a, b: c.b, profundidad: redondear(c.profundidad) }))
    return permitido
  })

  const correderas = diseno.uniones.filter((u) => (u.tipo === 'corredera' || u.tipo === 'bisagra-cazoleta') && geo.cajas.has(u.a) && geo.cajas.has(u.b))
  conexiones.push(...correderas.map((u) => ({ a: u.a, b: u.b, eje: 'x' as const, profundidad: 0 })))
  const alcanzadas = new Set([...geo.cajas].filter(([, c]) => c.y0 <= TOLERANCIA_CONTACTO).map(([id]) => id))
  for (let cambio = true; cambio; ) {
    cambio = false
    for (const c of conexiones) {
      if (alcanzadas.has(c.a) !== alcanzadas.has(c.b)) {
        alcanzadas.add(c.a).add(c.b)
        cambio = true
      }
    }
  }
  for (const id of geo.cajas.keys())
    if (!alcanzadas.has(id)) errores.push(error('E_FLOTANTE', `"${id}" no se apoya en nada: no toca ninguna pieza conectada al piso.`, { pieza: id }))

  for (const p of diseno.piezas) {
    const caja = geo.cajas.get(p.id)
    const material = materialPorId(catalogo, p.material)
    if (!caja || !material) continue
    const [largo, ancho] = medidasCara(caja, p.normal)
    const hoja = hojaUtil(catalogo, material)
    if (largo > hoja.largo || ancho > hoja.ancho)
      errores.push(
        error('E_NO_CABE_EN_HOJA', `"${p.id}" mide ${redondear(largo)} × ${redondear(ancho)} mm y la hoja útil es de ${hoja.largo} × ${hoja.ancho} mm.`, {
          pieza: p.id,
          largo: redondear(largo),
          ancho: redondear(ancho),
          hoja,
        }),
      )
  }

  for (const c of conexiones) {
    const a = porId.get(c.a)!
    const b = porId.get(c.b)!
    if ([a, b].some((p) => SIN_AVISO_DE_UNION.has(p.rol) || p.apoyo === 'movil')) continue
    if (!diseno.uniones.some((u) => mismoPar(u, c.a, c.b)))
      avisos.push({ codigo: 'A_CONTACTO_SIN_UNION', mensaje: `"${c.a}" y "${c.b}" se tocan pero no tienen unión.`, datos: { a: c.a, b: c.b } })
  }

  return { errores, avisos, contactos: todos }
}
