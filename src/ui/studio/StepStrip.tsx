import { kindLabel } from '../../domain/design/kind'
import { kindOf } from '../../domain/furniture/kind'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import { FINISHES, finishOf } from '../../domain/materials/finishes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { draftOf, useStore } from '../store'
import { KIND_STEP, outsideSteps } from './steps'

// Editing from outside on a wide screen (UI-93): every step in one ruled strip under the header, like the columns of a cut ticket. The open step is a solid ink cell whose notch points at its panel.

/** The open step's name at the top of its panel, under a heavy rule, as the strip names it. */
export function StepTitle({ number, name }: { number: number; name: string }) {
  return (
    <h2 className="border-b-4 border-graphite pb-3 font-display text-[44px] leading-none font-semibold uppercase">
      <span className="numerals">{number}.</span> {name}
    </h2>
  )
}

export function StepStrip({ state, plan }: { state: DesignState; plan: FurniturePlan }) {
  const part = useStore((s) => s.part)
  const selectPart = useStore((s) => s.selectPart)
  const draft = useStore(draftOf)
  const design = draft?.design ?? currentDesign(state)
  const known = kindOf(design).kind
  const finish = FINISHES[finishOf(currentDesign(state))].name
  const steps = outsideSteps(plan, finish, part?.id ?? null, known === 'unknown' ? 'Sin decidir' : kindLabel(known))
  return (
    <nav aria-label="Pasos" className="relative z-20 border-b-2 border-graphite bg-bone">
      <ol className="flex">
        {steps.map((step) => (
          // A longer value gets a wider cell, so each step keeps its value whole.
          <li key={step.id} className="relative min-w-0 border-r border-graphite last:border-r-0" style={{ flex: `${1 + step.summary.length / 28} 1 0` }}>
            <button
              type="button"
              aria-current={step.active ? 'step' : undefined}
              onClick={() => !step.active && selectPart(step.id === KIND_STEP ? null : step.id)}
              className={`flex h-full min-h-11 w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus ${step.active ? 'bg-graphite text-bone' : 'hover:bg-kraft'}`}
            >
              <span className="font-display text-[15px] leading-tight font-semibold uppercase">
                <span className="numerals">{step.number}.</span> {step.name}
              </span>
              <span className={`line-clamp-3 text-[13px] leading-snug ${step.active ? 'text-bone/85' : 'text-graphite-2'}`}>{step.summary}</span>
            </button>
            {step.active && <span aria-hidden className="absolute top-full left-1/2 -translate-x-1/2 border-x-[16px] border-t-[16px] border-x-transparent border-t-graphite" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}
