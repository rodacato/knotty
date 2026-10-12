import { ArrowRight } from '@phosphor-icons/react'
import type { Card } from '../capture/cards'
import { Thumbnail } from '../capture/Thumbnail'
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

export function Presentation({ examples, scene, materials }: { examples: Card[]; scene: string; materials: string }) {
  const shown = featured.map((code) => examples.find((c) => c.base.code === code)).filter((c): c is Card => Boolean(c))
  return (
    <Shell page="presentation">
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Muebles de triplay · Hechos por ti</p>
          <h1 id="hero-title">Ese rincón ya tiene<br /><em>su próximo mueble.</em></h1>
          <p className="lede">Elige una base, ajústala a tus medidas y entiende cómo se arma. Knotty te acompaña del diseño 3D a las piezas que llevas al taller.</p>
          <PageLink href="../" primary>Elegir mi primer mueble</PageLink>
          <p className="quiet hero-note">Puedes empezar con las bases sin conectar un experto.</p>
        </div>
        <figure className="hero-example">
          <img src={scene} width="2040" height="1686" alt="Aparador de triplay en la vista 3D de Knotty, con puertas ranuradas, cajones y medidas de 160 × 40 × 94 cm." fetchPriority="high" />
          <figcaption><span>Aparador con patas <small>Captura real de Knotty · Mueble de ejemplo</small></span><a className="nav-link" href="../?ficha=KC-APA-01" aria-label="Abrir el aparador con patas en Knotty"><ArrowRight size={22} aria-hidden /></a></figcaption>
        </figure>
      </section>
      <section id="como-funciona" className="page-width page-section" aria-labelledby="steps-title">
        <div className="section-heading"><p className="eyebrow">Del espacio al taller</p><h2 id="steps-title">Antes de cortar,<br />entiende lo que vas a hacer.</h2></div>
        <ol className="steps-grid">{steps.map(([title, copy], i) => <li key={title}><span className="step-number" aria-hidden>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol>
      </section>
      <section className="example-section" aria-labelledby="examples-title">
        <div className="page-width page-section">
          <div className="section-heading heading-row"><div><p className="eyebrow">Bases que ya puedes abrir</p><h2 id="examples-title">Un lugar para tus libros.<br />Ese espacio que falta.</h2></div><a className="nav-link" href="../">Ver todas las bases <ArrowRight size={18} aria-hidden /></a></div>
          <div className="examples-grid">{shown.map(({ base, boxes, size }) => <article key={base.code} className="example-card"><a href={`../?ficha=${base.code}`} aria-label={`Abrir ${base.name} en Knotty`}><div className="example-drawing drawing-surface">{boxes && <Thumbnail boxes={boxes} />}</div><p className="eyebrow example-code">{base.code}</p><h3>{base.name}</h3><p className="numerals quiet" aria-label={size.spoken}>{size.text}</p><span className="example-action">Abrir este mueble <ArrowRight size={18} aria-hidden /></span></a></article>)}</div>
          <p className="quiet examples-note">Son bases del catálogo de Knotty, dibujadas con sus piezas reales. Las medidas se muestran como ancho × fondo × alto.</p>
        </div>
      </section>
      <section className="page-width page-section material-section" aria-labelledby="materials-title">
        <div className="material-copy"><p className="eyebrow">Del diseño a la maderería</p><h2 id="materials-title">Las piezas claras.<br />La lista a la mano.</h2><p className="lede">Mira qué lleva tu mueble antes de salir a comprar.</p><ul><li>Revisa piezas, cortes y herrajes.</li><li>Copia la lista o imprime la hoja de armado.</li><li>Ajusta los precios a los de tu tienda; el total es una estimación.</li></ul><PageLink href="../?ficha=KC-APA-01">Explorar el aparador</PageLink></div>
        <figure className="material-proof"><div className="material-proof-window"><img src={materials} alt="Lista de corte de un aparador en Knotty: medidas de las piezas, hojas de triplay y opción de copiar para la maderería." loading="lazy" /></div><figcaption className="quiet">Lista de corte · Captura de referencia</figcaption></figure>
      </section>
      <section className="page-width page-section expert-section" aria-labelledby="expert-title">
        <div><p className="eyebrow">Cuando quieres ir más allá</p><h2 id="expert-title">Platica los cambios.<br />Revisa lo que propone.</h2></div>
        <div><p className="lede">Configura Claude, OpenAI o SheLLM para pedir ajustes o describir un mueble nuevo, con fotos o texto. Claude y OpenAI necesitan tu propia llave; en SheLLM es opcional.</p><p>El experto es un modelo de IA. Revisa sus propuestas y los avisos de Knotty antes de comprar o cortar; el diseño no sustituye la revisión de un carpintero.</p><p className="quiet">La app guarda tus diseños en este navegador y puede abrir sin conexión. El experto necesita internet. Los costos se estiman con precios que puedes ajustar a tu tienda.</p></div>
      </section>
      <section className="page-width page-section faq-section" aria-labelledby="faq-title"><div className="section-heading"><p className="eyebrow">Antes de empezar</p><h2 id="faq-title">Dudas de taller.</h2></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section className="page-width closing-section"><h2>Toma las medidas.<br />Dale forma a la idea.</h2><PageLink href="../" primary>Abrir Knotty</PageLink></section>
    </Shell>
  )
}
