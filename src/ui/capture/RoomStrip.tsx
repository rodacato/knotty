import type { Room } from '../../domain/furniture/references'

type Choice = Room | 'all'

/** The rooms as one ruled strip of cells, like a catalogue's chapter tabs; the chosen one is printed solid in ink (UI-93). */
export function RoomStrip({ chips, chosen, onChoose }: { chips: { room: Choice; label: string; count: number }[]; chosen: Choice; onChoose: (room: Choice) => void }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0" role="group" aria-label="Cuarto">
      <div className="flex w-max min-w-full border-2 border-graphite">
        {chips.map(({ room, label, count }) => {
          const active = chosen === room
          return (
            <button
              key={room}
              type="button"
              aria-pressed={active}
              onClick={() => onChoose(room)}
              className={`flex min-h-12 flex-1 shrink-0 items-center justify-center gap-2 border-graphite px-4 text-base whitespace-nowrap not-first:border-l-2 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus md:text-lg ${
                active ? 'bg-graphite font-semibold text-bone' : 'bg-bone text-graphite hover:bg-kraft'
              }`}
            >
              {label} <span className="numerals">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
