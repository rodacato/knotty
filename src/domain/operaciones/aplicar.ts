import { entre } from '../diseno/construir'
import { DIMENSION_DE_EJE, EJES, type Cota, type Diseno, type Eje, type Pieza, type Tramo } from '../diseno/esquema'
import { parseCara, resolver, type Geometria } from '../diseno/resolver'
import { materialPorId, type Catalogo } from '../materiales/catalogo'
import { contactoEntre } from '../validacion/contacto'
import { error, exito, fallo, type AvisoDiseno, type ErrorDiseno, type Resultado } from '../validacion/errores'
import type { Operacion } from './esquema'

export interface Aplicado {
  diseno: Diseno
  avisos: AvisoDiseno[]
}

class OperacionInvalida extends Error {
  constructor(readonly detalle: ErrorDiseno) {
    super(detalle.mensaje)
  }
}

const invalida = (codigo: ErrorDiseno['codigo'], mensaje: string, datos?: Record<string, unknown>) => new OperacionInvalida(error(codigo, mensaje, datos))

const refiereA = (cota: Cota | null, id: string) =>
  !!cota && ((cota.tipo === 'ref' && parseCara(cota.ref).pieza === id) || (cota.tipo === 'entre' && [cota.a, cota.b].some((r) => parseCara(r).pieza === id)))

/** Aplica las operaciones en orden sobre una copia. Si una falla, no se aplica ninguna. */
export function aplicar(original: Diseno, operaciones: Operacion[], catalogo: Catalogo): Resultado<Aplicado> {
  const diseno = structuredClone(original)
  const avisos: AvisoDiseno[] = []

  const geometria = (): Geometria => {
    const r = resolver(diseno, catalogo)
    if (!r.ok) throw new OperacionInvalida(r.errores[0])
    return r.valor
  }
  const pieza = (id: string) => {
    const p = diseno.piezas.find((x) => x.id === id)
    if (!p) throw invalida('E_PIEZA_INEXISTENTE', `No existe la pieza "${id}".`, { pieza: id })
    return p
  }
  const idLibre = (id: string) => {
    if (diseno.piezas.some((p) => p.id === id)) throw invalida('E_ID_DUPLICADO', `Ya existe una pieza "${id}".`, { pieza: id })
  }

  function eliminar(id: string) {
    pieza(id)
    const geo = geometria()
    const congeladas = new Set<string>()
    for (const p of diseno.piezas) {
      if (p.id === id) continue
      for (const eje of EJES)
        for (const extremo of ['desde', 'hasta'] as const) {
          const cota = p[eje][extremo]
          if (!refiereA(cota, id)) continue
          p[eje][extremo] = { tipo: 'mm', mm: geo.valor(cota!, eje) }
          congeladas.add(p.id)
        }
    }
    diseno.piezas = diseno.piezas.filter((p) => p.id !== id)
    diseno.uniones = diseno.uniones.filter((u) => u.a !== id && u.b !== id)
    if (congeladas.size)
      avisos.push({ codigo: 'A_REFERENCIA_CONGELADA', mensaje: `Al quitar "${id}", ${[...congeladas].join(', ')} quedaron fijas en mm.`, datos: { pieza: id, afectadas: [...congeladas] } })
  }

  function colocar(p: Pieza, eje: Eje, cota: Cota, largo: number) {
    p[eje] = eje === p.normal ? { desde: cota, hasta: null, largo: null } : { desde: cota, hasta: null, largo }
  }
  const largoDe = (id: string, eje: Eje, geo: Geometria) => geo.cajas.get(id)![`${eje}1`] - geo.cajas.get(id)![`${eje}0`]

  const aplicarUna = (op: Operacion) => {
    switch (op.op) {
      case 'agregarPieza':
        idLibre(op.pieza.id)
        diseno.piezas.push(structuredClone(op.pieza))
        return
      case 'eliminarPieza':
        return eliminar(op.id)
      case 'eliminarGrupo': {
        const ids = diseno.piezas.filter((p) => p.grupo === op.grupo).map((p) => p.id)
        if (!ids.length) throw invalida('E_PIEZA_INEXISTENTE', `No hay piezas en el grupo "${op.grupo}".`, { grupo: op.grupo })
        return ids.forEach(eliminar)
      }
      case 'duplicarPieza': {
        const origen = pieza(op.id)
        idLibre(op.nuevoId)
        const geo = geometria()
        const copia: Pieza = { ...structuredClone(origen), id: op.nuevoId, nombre: op.nombre }
        colocar(copia, op.eje, op.cota, largoDe(op.id, op.eje, geo))
        diseno.piezas.push(copia)
        const copiadas = diseno.uniones
          .filter((u) => u.a === op.id || u.b === op.id)
          .map((u) => ({ ...structuredClone(u), id: `${u.id}-${op.nuevoId}`, a: u.a === op.id ? op.nuevoId : u.a, b: u.b === op.id ? op.nuevoId : u.b }))
        const despues = resolver(diseno, catalogo)
        diseno.uniones.push(
          ...copiadas.filter((u) => {
            if (!despues.ok) return true
            const { cajas } = despues.valor
            return !!cajas.get(u.a) && !!cajas.get(u.b) && !!contactoEntre(u.a, cajas.get(u.a)!, u.b, cajas.get(u.b)!)
          }),
        )
        return
      }
      case 'redimensionar': {
        const p = pieza(op.id)
        if (op.eje === p.normal) throw invalida('E_OPERACION_INVALIDA', `"${p.id}" tiene su espesor en ${op.eje}; para eso usa cambiarEspesor o mover.`, { pieza: p.id, eje: op.eje })
        const caja = geometria().cajas.get(p.id)!
        const actual = p[op.eje]
        const nuevo: Tramo =
          op.extremo === 'desde'
            ? { desde: op.cota, hasta: actual.hasta ?? { tipo: 'mm', mm: caja[`${op.eje}1`] }, largo: null }
            : { desde: actual.desde ?? { tipo: 'mm', mm: caja[`${op.eje}0`] }, hasta: op.cota, largo: null }
        p[op.eje] = nuevo
        return
      }
      case 'mover': {
        const p = pieza(op.id)
        return colocar(p, op.eje, op.cota, largoDe(p.id, op.eje, geometria()))
      }
      case 'distribuir': {
        const piezas = op.ids.map(pieza)
        const fuera = piezas.find((p) => p.normal !== op.eje)
        if (fuera) throw invalida('E_OPERACION_INVALIDA', `Solo se reparte en el eje del espesor; "${fuera.id}" lo tiene en ${fuera.normal}.`, { pieza: fuera.id, eje: op.eje })
        const geo = geometria()
        const n = piezas.length
        piezas
          .sort((a, b) => geo.cajas.get(a.id)![`${op.eje}0`] - geo.cajas.get(b.id)![`${op.eje}0`])
          .forEach((p, i) => {
            const espesor = geo.espesores.get(p.id)!
            p[op.eje] = { desde: entre(op.a, op.b, (i + 1) / (n + 1), (espesor * (i - n)) / (n + 1)), hasta: null, largo: null }
          })
        return
      }
      case 'cambiarEspesor': {
        if (!materialPorId(catalogo, op.material)) throw invalida('E_ESPESOR_CATALOGO', `El material "${op.material}" no está en el catálogo.`, { material: op.material })
        return op.ids.forEach((id) => (pieza(id).material = op.material))
      }
      case 'cambiarPropiedades': {
        const p = pieza(op.id)
        for (const campo of ['nombre', 'rol', 'veta', 'carga', 'apoyo', 'cantos'] as const) if (op[campo] !== null) Object.assign(p, { [campo]: op[campo] })
        return
      }
      case 'agregarUnion':
        if (diseno.uniones.some((u) => u.id === op.union.id)) throw invalida('E_ID_DUPLICADO', `Ya existe una unión "${op.union.id}".`, { union: op.union.id })
        diseno.uniones.push(structuredClone(op.union))
        return
      case 'cambiarUnion': {
        const i = diseno.uniones.findIndex((u) => u.id === op.union.id)
        if (i < 0) throw invalida('E_UNION_INEXISTENTE', `No existe la unión "${op.union.id}".`, { union: op.union.id })
        diseno.uniones[i] = structuredClone(op.union)
        return
      }
      case 'eliminarUnion':
        if (!diseno.uniones.some((u) => u.id === op.id)) throw invalida('E_UNION_INEXISTENTE', `No existe la unión "${op.id}".`, { union: op.id })
        diseno.uniones = diseno.uniones.filter((u) => u.id !== op.id)
        return
      case 'cambiarDimensionGlobal': {
        const clave = DIMENSION_DE_EJE[op.eje]
        const factor = op.valor / diseno.dimensiones[clave]
        diseno.dimensiones[clave] = op.valor
        if (op.regla === 'proporcional')
          for (const p of diseno.piezas) {
            const t = p[op.eje]
            for (const extremo of ['desde', 'hasta'] as const) {
              const cota = t[extremo]
              if (cota?.tipo === 'mm') t[extremo] = { tipo: 'mm', mm: cota.mm * factor }
            }
            if (t.largo !== null && op.eje !== p.normal) t.largo *= factor
          }
        return
      }
      case 'cambiarAnclajeMuro':
        diseno.anclajeMuro = op.valor
        return
    }
  }

  for (const [i, op] of operaciones.entries()) {
    try {
      aplicarUna(op)
    } catch (e) {
      if (!(e instanceof OperacionInvalida)) throw e
      return fallo([{ ...e.detalle, datos: { ...e.detalle.datos, operacion: i, op: op.op } }])
    }
  }
  return exito({ diseno, avisos })
}
