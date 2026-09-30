import { currentDesign, type DesignState } from '../../domain/session/state'
import { finishOf } from '../../domain/materials/finishes'
import { useStore } from '../store'
import { FinishSelect } from './FinishSelect'

/** How it will look: the finish is chosen while designing and the wood shows it at once. What it takes to buy is in Materiales. */
export function FinishSection({ state }: { state: DesignState }) {
  const choose = useStore((s) => s.chooseFinish)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-base font-semibold">Acabado</h3>
      <FinishSelect value={finishOf(currentDesign(state))} onChange={choose} />
      <p className="text-xs text-graphite-2">Los litros y lo que hay que comprar están en Materiales.</p>
    </section>
  )
}
