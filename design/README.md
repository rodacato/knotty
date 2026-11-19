# Design

Everything about Knotty's visual design lives here. Read this before changing how a screen looks.

The design is set in three layers, and a lower one never contradicts an upper one without an explicit, recorded amendment:

1. **Brand.** [`brand/`](brand/README.md) holds the identity, the tokens in `src/ui/system/tokens.css`, the type and the voice.
2. **Product north star.** [`north-star/`](north-star/README.md) holds the reference images every screen is built against and the decisions they carry.
3. **Per-screen decisions.** [`DECISIONS.md`](DECISIONS.md) is the numbered registry (`UI-<n>`).

## Source of truth

- **What the app does:** the code in `src/ui/`. **What it should look like:** the north star. When they disagree, the north star is the plan and the difference is work. If the code is right, the difference is a finding.
- **Never invent copy.** Every string in a reference image or a brief exists in `src/ui/`, in the domain that produces it, or in [`brand/marketing.md`](brand/marketing.md). If you cannot find it, it is not real.
- **Generated images are references, not specs.** An image never drew an open state, a long name or an error. When a screen is built against it, adopt its structure, keep the real content, and write each intentional difference down.
- **Type and tokens are decided in code**, never by reading a picture. The [type specimen](north-star/type.html) is the reference for type.

## What's here

| Path | What it is |
|---|---|
| `brand/` | Brand source: identity, guidelines, marketing copy and the map of generated runtime copies (`public/brand/`, PWA icons). Start at `brand/README.md` |
| `north-star/` | The locked reference images (Studio, Materials, take-away guide, catalog, room, landing, brand guide), their prompts, the type specimen, and the directions set aside |
| `DECISIONS.md` | Numbered findings registry (`UI-<n>`) |
| `AUDIENCE.md` | Fictional users for auditing usability and feel; their findings land in `DECISIONS.md` |
| `assets/` | Captures with example data that the code, the brand kit or a north-star prompt uses: the 3D scenes and the Materials screens. Retake a capture when its screen changes |
| `references/` | Local device captures, **never committed** (they may contain real photos) |

Findings use `UI-<n>`, not `D<n>`, because `docs/PROPUESTA.md` already numbers its decisions `D<n>`.

## Screen sizes and targets

- Two base sizes with equal weight (D38): mobile 390×844 and desktop 1440×900.
- Touch targets are at least 44 px (the code uses `min-h-11`), with AA contrast through tokens. Color never carries a selection or a warning alone.

## Working

1. Design changes ride PRs like code, together with the implementing code when possible.
2. A screen is built against its north-star image with a side-by-side capture and a reviewer that did not write it. Each round's verdict is recorded in the PR or its scope.
3. A real capture replaces the generated image as the reference once the screen ships.

Until 2026-11-14 the design lived in Pencil (`.pen` flows and a mirrored kit). That workflow was retired with the two-ink redesign (UI-93); the files are in the git history.
