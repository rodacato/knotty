import { X } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Geometry } from '../../domain/design/resolve'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { draftOf, useStore, type EditSide } from '../store'
import { CellSheet } from './CellSheet'
import { DraftBar } from './DraftBar'
import { OutsideList } from './OutsideList'
import { PartSheet } from './PartSheet'
import { PartsList } from './PartsList'

// The panel while the furniture is edited from one side (UI-74): its parts, the chosen one, what is not applied yet, and the way out.

const TITLE: Record<EditSide, string> = { outside: 'Editar por fuera', inside: 'Editar por dentro' }

/** Leaving with changes not applied asks what to do with them; without any, it just leaves. */
function useLeave() {
  const draft = useStore(draftOf)
  const edit = useStore((s) => s.edit)
  const [asking, setAsking] = useState(false)
  const leave = () => (draft ? setAsking(true) : edit(null))
  return { asking, leave, stay: () => setAsking(false) }
}

export function EditPanel({ state, side, plan, applied, geo, pieceSheet }: { state: DesignState; side: EditSide; plan: FurniturePlan | null; applied: FurniturePlan | null; geo: Geometry | null; pieceSheet: ReactNode }) {
  const edit = useStore((s) => s.edit)
  const apply = useStore((s) => s.applyPlanDraft)
  const discard = useStore((s) => s.discardPlanDraft)
  const cell = useStore((s) => s.cell)
  const part = useStore((s) => s.part)
  const { asking, leave, stay } = useLeave()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const body = (() => {
    if (pieceSheet) return pieceSheet
    if (side === 'inside' && cell && plan?.kind === 'cabinet' && geo) return <CellSheet plan={plan as CabinetPlan} path={cell} geo={geo} />
    if (part && plan) return <PartSheet key={part.id} state={state} plan={plan} design={currentDesign(state)} part={part} />
    if (side === 'outside') return <OutsideList state={state} geo={geo} />
    return plan ? <PartsList state={state} plan={plan} side="inside" /> : null
  })()

  return (
    <section className="flex h-full min-h-0 flex-col bg-bone/60" aria-label={TITLE[side]}>
      <div className="flex min-h-11 items-center gap-2 border-b border-line px-4">
        <h2 className="flex-1 text-sm font-medium">{TITLE[side]}</h2>
        <button type="button" onClick={leave} aria-label="Salir de editar" title="Salir (Esc)" className="relative grid size-9 place-items-center rounded-full text-graphite-2 before:absolute before:-inset-1 before:content-[''] hover:bg-kraft">
          <X />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      {asking ? (
        <div className="flex flex-col gap-3 border-t border-line bg-paper p-4" role="alertdialog" aria-label="Cambios sin aplicar">
          <p className="text-sm font-medium">Tienes cambios sin aplicar</p>
          {error && <p className="text-xs text-rust">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                const r = apply()
                if (!r.ok) return setError(r.message)
                edit(null)
              }}
            >
              Aplicar y salir
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                discard()
                edit(null)
              }}
            >
              Descartar
            </Button>
            <Button variant="ghost" onClick={stay}>
              Seguir editando
            </Button>
          </div>
        </div>
      ) : (
        applied && (
          <div className="border-t border-line p-3 empty:hidden">
            <DraftBar applied={applied} />
          </div>
        )
      )}
    </section>
  )
}
