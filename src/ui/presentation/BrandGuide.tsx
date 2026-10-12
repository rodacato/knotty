import { useEffect, useState } from 'react'
import { Knot } from '../system/Brand'
import { Button } from '../system/components'
import { Field, Input } from '../system/Field'
import { PageLink, Shell } from './Shell'

const colors = [
  ['bone', 'Taller', 'El fondo oscuro de la interfaz.'],
  ['kraft', 'Kraft', 'Agrupa contenido y eleva superficies.'],
  ['graphite', 'Grafito', 'Texto principal y acciones.'],
  ['graphite-2', 'Lápiz', 'Texto secundario y contexto.'],
  ['color-pine', 'Pino', 'La madera del emblema.'],
  ['color-walnut', 'Nogal', 'La tinta del ensamble sobre madera.'],
  ['color-drawing-paper', 'Papel de dibujo', 'Una superficie cálida para ver cada mueble.'],
  ['amber', 'Ámbar', 'Una selección o un acento; sin texto pequeño encima.'],
  ['rust', 'Óxido', 'Avisos críticos y acciones destructivas.'],
  ['focus', 'Foco', 'Señala dónde estás al usar el teclado.'],
]
const measures = [
  ['spacing', 'Unidad de espacio', 'La escala de Tailwind parte de esta unidad.'],
  ['spacing-page', 'Margen de página', 'Crece con la pantalla.'],
  ['spacing-section', 'Entre secciones', 'Separa ideas completas.'],
  ['radius-xl', 'Controles', 'El radio de los botones del sistema.'],
  ['radius-panel', 'Paneles', 'La forma de las superficies de estas páginas.'],
  ['radius-emblem', 'Emblema', 'La misma proporción al cambiar de tamaño.'],
  ['duration-fast', 'Respuesta rápida', 'Para cambios de interacción.'],
  ['duration-base', 'Cambio de estado', 'Para algo que merece atención.'],
  ['ease-settle', 'Curva de movimiento', 'Se asienta sin rebote.'],
]
const files = [
  ['knotty-mark.svg', 'Ensamble en nogal', 'SVG · Fondo transparente'],
  ['knotty-mono.svg', 'Ensamble monocromático', 'SVG · Para papel claro'],
  ['knotty-inverse.svg', 'Ensamble en claro', 'SVG · Para fondos oscuros'],
  ['knotty-emblem.svg', 'Emblema sobre pino', 'SVG · Editable'],
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

export function BrandGuide() {
  const values = useTokenValues()
  return <Shell page="brand">
    <section className="page-width brand-intro"><div><p className="eyebrow">Guía de marca</p><h1>Madera, papel<br />y <em>dos trazos.</em></h1><p className="lede">Dos piezas que encajan. El ensamble de Knotty habla de construir con tus manos, conserva la calidez de la madera y se dibuja de memoria.</p></div><div className="brand-intro-mark"><Knot /><span>Knotty</span></div></section>
    <nav className="guide-nav page-width" aria-label="Secciones de la guía">{[['logo', 'El logo'], ['colores', 'Colores'], ['tipografia', 'Tipografía'], ['sistema', 'Sistema'], ['voz', 'Voz'], ['descargas', 'Descargas']].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
    <section id="logo" className="page-width page-section" aria-labelledby="logo-title"><div className="section-heading"><p className="eyebrow">01 · El logo</p><h2 id="logo-title">Dos piezas. Un ensamble.</h2><p>Un trazo sube, dobla y entra. El otro lo encuentra desde el lado opuesto. Las piezas se reconocen sin dibujar un mueble; el nombre completo en Fraunces acompaña al símbolo.</p></div><div className="logo-uses"><div className="logo-use"><div className="logo-tile"><Knot /></div><span>Sobre papel</span></div><div className="logo-use"><div className="logo-tile logo-use-wood"><Knot /></div><span>Sobre pino</span></div><div className="logo-use"><div className="logo-tile logo-use-inverse"><img src="../brand/knotty-inverse.svg" alt="Ensamble de Knotty en claro" /></div><span>Sobre fondo oscuro</span></div></div><ol className="draw-steps">{['Sube, gira a la derecha y baja un tramo.', 'Desde el lado opuesto, baja, gira a la izquierda y sube.'].map((text, i) => <li key={text}><Knot className={`draw-step draw-step-${i + 1}`} /><p><span className="numerals">0{i + 1}</span> {text}</p></li>)}</ol><div className="logo-rules"><p><strong>Dale aire.</strong> Deja al menos el ancho de una pieza entre el símbolo y cualquier otro elemento. Conserva su proporción, grosor y orientación.</p><div><p><strong>Que se lea pequeño.</strong> El emblema conserva las dos piezas desde 16 px. El nombre acompaña a la marca cuando hay espacio.</p><div className="small-marks" aria-label="Logo a 16, 24 y 32 píxeles">{[16, 24, 32].map((size) => <span key={size}><img src="../brand/knotty-emblem.svg" width={size} height={size} alt="" /><small className="numerals">{size} px</small></span>)}</div></div></div></section>
    <section id="colores" className="example-section"><div className="page-width page-section"><div className="section-heading"><p className="eyebrow">02 · Colores</p><h2 id="colors-title">Colores de taller.</h2><p>El taller es oscuro y cálido. Los muebles descansan sobre papel claro con una retícula tenue; los nombres y las acciones permanecen sobre oscuro. Pino y nogal conservan su color de madera.</p></div><div className="color-grid">{colors.map(([name, label, role]) => <article key={name} className="color-sample"><div className="color-swatch" style={{ backgroundColor: `var(--${name})` }} /><h3>{label}</h3><code>--{name}</code><p className="numerals">{values[name] || '…'}</p><p className="quiet">{role}</p></article>)}</div></div></section>
    <section id="tipografia" className="page-width page-section" aria-labelledby="type-title"><div className="section-heading"><p className="eyebrow">03 · Tipografía</p><h2 id="type-title">Calidez para la idea.<br />Precisión para la medida.</h2></div><div className="type-samples"><article><div><h3>Fraunces</h3><code>--font-display</code><p className="quiet">Títulos y nombre de la marca. Con carácter, sin perder claridad.</p></div><p className="type-display">Hecho a tu medida.</p></article><article><div><h3>Inter</h3><code>--font-sans</code><p className="quiet">Lectura, instrucciones y controles. Deja que el mueble sea el protagonista.</p></div><p className="type-sans">Elige una base.<br />Ajústala. Ármala tú mismo.</p></article><article><div><h3>JetBrains Mono</h3><code>--font-mono</code><p className="quiet">Medidas, precios y códigos. Cifras alineadas, unidades siempre a la vista.</p></div><p className="type-mono">90 × 30 × 180 cm<br />Triplay · 18 mm</p></article></div><p className="quiet">Son las fuentes variables que usa la app, servidas localmente. El kit incluye los archivos y sus licencias.</p></section>
    <section id="sistema" className="example-section"><div className="page-width page-section"><div className="section-heading"><p className="eyebrow">04 · Sistema</p><h2 id="system-title">Espacio para entender.</h2><p>Más aire entre ideas que entre elementos de la misma idea. Controles de al menos 44 px y foco visible al usar el teclado.</p></div><dl className="measure-list">{measures.map(([name, label, role]) => <div key={name}><dt><strong>{label}</strong><code>--{name}</code></dt><dd><code>{values[name] || '…'}</code><span className="quiet">{role}</span></dd></div>)}</dl><p className="quiet">El movimiento acompaña las acciones. Si tu dispositivo pide reducirlo, las transiciones y animaciones se reducen también.</p><SystemExample /></div></section>
    <section id="voz" className="page-width page-section" aria-labelledby="voice-title"><div className="section-heading"><p className="eyebrow">05 · Voz</p><h2 id="voice-title">Como una buena<br />plática en el taller.</h2></div><div className="voice-grid"><div><h3>Directa y cercana.</h3><p>Decimos triplay, entrepaño, zoclo y jaladera. Las acciones empiezan con un verbo y explican qué sigue. Las medidas llevan su unidad.</p></div><div><h3>Clara cuando algo falla.</h3><p>Un aviso dice qué revisar y cómo seguir. No promete que el mueble sea seguro solo porque un modelo lo propuso.</p></div><blockquote>“Madera de verdad. Medidas claras. Un paso a la vez.”<cite>La invitación de Knotty</cite></blockquote></div></section>
    <section id="descargas" className="page-width page-section downloads-section" aria-labelledby="downloads-title"><div className="section-heading heading-row"><div><p className="eyebrow">06 · Descargas</p><h2 id="downloads-title">Llévate la marca.</h2></div><PageLink href="../brand/knotty-brand-kit.zip" primary download>Descargar todo</PageLink></div><p className="quiet">El kit incluye los SVG, el icono PNG, la fuente de tokens, las tres fuentes y sus licencias. Los SVG se pueden editar sin perder calidad.</p><div className="download-list">{files.map(([file, title, format]) => <a key={file} href={`../brand/${file}`} download><span><strong>{title}</strong><small>{format}</small></span><span className="download-verb">Descargar <span aria-hidden>↓</span></span></a>)}</div></section>
  </Shell>
}
