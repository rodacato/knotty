# ui-kit.lib.pen — Changelog

Pencil cannot reference components across `.pen` files: each `flows/*.pen` **vendors** the kit at a pinned version. Bumping here may require re-vendoring the flows.

**Version markers:** the `kit-version` variable lives in `ui-kit.lib.pen`; each flow records what it vendored in `kit-version-source`.

**Rules:** patch = value tweak · minor = new or changed token or component · major = rename or removal. A changed token **value** forces every flow.

---

## 0.4.1 — the rest of `system/` that the kit lacked (additive; the flows stay at 0.4.0)

No existing component changes, so no flow has to re-vendor. Found by the blind review of the 0.4.0 sheet.

**Added:** `HelpButton/Closed` and `/Open` (a 20 px disc with the question mark; the 44 px touch ring is not drawn), `HelpPanel` (the term, its meaning and its note, from `glossary.ts`), `Reveal/Hidden` and `/Shown` (the 36 px eye of a secret field), `RadioCard/Disabled` (the `Off` card at `opacity: 0.4`, as the code does), and three states of `Field/Input`: `error` (a `rust` border and the `role="alert"` line under it), `help` (the 12 px help line) and `sm` (a 32 px box with 8 px of padding). Samples use strings that exist in the code.

**Still not in the kit:** hover states, the focus states of `Field` and `FinishSelect` (they come from the global rule, so there is nothing of their own to draw), the error state of `Select` and `TextArea`, and the three other `Button/Disabled` variants (the code gives all four the same look). The finish list shows 4 of the 8 options; the real one scrolls at 288 px.

## 0.4.0 — focus, inactive buttons, dark contrast, RadioCard (`ui-kit.lib.pen` at 0.4.0; the flows still vendor 0.3.0)

Lands with `UI-40`, `UI-45` and `UI-46`. A **value** change: every flow re-vendors. `ui-kit.lib.pen` carries the version (`kit-version` 0.4.0); `flows/studio.pen` and `flows/capture.pen` still say `kit-version-source` 0.3.0 until they are re-vendored.

**Added:** tokens `focus` (light `#9a5a10`, dark `#d98a2b`) and `on-rust` (light `#ffffff`, dark `#1d1a17`). One global `:focus-visible` rule (2 px, offset 2 px) replaces the per-component `focus-visible:outline-amber`; `Field` borders use `focus` too.

**Changed:** `rust` light `#b4452f` to `#a63d29`, dark `#d9674f` to `#e57d66`; `paper` dark `#3a332b` to `#2a2622` (a slight elevation of `bone`, no longer a raised brown). `Button` disabled is a muted fill (`kraft`, label `graphite-2`, 1 px `line` ring) in all variants instead of `opacity-40`; `Button/Danger` label uses `on-rust`.

| Pair | Before | After |
|---|---|---|
| Focus ring on `bone` / `kraft`, light | 2.43 / 2.17 | 4.82 / 4.30 |
| Focus ring on `bone`, dark | 6.29 | 6.29 (unchanged) |
| Label on `rust`, light | 5.48 (white) | 6.32 |
| Label on `rust`, dark | 3.50 (white) | 6.15 |
| `rust` text on `paper`, dark | 3.56 | 5.33 |
| `rust` text on its 10 % tint, light | 4.22 | 4.82 |
| Disabled label, light (primary) | 2.29 | 4.77 |
| Disabled label, dark (primary) | 3.33 | 6.65 |

**Touch targets (`UI-54`):** `Button` is `min-h-11` (44 px), up from `min-h-10`, in all variants; the call sites that tried to be smaller are gone.

**In `ui-kit.lib.pen`:** the `focus` and `on-rust` variables, the changed `rust` and `paper` values, the four `Button` components at 44 px with `Button/Danger` labelled in `on-rust`, and `Button/Disabled` (a `kraft` fill, `graphite-2` label and `line` ring) in place of the instance at `opacity: 0.4`. Foundations shows `focus` and `on-rust` in both modes; Components gains a *Focus ring* section (the global rule, drawn on a Button, a Chip and a RadioCard).

**Added (UI-47):** `RadioCard` and `RadioGroup` in `src/ui/system/RadioCard.tsx`: a native radio input under a styled label, replacing the nine hand-written `role="radio"` buttons (one tab stop per group, arrow keys, `name` and `checked` from the browser). Variants `card` (border, tint and a check on the corner), `pill`, `segment` and `bare`; the focus ring shows on the card when the hidden input is focused. In `ui-kit.lib.pen` as `RadioCard/Off`, `RadioCard/On` (graphite border, `amber-soft` fill and the check badge on the corner, placed for a 240 px card), `RadioPill/Off`, `RadioPill/On`, `Segment/Off` and `Segment/On`. `RadioGroup` is behavior only and has no component.

**Added (UI-47 escapees):** `FinishSelect/Closed`, `FinishSelect/List` and `TraceLog`, mirrored from `src/ui/system/` after the move. The `TraceLog` status icons are outline, as Pencil's Phosphor set has no fill weight (the code uses fill). Foundations shows `on-rust` as a pair on `rust`, and the type specimens now use strings that exist in the code. Still in their feature folders, so not in the kit: `ChangeList`, `ProposalFix`, `settings/Keys` (`Unlock`, `PassphraseField`, `ForgetKeys`, `useUnlockPassphrase`, `UNLOCK_TEXT`) and `SheLLM`.

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
