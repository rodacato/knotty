import type { ReactNode } from 'react'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { downloadDesign } from './download'

/** The way out a loss notice offers: the open design goes to a file, and only then what was asked happens. */
export function DownloadFirst({ then, className, children }: { then: () => void; className?: string; children: ReactNode }) {
  const { files } = useServices()
  const state = useStore((s) => s.state)
  if (!state) return null
  return (
    <Button variant="secondary" className={className} onClick={() => void downloadDesign(files, state).then(then)}>
      {children}
    </Button>
  )
}
