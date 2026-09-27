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
| `flows/*.pen` | One file per journey, drawn **as the code has it today** |
| `_playground.pen` | Proposals and exploration, inside the system (vendors the kit like any flow) |
| `DECISIONS.md` | Numbered findings registry (`UI-<n>`) the briefs cite |
| `AUDIENCE.md` | Fictional users to audit usability and feel; their findings land in `DECISIONS.md` |
| `audits/` | One file per persona audit, dated |
| `CODE_CHANGES.md` | Work order for design decisions still pending in code |
| `assets/` | App captures with example data, used as image fills in the as-is bands — **committed** |
| `exports/` | Canvas PNGs for PR review — **committed** |
| `references/` | Local device captures — **never committed** (may contain real photos) |

Findings use `UI-<n>`, not `D<n>`, because `docs/PROPUESTA.md` already numbers its decisions `D1…D38`.

### The flows

| File | Screens | Kit | Entry point |
|---|---|---|---|
| `studio.pen` | Studio as-is: 34 screens, mobile and desktop, default and states | 0.1.0 | After analysis, or from an example (`src/ui/App.tsx`) |
| `capture.pen` | Capture as-is: home, measures, photos, analyzing — 12 screens, mobile and desktop | 0.1.0 | Opening the app with no design |

This table is present tense; each flow's history lives in its `Log` frame.

## Flows versus proposals

A flow in `flows/` draws **what the code does today**. Its as-is bands are real app captures (`assets/`, example data only) with finding pins on top — redrawing a capture pixel for pixel adds nothing. A redesign is drawn in `_playground.pen` and moves into `flows/` together with the code that implements it, in the same PR. A flow never promises something the app does not do, and a proposal always has a baseline to compare against.

A screen that does not exist in code yet (how the furniture is assembled, D38) lives only in `_playground.pen`: there is no real copy to mirror.

## Source of truth

**code > app capture > old design**, in that order.

- **Never invent copy.** Every string exists in `src/ui/` or in the domain that produces it; if you cannot find it, it is not real.
- Draw a state only when it carries information the design lacks. Find what renders it in the code first; states left undrawn go in section 6 of the brief.

## Canvas conventions

- **Two base sizes, equal weight (D38):** mobile 390×844 and desktop 1440×900. `clip: true` on every screen.
- Naming: `[Flow] / [Screen] / [State]` in English (`Studio / Notices / Pending`), no numeric prefix. Order is position, not name.
- **Tokens only — zero hex in a flow.** A value the kit lacks is a kit gap and gets logged.
- Touch targets ≥ 44 px (the code uses `min-h-11`); AA contrast through tokens.
- The 3D is not drawn: it is a PNG of the real scene inside the artboard. Pencil represents neither 3D nor motion; design what goes around the furniture.

### Layout — a docs column plus row bands

One **row band per journey variant** (mobile · desktop · alternate paths), read left to right, each opening with its brief. One `Log` frame per file, below every band. Positions are computed from five `.pen` variables:

| Variable | Value | What it is |
|---|---|---|
| `grid-x0` | `0` | Left edge of the docs column (briefs and Log) |
| `grid-brief-w` | `640` | Width of every brief and of the Log |
| `grid-gutter` | `120` | Horizontal gap between artboards |
| `grid-y0` | `0` | Top of the first band |
| `grid-row-gap` | `260` | Vertical gap between bands |

### The brief

Each band opens with a `BRIEF — <Flow> · <band>` frame with these eight sections, in this order, present tense: 1. Purpose · 2. Entry points · 3. Screens · 4. Business rules (with `file:line`) · 5. Copy source · 6. States not drawn · 7. Open findings (`UI-<n>` numbers only) · 8. History → `Log` frame.

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
