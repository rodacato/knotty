import { ArrowLeft, ArrowRight, Eye, LockSimple, Stack } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Release, Saving, SavingSearch, SheetCount } from '../../domain/furniture/saving/saving'
import { Button } from '../system/components'
import { RadioCard, RadioGroup } from '../system/RadioCard'
import { useStore } from '../store'

// What «Ahorrar material» found: up to three ways to use fewer sheets, or, when there is none, which lock is worth freeing.

const sheetsWord = (n: number) => (n === 1 ? 'hoja' : 'hojas')

/** «Hoy: 5 hojas de 18 mm · 3 de 6 mm». */
export const todayLine = (today: SheetCount[]) => `Hoy: ${today.map((m, i) => `${m.sheets}${i === 0 ? ` ${sheetsWord(m.sheets)}` : ''} de ${m.thickness} mm`).join(' · ')}`

/** «colchón, alto de la base ni lado de los cajones». */
const lockedList = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} ni ${names.at(-1)}` : names[0])

function Header({ search }: { search: SavingSearch }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-2 font-medium">
        <Stack className="shrink-0" /> {todayLine(search.today)}
      </p>
      {search.locked.length > 0 && <p className="text-sm text-graphite">Sin tocar {lockedList(search.locked)}:</p>}
    </div>
  )
}

function OptionCard({ option, chosen, onChoose }: { option: Saving; chosen: boolean; onChoose: () => void }) {
  const preview = useStore((s) => s.preview)
  const previewFix = useStore((s) => s.previewFix)
  const showing = preview?.design === option.design
  return (
    <div className={`relative flex flex-col gap-2 rounded-2xl border p-3.5 text-sm transition ${chosen ? 'border-graphite bg-kraft/60' : 'border-line bg-bone'}`}>
      <RadioCard variant="bare" mark checked={chosen} onChange={onChoose} className="flex flex-col gap-2 rounded-lg text-left">
        <span className="flex w-full items-start justify-between gap-2">
          <span className="font-semibold">{option.title}</span>
          <span className="numerals shrink-0 rounded-md bg-kraft px-1.5 py-0.5 font-mono text-xs">
            −{option.saved} {sheetsWord(option.saved)}
          </span>
        </span>
        <span className="flex flex-col gap-1">
          {option.changes.map((change) => (
            <span key={change} className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 shrink-0 text-graphite-2" /> {change}
            </span>
          ))}
        </span>
      </RadioCard>
      <Button variant="ghost" aria-pressed={showing} className={`min-h-11 self-start border border-line px-3 text-xs ${showing ? 'bg-kraft text-graphite' : ''}`} onClick={() => previewFix(showing ? null : { design: option.design, label: option.title })}>
        <Eye /> Ver
      </Button>
    </div>
  )
}

function ReleaseRow({ release, onRelease }: { release: Release; onRelease: () => void }) {
  return (
    <button type="button" onClick={onRelease} className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-bone p-3 text-left text-sm hover:bg-kraft">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-graphite-2">
        <LockSimple size={14} />
      </span>
      <span className="flex flex-col">
        <span className="font-semibold">Soltar «{release.label}»</span>
        <span className="text-xs text-graphite">
          {release.change}: −{release.saved} {sheetsWord(release.saved)}
        </span>
      </span>
    </button>
  )
}

/** The results in place of the form; `onUse` takes an option to the draft, `onRelease` frees a lock and searches again. */
export function SavingSheet({ search, onUse, onRelease, onBack }: { search: SavingSearch; onUse: (option: Saving) => void; onRelease: (key: string) => void; onBack: () => void }) {
  const [chosen, setChosen] = useState(0)
  const option = search.options[chosen]
  return (
    <div className="flex flex-col gap-4">
      {search.today.length > 0 && <Header search={search} />}
      {search.options.length > 0 ? (
        <RadioGroup label="Opciones para ahorrar material" className="flex flex-col gap-3">
          {search.options.map((o, i) => (
            <OptionCard key={o.title} option={o} chosen={i === chosen} onChoose={() => setChosen(i)} />
          ))}
        </RadioGroup>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-kraft/60 p-4 text-sm">
            <p className="font-semibold">{search.today.length ? 'Con lo que fijaste no hay cómo ahorrar una hoja.' : 'Así como está la ficha no se puede armar: revísala antes de buscar.'}</p>
            {search.releases.length > 0 && <p className="text-graphite">Si sueltas uno, vuelvo a buscar.</p>}
          </div>
          {search.releases.map((r) => (
            <ReleaseRow key={r.key} release={r} onRelease={() => onRelease(r.key)} />
          ))}
        </>
      )}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {option ? (
          <>
            <p className="text-xs text-graphite">Pasa a la ficha como cambio; lo aplicas o lo descartas como siempre.</p>
            <div className="flex gap-2">
              <Button variant="primary" className="min-h-11 flex-1" onClick={() => onUse(option)}>
                Usar esta
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={onBack}>
                Regresar
              </Button>
            </div>
          </>
        ) : (
          <Button variant="ghost" className="min-h-11 self-start" onClick={onBack}>
            <ArrowLeft /> Regresar a la ficha
          </Button>
        )}
      </div>
    </div>
  )
}
