# Knotty brand kit

The approved **two-stroke assembly mark**, dark workshop and light drawing sheets, existing fonts, and shipped marketing in one portable folder. Start with [brand guidelines](guidelines.md) and [marketing copy and examples](marketing.md).

## Download

- [Download the published ZIP](https://rodacato.github.io/knotty/brand/knotty-brand-kit.zip), or choose **Descargar todo** in the [brand guide](https://rodacato.github.io/knotty/marca/#descargas).
- In a checkout, the generated kit is served from `public/brand/` and its archive is `public/brand/knotty-brand-kit.zip`. Extract it to get `knotty-brand-kit/`; its assets and these instructions travel together.
- The published archive changes only after the normal GitHub Pages deployment. Generating the kit locally does not publish it.

## Use the assets

| Need | Use |
|---|---|
| Mark on light paper | [Walnut](knotty-mark.svg) or [monochrome](knotty-mono.svg) SVG |
| Mark on a dark background | [Inverse SVG](knotty-inverse.svg) |
| App emblem | [Pine emblem SVG](knotty-emblem.svg) or [512 px PNG](knotty-icon.png) |
| Maskable icon | [Safe-area SVG](knotty-maskable.svg) or `icon-maskable-*.png` |
| Browser / Apple icons | `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-*.png` |
| Social preview | [1200 × 630 card](share.png) |
| Product examples | [Aparador scene](aparador.jpg), [cut-list reference](materials-cut-list.jpg) |
| Colors, type, spacing and shape | [Token source](knotty.tokens.css), explained in [guidelines](guidelines.md) |
| Fonts | Local `.woff2` files and the matching `.LICENSE` files |

Use SVG for editable or scalable artwork. Preserve its aspect ratio and clear space; do not recolor the pine or walnut to follow the interface theme. Use the inverse mark where the background is dark. The regular PNG is not a maskable icon.

```html
<img src="./knotty-inverse.svg" alt="Knotty" width="64" height="64">
```

`knotty.tokens.css` is a source stylesheet: it imports Tailwind and Knotty's three Fontsource packages. Compile it with the existing Vite/Tailwind pipeline; it is not a drop-in browser stylesheet. In another project, use the included fonts with `@font-face` and retain their licenses:

```css
@font-face {
  font-family: 'Inter Variable';
  src: url('./inter-latin-wght-normal.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

Use Fraunces for headings and the wordmark, Inter for reading and controls, and JetBrains Mono for measures and codes. Follow the app's existing price hierarchy rather than styling every number identically.

## Preview

From the repository root, with Node 24:

```bash
npm ci
npm run dev
```

Open `/` for the landing, `/marca/` for the visual brand guide and `/catalog/` for the product. `/presentacion/` is a compatibility redirect, not a second landing.

For a server-free snapshot of the actual landing and guide:

```bash
npm run brand:preview
```

Open `presentacion.html` or `marca.html` at the temporary path printed by the command. Fonts and product images are embedded; downloads sit in the adjacent `brand/` folder. Product links open the public app. This preview needs the source checkout to generate it and does not prove PWA or hosting behavior.

## Maintain and regenerate

This folder is a distribution, not another design system. Do not hand-edit it: edit the sources in the [repository](https://github.com/rodacato/knotty). The [brand source guide](https://github.com/rodacato/knotty/blob/main/design/brand/README.md) maps every file here to its source and explains how to regenerate the kit.
