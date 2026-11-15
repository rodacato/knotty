import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { measuresSummary } from '../../domain/furniture/modules/common'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { withPageTransition } from '../system/pageTransition'
import { FichaOrigin } from './FichaOrigin'
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
      {/* The same black band as the Studio's header: the furniture's name leads (UI-93). */}
      <header className="ink-band sticky top-0 z-10 flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 md:px-6 md:py-4">
        <Button variant="ghost" className="min-h-11 shrink-0 px-3 font-display text-base uppercase" onClick={() => back()} aria-label="Volver al Estudio">
          <ArrowLeft weight="bold" /> <span className="max-sm:hidden">Volver al Estudio</span>
        </Button>
        <div className="min-w-0 flex-1 border-l-2 border-line pl-3">
          <p className="font-display text-xl leading-tight font-semibold uppercase max-sm:line-clamp-2 sm:truncate md:text-[56px] md:leading-none">{design.name}</p>
          <p className="numerals text-xs text-graphite sm:truncate md:mt-1 md:text-xl">
            {measuresSummary(design.dimensions)}
            <FichaOrigin state={state} className="text-graphite" />
          </p>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1440px] flex-col">
        {/* The band already names the furniture; the page's own name is a label, so nothing outweighs it (UI-93). */}
        <h1 className="mx-4 pt-6 font-display text-2xl leading-none font-semibold tracking-wide uppercase md:mx-8 md:pt-8 md:text-3xl">Preparar materiales</h1>
        {analysis.valid ? (
          <Materials state={state} design={design} geo={analysis.geo} catalog={catalog} instead={instead} onRequest={request} />
        ) : (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-base text-graphite">Primero hay que resolver los problemas del diseño.</p>
            <Button variant="primary" className="min-h-11 px-5" onClick={() => back(() => setOverlay('notices'))}>
              Ver los avisos
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
