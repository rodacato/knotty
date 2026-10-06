import { ArrowCounterClockwise, ArrowsOut, CheckCircle, ClockCounterClockwise, Crosshair, Eye, Flask, PencilSimpleLine, Warning, X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { DesignState } from '../../domain/session/state'
import { STAGES } from '../chat/Chat'
import { useStore } from '../store'
import { Pencil } from '../system/components'
import { resolvedChipLabel, resolvedVisible } from './chipLabels'
import type { Status } from './StatusChip'
import type { StudioView } from './view'

const ROUND = "relative grid size-7 place-items-center rounded-full before:absolute before:-inset-2 before:content-[''] hover:bg-kraft"
const SMALL = "relative flex min-h-7 items-center gap-1 rounded-full bg-kraft before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:bg-kraft-2"
const WIDE = '-my-1 flex min-h-11 items-center gap-1 rounded-full bg-kraft px-3 hover:bg-kraft-2'

const Close = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label={label} className={ROUND}>
    <X />
  </button>
)

const counted = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

/** Shown only when its condition holds. */
const when = (condition: unknown, status: () => Status): Status[] => (condition ? [status()] : [])

interface Around {
  /** The expert's progress shows in the chat itself, so its status is for when the chat is out of sight. */
  chatInSight: boolean
  noticesOpen: boolean
  /** The version whose «resolved» status the person closed. */
  dismissedResolved: number | null
  onDismissResolved: () => void
  onNotices: () => void
  onProposal: () => void
}

/** Every status over the 3D, in order: the chip shows the first. What changes what you are looking at comes first (an old version, the expert at work, a focused piece, a proposal or preview); then problems, pieces to confirm, what the last change resolved. */
export function useStatuses(state: DesignState, view: StudioView, around: Around): Status[] {
  const backToVersion = useStore((s) => s.backToVersion)
  const viewVersion = useStore((s) => s.viewVersion)
  const thinking = useStore((s) => s.thinking)
  const stage = useStore((s) => s.stage)
  const cancel = useStore((s) => s.cancel)
  const unfocus = useStore((s) => s.unfocus)
  const select = useStore((s) => s.select)
  const sandboxed = useStore((s) => s.sandboxed)
  const leaveSandbox = useStore((s) => s.leaveSandbox)
  const { viewedVersion, focusedPiece, proposal, preview, problems, toConfirm, board } = view
  const action = (onClick: () => void, className: string, children: ReactNode) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )

  return [
    ...when(viewedVersion !== null, () => ({
      key: 'version',
      icon: <ClockCounterClockwise />,
      label: `Viendo v${viewedVersion}`,
      actions: (
        <>
          {action(() => backToVersion(viewedVersion!), `${SMALL} px-2`, <><ArrowCounterClockwise /> Volver a esta</>)}
          <Close label="Dejar de ver" onClick={() => viewVersion(null)} />
        </>
      ),
    })),
    ...when(thinking && !around.chatInSight, () => ({ key: 'thinking', icon: <Pencil className="h-3 w-8 text-amber" />, label: stage ? STAGES[stage.name] : 'Pensando…', actions: <Close label="Cancelar" onClick={cancel} /> })),
    ...when(focusedPiece, () => ({ key: 'focus', icon: <Crosshair />, label: `Enfocada: ${focusedPiece!.name}`, actions: action(unfocus, WIDE, <><ArrowsOut /> Ver todo el mueble</>) })),
    ...when(proposal, () => ({
      key: 'proposal',
      icon: <Eye weight="bold" />,
      label: preview ? ('draft' in preview ? preview.label : `Viendo la solución: ${preview.label}`) : 'Viendo la propuesta sin aplicar',
      actions: preview ? undefined : action(around.onProposal, `${WIDE} focus-visible:outline-2 focus-visible:outline-amber`, 'Ver propuesta'),
    })),
    ...when(view.geo && problems.length > 0, () => ({ key: 'problems', icon: <Warning weight="bold" className="text-rust" />, label: counted(problems.length, 'Un problema sin resolver', 'problemas sin resolver'), onClick: around.onNotices })),
    ...when(toConfirm.length > 0 && viewedVersion === null && !proposal, () => ({ key: 'confirm', icon: <PencilSimpleLine />, label: counted(toConfirm.length, `${toConfirm[0].name} por confirmar`, 'piezas por confirmar'), onClick: () => select(toConfirm[0].id) })),
    ...when(resolvedVisible(board.resolved, around.dismissedResolved, state.current) && !around.noticesOpen, () => ({
      key: 'resolved',
      icon: <CheckCircle weight="fill" className="text-slate" />,
      label: resolvedChipLabel(board.resolved[0]),
      actions: <Close label="Cerrar" onClick={around.onDismissResolved} />,
    })),
    // Last, because the chip shows only the first status: what changes what you see must not hide behind the sandbox's reminder.
    ...when(sandboxed, () => ({ key: 'sandbox', icon: <Flask />, label: 'Taller: nada de esto se guarda', actions: action(leaveSandbox, `${SMALL} px-3`, 'Salir') })),
  ]
}
