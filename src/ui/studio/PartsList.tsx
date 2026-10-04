import { CaretRight, Stack } from '@phosphor-icons/react'
import { currentPlan } from '../../application/useCases'
import { CABINET_LABELS, leafCells, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { CABINET_PARTS, type CabinetPart } from '../../domain/furniture/modules/cabinetParts'
import { FINISHES, finishOf } from '../../domain/materials/finishes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { draftOf, useStore } from '../store'
import { TERMS } from '../glossary'
import { PlanSourceNotes } from './PlanSheet'
import { SavingSheet } from './SavingSheet'
import { useSavingSearch } from './savingSearch'

// A cabinet's plan as its parts, outside and inside (UI-39): each says how it is now and opens the same sheet as touching it on the furniture.

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** How each part is now, in one line. */
function stateOf(id: CabinetPart, plan: CabinetPlan, finish: string): string {
  const c = plan.construction
  const cells = leafCells(plan.columns)
  const { construction: labels } = CABINET_LABELS
  switch (id) {
    case 'size':
      return `${plan.dimensions.height} de alto × ${plan.dimensions.width} de ancho × ${plan.dimensions.depth} de fondo, en mm`
    case 'wood':
      return `Triplay de ${plan.material.replace(/\D/g, '')} mm · ${finish}`
    case 'base':
      return `${plan.base === 'legs' ? `Sobre patas de ${plan.legHeight} mm` : CABINET_LABELS.base[plan.base].option}${plan.wallMounted ? ', anclado al muro' : ''}`
    case 'body':
      return `Techo ${c.top === 'between' ? 'entre laterales' : 'encima'}${c.top === 'fingers' ? ', esquinas de dedos' : ''}, ${c.back === 'nailed' ? 'trasera clavada' : 'sin trasera'}`
    case 'doors': {
      const n = cells.filter((x) => x.content === 'door').length
      return n ? `${count(n, 'puerta', 'puertas')} ${lower(labels.doors.options[c.doors])}${c.fronts === 'grooved' ? ', ranuradas' : ''}` : 'Sin puertas: agrégalas en los huecos'
    }
    case 'drawers': {
      const n = cells.filter((x) => x.content === 'drawer').length
      return n ? `${count(n, 'cajón', 'cajones')}, frentes ${lower(labels.drawerFronts.options[c.drawerFronts])}` : 'Sin cajones: agrégalos en los huecos'
    }
    case 'cells':
      return `${count(cells.filter((x) => x.content !== 'void').length, 'hueco', 'huecos')}, repisas ${lower(labels.shelves.options[c.shelves])}`
  }
}

export function PartsList({ state, plan }: { state: DesignState; plan: CabinetPlan }) {
  const selectPart = useStore((s) => s.selectPart)
  const setMode = useStore((s) => s.setMode)
  const editPlan = useStore((s) => s.editPlan)
  const draft = useStore(draftOf)
  const source = currentPlan(state)
  const saving = useSavingSearch(plan)
  const finish = FINISHES[finishOf(currentDesign(state))].name
  const open = (id: CabinetPart) => {
    // Inside is edited on the furniture without its fronts: opening it switches the view.
    if (CABINET_PARTS[id].side === 'inside') setMode('interior')
    selectPart(id)
  }

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

  const group = (side: 'outside' | 'inside', title: string) => (
    <section className="flex flex-col" aria-labelledby={`parts-${side}`}>
      <h3 id={`parts-${side}`} className="px-4 pt-4 pb-1 font-display text-base font-semibold">
        {title}
      </h3>
      <ul className="flex flex-col">
        {(Object.keys(CABINET_PARTS) as CabinetPart[])
          .filter((id) => CABINET_PARTS[id].side === side)
          .map((id) => (
            <li key={id}>
              <button type="button" onClick={() => open(id)} className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left hover:bg-kraft focus-visible:outline-2 focus-visible:outline-focus">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{CABINET_PARTS[id].name}</span>
                  <span className="text-sm text-graphite-2">{stateOf(id, plan, finish)}</span>
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
      <div className="px-4 pt-4">
        <PlanSourceNotes source={source} />
      </div>
      {group('outside', 'Por fuera')}
      {group('inside', 'Por dentro')}
      <div className="flex flex-col gap-2 px-4 pt-4">
        <Button variant="secondary" className="min-h-11" disabled={saving.searching} onClick={saving.start}>
          <Stack /> {saving.searching ? 'Buscando…' : TERMS.saveMaterial.name}
        </Button>
        {draft && <p className="text-xs text-graphite-2">Busca sobre los cambios sin aplicar.</p>}
      </div>
    </div>
  )
}
