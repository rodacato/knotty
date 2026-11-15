# Image Gen prompt

```text
Use case: ui-mockup
Create one realistic, production-quality desktop web-app UI mockup, exact output 1440 × 1024 pixels (45:32). Render just the flat edge-to-edge Knotty catalog viewport with no browser chrome, exterior margins, device, annotations or alternative designs. The user finds a plywood base by room and opens it from its drawing.

Five attachments cover all six reference files, in this order:
1. pick-catalog.png is the mandatory primary visual source. Match its black masthead, condensed title scale, large numbered plates, ruled captions and paper-to-ink balance. Apply the corrections in this prompt over the reference.
2. pick-landing.png is the selected sibling landing page. Carry over the shared masthead character, proportions of typography, strong rules and catalog plate rhythm. Leave all landing page content and red accents out.
3. studio-and-materials.png contains studio.png (top) and materials.png (bottom). They establish the shared Knotty visual language: solid near-black masthead, straw paper, square ruled cells, condensed display text and aligned mono figures. Do not transfer their hatching, red action or screen content.
4. borrow-ruled-filters.png is the authority for the single ruled room strip: adjoining rectangular cells, no gaps, with exactly one solid near-black cell and light lettering. Its index table, selected state and other content are not used.
5. object-catalog-drawings.png is the authority for the furniture illustration medium: front-right isometric technical linework, natural subtle flat plywood tones, thin precise ink contours; leave out the background grids, rounded boxes and other furniture.

Shared art direction. A modern, legible extension of Knotty's selected “rooms as chapters” design, in the visual register of a clean late-1960s Mexican lumber-yard printed catalog. Use a single flat pale straw paper surface (#f6efdc), near-black ink (#161412) for structure and type, and natural light plywood on the illustrations. Zero vermilion or other accent ink anywhere. Restrict structure to square rules, a strong main divider, thin caption rules and purposeful whitespace. Use Oswald-like condensed bold for the title, wordmark and base names, Libre Franklin-like reading type for style labels and body, IBM Plex Mono-like numerals for measures, counts and plate numbers. Use the exact spelling, casing, accents, centered dot and multiplication sign in the quoted copy. Keep every dimension string (including “160 × 40 × 94 cm”) on one line. Treat the plates as the primary way in, without adding a separate button to the caption. One room control only, immediately below search. No side table of contents, extra menus, or repeated room names as headings. Use exactly the text listed for this viewport.
All furniture drawings are complete and distinct, with clean broad wood planes, ink outlines and no selection overlay. Never hatch a top, side or leg and do not add crosshatching anywhere. Vertical grooves are part of the carpentry on door and drawer faces only. Mueble de TV ranurado: a long low case, three equal inset door fronts, visibly routed fine vertical grooves on each door, small notch pulls and short splayed legs. Aparador con patas: taller cabinet with four columns, a small grooved drawer at upper left followed by exactly three open niches in a horizontal row, three tall grooved doors below and two stacked grooved drawers below the far-right niche. Every closed door and all three drawer fronts have fine straight vertical flutes. Put short square legs under a recessed base frame. Read these parts from the landing and Studio references, correcting the smooth drawers there. Avoid elaborate woodgrain; preserve plywood edge detail and real silhouette.
Avoid gradients, glassmorphism, rounded cards, soft shadows, pill chips, decorative icons, centered hero with three cards, prices, ratings, favorites, sorting, pagination, checkout, a cart, lorem ipsum, invented people, logos, stamps, QR codes, photos, aged or distressed paper, and decorative mid-century clichés. Draw the small outline square before “Knotty” with its interior entirely empty.

Desktop composition. Stay close to the selected reference's masthead and left-aligned head. Group the two secondary actions beside the wide outlined search field, then put the eight-room ruled strip across the full available width immediately below. Give “Sala 21” the one solid ink cell with light text. Set the count line just underneath. Below the heavy full-width divider, let the plates fill the whole page grid. Use the reference's asymmetric spread: wide stacked plates 01 then 02 on the left, a tall plate 03 spanning both rows to the right. Draw Librero abierto as a tall narrow open bookcase with two equal columns of open shelves, lower shelves spaced more generously than upper ones, and a low recessed kick. Show the whole silhouette of each piece with breathing room; there are exactly three drawings. Use large monospace plate numbers in the drawing field and a thin ruled caption below each drawing. Keep all three captions fully visible within the viewport. Use plain straw paper behind all of the drawings. The outlined masthead button uses paper text on black with a fine paper-colored outline. The other outlined buttons use near-black ink on paper.

Visible text, verbatim in reading order:
Masthead: “Knotty” · “Experto sin conectar” · “Ajustes” · “Crear un diseño”
Head: “Catálogo de muebles” · “Encuentra tu próximo mueble.” · “Elige una base de triplay y ajusta sus medidas, acabado y armado. Puedes empezar sin conectar un experto.” · “Mis muebles” · “Abrir un archivo”
Search placeholder: “Nombre, cuarto, estilo o código”
Room strip: “Todas 61” · “Recámara 19” · “Sala 21” · “Comedor 12” · “Oficina 11” · “Cocina 9” · “Entrada 4” · “Taller 1”
Count line: “21 muebles · Medidas: ancho × fondo × alto.”
Plate “01” caption: “Mueble de TV ranurado · Ranurada · 180 × 40 × 60 cm”
Plate “02” caption: “Aparador con patas · Patas abiertas · 160 × 40 × 94 cm”
Plate “03” caption: “Librero abierto · Básica · 90 × 29 × 195 cm”
```

## Image attachments in call order

- The catalog picked in the first round (option 1, rooms as chapters), not kept in the repo.
- The landing picked in the first round, not kept in the repo.
- [studio.png](../studio.png) above [materials.png](../materials.png), as one sheet.
- A first-round catalog option, not kept in the repo — the ruled row of room cells only.
- A capture of the current catalog home — its plywood line drawings only.
