import type { Carga, Pieza } from '../../diseno/esquema'
import { redondear, type Caja } from '../../diseno/resolver'
import type { Catalogo } from '../../materiales/catalogo'
import type { Alternativa, Hallazgo, Regla, Severidad } from '../hallazgo'
import { SUPUESTOS } from '../supuestos'

const NOMBRE_CARGA: Record<Carga, string> = { ninguna: 'sin carga', ligera: 'carga ligera', media: 'carga media', pesada: 'libros' }

/** Viga simplemente apoyada con carga uniforme: δ = 5·w·L⁴ / (384·E·I) × fluencia. En mm. */
export function flecha(claro: number, fondo: number, espesor: number, carga: Carga, moduloE: number) {
  const w = (SUPUESTOS.cargas[carga] * SUPUESTOS.gravedad * fondo) / 1e6
  const inercia = (fondo * espesor ** 3) / 12
  return ((5 * w * claro ** 4) / (384 * moduloE * inercia)) * SUPUESTOS.fluencia
}

/** El claro más largo con el que la flecha no pasa de claro / límite recomendado. */
export function claroMaximo(fondo: number, espesor: number, carga: Carga, moduloE: number) {
  const w = (SUPUESTOS.cargas[carga] * SUPUESTOS.gravedad * fondo) / 1e6
  const inercia = (fondo * espesor ** 3) / 12
  return Math.cbrt((384 * moduloE * inercia) / (5 * w * SUPUESTOS.fluencia * SUPUESTOS.limiteFlecha.recomendacion))
}

export function severidadFlecha(delta: number, claro: number): Severidad | null {
  if (delta > claro / SUPUESTOS.limiteFlecha.critico) return 'critico'
  if (delta > claro / SUPUESTOS.limiteFlecha.recomendacion) return 'recomendacion'
  return null
}

function moduloSegunVeta(p: Pieza, caja: Caja) {
  const ladoLargoEsX = caja.x1 - caja.x0 >= caja.z1 - caja.z0
  const vetaEnX = p.veta === 'largo' ? ladoLargoEsX : p.veta === 'ancho' ? !ladoLargoEsX : false
  return vetaEnX ? SUPUESTOS.moduloElasticidad.paralela : SUPUESTOS.moduloElasticidad.perpendicular
}

/** El claro libre más largo entre apoyos verticales: los que tocan sus extremos o la sostienen desde abajo. */
export function claroLibre(id: string, caja: Caja, ctx: Parameters<Regla>[0]) {
  const apoyos = ctx.contactos
    .filter((c) => c.a === id || c.b === id)
    .map((c) => (c.a === id ? c.b : c.a))
    .filter((otro) => {
      const pieza = ctx.diseno.piezas.find((p) => p.id === otro)
      const o = ctx.geo.cajas.get(otro)
      if (!pieza || !o || pieza.normal !== 'x' || pieza.rol === 'puerta') return false
      return Math.abs(o.x1 - caja.x0) <= 0.5 || Math.abs(o.x0 - caja.x1) <= 0.5 || Math.abs(o.y1 - caja.y0) <= 0.5
    })
    .map((otro) => ctx.geo.cajas.get(otro)!)
    .sort((a, b) => a.x0 - b.x0)
  if (apoyos.length < 2) return null
  let claro = 0
  for (let i = 1; i < apoyos.length; i++) claro = Math.max(claro, apoyos[i].x0 - Math.max(...apoyos.slice(0, i).map((a) => a.x1)))
  return claro > 0 ? claro : null
}

function alternativas(p: Pieza, claro: number, fondo: number, espesor: number, carga: Carga, moduloE: number, catalogo: Catalogo): Alternativa[] {
  const lista: Alternativa[] = []
  const siguiente = catalogo.materiales.filter((m) => m.tipo === 'triplay' && m.espesor > espesor).sort((a, b) => a.espesor - b.espesor)[0]
  if (siguiente)
    lista.push({
      clave: 'subir-espesor',
      descripcion: `Subir a ${siguiente.nombre}`,
      datos: { material: siguiente.id, flecha: redondear(flecha(claro, fondo, siguiente.espesor, carga, moduloE)) },
    })
  const mitad = (claro - espesor) / 2
  lista.push({
    clave: 'divisor-al-centro',
    descripcion: p.rol === 'piso' ? 'Agregar un apoyo al centro, debajo del piso' : 'Agregar un divisor vertical al centro',
    datos: { claro: redondear(mitad, 0), flecha: redondear(flecha(mitad, fondo, espesor, carga, moduloE)) },
  })
  lista.push({ clave: 'claro-maximo', descripcion: `Claro máximo con ${espesor} mm`, datos: { claro: redondear(claroMaximo(fondo, espesor, carga, moduloE), 0) } })
  return lista
}

export const reglaFlecha: Regla = (ctx) =>
  ctx.diseno.piezas.flatMap((p): Hallazgo[] => {
    const caja = ctx.geo.cajas.get(p.id)
    const espesor = ctx.geo.espesores.get(p.id)
    if (!caja || !espesor || p.normal !== 'y' || p.carga === 'ninguna') return []
    const claro = claroLibre(p.id, caja, ctx)
    if (!claro) return []
    const fondo = caja.z1 - caja.z0
    const moduloE = moduloSegunVeta(p, caja)
    const delta = flecha(claro, fondo, espesor, p.carga, moduloE)
    const severidad = severidadFlecha(delta, claro)
    if (!severidad) return []
    const limite = claro / SUPUESTOS.limiteFlecha.recomendacion
    return [
      {
        codigo: 'R1_FLECHA',
        severidad,
        piezas: [p.id],
        mensaje: `${p.nombre} se pandearía ~${redondear(delta)} mm con ${NOMBRE_CARGA[p.carga]} en un claro de ${redondear(claro, 0)} mm (lo aceptable es hasta ${redondear(limite)} mm).`,
        datos: { claro: redondear(claro, 0), fondo: redondear(fondo, 0), espesor, carga: p.carga, flecha: redondear(delta), limite: redondear(limite), moduloE },
        alternativas: alternativas(p, claro, fondo, espesor, p.carga, moduloE, ctx.catalogo),
      },
    ]
  })
