import { Stack } from '@phosphor-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { currentPlan } from '../../application/useCases'
import { moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import type { PartSpec } from '../../domain/furniture/modules/parts'
import { FINISHES, finishOf } from '../../domain/materials/finishes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { draftOf, useStore } from '../store'
import { TERMS } from '../glossary'
import { PartSheet } from './PartSheet'
import { PlanSourceNotes } from './PlanSheet'
import { SavingSheet } from './SavingSheet'
import { useSavingSearch } from './savingSearch'
import { sideSteps } from './steps'
import { StepRow } from './StepRow'

// The parts of one side of the furniture being edited (UI-39, UI-74), as numbered steps (UI-92): each says how it is now, and the open one shows its sheet in place, the same one touching it on the furniture opens.

/** `kindStep`: the steps are on the strip (UI-93), so the panel shows only the open one, and this while no part is open. */
export function PartsList({ state, plan, side, first = 1, kindStep }: { state: DesignState; plan: FurniturePlan; side: PartSpec<FurniturePlan>['side']; first?: number; kindStep?: ReactNode }) {
  const selectPart = useStore((s) => s.selectPart)
  const editPlan = useStore((s) => s.editPlan)
  const draft = useStore(draftOf)
  const active = useStore((s) => s.part)
  // Only the open step's row is brought into view, so a part touched on the furniture shows without hiding the steps before it.
  const opened = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    opened.current?.scrollIntoView({ block: 'nearest' })
  }, [active?.id])
  const saving = useSavingSearch(plan)
  const parts = moduleOf(plan).parts.list as PartSpec<FurniturePlan>[]
  const finish = FINISHES[finishOf(currentDesign(state))].name
  const open = (part: PartSpec<FurniturePlan>) => selectPart(part.id)

  if (saving.search)
    return (
      <div className="flex min-h-full flex-col p-4">
        <SavingSheet
          search={saving.search}
          onBack={saving.close}
          onUse={(option) => {
            saving.close()
            editPlan(option.plan)
          }}
          onRelease={saving.release}
        />
      </div>
    )

  const steps = sideSteps(plan, side, finish, active?.id ?? null, first)
  const openStep = steps.find((s) => s.active)
  const group = kindStep !== undefined ? (
    openStep && active ? <PartSheet key={openStep.id} inline state={state} plan={plan} design={currentDesign(state)} part={active} number={openStep.number} /> : kindStep
  ) : (
    <section className="flex flex-col" aria-label="Pasos">
      <ol className="flex flex-col">
        {steps.map((step) => {
          const spec = parts.find((p) => p.id === step.id)!
          return (
            <li key={step.id} className="border-b border-line">
              <StepRow ref={step.active ? opened : undefined} number={step.number} name={step.name} summary={step.summary} active={step.active} onToggle={() => (step.active ? selectPart(null) : open(spec))} />
              {step.active && active && <PartSheet inline state={state} plan={plan} design={currentDesign(state)} part={active} />}
            </li>
          )
        })}
      </ol>
    </section>
  )

  return (
    <div className="flex flex-col pb-4">
      <div className="px-4 pt-4 empty:hidden">
        <PlanSourceNotes source={currentPlan(state)} />
      </div>
      {group}
      {side === 'outside' && (
        <div className="flex flex-col gap-2 px-4 pt-4">
          <Button variant="secondary" className="min-h-11" disabled={saving.searching} onClick={saving.start}>
            <Stack /> {saving.searching ? 'Buscando…' : TERMS.saveMaterial.name}
          </Button>
          {draft && <p className="text-xs text-graphite-2">Busca sobre los cambios sin aplicar.</p>}
        </div>
      )}
    </div>
  )
}
