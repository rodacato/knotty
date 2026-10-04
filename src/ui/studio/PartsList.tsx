import { CaretRight, Stack } from '@phosphor-icons/react'
import { currentPlan } from '../../application/useCases'
import { moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { partName, type PartSpec } from '../../domain/furniture/modules/parts'
import { FINISHES, finishOf } from '../../domain/materials/finishes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { draftOf, useStore } from '../store'
import { TERMS } from '../glossary'
import { PlanSourceNotes } from './PlanSheet'
import { SavingSheet } from './SavingSheet'
import { useSavingSearch } from './savingSearch'

// The parts of one side of the furniture being edited (UI-39, UI-74): each says how it is now and opens the same sheet as touching it on the furniture.

export function PartsList({ state, plan, side }: { state: DesignState; plan: FurniturePlan; side: PartSpec<FurniturePlan>['side'] }) {
  const selectPart = useStore((s) => s.selectPart)
  const editPlan = useStore((s) => s.editPlan)
  const draft = useStore(draftOf)
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

  const these = parts.filter((p) => p.side === side)
  const group = (
      <section className="flex flex-col" aria-label="Partes">
        <ul className="flex flex-col">
          {these.map((part) => (
            <li key={part.id}>
              <button type="button" onClick={() => open(part)} className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left hover:bg-kraft focus-visible:outline-2 focus-visible:outline-focus">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{partName(part, plan)}</span>
                  <span className="text-sm text-graphite-2">{part.summary(plan, finish)}</span>
                </span>
                <CaretRight className="text-graphite-2" />
              </button>
            </li>
          ))}
        </ul>
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
