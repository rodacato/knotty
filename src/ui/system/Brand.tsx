import mark from './knot.svg?raw'

const path = (name: string) => new RegExp(`class="${name}"[^>]*\\sd="([^"]+)"`).exec(mark)![1]
const viewBox = /viewBox="([^"]+)"/.exec(mark)![1]
const ink = path('ink')
const plate = path('plate')

/** The two-ink mark: the ink plate takes `currentColor`, so on a dark band it prints in paper; the vermilion plate is optional. */
export function Knot({ className = '', plated = true }: { className?: string; plated?: boolean }) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden>
      {plated && <path d={plate} fill="var(--action)" fillRule="evenodd" />}
      <path d={ink} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}

export function Emblem({ className = '' }: { className?: string }) {
  return <img src="../icon-192.png" alt="" className={`rounded-emblem ${className}`} />
}
