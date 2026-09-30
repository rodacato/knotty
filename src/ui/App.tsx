import { lazy, Suspense, useEffect, useState } from 'react'
import { Settings } from './settings/Settings'
import { KeysGate } from './settings/Keys'
import { Analyzing } from './capture/Analyzing'
import { Capture } from './capture/Capture'
import { Home } from './capture/Home'
import { ServicesContext, type Services } from './services'
import { Pencil } from './system/components'
import { Knot } from './system/Brand'
import { DebugPanel } from './debug/DebugPanel'
import { useStore } from './store'
import { valueFields } from '../domain/furniture/modules/fields'
import { moduleOf } from '../domain/furniture/modules/plan'

// The 3D is heavy: it loads once there is a piece of furniture to show.
const Studio = lazy(() => import('./studio/Studio').then((m) => ({ default: m.Studio })))

const Loading = () => (
  <div className="grid h-full place-items-center">
    <div className="flex flex-col items-center gap-3 text-amber">
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
  const fromExample = useStore((s) => s.fromExample)

  useEffect(() => {
    compose()
      .then((s) => {
        start(s)
        setServices(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo iniciar.'))
  }, [compose, start])

  // Experiment: ?open=GN-APA-01 (or a base id) lands in the studio with that piece of furniture.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('open')?.toLowerCase()
    const base = services && wanted ? services.references.home().find((b) => b.code.toLowerCase() === wanted || b.id.toLowerCase() === wanted) : null
    if (!base) return
    // Any other parameter is a field of the Mueble tab by its key: ?open=GN-APA-01&construction.pulls=notch&base=legs&dimensions.width=1200
    let plan = base.plan
    for (const [key, value] of new URLSearchParams(window.location.search)) {
      const field = valueFields(moduleOf(plan).fields, plan).find((x) => x.type !== 'custom' && x.key === key)
      if (field && field.type !== 'custom') plan = (field as unknown as { set: (p: typeof plan, v: string | number) => typeof plan }).set(plan, field.type === 'number' || field.type === 'stepper' ? Number(value) : value)
    }
    fromExample({ ...base, plan })
  }, [services, fromExample])

  if (error) return <p className="grid h-full place-items-center p-6 text-rust">{error}</p>
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
