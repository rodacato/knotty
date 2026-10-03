import { Copy, DownloadSimple } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { useStore } from '../store'
import { Button } from '../system/components'
import { adoptionCommands, candidateOf } from './candidate'

// The debug tools cannot write the repo: it hands the ficha back as a file for `probe`, which checks it and rewrites the ficha.

function Command({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-bone px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">{text}</code>
      <button
        type="button"
        aria-label="Copiar el comando"
        onClick={() =>
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }
        className="relative grid size-8 shrink-0 place-items-center rounded-full text-graphite-2 before:absolute before:-inset-1.5 before:content-[''] hover:bg-kraft"
      >
        {copied ? <span className="text-xs">Listo</span> : <Copy />}
      </button>
    </div>
  )
}

export function ExportFicha() {
  const state = useStore((s) => s.state)
  const origin = { code: useStore((s) => s.sandboxOrigin) }
  const [open, setOpen] = useState(false)
  const candidate = state ? candidateOf(state, origin) : null

  const download = () => {
    if (!candidate?.ok) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(candidate.file, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = candidate.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" className="gap-1 px-2 text-xs sm:px-3" aria-label="Exportar la ficha">
          <DownloadSimple /> <span className="hidden sm:inline">Exportar ficha</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[480px] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl border border-line bg-paper p-5 shadow-2xl">
          <Dialog.Title className="font-display text-xl font-semibold">Exportar la ficha</Dialog.Title>
          <Dialog.Description className="text-sm leading-relaxed text-graphite-2">
            El taller no escribe en el repositorio. Descarga el archivo y deja que <code className="font-mono text-xs">probe</code> lo revise y lo adopte.
          </Dialog.Description>
          {candidate?.ok ? (
            <>
              <p className="text-sm leading-relaxed">
                {origin.code ? `Es el plan de ${origin.code} con tus cambios.` : 'Es una ficha nueva: cambia el código por el que le toque (GN-… si es genérica, KC-… si la comprobaste contra un producto).'}
              </p>
              <ol className="flex flex-col gap-2 text-sm">
                <li>1. Pon el archivo en la raíz del proyecto y mira qué cambiaría:</li>
                <Command text={adoptionCommands(candidate.filename, origin.code)[0]} />
                <li>2. Si te convence, la vuelve la versión siguiente:</li>
                <Command text={adoptionCommands(candidate.filename, origin.code)[1]} />
              </ol>
              <div className="mt-1 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="ghost">Cerrar</Button>
                </Dialog.Close>
                <Button variant="primary" onClick={download}>
                  <DownloadSimple /> Descargar {candidate.filename}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p role="status" className="rounded-lg bg-kraft/60 p-3 text-sm leading-relaxed">
                {candidate ? candidate.reason : 'Abre una variante o una ficha primero.'}
              </p>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button variant="secondary">Entendido</Button>
                </Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
