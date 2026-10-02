# Design — Pencil workflow

Everything about Knotty's visual design lives here. Read this before touching a `.pen`. `.pen` files are encrypted: read and write them only through Pencil (the VS Code extension or its MCP server), never by hand.

**The two rules that matter most:**

1. **The code is the source of truth.** `src/ui/` decides design and layout — not an old design, not a screenshot.
2. **Noticing two things look alike is a note, not a task.** There is no live propagation: every kit change is manual work in every flow that uses it.

Names follow the code: files, artboards, tokens and components are in English. UI copy stays in Mexican Spanish because it is copied verbatim from the code.

## What's here

| Path | What it is |
|---|---|
| `ui-kit.lib.pen` | The library: tokens and components, mirrored from `src/ui/system/` |
| `ui-kit.CHANGELOG.md` | Kit versions and what each one changed |
| `flows/*.pen` | One file per journey: **the design we want**, in code or not — what the app is compared against |
| `_playground.pen` | Experiments only — kit, a blank brief, the log and two empty bases; approved work leaves it |
| `DECISIONS.md` | Numbered findings registry (`UI-<n>`) the briefs cite |
| `AUDIENCE.md` | Fictional users to audit usability and feel; their findings land in `DECISIONS.md` |
| `CODE_CHANGES.md` | Work order for design decisions still pending in code |
| `assets/` | Captures of the current app with example data: the 3D scenes the flows use, and the screens that stay as the app draws them — **committed**, retaken when their screen changes |
| `exports/` | Canvas exports (JPEG) for PR review, one folder per flow — **committed** |
| `references/` | Local device captures — **never committed** (may contain real photos) |

Findings use `UI-<n>`, not `D<n>`, because `docs/PROPUESTA.md` already numbers its decisions `D1…D40`.

### The flows

| File | Screens | Kit | Entry point |
|---|---|---|---|
| `capture.pen` | Start a design in one screen: kind, optional measures, photos, description — plus its states (reading failed, five photos, missing key, design failed…), and Home with the bases to start from. 15 mobile, 11 desktop | 0.4.0 | Opening the app with no design |
| `studio.pen` | The Studio by area — conversation, piece, notices, furniture, materials, history, settings — with their states. 47 mobile, 20 desktop | 0.4.0 | After analysis, or from an example (`src/ui/App.tsx`) |

This table is present tense; each flow's history lives in its `Log` frame.

## Flows hold only the design we want

- A flow draws **what the app should be**, whether the code does it yet or not; it is what the app is compared against. What the code does today is the app itself — there are no as-is bands. (Changed 2026-09-27: as-is bands went stale with every PR and confused which screen was the plan.)
- A screen that should stay exactly as the app draws it is a **capture** of the current app (`assets/`, example data only), named `… (mobile, capture)`. Retake it when its screen changes in code.
- Each brief says what is in code and what is pending. A screen never pretends to be shipped.
- The **playground** is for ideas only. An approved idea moves into its flow, in the column of its area; the playground goes back to the kit, a blank brief, the log and two empty bases.

A screen whose copy does not exist in code yet marks every new string as NEW in its brief.

## Source of truth

**What the app does:** the code, then a capture of it. **What the app should do:** the flow. When the two disagree, the flow is the plan and the difference is work — or a finding, if the code is right.

- **Never invent copy.** Every string exists in `src/ui/` or in the domain that produces it; if you cannot find it, it is not real.
- Draw a state only when it carries information the design lacks. Find what renders it in the code first; states left undrawn go in section 6 of the brief.

## Canvas conventions

- **Two base sizes, equal weight (D38):** mobile 390×844 and desktop 1440×900. `clip: true` on every screen.
- Naming: `[Flow] / [Screen] / [State]` in English (`Studio / Notices / Pending`), no numeric prefix. Order is position, not name.
- **Tokens only — zero hex in a flow.** A value the kit lacks is a kit gap and gets logged.
- Touch targets ≥ 44 px (the code uses `min-h-11`); AA contrast through tokens.
- The 3D is not drawn: it is a PNG of the real scene inside the artboard. Pencil represents neither 3D nor motion; design what goes around the furniture.
- Icons are not a design decision when they come from Pencil's limits: its Phosphor set has no fill weight and no `hammer`, so a flow draws outline icons and a `wrench` where the code uses filled ones and `Hammer`. When comparing the app against an export, the code's icon wins.

### Layout — a section per size, a column per step

Each flow has a **Mobile · 390** section on top and a **Desktop · 1440** section below it, 600 px apart, each with a `SECTION —` heading. Inside a section, **one column per step or area**, left to right in the order the person meets them (`STEP —` labels on top); a step's states stack below it, 120 px apart. The briefs sit in the docs column at the left of their section; one `Log` frame per file, below everything. Positions are computed from these `.pen` variables:

| Variable | Value | What it is |
|---|---|---|
| `grid-x0` | `0` | Left edge of the docs column (briefs and Log) |
| `grid-brief-w` | `640` | Width of every brief and of the Log |
| `grid-gutter` | `120` | Gap between columns, and between the states stacked in a column |
| `grid-y0` | `0` | Top of the first band |
| `grid-row-gap` | `260` | Gap between a section's last screen and the Log; sections themselves sit 600 apart |

### The brief

Each section opens with one or more `BRIEF — <Flow> · <section>` frames with these eight sections, in this order, present tense: 1. Purpose · 2. Entry points · 3. Screens · 4. Business rules (with `file:line`) · 5. Copy source · 6. States not drawn · 7. Open findings (`UI-<n>` numbers only) · 8. History → `Log` frame.

The `Log` holds one line per change, newest first: `YYYY-MM-DD · <kit version if it changed> · <what changed> · <UI-n>`.

## The kit

Shared components (`src/ui/system/`) go in the kit; components used by one screen (e.g. `src/ui/studio/PlanControls.tsx`) stay in their flow. Pencil cannot reference components across files, so each flow **vendors** the kit at a pinned version (`kit-version-source`). Being behind is fine; diverging is not. Every token goes into every flow, used or not.

## Working

1. Design changes ride PRs like code, together with the implementing code when possible.
2. One person per `.pen` at a time. No auto-save: save and commit often.
3. Nothing moves from `_playground.pen` to `flows/` without cleanup and approval.
4. Export changed flows to `exports/`.

## Design ↔ code loop

1. Open the flow, read its brief. 2. Design with kit components. 3. Implement: `.pen` components map 1:1 to `src/ui/system/`. 4. Screenshot the app, overlay it at 50 % on the design, fix the design first, then the code.
