# Image Gen prompt

```text
Use case: ui-mockup, targeted edit.
Image 1 is the edit target, a single phone viewport of Knotty's catalog. Keep its exact aspect ratio 195:422 and the mobile screenshot presentation, ultimately 390 × 844 px. Preserve its composition, sizes of its drawings, typography, black masthead, big title, gear and empty outlined square, natural plywood, pale straw paper and thin ink outlines. The page already has the right content. Make the following precise corrections so it works as a touch-friendly design.

Enlarge the two horizontal controls vertically. In image 1 the search field and room tabs are each only about 80 pixels high out of 852 pixels total image width. Increase them to at least 119 pixels high, about 14% of the image width, so both controls are clearly usable with a finger and measure at least 44 px high in the 390 px viewport. Draw visibly taller rectangles with more blank room above and below the existing centered labels. For a render 852 px wide, place the search outline at around y=367–489 and the tab strip at around y=499–621. Hence the search and strip are separated by just a slim straw gap. Keep the gear an outlined square of at least 100 pixels on each side out of 852 pixels width, with a small light centered gear inside. Fit the count line and thick divider closer together. The next room cell starts with “Comedor 12”, but only show the beginning of the cell so its label is clearly clipped at the right edge. The selected “Sala 21” cell remains fully visible at its current horizontal position, solid dark with light text. The rule of the tabs continues to the crop and there is no vertical end border on the right. Keep the rest of the mobile page in the same layout: full width plates separated with horizontal rules, two complete drawings, captions on two lines and their dimensions never broken. Use 16–17 logical px for reading text and at least 44 logical px per control dimension. No individual outer card boxes. Draw the sideboard with only four short square corner legs beneath its recessed base frame; remove the extra central foot that appeared in image 1. Keep its three open top niches and fine vertical flutes on all three lower doors, its upper-left drawer and both right-hand drawers, and keep the three grooved TV-stand doors and short splayed legs. No hatching anywhere. No vermilion or accent UI ink.

Reference inputs in order:
1. Generated phone draft, the only edit target. Source of all mobile composition and text positioning other than the changes stated above.
2. refs/pick-catalog.png, the mandatory catalog visual source. Match its masthead, type scale, plate numbers, furniture plates and ruled captions. Apply the corrections in this prompt over the reference; no side table of contents, wrong count, hatching or red.
3. landing-studio-and-materials.png is three stacked reference images. Top: refs/pick-landing.png, the Knotty site's selected masthead, dominant type and rules. Middle: refs/studio.png, app paper, ink and large condensed type. Bottom: refs/materials.png, ruled cells and aligned mono data. Do not transfer colors other than paper and ink, or add anything from their content.
4. refs/borrow-ruled-filters.png, rectangular room selector construction and black selected cell only.
5. refs/object-catalog-drawings.png, plywood isometric line drawing technique only, without grids or rounded boxes.

Use only this visible text verbatim. Preserve accents, spacing, punctuation, the centered dot and multiplication signs:
“Knotty”
“Encuentra tu próximo mueble.”
“Nombre, cuarto, estilo o código”
“Todas 61” · “Recámara 19” · “Sala 21” · “Comedor 12” (last cell cropped)
“21 muebles · Medidas: ancho × fondo × alto.”
“01” followed by the whole TV-stand drawing, caption line 1 “Mueble de TV ranurado”, caption line 2 “Ranurada · 180 × 40 × 60 cm”
“02” followed by the whole sideboard drawing, caption line 1 “Aparador con patas”, caption line 2 “Patas abiertas · 160 × 40 × 94 cm”

Use Oswald-like condensed bold for base names and title, Libre Franklin-like reading face for style labels and body, and IBM Plex Mono-like face for plate numbers and measures. Do not add gradients, glass, soft shadows, pill chips, decorative icons, prices, ratings, favorites, sorting, pagination, a cart, extra features, people, logos, stamps, QR codes, photos, paper distress, or decorative mid-century motifs. No device or browser chrome. Keep one search, one room selector and the rules beneath captions, on a single pale straw paper background.
```

## Image attachments in call order

- A first phone draft from Image Gen, not kept in the repo — the edit target.
- The catalog picked in the first round (option 1, rooms as chapters), not kept in the repo.
- The landing picked in the first round, [studio.png](../studio.png) and [materials.png](../materials.png), stacked as one sheet.
- A first-round catalog option, not kept in the repo — the ruled row of room cells only.
- A capture of the current catalog home — its plywood line drawings only.
