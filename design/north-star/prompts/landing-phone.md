# Image Gen prompt

```text
Use case: ui-mockup. Create exactly one production-quality, edge-to-edge Knotty public website viewport. Render only the webpage, with no browser chrome, device mockup, presentation border, watermark or alternative view. Set a clear hierarchy with strong typography, specific furniture illustration, purposeful spacing and a naturally composed viewport.

Five attached visual inputs in order, carrying all six source images:
1. pick-landing.png: mandatory art direction. Match its broad black masthead, empty square before the word Knotty, warm straw paper, near-black ink, hard horizontal rules, asymmetrical editorial grid, condensed display hierarchy and ruled plate captions. The specific composition and corrections below take precedence over the old copy, finish and dimension arrows in this image.
2. pick-catalog.png: make site and app visibly part of the same product through printed furniture plates, the type hierarchy and square controls. Do not copy its app navigation, filters, data or action.
3. studio-materials.png contains studio.png on the top half (two-ink visual language, rule weights and technical annotations) and materials.png on the bottom half (two-ink printed diagram language, fine black hatching and plywood cut sheet treatment). Use the exact data below instead of copying data from these app screenshots.
4. object-aparador.jpg: geometry and vertical grooves of the real cabinet only. Do not copy its grid or UI.
5. borrow-leader-to-sheet.png: the solid black callout leader linking the illustrated cabinet top to the same piece on a cut sheet is a reference for the materials section only. Do not copy its action, cabinet fronts, dimension annotations or layout wholesale.

Use a clean, newly printed late-1960s Mexican maderería brochure register: flat pale straw paper #f6efdc, near-black ink #161412 and natural golden pine plywood on furniture. Use vermilion #cc3517 only where explicitly directed. Use Oswald-like condensed heavy display type and Libre Franklin-like reading type for all paragraphs, notes and base names at 16–18 px minimum. Use IBM Plex Mono only for codes, measures, plate and step numbers, and counts. Preserve the editorial asymmetry and alternate heavy and fine ink rules. Square corners throughout. Keep an unmarked outlined square before the mixed-case word Knotty. Leave any other designated logo plates empty.

Print only the quoted strings and explicit numbers for this particular view. Preserve accents, sentence case, punctuation, multiplication signs, middle dots and every figure. Quotation marks delimit text and are not visible. Do not add copy, data, prices, decorative labels or marks. Avoid gradients, glassmorphism, rounded cards, soft shadows, pill chips, decorative icons, centered hero with three cards, lorem ipsum, people, logos, stamps, QR codes, photographs, distressed or aged paper, starbursts, boomerangs and script lettering.

Target viewport: 390 × 844 px, aspect ratio 195:422, mobile web landing. Generate a tall single phone-width web page crop. No device frame, notch, OS status bar, clock, home indicator, rounded mask or browser controls. Translate the shop window from input 1 into one column. Use side gutters of about 16 px, an economical vertical rhythm and no desktop catalogue column in this crop.

At the top place a compact black masthead with the empty square and “Knotty” at left and a simple outlined square 44 px menu control at right, with three horizontal menu strokes and no label. Immediately below, place the exact hero copy as eyebrow, headline, lede, action and note:
“Muebles de triplay · Hechos por ti”
“Ese rincón ya tiene su próximo mueble.”
“Elige una base, ajústala a tus medidas y entiende cómo se arma. Knotty te acompaña del diseño 3D a las piezas que llevas al taller.”
“Elegir mi primer mueble”
“Puedes empezar con las bases sin conectar un experto.”
Set reading copy and the note at least 16 px, with natural line breaks. Keep the filled vermilion CTA 44 px or taller. It is the only vermilion element. Use a compact but readable multiline headline above it.

Place the dimensioned aparador plate immediately under the note, high enough that the whole plate and caption are visible before the 844 px fold. Scale the illustration itself to the available width with a dedicated left gutter for the horizontal height label, and reserve room above the cabinet for both upper-axis annotations. Compact captions can wrap by field to fit, but never split a dimension label or its units.
Depict the exact aparador from input 4 in a clean three-quarter catalogue illustration showing front and right side. Across the upper band place one short drawer on the far left followed by exactly three open niches. Below, place exactly two tall doors across the left and center and two stacked drawers at the right, beneath the last niche. Put closely spaced vertical flutes over the full surface of every single door and drawer face, especially the little upper-left drawer and each of the two right-hand drawers. The top and side panels are flat golden pine plywood. Set the piece over a recessed base frame with short square legs, visibly meeting the floor.
Make three measured axes, one width, one depth, one height. For height, draw a continuous vertical double-arrow outside the cabinet. The upper witness mark aligns with the top plane of the cabinet and the lower witness mark aligns with the floor at the sole of a square leg, below the recessed frame. The height arrow measures the legs as part of the 940 mm. Use short witness lines to make the top and floor endpoints unmistakable. Set each of these exact annotations as one unbroken horizontal line, even on mobile: “940 mm · 94 cm”, “1600 mm · 160 cm”, “400 mm · 40 cm”. Keep the labels clear of the cabinet, each other and the crop.
Finish the illustration with a ruled caption. Include the plate number “01” and the three fields “Aparador con patas” | “Mueble de ejemplo” | “KC-APA-01”.
```

## Attached images in order

- The landing picked in the first round (option 1, the shop window), not kept in the repo — art direction.
- The catalog picked in the first round (option 1, rooms as chapters), not kept in the repo — so the site and the app read as one product.
- [studio.png](../studio.png) above [materials.png](../materials.png), as one sheet — the app's two-ink language.
- A capture of the aparador KC-APA-01 from the Studio with its dimension lines — geometry and fluted fronts only.
- A first-round landing option, not kept in the repo — the leader line from the cabinet top to the same piece on the cut sheet.

## Final Image Gen edit prompt

```text
Use case: precise-object-edit. Make a narrowly targeted edit of the first attached Knotty viewport. Keep the same entire viewport and crop, 390 × 844 px (195:422), as a single edge-to-edge artwork. Preserve the original graphic design, cabinet and furniture geometry, exact Spanish text, scale, border rules, wording, dimensions, type, colors and placement everywhere outside the correction specified below.

First attached image is the exact edit target. Attachment 2, pick-landing.png, is the approved visual direction. Attachment 3, object-aparador.jpg, documents the real fluted cabinet and square legs. Attachment 4 contains studio.png on top and materials.png below, for art direction. Attachment 5 contains pick-catalog.png on top and borrow-leader-to-sheet.png below, for art direction. Ignore any split height text in the art direction inputs.

Correct the height annotation at the left of the cabinet in the first image: completely erase the old two-line height text from beside the shaft. Reconnect the black vertical shaft through the former gap into one continuous double-ended arrow. Keep the upper horizontal witness tick aligned with the top plane of the cabinet and align the lower horizontal witness tick with the floor where the sole of the front left square leg touches it. The extension is from the top to the floor, legs included. Typeset the full height annotation once, exactly “940 mm · 94 cm”, as one uninterrupted horizontal line in near-black IBM Plex Mono, in the clear paper under the left-hand foot and arrow, before the ruled caption begins, left aligned with the caption. This placement gives the label space for a single line. It may extend to the right across the empty paper underneath the illustration. The midpoint of the vertical arrow must have no text anywhere. Do not put “94 cm” on a new line under “940 mm ·”. Leave the width and depth annotations at the top as single-line “1600 mm · 160 cm” and “400 mm · 40 cm”.

One letter-case correction on the vermilion button: render its exact existing wording in normal sentence case “Elegir mi primer mueble”, preserving the button size, position and color. No other copy changes.

Output only the revised viewport, with no added annotations, external border, device frame, logo drawing, or commentary.
```

### Attached images in order for the final edit

- The first output of the prompt above, not kept in the repo — the edit target.
- The landing picked in the first round, not kept in the repo.
- A capture of the aparador KC-APA-01 from the Studio with its dimension lines.
- [studio.png](../studio.png) above [materials.png](../materials.png), as one sheet.
- The catalog picked in the first round above the first-round leader-line option, as one sheet; neither is kept in the repo.
