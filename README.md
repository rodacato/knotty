# Knotty

*Naughty knots.* Fotos de un mueble → diseño 3D de triplay que se ajusta conversando con un carpintero experto (un LLM), para saber cómo se arma y cuántas hojas comprar.

La propuesta, las decisiones y el estado viven en [docs/PROPUESTA.md](docs/PROPUESTA.md).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # dominio, casos de uso y adapters
npm run typecheck
npm run build      # dist/, listo para GitHub Pages
```

Se puede instalar como app desde el navegador (PWA) y abre sin conexión; el experto sí necesita red.

Sin API key funciona en modo **Simulado**, que entiende unos cuantos pedidos ("hazlo de 90 cm de ancho", "que aguante libros", "baja una repisa 10 cm", "refuerza la base", "agrega un divisor al centro"). Para usar Claude, OpenAI o [SheLLM](https://rodacato.github.io/SheLLM/), abre el engrane en la app y pon tu llave: se queda en el dispositivo, en memoria, en la pestaña o cifrada con una frase.

## Arquitectura

- `src/domain/`: modelo del mueble, operaciones, validación, reglas estructurales. TypeScript puro.
- `src/application/`: casos de uso y construcción del contexto para el LLM.
- `src/ports/`: interfaces hacia afuera.
- `src/adapters/`: Anthropic, OpenAI, simulado, localStorage, catálogo, imágenes. Los prompts están en `src/adapters/llm/prompts/`.
- `src/ui/`: React y la escena 3D.
- `public/catalogo/catalogo.json`: materiales, herrajes y parámetros de acomodo; se edita sin tocar código.

`src/arquitectura.test.ts` verifica que ninguna capa importe lo que no debe.
