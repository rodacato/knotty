import { ArrowArcLeft, ArrowCounterClockwise, Check } from '@phosphor-icons/react'
import { useState } from 'react'
import { describePlanChanges, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { Button } from '../system/components'
import { ErrorText } from '../system/Field'
import { draftOf, useStore } from '../store'

// What the interior view has changed and not applied yet: it stays a draft until «Aplicar», one version for all of it.

export function DraftBar({ applied }: { applied: FurniturePlan }) {
  const draft = useStore(draftOf)
  const undo = useStore((s) => s.undoPlanEdit)
  const discard = useStore((s) => s.discardPlanDraft)
  const apply = useStore((s) => s.applyPlanDraft)
  const [error, setError] = useState<string | null>(null)
  if (!draft) return null
  const changes = describePlanChanges(applied, draft.plan)
  const message = error ?? draft.message
  return (
    <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-paper/95 p-3 shadow-lg backdrop-blur" role="region" aria-label="Cambios sin aplicar">
      <p className="text-xs text-graphite">{changes.length ? `Sin aplicar: ${changes.join(', ')}.` : 'Sin aplicar.'}</p>
      {message && <ErrorText>{message}</ErrorText>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={!draft.design}
          onClick={() => {
            const r = apply()
            setError(r.ok ? null : r.message)
          }}
        >
          <Check weight="fill" /> Aplicar
        </Button>
        <Button variant="ghost" disabled={!draft.steps.length} onClick={undo}>
          <ArrowArcLeft /> Deshacer
        </Button>
        <Button variant="ghost" onClick={discard}>
          <ArrowCounterClockwise /> Descartar
        </Button>
      </div>
    </div>
  )
}
