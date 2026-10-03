import { Flask, SignOut, Warning } from '@phosphor-icons/react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useServices } from '../services'
import { useStore } from '../store'
import { Emblem } from '../system/Brand'
import { Button, Title } from '../system/components'
import { Drawer } from './Drawer'
import { LabBench, variantKey } from './LabBench'
import { ModelSwitch } from './ModelSwitch'
import { ExportFicha } from './ExportFicha'
import type { Origin } from './candidate'
import { groupVariants, listFichas } from './variants'
import type { Workshop } from './workshop'

const Studio = lazy(() => import('../studio/Studio').then((m) => ({ default: m.Studio })))

// The hidden workshop: the real Studio between a bench drawer and its own panel, on designs that never reach the saved one.

function Empty({ workshop }: { workshop: Workshop }) {
  const [benchOpen, setBenchOpen] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-bone/80 px-5 py-2">
        <Emblem className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-semibold">Taller</p>
          <p className="text-xs text-graphite-2">Nada de lo que hagas aquí se guarda</p>
        </div>
        {workshop.expert}
        <Button variant="ghost" className="gap-1 px-3 text-xs" onClick={workshop.onExit} aria-label="Salir del taller">
          <SignOut /> Salir del taller
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <Drawer side="left" open={benchOpen} onToggle={() => setBenchOpen((v) => !v)} label="el banco" width="w-[380px]" rail={workshop.benchRail}>
          {workshop.bench}
        </Drawer>
        <div className="grid min-w-0 flex-1 place-items-center bg-[var(--scene-bg)] p-12">
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <Flask size={40} className="text-graphite-2" />
            <Title>Elige una variante del banco</Title>
            <p className="text-sm leading-relaxed text-graphite-2">Se abre aquí, en el Studio de siempre, sobre un diseño de prueba que no se guarda.</p>
          </div>
        </div>
        <Drawer side="right" open={panelOpen} onToggle={() => setPanelOpen((v) => !v)} label="el panel" width="w-[420px]" rail={<Warning />}>
          <p className="p-4 pt-16 text-sm leading-relaxed text-graphite-2">Abre una variante del banco para ver aquí lo que Knotty calcula de ella.</p>
        </Drawer>
      </div>
    </div>
  )
}

export function Lab() {
  const { bench, references, catalog } = useServices()
  const state = useStore((s) => s.state)
  const fromExample = useStore((s) => s.fromExample)
  const leaveLab = useStore((s) => s.leaveLab)
  const [groups, setGroups] = useState(() => groupVariants(bench))
  const [opened, setOpened] = useState<string | null>(null)
  const [origin, setOrigin] = useState<Origin>({ code: null })
  const fichas = useMemo(() => listFichas(references.all(), catalog), [references, catalog])
  const rows = useMemo(() => groups.flatMap((g) => g.variants), [groups])

  const workshop: Workshop = {
    bench: (
      <LabBench
        groups={groups}
        fichas={fichas}
        opened={state ? opened : null}
        onOpen={(module, row) => {
          setOpened(variantKey(module, row.variant))
          setOrigin({ code: null })
          fromExample({ name: row.plan.name, plan: row.plan, notes: '' })
        }}
        onOpenFicha={({ reference: r }) => {
          setOpened(`ficha/${r.code}`)
          setOrigin({ code: r.code })
          fromExample({ name: r.name, plan: r.plan, notes: r.notes, ...(r.kind ? { kind: r.kind } : {}), ...(r.finish ? { finish: r.finish } : {}) })
        }}
        onReview={() => setGroups(groupVariants(bench))}
      />
    ),
    benchRail: (
      <>
        <Flask />
        <span className="numerals font-mono text-[11px] text-graphite-2">
          {rows.filter((r) => r.verdict === 'ok').length}/{rows.length}
        </span>
      </>
    ),
    actions: <ExportFicha origin={origin} />,
    expert: <ModelSwitch />,
    onExit: leaveLab,
  }

  if (!state) return <Empty workshop={workshop} />
  return (
    <Suspense fallback={null}>
      <Studio state={state} workshop={workshop} />
    </Suspense>
  )
}
