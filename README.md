<p align="center"><img src="public/icon-192.png" width="96" alt="" /></p>

<h1 align="center">Knotty</h1>

<p align="center">Choose a plywood furniture base, adjust it to your space and see how it goes together: 3D design, cut lists and estimated materials. Connect an expert (an LLM) when you want to request other changes.</p>

<p align="center"><a href="https://rodacato.github.io/knotty/"><strong>Meet Knotty</strong></a> · <a href="https://rodacato.github.io/knotty/catalog/#catalog"><strong>Explore the catalog</strong></a></p>

![Knotty](public/share.png)

The proposal, the decisions and the state live in [docs/PROPUESTA.md](docs/PROPUESTA.md) (in Spanish). The app itself is in Mexican Spanish.

## Development

```bash
npm install
npm run dev        # landing at /; catalog and app at /catalog/
npm test           # domain, use cases and adapters
npm run typecheck
npm run build      # dist/, ready for GitHub Pages
npm run compare    # the bench against real experts; costs tokens, by hand only
```

Before opening a PR, [CONTRIBUTING.md](CONTRIBUTING.md) says how to check that a change works, and [docs/workflows.md](docs/workflows.md) what to do and where each thing goes.

It installs as an app from the browser (PWA) and opens offline; the expert does need the network.

Without an API key it works in **Simulado** mode, which understands a few requests ("hazlo de 90 cm de ancho", "que aguante libros", "baja una repisa 10 cm", "refuerza la base", "agrega un divisor al centro"). To use Claude, OpenAI or [SheLLM](https://rodacato.github.io/SheLLM/), open the gear in the app and enter your key: it stays on the device, in memory, in the tab or encrypted with a passphrase.

## Architecture

- `src/domain/`: the furniture model, operations, validation, structural rules. Pure TypeScript, in groups by intent (`materials/`, `design/`, `estimate/`, `checks/`, `editing/`, `furniture/`, `session/`).
- `src/application/`: use cases, building the context for the LLM, and the bench.
- `src/ports/`: interfaces to the outside.
- `src/adapters/`: Anthropic, OpenAI and SheLLM, the simulated expert, localStorage, catalog, images and log. The prompts are in `src/adapters/llm/prompts/`.
- `src/ui/`: React and the 3D scene.
- `public/catalog/catalog.json`: materials, hardware and layout parameters; it is edited without touching code.

`src/architecture.test.ts` checks that no layer imports what it must not.

## Brand

The [root landing](index.html), [catalog and app](catalog/index.html), [legacy presentation redirect](presentacion/index.html) and [brand guide](marca/index.html) share one identity. Preview routes, fragment navigation and PWA compatibility are in [docs/brand.md](docs/brand.md). The [source mark](src/ui/system/knot.svg) generates the variants in `scripts/brand/`. Regenerating the downloadable kit, favicon, PWA icons and share image (`public/share.png`) uses Node, `rsvg-convert` and Python with the export dependencies. Setup and regeneration: [scripts/brand/README.md](scripts/brand/README.md).
