import { analyze } from '../domain/checks/analysis'
import { parseIntent } from '../domain/furniture/intent/intent'
import { rebuildFromPlan } from '../domain/furniture/modules/rebuild'
import type { Catalog } from '../domain/materials/catalog'
import { currentDesign, type DesignState } from '../domain/session/state'
import { currentPlan } from './useCases/currentPlan'

/** In the order they are offered: what a person changes first, then what the piece has, then how it is built, then the way back. */
const REQUESTS = [
  'Dale 10 cm más de ancho',
  'Dale 20 cm más de largo',
  'Dale 10 cm más de alto',
  'Ponle puertas',
  'Puertas corredizas',
  'Ponle patas',
  'Con cuatro patas',
  'Agrégale una repisa',
  'Agrégale un cajón',
  'Con repisa baja',
  'Cajonera a la derecha',
  'Colchón matrimonial',
  'Colchón queen',
  'Cabecera lisa',
  'Cabecera librero',
  'Cajones del lado izquierdo',
  'Base de tablillas',
  'Con zoclo',
  'Sin zoclo',
  'Ánclalo al muro',
  'Cubierta de esquinas redondeadas',
  'Desarmable con pernos',
  'Dale 5 cm más de fondo',
  'Quítale 10 cm de ancho',
  'Quítale 10 cm de alto',
  'Quítale 5 cm de fondo',
  'Quítale una repisa',
  'Quítale un cajón',
  'Cajonera a la izquierda',
  'Colchón king',
  'Cajones de los dos lados',
]

/** The first few requests that read as a change to the live plan and build a valid piece, one for each field; none while a proposal waits. */
export function quickActions(state: DesignState, catalog: Catalog, limit = 6): string[] {
  const { plan, extras, diverged } = currentPlan(state)
  if (!plan || diverged || state.proposal) return []
  const design = currentDesign(state)
  const fields = new Set<string>()
  const offered: string[] = []
  for (const request of REQUESTS) {
    if (offered.length === limit) break
    const intent = parseIntent(request, plan, design, catalog)
    if (intent?.kind !== 'edit' || intent.plan === plan || fields.has(intent.field)) continue
    if (!analyze(rebuildFromPlan(intent.plan, extras, catalog, state.requirements).design, catalog, state.requirements).valid) continue
    fields.add(intent.field)
    offered.push(request)
  }
  return offered
}
