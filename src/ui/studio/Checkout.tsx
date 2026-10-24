import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { measuresSummary } from '../../domain/furniture/modules/common'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { withPageTransition } from '../system/pageTransition'
import { Materials } from './Materials'
import { useStudioView } from './view'

/** What to buy, reviewed on a page of its own once the furniture is to the person's liking (UI-90); any change goes back to the Studio. */
export function Checkout({ state }: { state: DesignState }) {
  const { catalog } = useServices()
  const { current: design, currentAnalysis: analysis, instead } = useStudioView(state)
  const openCheckout = useStore((s) => s.openCheckout)
  const setTab = useStore((s) => s.setStudioTab)
  const setOverlay = useStore((s) => s.setStudioOverlay)
  const adjust = useStore((s) => s.adjust)
  const back = (then?: () => void) => withPageTransition('back', () => {
    openCheckout(false)
    then?.()
  })
  const request = (text: string) => back(() => {
    setOverlay(null)
    setTab('chat')
    void adjust(text)
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-bone">
      <div className="sticky top-0 z-10 flex items-center border-b border-line bg-bone/90 px-2 py-2 backdrop-blur">
        <Button variant="ghost" className="min-h-11 px-3" onClick={() => back()}>
          <ArrowLeft weight="bold" /> Volver al Estudio
        </Button>
      </div>
      <main className="mx-auto flex max-w-xl flex-col">
        <header className="flex flex-col gap-1 px-4 pt-5">
          <p className="text-sm text-graphite-2">Preparar materiales</p>
          <h1 className="font-display text-2xl leading-tight font-semibold">{design.name}</h1>
          <p className="numerals text-xs text-graphite-2">{measuresSummary(design.dimensions)}</p>
        </header>
        {analysis.valid ? (
          <Materials state={state} design={design} geo={analysis.geo} catalog={catalog} instead={instead} onRequest={request} />
        ) : (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-sm text-graphite">Primero hay que resolver los problemas del diseño.</p>
            <Button className="min-h-11" onClick={() => back(() => setOverlay('notices'))}>
              Ver los avisos
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
