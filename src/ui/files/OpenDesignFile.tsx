import * as Dialog from '@radix-ui/react-dialog'
import { FolderOpen } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { DESIGN_FILE_EXTENSION, type DesignFileRejection } from '../../domain/session/file'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { LOSS_NOTE, swapLoss, type SwapLoss } from '../spotlight/swap'
import { useStore } from '../store'
import { Button } from '../system/components'
import { DownloadFirst } from './DownloadFirst'

const REJECTION: Record<DesignFileRejection, string> = {
  'not-knotty': 'Ese archivo no es un diseño de Knotty.',
  newer: 'Ese diseño se guardó con un Knotty más nuevo. Actualiza Knotty y vuelve a abrirlo.',
  invalid: 'El archivo está dañado y no se pudo abrir.',
  'too-large': 'El archivo es demasiado grande para ser un diseño de Knotty.',
}

/** Opens a `.knotty` file in the Studio; it asks first when the open design would be lost. */
export function OpenDesignFile({ className = '' }: { className?: string }) {
  const { files } = useServices()
  const openDesign = useStore((s) => s.openDesign)
  const input = useRef<HTMLInputElement>(null)
  const [asking, setAsking] = useState<{ state: DesignState; loss: SwapLoss } | null>(null)
  const [rejection, setRejection] = useState<DesignFileRejection | null>(null)

  const read = async (file: File) => {
    setRejection(null)
    const result = await files.decode(file)
    if (!result.ok) return setRejection(result.reason)
    const { phase, state } = useStore.getState()
    const loss = swapLoss(phase, state)
    if (loss) setAsking({ state: result.state, loss })
    else openDesign(result.state)
  }
  const open = () => asking && openDesign(asking.state)

  return (
    <>
      <Button variant="ghost" className={`gap-2 ${className}`} onClick={() => input.current?.click()}>
        <FolderOpen aria-hidden /> Abrir un archivo
      </Button>
      <input
        ref={input}
        type="file"
        accept={`${DESIGN_FILE_EXTENSION},application/json`}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void read(file)
        }}
      />
      {rejection && (
        <p role="alert" className="basis-full text-sm text-rust">
          {REJECTION[rejection]}
        </p>
      )}
      <Dialog.Root open={!!asking} onOpenChange={(show) => !show && setAsking(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/30 backdrop-blur-[2px]" />
          <Dialog.Content className="animate-appear fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-3xl border border-line bg-bone p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
            <Dialog.Title className="font-display text-xl font-semibold">¿Abrir {asking ? currentDesign(asking.state).name : 'el archivo'}?</Dialog.Title>
            <Dialog.Description className="text-sm text-graphite">{asking && LOSS_NOTE[asking.loss]}</Dialog.Description>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost">Conservar</Button>
              </Dialog.Close>
              {asking?.loss === 'design' && <DownloadFirst then={open}>Descargar y abrir</DownloadFirst>}
              <Button variant="danger" onClick={open}>
                Abrir
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
