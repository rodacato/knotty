import { Camera, Images } from '@phosphor-icons/react'
import { useRef, type ReactNode } from 'react'
import { Button } from './components'

/** Camera or gallery: on a phone `capture` opens the camera directly; on desktop both open the file picker. */
export function TakePhoto({ onChoose, disabled = false, compact = false, label }: { onChoose: (file: File) => void; disabled?: boolean; compact?: boolean; label?: ReactNode }) {
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onChoose(file)
    e.target.value = ''
  }
  const size = compact ? 'min-h-9 flex-1 px-2 text-xs' : 'min-h-9 text-xs'
  return (
    <>
      <Button variant="primary" className={size} onClick={() => camera.current?.click()} disabled={disabled} aria-label="Tomar foto">
        <Camera weight="bold" /> {!compact && (label ?? 'Tomar foto')}
      </Button>
      <Button variant="secondary" className={size} onClick={() => gallery.current?.click()} disabled={disabled} aria-label="Elegir de la galería">
        <Images weight="bold" /> {!compact && 'Galería'}
      </Button>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={choose} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={choose} />
    </>
  )
}
