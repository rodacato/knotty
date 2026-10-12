import { ArrowRight } from '@phosphor-icons/react'
import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../system/components'

type Step = 1 | 2 | 3

export function MaterialsJourney({ remaining, review, materials, guide, materialSummary, guideSummary }: { remaining: number; review: ReactNode; materials: ReactNode; guide: ReactNode; materialSummary: string; guideSummary: string }) {
  const [active, setActive] = useState<Step | null>(remaining ? 1 : 2)
  const summaries = useRef(new Map<Step, HTMLElement>())
  const advance = (step: Step) => {
    setActive(step)
    requestAnimationFrame(() => summaries.current.get(step)?.focus())
  }
  const steps: { id: Step; title: string; summary: string; content: ReactNode; next?: string }[] = [
    { id: 1, title: 'Revisar pendientes', summary: remaining ? `${remaining} ${remaining === 1 ? 'decisión por tomar' : 'decisiones por tomar'}` : 'Sin decisiones por tomar', content: review, next: 'Continuar a materiales' },
    { id: 2, title: 'Confirmar materiales', summary: materialSummary, content: materials, next: 'Continuar a la guía' },
    { id: 3, title: 'Obtener tu guía', summary: guideSummary, content: guide },
  ]
  return (
    <section aria-label="Pasos para preparar tu mueble" className="flex flex-col gap-3">
      <p className="text-xs font-medium text-graphite-2" aria-live="polite">{active ? `Paso ${active} de 3` : '3 pasos para preparar tu mueble'}</p>
      {steps.map((step) => <details key={step.id} open={active === step.id} onToggle={(event) => { if (event.currentTarget.open) setActive(step.id); else setActive((current) => current === step.id ? null : current) }} className="rounded-xl border border-line">
        <summary ref={(element) => { if (element) summaries.current.set(step.id, element); else summaries.current.delete(step.id) }} className="min-h-11 cursor-pointer rounded-xl p-3 marker:text-graphite-2"><span className="text-sm font-semibold">{step.id}. {step.title}</span><span className="mt-1 block pl-4 text-xs leading-relaxed text-graphite-2">{step.summary}</span></summary>
        <div className="flex flex-col gap-4 px-3 pb-3">{step.content}{step.next && <Button variant="secondary" className="self-start px-4 text-sm" onClick={() => advance(step.id === 1 ? 2 : 3)}>{step.next}<ArrowRight /></Button>}</div>
      </details>)}
    </section>
  )
}
