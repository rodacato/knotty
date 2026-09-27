# Design decisions — findings (UI-1…UI-20)

> The registry the `flows/*.pen` briefs and the `ui-kit.lib.pen` notes cite. A resolved entry is never deleted: record the outcome, because the reasoning is the useful part.

**Status:** 20 entries · 6 decided · 13 open · 🐞 3 app bugs (fixed on their own, they do not wait for the redesign).

**How entries work.** A `UI-<n>` is a finding: the design is always drawn as the **code** is, and the entry records what it does today, what it should do, and who decides. The thesis that orders them is D38 in `docs/PROPUESTA.md`: the furniture is the interface.

Tags: `vice` (wrong for this product) · `slop` (reflex choice) · `gap` (something missing) · `lift` (would raise it) · `drift` (contradicts a written rule) · `bug`.

Source: review of all of `src/ui/` on 2026-09-27, then checked against captures of the Aparador and Librero examples with the simulated expert, 390×844 and 1440×900. Those captures and the persona audit files were removed on 2026-09-27; the findings below keep what they showed.

---

## Decisions to make

| # | Tag | Finding | Recommendation |
|---|---|---|---|
| **UI-1** | `vice` | Amber means too many things: accent, active tab, "recommendation" severity, "fix it" verdict, tray, proposal, selected piece, required marker, info note and chosen provider — in 23 files, 100 uses under `src/ui/` (re-counted 2026-09-27 without the debug panel). PROPUESTA §1 defines it as both accent and severity. | ✅ **Decided 2026-09-27 (Adrian): amber only for selection and focus** (active tab, selected piece, the tape handle). Severity stamps become ink: critical rust, **recommendation graphite**, detail slate; the "Arréglalo antes de comprar" verdict turns neutral. Landed in code (`amber-k6`) and in kit 0.3.0 (`CODE_CHANGES.md` §6). |
| **UI-2** | `slop` | 13 uppercase labels outside the debug panel — re-counted: 11 are the `tracking-wide text-graphite-2 uppercase` eyebrow, 1 is Home's tagline, 1 is the `Stamp` (which stays: `keep`); so **12** to change (`AL INSTANTE`, `LAS CUENTAS`, `TUS REQUISITOS`…) and 32 bordered `rounded-2xl`, several nested (`FixButton` inside `NoticeCard`; cell inside column in `CabinetColumns`). | ⏳ Group with space first, fill second, borders last. No card inside a card. |
| **UI-3** | `vice` | One proposal, two button sets: in chat "Sí, aplícalo" is `ghost` (`src/ui/chat/Chat.tsx:175`), in Notices it is `primary` (`src/ui/studio/NoticePanel.tsx:131`), with different discard labels. | ⏳ One proposal component, primary action `primary` in both places. |
| **UI-4** | `vice` | The Furniture tab mixes furniture kind (changing it may force a redo), the plan sheet with its sticky Apply bar and `pb-28`, the expert's memory and the photos. The bar stops sticking before the memory (`src/ui/studio/FurniturePanel.tsx:164`). | ✅ **Landed** (`ui4-memory`): the memory folds above the conversation (`src/ui/chat/Memory.tsx`), one line with a count, closed by default; open it holds the requirements, the design decisions and the add-note field. Kind and photos stay in the Furniture tab. Drawn in `flows/studio.pen`. |
| **UI-5** | `gap` | *Confirmed:* on mobile the view bar alone wraps into two rows over the furniture. Up to five pills stack top-left over the 3D: view bar, proposal, problems, to-confirm and "Viendo vN" (`src/ui/studio/Studio.tsx:201`). | ⏳ One status strip with priority: one state visible, the rest counted. |
| **UI-6** | `gap` | D34's three speeds (instant, tray, free) show up as three unrelated UIs across Notices, the piece card, the plan sheet and chat. | ⏳ The core of the redesign: one visual grammar for "this changes now" versus "this goes to the expert". |
| **UI-7** | `vice` | In Capture, "Tipo de mueble" sits on the "¿Cuánto mide?" step (`src/ui/capture/Capture.tsx:242`) and depends on the photos, which come next. | ✅ **Decided 2026-09-27 (Adrian): one screen, the kind first** (D40). Landed in `photos-d39`. |
| **UI-8** | `gap` | In Capture, the required marker is an amber dot with no legend, and on mobile five `min-h-60` slots push the description far down. | ✅ **Decided and landed:** D39 — no slots, one "Agregar fotos" (up to 5), views labeled by the model, no required photos, no photo requests from the expert. One deviation from `flows/capture.pen`: a photo's note stays open as a text field while it has text, because closing it on blur moved "Analizar" under the pointer and lost the click. |
| **UI-9** | `lift` | Materials is the journey's payoff (D38) but reads as one more list of cards. There is no assembly screen, only the exploded view. | ⏳ Explore in `_playground.pen`: cost and sheets as the finale, assembly as the destination. Does not move to `flows/` without code. |
| **UI-10** | `vice` | 🔒 emoji in `src/ui/settings/Settings.tsx:163`, in a UI that uses Phosphor everywhere else. The debug-log toggle lives inside the "El experto" dialog. | ⏳ A Phosphor icon; the debug toggle in its own section. |
| **UI-11** | `vice` | "Nuevo diseño", which erases everything, is the heaviest header button (`secondary`), above history, notices and settings (`src/ui/studio/Studio.tsx:129`). | ⏳ `ghost`, or inside a menu. |
| **UI-12** | `vice` | A pending **proposal** notice joins one sentence per piece ("Piso se pandearía ~9.8 mm… Entrepaño 1 se pandearía ~9.8 mm…" ×5), while the same finding, once applied, is grouped ("Y 4 piezas más igual") and the chat groups it too (`groupByCode`, `src/ui/chat/Chat.tsx:28`). | ⏳ Proposal notices use the same grouping. |
| **UI-13** | `gap` | With a proposal on screen ("Viendo la propuesta sin aplicar"), Materials reviews the **current** design and says "Se puede hacer", with nothing saying which of the two it judged. The header also keeps the current measures (57 cm) while the 3D shows the proposal (90 cm) — raised by four personas across both audit passes. | ⏳ Materials names the version it reviewed, or waits while a proposal is shown. |
| **UI-14** | `gap` | On mobile with the tray open, the conversation gets ~160 px and the expert's last message is cut. | ⏳ Part of the mobile panel redesign (UI-6). |
| **UI-15** | `gap` | Decisions go one at a time, and while the expert thinks everything is disabled (`disabled={thinking}` across chat, notices and piece edits). Adrian, 2026-09-27: *"no aplicar cosas una por una, sino en un grupo… que me indique que se está trabajando por detrás"*. | ⏳ Step 1 drawn in `_playground.pen`: each notice picks its way, one "Resolver N" applies the ⚡ ones as one version and sends the rest to the expert as one request; the expert works in the background with a global indicator. Step 2 (editing while the expert works, answer lands as a proposal via D36) stays open until it hurts. Splitting a batch into parallel expert calls was rejected: more calls, and each answer starts from a stale version. |
| **UI-16** | `gap` | The cost and the cut list sit behind "Revisar y ver materiales"; three personas looked for the price first and did not find it. It collides with D30: the list appears only after a review, on purpose. | ✅ **Decided 2026-09-27 (Adrian): show the estimated total before the review; the list stays behind it, so D30 holds.** Drawn in `_playground.pen` (Materials screens). |
| **UI-17** | `vice` | Overriding is hard to see, and two different actions read almost the same: "Aplicar así, bajo mi riesgo" (`src/ui/chat/Chat.tsx`) vs "Aceptar así, bajo mi riesgo" (`src/ui/studio/NoticePanel.tsx`), both small grey text. Four personas (summary, D). | ⏳ Corrected after checking the code: they are **two different actions** — the chat one applies a proposal not yet in the furniture, the notice one leaves the furniture as it already is. Keep both wordings; make each a visible secondary button, never grey text. Same family as UI-3. |
| **UI-18** | `gap` | Nothing says "it's fine now": after an answer or a fix the only signals are a count, a dot, or "Los puntos críticos siguen". Three personas (summary, E). | ⏳ An explicit resolved state where the person is looking: the scene status and the notice count. |
| **UI-19** | `vice` | Each capture slot shows its camera and gallery buttons as icons only: `TakePhoto` in compact mode drops the label (`{!compact && …}`, `src/ui/system/TakePhoto.tsx`), ten unlabeled buttons on the photos step. The Studio audit already flagged icon-only actions for Doña Carmen and Ricardo. | ✅ Superseded by D39 and landed: one labeled "Agregar fotos"; `TakePhoto` is gone. |
| **UI-20** | `bug` | On mobile the Materials sheet row gives the price column the room: "Triplay de pino 18 mm" wraps to three lines and "desperdicio" breaks (`src/ui/studio/Materials.tsx`). Capture: `assets/studio/current/mobile-materials-list.jpg`. | ✅ **Fixed in `materials-row`:** while the sheet card is narrower than `@sm` (a container query, so it covers both the phone and the ~385 px desktop side panel) the name and the size/waste line keep the full width and the price row (total, per-sheet price, inline edit) goes under them, aligned with the name; side by side only when the card has room. |

## Consolidation (2026-09-27, `ui-consolidate`)

Read across UI-1…UI-19, B-1, B-2, both persona audits (since removed) and `CODE_CHANGES.md`, with every count re-derived by search.

### Consolidated items — each replaces the findings it absorbs

| # | Kind | Item | Absorbs |
|---|---|---|---|
| **K1** | one component — ✅ landed (`notice-ways-resolve`); the proposal's instant fix landed in `proposal-fixes` | **Ways out of a decision**: one component for a notice and a proposal — ⚡ "Al instante", "A la bandeja, para el experto", "Aceptar/Aplicar así, bajo mi riesgo" — plus "Resolver N" for several. Today two renderings: `Chat.tsx` (Bubble) and `NoticePanel.tsx` (NoticeCard). | UI-3, UI-6, UI-12, UI-15, UI-17 |
| **K2** | one component — ✅ landed (`studio-panel-and-status`) | **StatusChip**: one status over the 3D. Landed with the order corrected while implementing: what changes what you are looking at comes first — an old version, then a proposal or preview, then problems, then pieces to confirm (problems stay counted on the header bell). "Resuelto: …" and the expert working in the background landed with K1. | UI-5, UI-13 (header vs 3D), UI-18, UI-15 |
| **K3** | one rule, broken twice — ✅ landed (`studio-panel-and-status`) | **"The 3D is never covered"** is written in D14 and in `Studio.tsx:146` and broken by the piece card and the pills. Fix the rule's home, not the instances: the panel is the only place anything opens (notices, history, piece). | B-2, UI-5, UI-4 |
| **K4** | one cause | **Width hides meaning**: labels drop at phone width — `hidden sm:inline` ×3 in `Studio.tsx`, compact `TakePhoto`, the icon-only ruler. One rule: no action without a word at any width, except close and send. | UI-19, audit C, UI-11 |
| **K5** | one cause — ✅ landed (`field-k7-k5`) | **Small grey mono for things people read**: `text-[10px]`/`text-[11px]` ×19 in 10 files, plus `graphite-2` body text. One decision: 12 px minimum, `graphite` for anything that is read, not scanned. Landed: the 14 sub-12 px uses outside the debug panel (8 files) are 12 px, the `Stamp` included; sentences (explanations, help, empty states, dialog descriptions) turned `graphite`; labels, units, numbers and metadata stay `graphite-2`, which is AA on bone. | Doña Carmen (both passes), UI-2 |
| **K6** | one token decision — ✅ landed (`amber-k6`, kit 0.3.0) | **Amber = selection and focus only**; "recommendation" and the verdict "Arréglalo" need their own tone. A kit token change: every flow re-vendors. | UI-1 |
| **K7** | one component — ✅ landed (`field-k7-k5`), in kit 0.3.0 | **`Field`**: 27 hand-styled inputs in 12 files — 20 of them text fields, re-counted. Landed as `Field`/`Input`/`Select`/`TextArea`, drawn from the studio target (label on top, 44 px box, unit inside). Controls are 16 px so iOS does not zoom on focus. | CODE_CHANGES §1 |

### Corrected counts

- UI-1: 23 files / 100 uses (the 26 / 103 first seen included the debug panel).
- UI-2: 12 uppercase labels to change, not 13 or 11 — the two earlier counts measured different things, and the `Stamp` is `keep`.
- K5: 14 sub-12 px uses in 8 files without the debug panel (20 with it), not 19 in 10.
- K7: 27 elements, 20 of them text fields.
- UI-2: 6 uppercase labels left once K1 landed.
- `disabled={thinking}`: 19 sites in 8 files — the blast radius of UI-15 step 1, larger than "chips, fixes and edits" suggested.

### Escapees — shared components that live in a feature folder

- `ChangeList` lives in `src/ui/chat/` and is rendered by `studio/HistoryPanel.tsx` too.
- `TraceLog` lives in `src/ui/studio/` and is rendered by `capture/Capture.tsx` too.
Both are kit that was never declared kit. Move them to `src/ui/system/` before the kit mirrors them.

### A rule's home that went stale

`docs/PROPUESTA.md` §1 still describes a "Hoja inferior arrastrable… con pestañas Chat · Revisión · Materiales · Historial" and a "Revisión" tab. D14 removed the sheet and phase 9 (entrega 4) removed both tabs. §1 is where a newcomer reads the layout; it contradicts the product. Rewrite §1 from D38 when the target bands are approved in code. **Rewritten 2026-09-27** from D38 and the code as it is.

### What is blocked, and on what

1. ~~K6 (amber token) blocks re-vendoring~~ — **decided 2026-09-27** and applied to the target bands; no longer blocking.
2. ~~K7 (`Field`) blocks the rest of the Studio target screens~~ — landed with K5; K2 and K3 landed before.
3. **K1 blocks UI-15 step 2** (editing while the expert works): the 19 `disabled={thinking}` sites are the change, and K1 owns most of them.
4. D39 (photos without slots) is **not blocked**: it touches Capture and reading only.

### What did not consolidate

- UI-12 (a proposal notice that repeats one sentence per piece) is a single cause in `application/notices.ts`, not a pattern.
- UI-9, UI-10, UI-16 are one screen each; UI-16 is decided.
- "Share the design" (Luis, Doña Carmen) looked like a pattern across passes: it is two personas, still a hypothesis.

## 🐞 App bugs — fixed in code, they do not wait for the redesign

| # | Bug | Status |
|---|---|---|
| **B-1** | Under reduced motion, `tokens.css` sets `animation-duration: 0.01ms` but keeps `infinite`, so looping animations restart every 0.01 ms. **Corrected after measuring:** the pencil is not invisible — it **flickers** (`stroke-dashoffset` jumping between 0.00 and 0.93 across 12 samples; the pulse stuck at opacity 0.67). Fix: `animation-iteration-count: 1 !important`. | fixed in #109 |
| **B-2** | The piece card (`src/ui/studio/Panels.tsx:59`) grows upward with no `max-h` or scroll. *Confirmed:* on mobile it covers most of the 3D when closed, and with "Editar a mano" open it covers **all** of it and overlaps the header. The overflow is fixed in #109 (the card stays below the view bar and scrolls); covering the 3D stays open for K3. It also breaks a rule written twice: D14 (*"El 3D nunca queda tapado"*) and `src/ui/studio/Studio.tsx:146` (*"Notices and history take the place of the tabs, so the 3D stays in sight"*). Tag: `drift`. | fixed: overflow in #109, covering the 3D with K3 in #110 (the piece opens in the panel) |
| **B-3** | On unlock ("Tus llaves están guardadas"), at 390 px "Desbloquear" overflows its card: the `Input` with `flex-1` has no `min-w-0`, so it does not shrink (`src/ui/settings/Keys.tsx`). Regression from K7 (#113). Capture: `assets/studio/current/mobile-keys-unlock.jpg`. | fixed in `photos-d39` (`min-w-0` on `Input`) |

## Motion (decided last, with the app running)

- There is no vocabulary: the only tokens are `appear` and `draw`; other timings are loose (300 ms, 900, 1800, `smoothTime` 0.35). The first decision is duration and easing tokens.
- The height transition on the 3D container (`Studio.tsx:308`) resizes the canvas every frame: make it instant.
- The piece card enters with 350 ms and overshoot on an action done tens of times a day: 150 ms, no overshoot.
- `Chip` carries `animate-appear` inside the component, so it animates on every mount.

## Keep (authorship — leave alone)

Tilted ink stamps · the pencil drawing with the real stage and clock · the tape-measure ruler · shopping list only after the review (D30) · 3D on top with no draggable sheet (D14) · Fraunces, Inter and JetBrains Mono · the bone, kraft and graphite palette · the sawdust drop, ghost and glow in the 3D.

## Out of scope (confirmed)

The code has no spacing, radius or shadow scale of its own: it uses Tailwind's. The kit does not invent one; it mirrors the values in use.
