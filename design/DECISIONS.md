# Design decisions — findings (UI-1…UI-18)

> The registry the `flows/*.pen` briefs and the `ui-kit.lib.pen` notes cite. A resolved entry is never deleted: record the outcome, because the reasoning is the useful part.

**Status:** 18 entries · 1 decided · 17 open · 🐞 2 app bugs (fixed on their own, they do not wait for the redesign).

**How entries work.** A `UI-<n>` is a finding: the design is always drawn as the **code** is, and the entry records what it does today, what it should do, and who decides. The thesis that orders them is D38 in `docs/PROPUESTA.md`: the furniture is the interface.

Tags: `vice` (wrong for this product) · `slop` (reflex choice) · `gap` (something missing) · `lift` (would raise it) · `drift` (contradicts a written rule) · `bug`.

Source: review of all of `src/ui/` on 2026-09-27, then checked against real captures (`assets/studio/`, `assets/studio/states/`: the Aparador and Librero examples with the simulated expert, 390×844 and 1440×900).

---

## Decisions to make

| # | Tag | Finding | Recommendation |
|---|---|---|---|
| **UI-1** | `vice` | Amber means too many things: accent, active tab, "recommendation" severity, "fix it" verdict, tray, proposal, selected piece, required marker, info note and chosen provider — in 23 files under `src/ui/`. PROPUESTA §1 defines it as both accent and severity. | ⏳ Amber only for **selection and action**. "Recommendation" needs another tone or leans on the stamp. A kit decision: it touches every flow. |
| **UI-2** | `slop` | 13 uppercase tracked labels (`AL INSTANTE`, `LAS CUENTAS`, `TUS REQUISITOS`…) and 32 bordered `rounded-2xl`, several nested (`FixButton` inside `NoticeCard`; cell inside column in `CabinetColumns`). | ⏳ Group with space first, fill second, borders last. No card inside a card. |
| **UI-3** | `vice` | One proposal, two button sets: in chat "Sí, aplícalo" is `ghost` (`src/ui/chat/Chat.tsx:175`), in Notices it is `primary` (`src/ui/studio/NoticePanel.tsx:131`), with different discard labels. | ⏳ One proposal component, primary action `primary` in both places. |
| **UI-4** | `vice` | The Furniture tab mixes furniture kind (changing it may force a redo), the plan sheet with its sticky Apply bar and `pb-28`, the expert's memory and the photos. The bar stops sticking before the memory (`src/ui/studio/FurniturePanel.tsx:164`). | ⏳ Furniture tab = the plan sheet. The expert's memory goes next to the conversation; kind and photos to a "furniture details" place. |
| **UI-5** | `gap` | *Confirmed:* on mobile the view bar alone wraps into two rows over the furniture. Up to five pills stack top-left over the 3D: view bar, proposal, problems, to-confirm and "Viendo vN" (`src/ui/studio/Studio.tsx:201`). | ⏳ One status strip with priority: one state visible, the rest counted. |
| **UI-6** | `gap` | D34's three speeds (instant, tray, free) show up as three unrelated UIs across Notices, the piece card, the plan sheet and chat. | ⏳ The core of the redesign: one visual grammar for "this changes now" versus "this goes to the expert". |
| **UI-7** | `vice` | In Capture, "Tipo de mueble" sits on the "¿Cuánto mide?" step (`src/ui/capture/Capture.tsx:242`) and depends on the photos, which come next. | ⏳ Move it to the photos step or drop it from capture. Decided in `capture.pen`. |
| **UI-8** | `gap` | In Capture, the required marker is an amber dot with no legend, and on mobile five `min-h-60` slots push the description far down. | ⏳ In `capture.pen`. |
| **UI-9** | `lift` | Materials is the journey's payoff (D38) but reads as one more list of cards. There is no assembly screen, only the exploded view. | ⏳ Explore in `_playground.pen`: cost and sheets as the finale, assembly as the destination. Does not move to `flows/` without code. |
| **UI-10** | `vice` | 🔒 emoji in `src/ui/settings/Settings.tsx:163`, in a UI that uses Phosphor everywhere else. The debug-log toggle lives inside the "El experto" dialog. | ⏳ A Phosphor icon; the debug toggle in its own section. |
| **UI-11** | `vice` | "Nuevo diseño", which erases everything, is the heaviest header button (`secondary`), above history, notices and settings (`src/ui/studio/Studio.tsx:129`). | ⏳ `ghost`, or inside a menu. |
| **UI-12** | `vice` | A pending **proposal** notice joins one sentence per piece ("Piso se pandearía ~9.8 mm… Entrepaño 1 se pandearía ~9.8 mm…" ×5), while the same finding, once applied, is grouped ("Y 4 piezas más igual") and the chat groups it too (`groupByCode`, `src/ui/chat/Chat.tsx:28`). Capture: `states/mobile-notices-pending.png`. | ⏳ Proposal notices use the same grouping. |
| **UI-13** | `gap` | With a proposal on screen ("Viendo la propuesta sin aplicar"), Materials reviews the **current** design and says "Se puede hacer", with nothing saying which of the two it judged. Capture: `states/mobile-materials-during-proposal.png`. | ⏳ Materials names the version it reviewed, or waits while a proposal is shown. |
| **UI-14** | `gap` | On mobile with the tray open, the conversation gets ~160 px and the expert's last message is cut. Capture: `states/mobile-chat-tray.png`. | ⏳ Part of the mobile panel redesign (UI-6). |
| **UI-15** | `gap` | Decisions go one at a time, and while the expert thinks everything is disabled (`disabled={thinking}` across chat, notices and piece edits). Adrian, 2026-09-27: *"no aplicar cosas una por una, sino en un grupo… que me indique que se está trabajando por detrás"*. | ⏳ Step 1 drawn in `_playground.pen`: each notice picks its way, one "Resolver N" applies the ⚡ ones as one version and sends the rest to the expert as one request; the expert works in the background with a global indicator. Step 2 (editing while the expert works, answer lands as a proposal via D36) stays open until it hurts. Splitting a batch into parallel expert calls was rejected: more calls, and each answer starts from a stale version. |
| **UI-16** | `gap` | The cost and the cut list sit behind "Revisar y ver materiales"; three personas looked for the price first and did not find it (`audits/2026-09-27-studio-summary.md`, B). It collides with D30: the list appears only after a review, on purpose. | ✅ **Decided 2026-09-27 (Adrian): show the estimated total before the review; the list stays behind it, so D30 holds.** Drawn in `_playground.pen` (Materials screens). |
| **UI-17** | `vice` | Overriding is hard to see, and two different actions read almost the same: "Aplicar así, bajo mi riesgo" (`src/ui/chat/Chat.tsx`) vs "Aceptar así, bajo mi riesgo" (`src/ui/studio/NoticePanel.tsx`), both small grey text. Four personas (summary, D). | ⏳ Corrected after checking the code: they are **two different actions** — the chat one applies a proposal not yet in the furniture, the notice one leaves the furniture as it already is. Keep both wordings; make each a visible secondary button, never grey text. Same family as UI-3. |
| **UI-18** | `gap` | Nothing says "it's fine now": after an answer or a fix the only signals are a count, a dot, or "Los puntos críticos siguen". Three personas (summary, E). | ⏳ An explicit resolved state where the person is looking: the scene status and the notice count. |

## 🐞 App bugs — fixed in code, they do not wait for the redesign

| # | Bug | Status |
|---|---|---|
| **B-1** | Under reduced motion, `tokens.css` sets `animation-duration: 0.01ms` but keeps `infinite`. `draw` ends at `stroke-dashoffset: -1`, so the Analyzing pencil may be invisible or flicker. Fix: `animation-iteration-count: 1 !important`. *Unverified.* | open |
| **B-2** | The piece card (`src/ui/studio/Panels.tsx:59`) grows upward with no `max-h` or scroll. *Confirmed:* on mobile it covers most of the 3D when closed, and with "Editar a mano" open it covers **all** of it and overlaps the header (`states/mobile-piece-editing.png`). It also contradicts the rule the Studio wrote for itself: "Notices and history take the place of the tabs, so the 3D stays in sight" (`src/ui/studio/Studio.tsx:146`). | open |

## Motion (decided last, with the app running)

- There is no vocabulary: the only tokens are `appear` and `draw`; other timings are loose (300 ms, 900, 1800, `smoothTime` 0.35). The first decision is duration and easing tokens.
- The height transition on the 3D container (`Studio.tsx:308`) resizes the canvas every frame: make it instant.
- The piece card enters with 350 ms and overshoot on an action done tens of times a day: 150 ms, no overshoot.
- `Chip` carries `animate-appear` inside the component, so it animates on every mount.

## Keep (authorship — leave alone)

Tilted ink stamps · the pencil drawing with the real stage and clock · the tape-measure ruler · shopping list only after the review (D30) · 3D on top with no draggable sheet (D14) · Fraunces, Inter and JetBrains Mono · the bone, kraft and graphite palette · the sawdust drop, ghost and glow in the 3D.

## Out of scope (confirmed)

The code has no spacing, radius or shadow scale of its own: it uses Tailwind's. The kit does not invent one; it mirrors the values in use.
