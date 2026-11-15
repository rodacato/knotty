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

/** The app's emblem, the mark every masthead carries (app, Studio and site); `root` is where the site's page sits. */
export function Emblem({ className = '', root = '../' }: { className?: string; root?: './' | '../' }) {
  return <img src={`${root}icon-192.png`} alt="" className={`rounded-emblem ${className}`} />
}
