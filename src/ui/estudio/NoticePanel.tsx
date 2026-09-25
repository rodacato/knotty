import { ArrowCounterClockwise, CheckCircle, Eye, Lightning, ChatCircleText, Wrench } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { noticeBoard, type Notice } from '../../application/notices'
import { fixesFor, type Fix } from '../../domain/fixes/fixes'
import { disenoActual, type EstadoDiseno } from '../../domain/sesion/estado'
import { useServicios } from '../servicios'
import { Boton, Sello } from '../sistema/componentes'
import { useTienda } from '../tienda'

// Every notice with its way out: a solution Knotty builds (previewed in 3D), asking the expert, or leaving it as it is.

const KIND: Record<Notice['kind'], string> = { finding: '', requirement: 'Requisito', problem: 'Sin resolver', proposal: 'Del experto', question: 'Pregunta' }

function FixButton({ fix }: { fix: Fix }) {
  const preview = useTienda((s) => s.preview)
  const previewFix = useTienda((s) => s.previewFix)
  const applyFix = useTienda((s) => s.applyFix)
  const pensando = useTienda((s) => s.pensando)
  const showing = preview?.label === fix.label
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-2 py-1.5 ${showing ? 'border-ambar bg-ambar-suave' : 'border-linea bg-hueso'}`}>
      <Lightning className="shrink-0 text-ambar" weight="fill" />
      <span className="min-w-0 flex-1 text-sm">{fix.label}</span>
      <Boton variante="fantasma" className="min-h-8 px-2 text-xs" onClick={() => previewFix(showing ? null : fix)} aria-pressed={showing}>
        <Eye /> {showing ? 'Ocultar' : 'Ver'}
      </Boton>
      <Boton variante="primario" className="min-h-8 px-3 text-xs" disabled={pensando} onClick={() => applyFix(fix)}>
        Aplicar
      </Boton>
    </div>
  )
}

function NoticeCard({ notice, estado, onAsk, onAnswer }: { notice: Notice; estado: EstadoDiseno; onAsk: (text: string) => void; onAnswer: () => void }) {
  const { catalogo } = useServicios()
  const seleccionar = useTienda((s) => s.seleccionar)
  const acceptNotice = useTienda((s) => s.acceptNotice)
  const aplicarPropuesta = useTienda((s) => s.aplicarPropuesta)
  const descartarPropuesta = useTienda((s) => s.descartarPropuesta)
  const alternarPropuesta = useTienda((s) => s.alternarPropuesta)
  const verPropuesta = useTienda((s) => s.verPropuesta)
  const pensando = useTienda((s) => s.pensando)
  const design = disenoActual(estado)
  // One solution covers every piece of the notice: five sagging shelves get five supports in one click.
  const fixes = useMemo(() => {
    const [first] = notice.findings
    if (!first) return []
    const pieces = [...new Set(notice.findings.flatMap((h) => h.piezas))]
    const general = (f: Fix) => (f.key === 'divisor-al-centro' || f.key === 'apoyo-central' ? 'Un apoyo al centro, debajo de cada una' : f.label)
    const perPiece = new Set(['divisor-al-centro', 'apoyo-central', 'subir-espesor'])
    return fixesFor(design, catalogo, { ...first, piezas: pieces }).map((f) => (pieces.length > 1 && perPiece.has(f.key) ? { ...f, label: `${general(f)} (${pieces.length} piezas)` } : f))
  }, [notice, design, catalogo])
  const built = new Set(fixes.map((f) => f.key))
  const forExpert = [...new Map(notice.findings.flatMap((h) => h.alternativas).filter((a) => a.clave !== 'claro-maximo' && !built.has(a.clave)).map((a) => [a.descripcion, a])).values()]
  const name = (id: string) => design.piezas.find((p) => p.id === id)?.nombre ?? id

  return (
    <li className={`animate-aparecer flex flex-col gap-2.5 rounded-2xl border p-4 ${notice.severity === 'critico' ? 'border-oxido/30 bg-oxido/5' : notice.severity === 'decision' ? 'border-ambar/40 bg-ambar-suave/40' : 'border-linea bg-hueso'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {KIND[notice.kind] && <span className="mr-1.5 text-xs text-grafito-2">{KIND[notice.kind]} ·</span>}
          {notice.title}
        </span>
        {notice.severity !== 'decision' && <Sello severidad={notice.severity} />}
      </div>
      <p className="text-[15px] leading-snug">{notice.message}</p>
      {notice.pieces.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notice.pieces.map((id) => (
            <button key={id} type="button" onClick={() => seleccionar(id)} className="rounded-full border border-linea px-2.5 py-0.5 text-xs text-grafito-2 transition hover:border-ambar hover:text-grafito">
              {name(id)}
            </button>
          ))}
        </div>
      )}

      {fixes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Al instante</p>
          {fixes.map((f) => (
            <FixButton key={f.label} fix={f} />
          ))}
        </div>
      )}

      {notice.kind === 'proposal' && (
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" className="min-h-9 text-xs" onClick={alternarPropuesta}>
            <Eye /> {verPropuesta ? 'Ver el actual' : 'Ver propuesta'}
          </Boton>
          <Boton variante="primario" className="min-h-9 text-xs" disabled={pensando} onClick={aplicarPropuesta}>
            Sí, aplícalo
          </Boton>
          <Boton variante="fantasma" className="min-h-9 text-xs" disabled={pensando} onClick={descartarPropuesta}>
            No, déjalo como estaba
          </Boton>
        </div>
      )}

      {notice.kind === 'question' && (
        <Boton variante="secundario" className="min-h-9 self-start text-xs" onClick={onAnswer}>
          <ChatCircleText /> Contestar en la conversación
        </Boton>
      )}

      {(notice.kind === 'finding' || notice.kind === 'requirement' || notice.kind === 'problem') && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Con el experto · ~1 min</p>
          <div className="flex flex-wrap gap-2">
            {forExpert.map((a) => (
              <Boton key={a.descripcion} variante="secundario" className="min-h-8 text-xs" disabled={pensando} onClick={() => onAsk(`${notice.message} ${a.descripcion}.`)}>
                <Wrench /> {a.descripcion}
              </Boton>
            ))}
            <Boton variante="fantasma" className="min-h-8 px-2 text-xs underline" disabled={pensando} onClick={() => onAsk(`Corrige esto: ${notice.message}`)}>
              Que el experto decida
            </Boton>
          </div>
        </div>
      )}

      {notice.kind === 'finding' && (
        <button type="button" onClick={() => acceptNotice(notice)} className="self-start text-xs text-grafito-2 underline hover:text-grafito">
          Aceptar así, bajo mi riesgo
        </button>
      )}
    </li>
  )
}

export function NoticePanel({ estado, onAsk, onAnswer }: { estado: EstadoDiseno; onAsk: (text: string) => void; onAnswer: () => void }) {
  const { catalogo } = useServicios()
  const reopenNotice = useTienda((s) => s.reopenNotice)
  const board = useMemo(() => noticeBoard(estado, catalogo), [estado, catalogo])
  const [showAccepted, setShowAccepted] = useState(false)

  return (
    <div className="flex flex-col gap-4 p-4">
      {board.resolved.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-2xl border border-pizarra/30 bg-pizarra/10 p-3 text-sm text-pizarra">
          {board.resolved.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 shrink-0" weight="fill" /> Resuelto: {r}
            </li>
          ))}
        </ul>
      )}

      {board.pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-grafito-2">
          <Wrench size={28} weight="duotone" className="text-ambar" />
          <p className="font-medium text-grafito">Nada pendiente</p>
          <p className="text-sm">Revisé flecha de entrepaños, espesores por unión, tornillos, vuelco, escuadrado, puertas, base, veta, cajones y el uso del mueble.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {board.pending.map((n) => (
            <NoticeCard key={n.key} notice={n} estado={estado} onAsk={onAsk} onAnswer={onAnswer} />
          ))}
        </ul>
      )}

      {board.accepted.length > 0 && (
        <div className="rounded-2xl border border-linea bg-hueso/60 p-3 text-sm">
          <button type="button" className="text-xs text-grafito-2 underline" onClick={() => setShowAccepted((v) => !v)}>
            {showAccepted ? 'Ocultar' : 'Ver'} lo que aceptaste así ({board.accepted.length})
          </button>
          {showAccepted && (
            <ul className="mt-2 flex flex-col gap-2">
              {board.accepted.map((n) => (
                <li key={n.key} className="flex items-start gap-2">
                  <span className="flex-1">
                    <span className="font-medium">{n.title}:</span> {n.message}
                  </span>
                  <button type="button" onClick={() => reopenNotice(n)} className="flex shrink-0 items-center gap-1 text-xs underline">
                    <ArrowCounterClockwise /> Reabrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
