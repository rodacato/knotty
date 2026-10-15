# Marketing copy and examples

This is the approved direction and reusable copy from the shipped landing, metadata, footer and social card. Instructions are in English; quoted product copy stays in es-MX. The implementation remains authoritative: `src/ui/presentation/Presentation.tsx`, `Shell.tsx`, root `index.html` and `scripts/brand/share.py`. Update this handoff when those surfaces change.

## Audience and promise

For someone who has a space to furnish and wants to start from a plywood furniture base, adjust its dimensions and understand the pieces before buying or cutting. Lead with that outcome; expert configuration comes later.

Eyebrow:

> Muebles de triplay · Hechos por ti

Headline:

> Ese rincón ya tiene su próximo mueble.

Description:

> Elige una base, ajústala a tus medidas y entiende cómo se arma. Knotty te acompaña del diseño 3D a las piezas que llevas al taller.

Primary action, leading to `/catalog/#catalog`:

> Elegir mi primer mueble

Supporting note:

> Puedes empezar con las bases sin conectar un experto.

## The three-part explanation

1. **Choose.**

   > Elige una base. Empieza con un librero, un buró o un escritorio del catálogo. Cada base ya tiene medidas y opciones para ajustar.

2. **Adjust.**

   > Hazla a tu medida. Cambia el ancho, el fondo y el alto. Mira el mueble en 3D, abre sus puertas o separa las piezas para entenderlo.

3. **Take the list.**

   > Llévate la lista. Revisa las piezas, los materiales y los avisos. Copia la lista para la maderería o imprime la hoja de armado.

Section invitation:

> Antes de cortar, entiende lo que vas a hacer.

## Product proof

| Asset / source | What it shows | How to use it |
|---|---|---|
| [aparador.jpg](aparador.jpg) | The existing aparador scene from the landing | Show it on warm paper, next to the dark copy column. Label it as example furniture. |
| [materials-cut-list.jpg](materials-cut-list.jpg) | The landing's cut-list reference capture | Explain the list, dimensions and materials; it is a reference capture, not a claim about the latest panel layout. |
| [share.png](share.png) | The existing social card, with outlined local fonts | Use as a 1200 × 630 social preview, without stretching. |
| Live catalog geometry | Librero `KC-LIB-03`, buró `KC-BUR-02`, escritorio `KC-ESC-03` | Render existing `Thumbnail` geometry; do not invent testimonial or customer imagery. |

Catalog section:

> Encuentra una base para tu espacio.

Materials section:

> Las piezas claras. La lista a la mano.

> Mira qué lleva tu mueble antes de salir a comprar.

Social-card description:

> Elige una base. Ajústala a tus medidas. Mira cómo se arma y llévate la lista al taller.

Footer:

> De tu espacio al taller.

## Actions and destinations

Paths below are relative to the deployment base (`/knotty/` on GitHub Pages). Keep route fragments so the destination remains visible and shareable.

| Purpose | Existing es-MX label | Destination |
|---|---|---|
| Start / browse | Elegir mi primer mueble; Explorar el catálogo | `catalog/#catalog` |
| Open the example | Ajustar el aparador | `catalog/#catalog/adjust/KC-APA-01` |
| Explain the process | Cómo funciona | `#como-funciona` on the landing |
| Explain the identity | Guía de marca | `marca/` |
| Download the brand | Descargar todo | `brand/knotty-brand-kit.zip` |
| Close the invitation | Toma las medidas. Dale forma a la idea. | Follow with Explorar el catálogo |

Use the root landing for presentation. The old `presentacion/` route only redirects; do not market it as another destination. Links into a saved Studio depend on a design in that browser; use the catalog for a first visit.

## Metadata

Page title:

> Knotty · Ese rincón ya tiene su próximo mueble

Search description:

> Elige una base de triplay, ajústala a tus medidas y revisa sus piezas en 3D antes de llevarlas al taller.

Social description:

> Elige una base de triplay, ajústala a tus medidas y entiende cómo se arma.

The root document supplies canonical, Open Graph and social-image URLs. Preserve the repository base when changing hosting.

## Claims and limits

- Catalog bases can be adjusted without an LLM connection. Do not make AI setup the first action.
- Claude and OpenAI require the person's key; SheLLM's key is optional. The expert needs internet.
- Offline opening follows an online visit; do not promise that an unvisited page is already available offline.
- Prices are estimates with editable reference prices, not a store quotation.
- A generated design requires review before buying or cutting. Do not advertise structural certification, guaranteed load capacity or automatic resolution of findings.
- The guide and printable/PDF actions must describe what the current design actually includes. Do not promise assembly phases for a design that only has a cut guide.
- The example furniture are product examples, not customers. Do not invent testimonials, usage counts or endorsements.
