# ui-kit.lib.pen — Changelog

Pencil cannot reference components across `.pen` files: each `flows/*.pen` **vendors** the kit at a pinned version. Bumping here may require re-vendoring the flows.

**Version markers:** the `kit-version` variable lives in `ui-kit.lib.pen`; each flow records what it vendored in `kit-version-source`.

**Rules:** patch = value tweak · minor = new or changed token or component · major = rename or removal. A changed token **value** forces every flow.

---

## 0.3.0 — amber for selection only, Field, no TakePhoto

Lands with the code of K6 (`amber-k6`), K7 (#113) and D39 (#115). A **value** change and a removal: every flow re-vendors.

**Changed:** `Stamp/Recommendation` is graphite, not amber (K6, `UI-1`); the three stamps are 12 px, as the code has been since K5; `KindSelect` is 16 px with its caret at the edge, as `Select` draws it.

**Added:** `Field/Input` (label, 44 px box, value in mono, unit inside), `Field/Select` and `Field/TextArea`, mirrored from `src/ui/system/Field.tsx`.

**Removed:** `TakePhoto` and `TakePhoto/Compact`: the code deleted `TakePhoto.tsx` with D39.

## 0.2.0 — fixtures

**Added:** a `Fixtures` section — canvas scaffolding, not design to implement — with `Fixture/Finding pin`, the rust label that marks a `UI-<n>` on an as-is capture. It was built separately in `studio.pen` and `capture.pen`; they keep their local copy until their next re-vendor. Additive: no flow has to re-sync.

**Not added, on purpose:** the proposal's new parts (scene status chip, the three ways out of a notice, the resolve bar, the compact tray, labeled photo buttons). They do not exist in `src/ui/` yet; the kit mirrors the code, so they enter the kit when the code lands. The work order is `CODE_CHANGES.md`.

## 0.1.0 — initial

**Tokens (28 + `kit-version`)**, mirrored from `src/ui/system/tokens.css` with a `mode` theme (light · dark): `bone`, `kraft`, `kraft-2`, `paper`, `scene-bg`, `graphite`, `graphite-2`, `line`, `amber`, `amber-soft`, `rust`, `slate`; woods `birch`, `pine`, `walnut`; brand `knot-ring`, `knot-inner`, `knot-core` (hardcoded in `Brand.tsx`); `white` (the danger button's `text-white`); fonts `font-display` (Fraunces), `font-sans` (Inter), `font-mono` (JetBrains Mono); radii named after Tailwind: `radius-stamp` 4, `radius-lg` 8, `radius-xl` 12, `radius-2xl` 16, `radius-3xl` 24, `radius-full`. `rgb(… / a)` values are stored as `#RRGGBBAA`.

**Components (17):** `Button/Primary` · `Button/Secondary` · `Button/Ghost` · `Button/Danger`, each with a toggleable leading and trailing icon · `Chip/Inactive` · `Chip/Active` · `Stamp/Critical` · `Stamp/Recommendation` · `Stamp/Detail` (tilt as in the code) · `Title` · `Pencil (thinking)` · `Knot` (ellipses computed from `Brand.tsx`, not drawn by hand) · `Logo` · `Emblem` (`public/icon-192.png`) · `KindSelect` · `TakePhoto` · `TakePhoto/Compact`.

**Vendored by:** `flows/studio.pen` (pilot).

### Gaps found building it

| Need | Real value | Used instead | Note |
|---|---|---|---|
| Phosphor `Images` icon (`TakePhoto`) | `Images` | `image` | Pencil's Phosphor set has no `images` |
| Phosphor `Hammer` icon (review gate) | `Hammer` | `wrench` | Pencil's Phosphor set has no `hammer` |
| Disabled state | `disabled:opacity-40` | instance with `opacity: 0.4` | Not a separate component; the code has none either |
| Text baseline for the logo's knot | `translate-y-[0.03em]`, baseline | bottom-aligned with a 17 px pad | Pencil has no baseline alignment. Measured against the app: knot spans 0.41–0.93 of the cap height (app: 0.40–0.94) |
| Resizing a `Knot` instance | the SVG scales with `size-[0.56em]` | override each path's size and stroke (`5 × size/64`) | Pencil does not scale a layout-none instance's children. Any new `Knot` size needs the same override |
| Fraunces optical size | `font-variation-settings: 'opsz' 144` (logo), `48` (titles) | the default optical size | Pencil cannot set a variable-font axis; letters read slightly lighter than in the app |
