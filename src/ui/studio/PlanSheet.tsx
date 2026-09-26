import { ArrowCounterClockwise, Check, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import { describePlanChanges, moduleLabels, moduleOf, type FurniturePlan } from '../../domain/modules/plan'
import type { DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { useStore } from '../store'
import { PlanFields } from './PlanFields'

// The plan as a form: every decision that shapes the piece of furniture, applied at once and without the expert.

export function PlanSheet({ state }: { state: DesignState }) {
  const applyPlan = useStore((s) => s.applyPlan)
  const source = useMemo(() => currentPlan(state), [state])
  const [draft, setDraft] = useState<FurniturePlan | null>(source.plan)
  const [message, setMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)
  // A new plan from outside (another version, the expert) replaces the draft.
  const [synced, setSynced] = useState(source.plan)
  if (synced !== source.plan) {
    setSynced(source.plan)
    setDraft(source.plan)
  }

  if (!source.plan || !draft)
    return (
      <div className="flex flex-col gap-2 p-6 text-center text-sm text-graphite-2">
        <p className="font-medium text-graphite">Este mueble no tiene ficha</p>
        <p>La ficha aparece cuando el mueble es {moduleLabels()}. Lo demás se ajusta con el experto.</p>
      </div>
    )

  const changes = describePlanChanges(source.plan, draft)
  const set = (plan: FurniturePlan) => {
    setMessage(null)
    setDraft(plan)
  }

  const apply = () => {
    const r = applyPlan(draft)
    setMessage(r.ok ? (r.notes.length ? { kind: 'note', text: r.notes.join(' ') } : null) : { kind: 'error', text: r.message })
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-28">
      {source.diverged && (
        <p className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber-soft p-3 text-xs">
          <Warning className="mt-0.5 shrink-0" weight="bold" /> Desde la v{source.since} hubo cambios con el experto que no están en la ficha. Si aplicas la ficha, el mueble vuelve a armarse desde ella y esos cambios se pierden.
        </p>
      )}

      {!source.diverged && source.extras.length > 0 && (
        <p className="rounded-xl bg-kraft/60 p-3 text-xs text-graphite-2">
          Encima de la ficha {source.extras.length === 1 ? 'hay un cambio hecho' : `hay ${source.extras.length} cambios hechos`} con el experto. Se conservan al aplicar; si alguno ya no tiene dónde ir, te aviso.
        </p>
      )}

      <PlanFields module={moduleOf(draft)} plan={draft} onChange={set} />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {message && <p className={`text-xs ${message.kind === 'error' ? 'text-rust' : 'text-graphite-2'}`}>{message.text}</p>}
        <p className="text-xs text-graphite-2">{changes.length ? `Cambios: ${changes.join(', ')}.` : 'Sin cambios todavía.'}</p>
        <div className="flex gap-2">
          <Button variant="primary" className="min-h-10 flex-1" disabled={!changes.length} onClick={apply}>
            <Check weight="bold" /> Aplicar
          </Button>
          <Button variant="ghost" className="min-h-10" disabled={!changes.length} onClick={() => set(source.plan!)}>
            <ArrowCounterClockwise /> Descartar
          </Button>
        </div>
      </div>
    </div>
  )
}
