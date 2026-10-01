import { ArrowCounterClockwise, Check, Stack, Warning } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import { describePlanChanges, moduleLabels, moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { isLocked, type SavingSearch } from '../../domain/furniture/saving/saving'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { TERMS } from '../glossary'
import { Button } from '../system/components'
import { ErrorText } from '../system/Field'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'
import { useStore } from '../store'
import { JointsSection } from './Joints'
import { PlanFields, type Locks } from './PlanFields'
import { FinishSection } from './FinishSection'
import { SavingSheet } from './SavingSheet'

// The plan as a form: every decision that shapes the piece of furniture, applied at once and without the expert.

export function PlanSheet({ state }: { state: DesignState }) {
  const applyPlan = useStore((s) => s.applyPlan)
  const lockField = useStore((s) => s.lockField)
  const findSavings = useStore((s) => s.findSavings)
  const previewFix = useStore((s) => s.previewFix)
  const help = useHelp<'saveMaterial'>()
  const [search, setSearch] = useState<SavingSearch | null>(null)
  const [searching, setSearching] = useState(false)
  const source = useMemo(() => currentPlan(state), [state])
  const [draft, setDraft] = useState<FurniturePlan | null>(source.plan)
  const [message, setMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)
  // A new plan from outside (another version, the expert) replaces the draft.
  const [synced, setSynced] = useState(source.plan)
  if (synced !== source.plan) {
    setSynced(source.plan)
    setDraft(source.plan)
    setSearch(null)
  }
  // The search is synchronous and takes a moment on a phone: the button says so before it starts.
  useEffect(() => {
    if (!searching || !draft) return
    const timer = setTimeout(() => {
      setSearch(findSavings(draft))
      setSearching(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [searching, draft, findSavings])
  // An option seen in 3D belongs to the results: leaving them hides it.
  useEffect(() => {
    if (search) return () => previewFix(null)
  }, [search, previewFix])

  if (!source.plan || !draft)
    return (
      <div className="flex flex-col gap-2 p-6 text-center text-sm text-graphite">
        <p className="font-medium text-graphite">Este mueble no tiene ficha</p>
        <p>La ficha aparece cuando el mueble es {moduleLabels()}. Lo demás se ajusta con el experto.</p>
      </div>
    )

  const changes = describePlanChanges(source.plan, draft)
  const set = (plan: FurniturePlan) => {
    setMessage(null)
    setDraft(plan)
  }

  const locks: Locks = { locked: (field) => isLocked(field, state.locks), toggle: lockField }
  const backToForm = () => {
    previewFix(null)
    setSearch(null)
  }

  if (search)
    return (
      <div className="flex min-h-full flex-col p-4">
        <SavingSheet
          search={search}
          onBack={backToForm}
          onUse={(option) => {
            backToForm()
            set(option.plan)
          }}
          onRelease={(key) => {
            lockField(key, false)
            setSearch(null)
            setSearching(true)
          }}
        />
      </div>
    )

  const apply = () => {
    const r = applyPlan(draft)
    setMessage(r.ok ? (r.notes.length ? { kind: 'note', text: r.notes.join(' ') } : null) : { kind: 'error', text: r.message })
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-28">
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

      <p className="-mb-2 text-sm text-graphite">Fija lo que no se mueve; lo demás puede cambiar para ahorrar material.</p>
      <PlanFields module={moduleOf(draft)} plan={draft} onChange={set} locks={locks} afterMeasures={<FinishSection state={state} />} />

      <JointsSection design={currentDesign(state)} />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {message && (message.kind === 'error' ? <ErrorText>{message.text}</ErrorText> : <p className="text-xs text-graphite">{message.text}</p>)}
        <p className="text-xs text-graphite">{changes.length ? `Cambios: ${changes.join(', ')}.` : 'Sin cambios todavía.'}</p>
        {help.open && <HelpPanel term={TERMS[help.open]} onClose={help.close} />}
        <div className="flex items-center gap-1">
          <Button variant="secondary" className="min-h-11 flex-1" disabled={searching} onClick={() => setSearching(true)}>
            <Stack /> {searching ? 'Buscando…' : TERMS.saveMaterial.name}
          </Button>
          <HelpButton term={TERMS.saveMaterial} open={help.open === 'saveMaterial'} onToggle={() => help.toggle('saveMaterial')} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="min-h-10 flex-1" disabled={!changes.length} onClick={apply}>
            <Check weight="fill" /> Aplicar
          </Button>
          <Button variant="ghost" className="min-h-10" disabled={!changes.length} onClick={() => set(source.plan!)}>
            <ArrowCounterClockwise /> Descartar
          </Button>
        </div>
      </div>
    </div>
  )
}
