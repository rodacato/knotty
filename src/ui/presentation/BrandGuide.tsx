import { useEffect, useState } from 'react'
import { Knot } from '../system/Brand'
import { Button } from '../system/components'
import { Field, Input } from '../system/Field'
import { PageLink, Shell } from './Shell'

const colors = [
  ['bone', 'Papel', 'El fondo de toda la interfaz: paja pálida, nunca blanco.'],
  ['kraft', 'Kraft', 'Agrupa contenido y eleva superficies.'],
  ['graphite', 'Tinta', 'Texto, reglas y lo que está elegido.'],
  ['graphite-2', 'Lápiz', 'Texto secundario y contexto.'],
  ['select', 'Selección', 'Lo elegido va en tinta: relleno negro, achurado o una marca, nunca solo color.'],
  ['action', 'Bermellón', 'Solo la acción principal de cada pantalla.'],
  ['color-pine', 'Pino', 'La madera del emblema.'],
  ['color-walnut', 'Nogal', 'La tinta del ensamble sobre madera.'],
  ['color-drawing-paper', 'Papel de dibujo', 'Donde se dibuja cada mueble.'],
  ['rust', 'Óxido', 'Solo lo que no se puede hacer, siempre con su ícono. Un aviso común va en tinta, con barra a la izquierda.'],
  ['focus', 'Foco', 'Señala dónde estás al usar el teclado.'],
]
const measures = [
  ['spacing', 'Unidad de espacio', 'La escala de Tailwind parte de esta unidad.'],
  ['spacing-page', 'Margen de página', 'Crece con la pantalla.'],
  ['spacing-section', 'Entre secciones', 'Separa ideas completas.'],
  ['radius-emblem', 'Emblema', 'La misma proporción al cambiar de tamaño.'],
  ['duration-fast', 'Respuesta rápida', 'Para cambios de interacción.'],
  ['duration-base', 'Cambio de estado', 'Para algo que merece atención.'],
  ['ease-settle', 'Curva de movimiento', 'Se asienta sin rebote.'],
]
const files = [
  ['knotty-mark.svg', 'Marca a dos tintas', 'SVG · Fondo transparente'],
  ['knotty-mono.svg', 'Marca a una tinta', 'SVG · Para papel claro'],
  ['knotty-inverse.svg', 'Marca en claro', 'SVG · Para fondos oscuros'],
  ['knotty-emblem.svg', 'Emblema · la tabla del nudo', 'SVG · Editable'],
  ['knotty-icon.png', 'Icono de la app', 'PNG · 512 × 512 px'],
  ['knotty-maskable.svg', 'Icono maskable', 'SVG · Margen de protección incluido'],
  ['knotty.tokens.css', 'Fuente de tokens', 'CSS · Incluye imports de Tailwind y Fontsource'],
]

function useTokenValues() {
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    const names = [...colors, ...measures].map(([name]) => name)
    const read = () => {
      const css = getComputedStyle(document.documentElement)
      setValues(Object.fromEntries(names.map((name) => [name, css.getPropertyValue(`--${name}`).trim()])))
    }
    read()
  }, [])
  return values
}

function SystemExample() {
  const [width, setWidth] = useState('90')
  const [shown, setShown] = useState(false)
  return <div className="system-example"><div><p className="eyebrow">Una muestra del sistema</p><h3>Medidas claras. Acciones claras.</h3><p>La cifra usa la fuente de medidas. El botón toma los estados y el foco del sistema de Knotty.</p></div><div className="sample-controls"><Field label="Ancho (cm)"><Input type="number" min="1" value={width} onChange={(e) => setWidth(e.target.value)} className="numerals" /></Field><Button variant="primary" onClick={() => setShown(!shown)} aria-expanded={shown} aria-controls="sample-result">{shown ? 'Ocultar medida' : 'Ver medida'}</Button><p id="sample-result" className="numerals" aria-live="polite">{shown ? `Ancho de muestra: ${width || '—'} cm` : 'Cambia el ancho y prueba el botón.'}</p></div></div>
}

const sections = [['logo', 'El logo'], ['colores', 'Colores'], ['tipografia', 'Tipografía'], ['sistema', 'Sistema'], ['voz', 'Voz'], ['descargas', 'Descargas']]
/** The kit's four marks, each printed on its own plate under its file's title (UI-93). */
const plates = files.slice(0, 4)

export function BrandGuide() {
  const values = useTokenValues()
  return <Shell page="brand">
    <section className="page-width brand-intro">
      <div className="brand-intro-copy"><p className="eyebrow">Guía de marca</p><h1>Madera, papel y <em>dos tintas.</em></h1><p className="lede">Dos tablas unidas, una con su nudo. La marca de Knotty habla de construir con tus manos y está impresa como la nota de una maderería: tinta negra y un registro bermellón que no cae exacto.</p></div>
      <div className="brand-intro-mark"><Knot /></div>
    </section>
    <nav className="guide-nav page-width" aria-label="Secciones de la guía"><ul>{sections.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul></nav>
    <section id="logo" className="page-width brand-section" aria-labelledby="logo-title"><div className="section-heading"><p className="eyebrow">01 · El logo</p><h2 id="logo-title">Dos tablas. Un nudo.</h2><p>Una unión de dientes junta dos tablas de pino. La de la izquierda lleva el nudo que le da nombre a Knotty, con la veta que lo rodea. La placa bermellón va un poco corrida, como en la prensa; el nombre completo en Oswald acompaña al símbolo.</p></div>
      <div className="logo-plates">{plates.map(([file, title]) => <figure key={file} className={file === 'knotty-inverse.svg' ? 'logo-plate logo-plate-inverse' : 'logo-plate'}><div><img src={`../brand/${file}`} alt="" /></div><figcaption>{title}</figcaption></figure>)}</div>
      <div className="logo-rules"><p><strong>Dale aire.</strong> Deja al menos la altura de una tabla entre el símbolo y cualquier otro elemento. Conserva su proporción y orientación, y no enderezes sus bordes.</p><div><p><strong>Que se lea pequeño.</strong> En tamaños chicos el emblema es la tabla del nudo: se reconoce desde 16 px. El nombre acompaña a la marca cuando hay espacio.</p><div className="small-marks" aria-label="Logo a 16, 24 y 32 píxeles">{[16, 24, 32].map((size) => <span key={size}><img src="../brand/knotty-emblem.svg" width={size} height={size} alt="" /><small className="numerals">{size} px</small></span>)}</div></div></div></section>
    <section id="colores" className="page-width brand-section" aria-labelledby="colors-title"><div className="section-heading"><p className="eyebrow">02 · Colores</p><h2 id="colors-title">Dos tintas sobre papel.</h2><p>Como la nota de despiece de una maderería: tinta negra para el texto, las reglas y lo que eliges, y una sola tinta bermellón para la acción principal. Todo va sobre papel paja pálido. Pino y nogal conservan su color de madera.</p></div><div className="color-grid">{colors.map(([name, label, role]) => <article key={name} className="color-sample"><div className="color-cell"><div className="color-swatch" style={{ backgroundColor: `var(--${name})` }} /><h3>{label}</h3></div><code>--{name}</code><p className="numerals">{values[name] || '…'}</p><p className="quiet">{role}</p></article>)}</div></section>
    <section id="tipografia" className="page-width brand-section" aria-labelledby="type-title"><div className="section-heading"><p className="eyebrow">03 · Tipografía</p><h2 id="type-title">Letra de imprenta para la idea. Precisión para la medida.</h2></div>
      <div className="type-samples">
        <article><h3 className="type-name type-name-display">Oswald</h3><p className="type-display">Hecho a tu medida.</p><code>--font-display</code><p className="quiet">Títulos, pasos, botones y nombre de la marca. Una gótica condensada de catálogo de ferretería; mayúsculas solo en pasos, títulos de panel y botones.</p></article>
        <article><h3 className="type-name type-name-sans">Libre Franklin</h3><p className="type-sans">Elige una base.<br />Ajústala. Ármala tú mismo.</p><code>--font-sans</code><p className="quiet">Lectura, ayudas y avisos. Deja que el mueble sea el protagonista.</p></article>
        <article><h3 className="type-name type-name-mono">IBM Plex Mono</h3><p className="type-mono">90 × 30 × 180 cm<br />Triplay · 18 mm</p><code>--font-mono</code><p className="quiet">Medidas, precios y códigos. Cifras alineadas, unidades siempre a la vista.</p></article>
      </div>
      <p className="quiet">Son las fuentes que usa la app, servidas localmente. El kit incluye los archivos y sus licencias.</p></section>
    <section id="sistema" className="page-width brand-section" aria-labelledby="system-title"><div className="section-heading"><p className="eyebrow">04 · Sistema</p><h2 id="system-title">Espacio para entender.</h2><p>Más aire entre ideas que entre elementos de la misma idea. Controles de al menos 44 px y foco visible al usar el teclado.</p></div><dl className="measure-list">{measures.map(([name, label, role]) => <div key={name}><dt><strong>{label}</strong><code>--{name}</code></dt><dd><code>{values[name] || '…'}</code><span className="quiet">{role}</span></dd></div>)}</dl><p className="quiet">El movimiento acompaña las acciones. Si tu dispositivo pide reducirlo, las transiciones y animaciones se reducen también.</p><SystemExample /></section>
    <section id="voz" className="page-width brand-section" aria-labelledby="voice-title"><div className="section-heading"><p className="eyebrow">05 · Voz</p><h2 id="voice-title">Como una buena plática en el taller.</h2></div><div className="voice-grid"><div><h3>Directa y cercana.</h3><p>Decimos triplay, entrepaño, zoclo y jaladera. Las acciones empiezan con un verbo y explican qué sigue. Las medidas llevan su unidad.</p></div><div><h3>Clara cuando algo falla.</h3><p>Un aviso dice qué revisar y cómo seguir. No promete que el mueble sea seguro solo porque un modelo lo propuso.</p></div><blockquote>“Madera de verdad. Medidas claras. Un paso a la vez.”<cite>La invitación de Knotty</cite></blockquote></div></section>
    <section id="descargas" className="page-width brand-section" aria-labelledby="downloads-title"><div className="section-heading heading-row"><div><p className="eyebrow">06 · Descargas</p><h2 id="downloads-title">Llévate la marca.</h2></div><PageLink href="../brand/knotty-brand-kit.zip" primary download>Descargar todo</PageLink></div><p className="quiet">El kit incluye los SVG, el icono PNG, la fuente de tokens, las tres fuentes y sus licencias. Los SVG se pueden editar sin perder calidad.</p><div className="download-list">{files.map(([file, title, format]) => <a key={file} href={`../brand/${file}`} download><span><strong>{title}</strong><small>{format}</small></span><span className="download-verb">Descargar <span aria-hidden>↓</span></span></a>)}</div></section>
  </Shell>
}
