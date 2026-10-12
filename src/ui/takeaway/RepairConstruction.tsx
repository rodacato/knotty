import { useState } from 'react'
import { currentPlan } from '../../application/useCases/currentPlan'
import type { DesignState } from '../../domain/session/state'
import { useStore } from '../store'
import { Button } from '../system/components'

/** Updating an old design is an explicit, reversible version; free piece edits are never discarded here. */
export function RepairConstruction({ state }: { state: DesignState }) {
  const applyPlan = useStore((s) => s.applyPlan)
  const openTakeAway = useStore((s) => s.openTakeAway)
  const [error, setError] = useState('')
  const { plan, diverged } = currentPlan(state)
  if (!plan || diverged) return <p className="text-sm">Corrige las piezas desde el Estudio y revisa otra vez antes de cortar.</p>
  return <div className="flex flex-col gap-2 print:hidden">
    <p className="text-sm">Este diseño se calculó con ajustes anteriores. Recalcular crea una versión nueva con las holguras actuales; después revisa los materiales otra vez.</p>
    <Button variant="secondary" onClick={() => {
      const result = applyPlan(plan)
      if (!result.ok) setError(result.message)
      else openTakeAway(false)
    }}>Recalcular ajustes de construcción</Button>
    {error && <p role="alert">{error}</p>}
  </div>
}
