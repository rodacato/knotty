import type { Carga, Pieza } from '../../diseno/esquema'
import { roundTo, type Box } from '../../diseno/resolve'
import type { Catalogo } from '../../materiales/catalogo'
import type { Alternative, Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

const NOMBRE_CARGA: Record<Carga, string> = { ninguna: 'sin carga', ligera: 'carga ligera', media: 'carga media', pesada: 'libros' }

/** Viga simplemente apoyada con carga uniforme: δ = 5·w·L⁴ / (384·E·I) × fluencia. En mm. */
export function deflection(claro: number, fondo: number, espesor: number, carga: Carga, moduloE: number) {
  const w = (ASSUMPTIONS.loads[carga] * ASSUMPTIONS.gravity * fondo) / 1e6
  const inercia = (fondo * espesor ** 3) / 12
  return ((5 * w * claro ** 4) / (384 * moduloE * inercia)) * ASSUMPTIONS.creep
}

/** El claro más largo con el que la flecha no pasa de claro / límite recomendado. */
export function maxSpan(fondo: number, espesor: number, carga: Carga, moduloE: number) {
  const w = (ASSUMPTIONS.loads[carga] * ASSUMPTIONS.gravity * fondo) / 1e6
  const inercia = (fondo * espesor ** 3) / 12
  return Math.cbrt((384 * moduloE * inercia) / (5 * w * ASSUMPTIONS.creep * ASSUMPTIONS.deflectionLimit.recommended))
}

export function deflectionSeverity(delta: number, claro: number): Severity | null {
  if (delta > claro / ASSUMPTIONS.deflectionLimit.critical) return 'critico'
  if (delta > claro / ASSUMPTIONS.deflectionLimit.recommended) return 'recomendacion'
  return null
}

function moduloSegunVeta(p: Pieza, caja: Box) {
  const ladoLargoEsX = caja.x1 - caja.x0 >= caja.z1 - caja.z0
  const vetaEnX = p.veta === 'largo' ? ladoLargoEsX : p.veta === 'ancho' ? !ladoLargoEsX : false
  return vetaEnX ? ASSUMPTIONS.elasticModulus.parallel : ASSUMPTIONS.elasticModulus.perpendicular
}

/** El claro libre más largo entre apoyos verticales: los que tocan sus extremos o la sostienen desde abajo. */
export function freeSpan(id: string, caja: Box, ctx: Parameters<Rule>[0]) {
  const apoyos = ctx.contacts
    .filter((c) => c.a === id || c.b === id)
    .map((c) => (c.a === id ? c.b : c.a))
    .filter((otro) => {
      const pieza = ctx.design.piezas.find((p) => p.id === otro)
      const o = ctx.geo.boxes.get(otro)
      if (!pieza || !o || pieza.normal !== 'x' || pieza.rol === 'puerta') return false
      return Math.abs(o.x1 - caja.x0) <= 0.5 || Math.abs(o.x0 - caja.x1) <= 0.5 || Math.abs(o.y1 - caja.y0) <= 0.5
    })
    .map((otro) => ctx.geo.boxes.get(otro)!)
    .sort((a, b) => a.x0 - b.x0)
  if (apoyos.length < 2) return null
  let claro = 0
  for (let i = 1; i < apoyos.length; i++) claro = Math.max(claro, apoyos[i].x0 - Math.max(...apoyos.slice(0, i).map((a) => a.x1)))
  return claro > 0 ? claro : null
}

function alternativas(p: Pieza, claro: number, fondo: number, espesor: number, carga: Carga, moduloE: number, catalogo: Catalogo): Alternative[] {
  const lista: Alternative[] = []
  const siguiente = catalogo.materiales.filter((m) => m.tipo === 'triplay' && m.espesor > espesor).sort((a, b) => a.espesor - b.espesor)[0]
  if (siguiente)
    lista.push({
      key: 'subir-espesor',
      description: `Subir a ${siguiente.nombre}`,
      data: { material: siguiente.id, flecha: roundTo(deflection(claro, fondo, siguiente.espesor, carga, moduloE)) },
    })
  const mitad = (claro - espesor) / 2
  lista.push({
    key: 'divisor-al-centro',
    description: p.rol === 'piso' ? 'Agregar un apoyo al centro, debajo del piso' : 'Agregar un divisor vertical al centro',
    data: { claro: roundTo(mitad, 0), flecha: roundTo(deflection(mitad, fondo, espesor, carga, moduloE)) },
  })
  lista.push({ key: 'claro-maximo', description: `Claro máximo con ${espesor} mm`, data: { claro: roundTo(maxSpan(fondo, espesor, carga, moduloE), 0) } })
  return lista
}

export const deflectionRule: Rule = (ctx) =>
  ctx.design.piezas.flatMap((p): Finding[] => {
    const caja = ctx.geo.boxes.get(p.id)
    const espesor = ctx.geo.thicknesses.get(p.id)
    if (!caja || !espesor || p.normal !== 'y' || p.carga === 'ninguna') return []
    const claro = freeSpan(p.id, caja, ctx)
    if (!claro) return []
    const fondo = caja.z1 - caja.z0
    const moduloE = moduloSegunVeta(p, caja)
    const delta = deflection(claro, fondo, espesor, p.carga, moduloE)
    const severidad = deflectionSeverity(delta, claro)
    if (!severidad) return []
    const limite = claro / ASSUMPTIONS.deflectionLimit.recommended
    return [
      {
        code: 'R1_FLECHA',
        severity: severidad,
        pieces: [p.id],
        message: `${p.nombre} se pandearía ~${roundTo(delta)} mm con ${NOMBRE_CARGA[p.carga]} en un claro de ${roundTo(claro, 0)} mm (lo aceptable es hasta ${roundTo(limite)} mm).`,
        data: { claro: roundTo(claro, 0), fondo: roundTo(fondo, 0), espesor, carga: p.carga, flecha: roundTo(delta), limite: roundTo(limite), moduloE },
        alternatives: alternativas(p, claro, fondo, espesor, p.carga, moduloE, ctx.catalog),
      },
    ]
  })
