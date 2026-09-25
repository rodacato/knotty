import { lazy, Suspense, useEffect, useState } from 'react'
import { Settings } from './ajustes/Settings'
import { KeysGate } from './ajustes/Keys'
import { Analyzing } from './captura/Analyzing'
import { Capture } from './captura/Capture'
import { Home } from './captura/Home'
import { ServicesContext, type Services } from './services'
import { Pencil } from './sistema/components'
import { Knot } from './sistema/Brand'
import { DebugPanel } from './debug/DebugPanel'
import { useStore } from './store'

// The 3D is heavy: it loads once there is a piece of furniture to show.
const Studio = lazy(() => import('./estudio/Studio').then((m) => ({ default: m.Studio })))

const Loading = () => (
  <div className="grid h-full place-items-center">
    <div className="flex flex-col items-center gap-3 text-ambar">
      <Knot className="size-12 animate-pulse" />
      <Pencil className="h-6 w-16" />
    </div>
  </div>
)

function Screen() {
  const phase = useStore((s) => s.phase)
  const state = useStore((s) => s.state)
  if (phase === 'studio' && state)
    return (
      <Suspense fallback={<Loading />}>
        <Studio state={state} />
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

  if (error) return <p className="grid h-full place-items-center p-6 text-oxido">{error}</p>
  if (!services) return <Loading />
  return (
    <ServicesContext.Provider value={services}>
      <Screen />
      <Settings />
      <KeysGate />
      <DebugPanel />
    </ServicesContext.Provider>
  )
}
