import { ArrowRight, Cube } from '@phosphor-icons/react'
import { EXAMPLES } from '../../domain/furniture/examples'
import { Button } from '../system/components'
import { Logo, Emblem } from '../system/Brand'
import { useStore } from '../store'

/** A piece of furniture in exploded view, drawn as a sketch. */
function Sketch() {
  const stroke = 'fill-none stroke-graphite/70 [stroke-width:1.4] [stroke-linejoin:round]'
  const wood = 'fill-pine/40 stroke-graphite/70 [stroke-width:1.4] [stroke-linejoin:round]'
  return (
    <svg viewBox="0 0 260 220" className="h-auto w-full max-w-[300px]" aria-hidden>
      <g className="animate-appear">
        <path className={wood} d="M60 40 l80 -20 l0 150 l-80 20 z" />
        <path className={stroke} d="M60 40 l-14 -6 l0 150 l14 6" />
        <path className={wood} d="M170 30 l40 -10 l0 150 l-40 10 z" />
        <path className={wood} d="M72 92 l64 -16 l38 14 l-64 16 z" />
        <path className={wood} d="M72 132 l64 -16 l38 14 l-64 16 z" />
        <path className={`${stroke} [stroke-dasharray:3_4]`} d="M110 106 l0 -40 M110 146 l0 30" />
        <path className="fill-amber/70 stroke-graphite/70 [stroke-width:1.4]" d="M84 60 l52 -13 l20 7 l-52 13 z" />
      </g>
      <g className="text-graphite-2">
        <path className="fill-none stroke-current [stroke-width:1]" d="M46 200 l124 -30" />
        <path className="fill-none stroke-current [stroke-width:1]" d="M46 194 l0 12 M170 164 l0 12" />
      </g>
    </svg>
  )
}

export function Home() {
  const startCapture = useStore((s) => s.startCapture)
  const fromExample = useStore((s) => s.fromExample)
  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-10 px-6 py-12 md:flex-row md:gap-16">
      <div className="flex max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <Emblem className="size-10 shadow-[0_8px_20px_-10px_rgba(43,40,37,.6)]" />
          <p className="numerals text-xs uppercase tracking-[0.2em] text-graphite-2">Muebles de triplay · DIY</p>
        </div>
        <h1 className="text-6xl leading-[0.95] md:text-7xl">
          <Logo />
        </h1>
        <p className="text-lg leading-relaxed text-graphite-2">
          Toma fotos de un mueble y un carpintero experto lo convierte en un diseño de triplay que puedes explorar, ajustar platicando y armar tú mismo. Al final sabes cómo se arma y cuántas hojas comprar.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" className="min-h-12 px-6 text-base" onClick={startCapture}>
            Nuevo diseño <ArrowRight weight="bold" />
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-graphite-2">O empieza con un ejemplo:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button key={example.name} variant="secondary" onClick={() => fromExample(example)}>
                <Cube /> {example.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <Sketch />
    </main>
  )
}
