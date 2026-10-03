import { lazy, Suspense, useEffect, useState } from 'react'
import { Settings } from './settings/Settings'
import { KeysGate } from './settings/Keys'
import { ConnectExpert } from './connect/ConnectExpert'
import { Analyzing } from './capture/Analyzing'
import { Capture } from './capture/Capture'
import { Home } from './capture/Home'
import { ServicesContext, type Services } from './services'
import { Pencil } from './system/components'
import { Knot } from './system/Brand'
import { DebugPanel } from './debug/DebugPanel'
import { useStore } from './store'

// The 3D is heavy: it loads once there is a piece of furniture to show.
const AdjustBase = lazy(() => import('./capture/AdjustBase').then((m) => ({ default: m.AdjustBase })))
const Lab = lazy(() => import('./lab/Lab').then((m) => ({ default: m.Lab })))
const Studio = lazy(() => import('./studio/Studio').then((m) => ({ default: m.Studio })))

const Loading = () => (
  <div className="grid h-full place-items-center">
    <div className="flex flex-col items-center gap-3 text-amber">
      <Knot className="size-12 motion-safe:animate-pulse" />
      <Pencil className="h-6 w-16" />
    </div>
  </div>
)

function Screen() {
  const phase = useStore((s) => s.phase)
  const state = useStore((s) => s.state)
  const adjusting = useStore((s) => s.adjusting)
  if (phase === 'lab')
    return (
      <Suspense fallback={<Loading />}>
        <Lab />
      </Suspense>
    )
  if (phase === 'studio' && state)
    return (
      <Suspense fallback={<Loading />}>
        <Studio state={state} />
      </Suspense>
    )
  if (phase === 'home' && adjusting)
    return (
      <Suspense fallback={<Loading />}>
        <AdjustBase base={adjusting} />
      </Suspense>
    )
  if (phase === 'analyzing') return <Analyzing />
  if (phase === 'capture') return <Capture />
  return <Home />
}

export function App({ compose }: { compose: () => Promise<Services> }) {
  const [services, setServices] = useState<Services | null>(null)
  const [error, setError] = useState<string | null>(null)
  const start = useStore((s) => s.start)

  useEffect(() => {
    compose()
      .then((s) => {
        start(s)
        setServices(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo iniciar.'))
  }, [compose, start])

  if (error) return <p role="alert" className="grid h-full place-items-center p-6 text-rust">{error}</p>
  if (!services) return <Loading />
  return (
    <ServicesContext.Provider value={services}>
      <Screen />
      <Settings />
      <ConnectExpert />
      <KeysGate />
      <DebugPanel />
    </ServicesContext.Provider>
  )
}
