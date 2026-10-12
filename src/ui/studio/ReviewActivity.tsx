import { CheckCircle, Stop } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { ReviewStage } from '../../application/useCases/review'
import { useStore } from '../store'
import { Button, Pencil } from '../system/components'

const LABELS: Record<ReviewStage, string> = {
  checking: 'Comprobando medidas, estructura y cortes',
  waiting: 'Esperando la respuesta del experto',
  receiving: 'Recibiendo la respuesta del experto',
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return <span className="numerals shrink-0 text-xs text-graphite-2" aria-label="Tiempo transcurrido">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
}

export function ReviewActivity({ compact = false }: { compact?: boolean }) {
  const progress = useStore((s) => s.reviewProgress)
  const cancel = useStore((s) => s.cancelReview)
  if (!progress) return null
  return (
    <section aria-label="Revisión en curso" className={`flex flex-col gap-2 border-line bg-kraft/60 ${compact ? 'border-b px-4 py-2' : 'rounded-xl border p-3'}`}>
      <div className="flex items-start gap-2">
        <Pencil className="mt-1 h-5 w-9 shrink-0 text-amber" />
        <div className="min-w-0 flex-1">
          <p role="status" className="text-sm font-medium">{LABELS[progress.stage]}</p>
          <p className="text-xs text-graphite-2">Diseño al iniciar: versión {progress.version}</p>
        </div>
        <Elapsed key={progress.startedAt} startedAt={progress.startedAt} />
        <Button variant="ghost" className="shrink-0 px-2 text-xs" onClick={cancel}>
          <Stop weight="fill" /> Cancelar
        </Button>
      </div>
      {!compact && (
        <>
          {progress.stage !== 'checking' && <p className="flex items-center gap-1.5 text-xs"><CheckCircle className="shrink-0 text-slate" /> Cuentas de Knotty completadas</p>}
          <p className="text-xs leading-relaxed text-graphite-2">Puedes seguir viendo el 3D. Si cambias las medidas, las piezas o los ajustes de corte, cancelamos esta revisión; podrás iniciar otra al terminar.</p>
          {progress.stage === 'waiting' && <p className="text-xs text-graphite-2">El proveedor aún no ha enviado una respuesta. El tiempo depende del modelo conectado.</p>}
        </>
      )}
    </section>
  )
}
