import { Button } from '../system/components'

export function InvalidCanvas({ detail, previous, onBack, onNotices }: { detail: string; previous: number | null; onBack: () => void; onNotices: () => void }) {
  return (
    <div role="alert" className="grid h-full place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <p className="text-base font-medium text-rust">Algo del diseño quedó roto y no se puede dibujar.</p>
        {detail && <p className="text-xs text-graphite-2">{detail}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {previous !== null && (
            <Button variant="primary" className="min-h-11" onClick={onBack}>
              Volver a la versión anterior
            </Button>
          )}
          <Button className="min-h-11" onClick={onNotices}>
            Ver los avisos
          </Button>
        </div>
      </div>
    </div>
  )
}
