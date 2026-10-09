import { ArrowCounterClockwise, Check, Stack, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import { describePlanChanges, moduleLabels, moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { isLocked } from '../../domain/furniture/saving/saving'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { TERMS } from '../glossary'
import { Button } from '../system/components'
import { ErrorText } from '../system/Field'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'
import { draftOf, useStore } from '../store'
import { JointsSection } from './Joints'
import { PlanFields, type Locks } from './PlanFields'
import { FinishSection } from './FinishSection'
import { SavingSheet } from './SavingSheet'
import { useSavingSearch } from './savingSearch'

// The plan as a form: every decision that shapes the piece of furniture, shown in 3D as a draft and applied without the expert.

/** What the expert changed outside the plan: left behind if the plan is applied, or carried on top of it. */
export function PlanSourceNotes({ source }: { source: ReturnType<typeof currentPlan> }) {
  return (
    <>
      {source.diverged && (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-kraft p-3 text-xs">
          <Warning className="mt-0.5 shrink-0" weight="bold" /> Desde la v{source.since} hubo cambios con el experto que no están en la ficha. Si aplicas la ficha, el mueble vuelve a armarse desde ella y esos cambios se pierden.
        </p>
      )}

      {!source.diverged && source.extras.length > 0 && (
        <p className="rounded-xl bg-kraft/60 p-3 text-xs text-graphite">
          Encima de la ficha {source.extras.length === 1 ? 'hay un cambio hecho' : `hay ${source.extras.length} cambios hechos`} con el experto. Se conservan al aplicar; si alguno ya no tiene dónde ir, te aviso.
        </p>
      )}
    </>
  )
}

export function PlanSheet({ state }: { state: DesignState }) {
  const editPlan = useStore((s) => s.editPlan)
  const applyPlanDraft = useStore((s) => s.applyPlanDraft)
  const discardPlanDraft = useStore((s) => s.discardPlanDraft)
  const pending = useStore(draftOf)
  const lockField = useStore((s) => s.lockField)
  const help = useHelp<'saveMaterial'>()
  const source = useMemo(() => currentPlan(state), [state])
  const draft = pending?.plan ?? source.plan
  const saving = useSavingSearch(draft)
  const { search, searching } = saving
  const [message, setMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)
  // A new plan from outside (another version, the expert) leaves the search behind.
  const [synced, setSynced] = useState(source.plan)
  if (synced !== source.plan) {
    setSynced(source.plan)
    saving.reset()
  }

  if (!source.plan || !draft)
    return (
      <div className="flex flex-col gap-2 p-6 text-center text-sm text-graphite">
        <p className="font-medium text-graphite">Este mueble no tiene ficha</p>
        <p>La ficha aparece cuando el mueble es {moduleLabels()}. Lo demás se ajusta con el experto.</p>
      </div>
    )

  const changes = describePlanChanges(source.plan, draft)
  const set = (plan: FurniturePlan, typed?: string) => {
    setMessage(null)
    editPlan(plan, typed)
  }

  const locks: Locks = { locked: (field) => isLocked(field, state.locks), toggle: lockField }

  if (search)
    return (
      <div className="flex min-h-full flex-col p-4">
        <SavingSheet
          search={search}
          onBack={saving.close}
          onUse={(option) => {
            saving.close()
            set(option.plan)
          }}
          onRelease={saving.release}
        />
      </div>
    )

  const apply = () => {
    const r = applyPlanDraft()
    setMessage(r.ok ? (r.notes.length ? { kind: 'note', text: r.notes.join(' ') } : null) : { kind: 'error', text: r.message })
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-28">
      <PlanSourceNotes source={source} />

      <p className="-mb-2 text-sm text-graphite">Fija lo que no se mueve; lo demás puede cambiar para ahorrar material.</p>
      <PlanFields module={moduleOf(draft)} plan={draft} onChange={set} locks={locks} afterMeasures={<FinishSection state={state} />} />

      <JointsSection design={currentDesign(state)} />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {pending?.message && !message && <ErrorText>{pending.message}</ErrorText>}
        {message && (message.kind === 'error' ? <ErrorText>{message.text}</ErrorText> : <p className="text-xs text-graphite">{message.text}</p>)}
        <p className="text-xs text-graphite">{changes.length ? `Cambios: ${changes.join(', ')}.` : 'Sin cambios todavía.'}</p>
        {help.open && <HelpPanel term={TERMS[help.open]} onClose={help.close} />}
        <div className="flex items-center gap-1">
          <Button variant="secondary" className="min-h-11 flex-1" disabled={searching} onClick={saving.start}>
            <Stack /> {searching ? 'Buscando…' : TERMS.saveMaterial.name}
          </Button>
          <HelpButton term={TERMS.saveMaterial} open={help.open === 'saveMaterial'} onToggle={() => help.toggle('saveMaterial')} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!changes.length} onClick={apply}>
            <Check weight="fill" /> Aplicar
          </Button>
          <Button variant="ghost" disabled={!changes.length} onClick={discardPlanDraft}>
            <ArrowCounterClockwise /> Descartar
          </Button>
        </div>
      </div>
    </div>
  )
}
