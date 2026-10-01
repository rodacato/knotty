import type { ReactNode } from 'react'

export interface Status {
  key: string
  icon: ReactNode
  label: ReactNode
  onClick?: () => void
  actions?: ReactNode
}

const LOOK = 'animate-appear pointer-events-auto flex min-h-9 items-center gap-2 rounded-full border border-line bg-bone/95 py-1 pl-3 text-xs font-medium text-graphite shadow-sm backdrop-blur'

/** One status over the 3D at a time: the first of the list, which the caller orders by priority. */
export function StatusChip({ statuses }: { statuses: Status[] }) {
  const status = statuses[0]
  if (!status) return null
  const body = (
    <>
      {status.icon}
      <span>{status.label}</span>
    </>
  )
  if (status.onClick)
    return (
      <div role="status" className="contents">
        <button type="button" onClick={status.onClick} className={`${LOOK} pr-3 hover:bg-kraft`}>
          {body}
        </button>
      </div>
    )
  return (
    <div role="status" className={`${LOOK} ${status.actions ? 'pr-1' : 'pr-3'}`}>
      {body}
      {status.actions}
    </div>
  )
}
