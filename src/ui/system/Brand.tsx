import mark from './knot.svg?raw'

const drawing = /<g[\s\S]*<\/g>/.exec(mark)![0]
const strokeWidth = Number(/stroke-width="([^"]+)"/.exec(mark)![1])

export function Knot({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={className} aria-hidden dangerouslySetInnerHTML={{ __html: drawing }} />
  )
}

export function Emblem({ className = '' }: { className?: string }) {
  return <img src="../icon-192.png" alt="" className={`rounded-emblem ${className}`} />
}
