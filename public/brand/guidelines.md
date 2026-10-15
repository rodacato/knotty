# Brand guidelines

Knotty helps a person choose a plywood furniture base, adjust it to their space, understand its pieces in 3D and take a reviewed materials/cut list to the workshop. The identity connects the activity to wood, paper and a simple assembly.

## Mark and wordmark

The approved mark is two opposing pieces drawn in two strokes. It suggests an assembly without depicting a particular piece of furniture. The wordmark is **Knotty**, set in the existing Fraunces display face.

- Keep the proportions, orientation and line weight of the SVGs.
- Leave clear space at least as wide as one piece; do not cram the mark against text or a card edge.
- Use walnut or monochrome on light paper, inverse on dark surfaces, pine for the emblem.
- Inspect at 16, 24 and 32 px when exporting icons. Use the maskable variant's safe area rather than cropping the regular emblem.
- Do not stretch, rotate, add shadows to, or draw extra wood grain inside the mark.

The editable geometry lives in `src/ui/system/knot.svg`. `src/ui/system/Brand.tsx` and the export script reuse it; exported variants should never become a competing source.

## Surfaces and color roles

The **workshop is dark; the drawing stage is light**. Wood keeps its material color. These are intentional roles, independent of the device's light/dark preference.

| Context | Existing role |
|---|---|
| Page background | `--bone` |
| Grouped or raised content | `--kraft`, `--kraft-2` |
| Main and secondary text | `--graphite`, `--graphite-2` |
| Selection and accent | `--amber`, `--amber-soft` |
| Critical findings | `--rust`, with an icon and explicit wording |
| Keyboard position | `--focus` |
| Wood identity | `--color-pine`, `--color-walnut`, `--color-birch` |
| Furniture drawings | `--color-drawing-paper`, `--color-drawing-grid` |

Read actual values from [knotty.tokens.css](knotty.tokens.css) or the visual guide, which reads the running CSS properties. Do not maintain a second palette table of hex values.

Use `.drawing-sheet` for illustrated choices, joints, edge diagrams and sheet layouts; `.drawing-surface` adds the decorative grid for thumbnails. The 3D scene uses the same light paper and its own lighting. Keep surrounding descriptions and actions on dark surfaces. A dark interface does not mean dark furniture previews. The grid is decorative, not a measurement scale.

## Typography and layout

- **Fraunces:** headings, wordmark and the existing prominent estimate treatment.
- **Inter:** paragraphs, instructions, actions and controls.
- **JetBrains Mono:** measures, technical codes and tabular figures where alignment helps.
- Use the local variable fonts and keep their corresponding licenses when redistributing them. The exported files are Latin subsets; check character coverage before using another writing system.
- Use the spacing, radius and type tokens from the stylesheet. Give more space between ideas than within one idea. Do not add a parallel component library for marketing.
- Preserve visible focus, readable contrast, existing 44 px control targets and reduced-motion behavior. Color alone must not carry a decision or warning.

## Voice

Product copy is Mexican Spanish: direct, close and concrete, like a conversation in a workshop. Use **triplay, entrepaño, zoclo, jaladera**. Begin actions with a verb that explains what happens next. Show units; furniture dimensions are presented as width × depth × height, while calculations use millimeters.

Approved brand invitation:

> Madera de verdad. Medidas claras. Un paso a la vez.

State what the person can do and what they must review. Estimates are not quotations; expert output is a proposal, not a safety certification. See [marketing.md](marketing.md) for the shipped copy, destinations and product limits.

## Reference surfaces

- [Brand guide](https://rodacato.github.io/knotty/marca/): mark, live token values, type specimens, system example, voice and downloads.
- [Landing](https://rodacato.github.io/knotty/): the outcome, real product examples and one path into the catalog.
- [Catalog and Studio](https://rodacato.github.io/knotty/catalog/#catalog): the operational product; preserve its existing visual conventions.
- [Brand source and maintenance](https://github.com/rodacato/knotty/blob/main/design/brand/README.md): where each source lives and how the kit is regenerated.
- [Preview and PWA contract](https://github.com/rodacato/knotty/blob/main/docs/brand.md): preview, export and hosting verification.
