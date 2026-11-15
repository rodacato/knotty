import type { Card } from '../capture/cards'
import { Thumbnail } from '../capture/Thumbnail'
import { SheetDiagram } from '../studio/SheetDiagram'
import type { ExampleSheet } from './exampleSheet'
import { Leader } from './Leader'
import { PageLink, Shell } from './Shell'

const featured = ['KC-LIB-03', 'KC-BUR-02', 'KC-ESC-03']
const steps = [
  ['Elige una base', 'Empieza con un librero, un buró o un escritorio del catálogo. Cada base ya tiene medidas y opciones para ajustar.'],
  ['Hazla a tu medida', 'Cambia el ancho, el fondo y el alto. Mira el mueble en 3D, abre sus puertas o separa las piezas para entenderlo.'],
  ['Llévate la lista', 'Revisa las piezas, los materiales y los avisos. Copia la lista para la maderería o imprime la hoja de armado.'],
]

const questions = [
  ['¿Necesito conectar una IA?', 'No para empezar. Las bases del catálogo se ajustan al instante sin un experto. Conecta uno cuando quieras pedir otros cambios o describir un mueble nuevo.'],
  ['¿Puedo usarlo sin internet?', 'Después de abrir la app en línea, puede volver a abrir sin conexión en este navegador. El experto sí necesita internet.'],
  ['¿El diseño está listo para fabricar?', 'Revisa las medidas, los materiales y los avisos antes de comprar o cortar. Knotty te ayuda a entender el diseño; no sustituye la revisión de un carpintero.'],
  ['¿Cómo me llevo los cortes?', 'Puedes copiar la lista para la maderería o imprimir la hoja de armado. Desde la ventana de impresión también puedes guardarla como PDF. Los costos son estimados y puedes ajustar los precios a tu tienda.'],
]

/** Where the sideboard's top sits in the scene capture, as fractions of the image, for the leader line. */
const TOP_IN_SCENE = { x: 0.53, y: 0.18 }

export function Presentation({ examples, scene, sheet, root = '../' }: { examples: Card[]; scene: string; sheet: ExampleSheet | null; root?: './' | '../' }) {
  const shown = featured.map((code) => examples.find((c) => c.base.code === code)).filter((c): c is Card => Boolean(c))
  return (
    <Shell page="presentation" root={root}>
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-main">
          <div className="hero-copy">
            <p className="eyebrow">Muebles de triplay · Hechos por ti</p>
            <h1 id="hero-title">Ese rincón ya tiene su próximo mueble.</h1>
            <p className="lede">Elige una base, ajústala a tus medidas y entiende cómo se arma. Knotty te acompaña del diseño 3D a las piezas que llevas al taller.</p>
            <PageLink href={`${root}catalog/#catalog`} primary>Elegir mi primer mueble</PageLink>
            <p className="hero-note">Puedes empezar con las bases sin conectar un experto.</p>
          </div>
          <figure className="plate">
            <img src={scene} width="1690" height="1320" alt="Aparador de triplay en la vista 3D de Knotty, con puertas ranuradas, cajones y medidas de 160 × 40 × 94 cm." fetchPriority="high" />
            <figcaption className="plate-caption">
              <span className="plate-number">01</span>
              <a className="plate-name" href={`${root}catalog/#catalog/adjust/KC-APA-01`}>Aparador con patas</a>
              <span>Mueble de ejemplo</span>
              <span className="plate-code">KC-APA-01</span>
            </figcaption>
          </figure>
        </div>
        <div id="catalog" className="hero-index">
          <p className="eyebrow">Del catálogo, a tu medida</p>
          <h2 id="examples-title">Encuentra una base para tu espacio.</h2>
          <ol className="index-list">
            {shown.map(({ base, boxes, size }, i) => (
              <li key={base.code}>
                <a href={`${root}catalog/#catalog/adjust/${base.code}`} aria-label={`Ajustar ${base.name} en Knotty`}>
                  <span className="index-number" aria-hidden>0{i + 1}</span>
                  <span className="index-drawing">{boxes && <Thumbnail boxes={boxes} />}</span>
                  <span className="index-text">
                    <span className="index-code">{base.code}</span>
                    <span className="index-name">{base.name}</span>
                    <span className="numerals" aria-label={size.spoken}>{size.text}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p className="index-note">Son bases del catálogo de Knotty, dibujadas con sus piezas reales. Las medidas se muestran como ancho × fondo × alto.</p>
          <a className="text-link" href={`${root}catalog/#catalog`}>Explorar el catálogo</a>
        </div>
      </section>
      <section id="como-funciona" className="page-width steps-section" aria-labelledby="steps-title">
        <div className="section-band"><p className="eyebrow">Del espacio al taller</p><h2 id="steps-title">Antes de cortar, entiende lo que vas a hacer.</h2></div>
        <ol className="steps-strip">{steps.map(([title, copy], i) => <li key={title}><h3><span className="step-number" aria-hidden>0{i + 1}</span>{title}</h3><p>{copy}</p></li>)}</ol>
      </section>
      <section id="materiales" className="page-width page-section material-section" aria-labelledby="materials-title">
        <div className="section-heading"><p className="eyebrow">Del diseño a la maderería</p><h2 id="materials-title">Las piezas claras. La lista a la mano.</h2><p className="lede">Mira qué lleva tu mueble antes de salir a comprar.</p></div>
        {sheet && (
          <Leader className="material-figure" label="Techo" from={TOP_IN_SCENE} to={sheet.chosen}>
            <img className="material-piece" src={scene} width="1690" height="1320" alt="" loading="lazy" />
            <div className="material-sheet"><SheetDiagram {...sheet} /></div>
          </Leader>
        )}
        <div className="material-foot">
          <ul><li>Revisa piezas, cortes y herrajes.</li><li>Copia la lista o imprime la hoja de armado.</li><li>Ajusta los precios a los de tu tienda; el total es una estimación.</li></ul>
          <div><PageLink href={`${root}catalog/#catalog/adjust/KC-APA-01`}>Ajustar el aparador</PageLink></div>
        </div>
      </section>
      <section id="experto" className="page-width page-section expert-section" aria-labelledby="expert-title">
        <div><p className="eyebrow">Cuando quieres ir más allá</p><h2 id="expert-title">Platica los cambios. Revisa lo que propone.</h2></div>
        <div><p className="lede">Configura Claude, OpenAI o SheLLM para pedir ajustes o describir un mueble nuevo, con fotos o texto. Claude y OpenAI necesitan tu propia llave; en SheLLM es opcional.</p><p>El experto es un modelo de IA. Revisa sus propuestas y los avisos de Knotty antes de comprar o cortar; el diseño no sustituye la revisión de un carpintero.</p><p className="small">La app guarda tus diseños en este navegador y puede abrir sin conexión. El experto necesita internet. Los costos se estiman con precios que puedes ajustar a tu tienda.</p></div>
      </section>
      <section id="preguntas" className="page-width page-section faq-section" aria-labelledby="faq-title"><div className="section-heading"><p className="eyebrow">Antes de empezar</p><h2 id="faq-title">Dudas de taller.</h2></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section id="empezar" className="page-width closing-section"><h2>Toma las medidas. Dale forma a la idea.</h2><PageLink href={`${root}catalog/#catalog`}>Explorar el catálogo</PageLink></section>
    </Shell>
  )
}
