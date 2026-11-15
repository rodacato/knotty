import { EXPORT_MODES, type ExportMode } from './exportIdentity'

export type Role = Exclude<ExportMode, 'complete'>
export type RouteStep = { number: string; id: string; label: string }
export type RouteRole = { role: Role; name: string; steps: RouteStep[] }

const STEPS: { role: Role; id: string; label: string; phases?: true }[] = [
  { role: 'yard', id: 'cuts', label: 'Lista de corte' },
  { role: 'yard', id: 'machining', label: 'Mecanizado y perfiles' },
  { role: 'assembly', id: 'purchase', label: 'Compra de herrajes y consumibles' },
  { role: 'assembly', id: 'assembly', label: 'Armado por fases', phases: true },
  { role: 'assembly', id: 'fit', label: 'Ajustes e instalación' },
]

/**
 * The guide as one numbered route (UI-93): the lumberyard's work first, then the assembly at home, each under its role.
 * The numbers run across the whole route, so a mode that prints one role keeps the numbers of the complete guide.
 */
export function route(mode: ExportMode, hasPhases: boolean): RouteRole[] {
  const steps = STEPS.filter((s) => hasPhases || !s.phases).map((s, i) => ({ ...s, number: String(i + 1).padStart(2, '0') }))
  return (['yard', 'assembly'] as const)
    .filter((role) => mode === 'complete' || mode === role)
    .map((role) => ({ role, name: EXPORT_MODES[role], steps: steps.filter((s) => s.role === role).map(({ number, id, label }) => ({ number, id, label })) }))
}
