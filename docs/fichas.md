# Fichas de referencia

Una ficha de referencia es un mueble que Knotty sabe construir, escrito como archivo y comprobado por el motor. Sirve de punto de partida en la pantalla de inicio, de caso para el banco y de regresión: si el motor cambia y una ficha ya no sale igual, se ve.

## Qué es un archivo de ficha

Vive en `src/adapters/references/<código>.v<N>.json` (por ejemplo `kc-apa-01.v1.json`). El número va en el nombre, como en los prompts: solo existe la versión vigente y el resto está en git.

| Campo | Para qué |
|---|---|
| `code` | Lo da el argumento de `--adopt`/`--diff`, no el archivo candidato. `KC-…`: un producto de referencia comprobado contra sus fotos. `GN-…`: un punto de partida genérico, sin producto detrás |
| `id`, `name`, `notes` | Para la persona: el id en inglés, el nombre y las notas en español. Obligatorios en una referencia nueva |
| `kind`, `finish` | Opcionales: qué mueble es (`DesignKind`, `src/domain/design/kind.ts`) y su acabado (`src/domain/materials/finishes.ts`). Un gabinete no dice por sí mismo si es aparador o librero |
| `plan` | La ficha que entiende el motor (`FurniturePlan`): medidas, base, construcción, columnas y celdas |
| `home` | Opcional. Con él es una tarjeta de la pantalla de inicio (`order`, `category`); sin él sigue siendo referencia para las pruebas |
| `expect` | Lo que el motor hace del plan: válido, piezas, avisos, hojas y herrajes. Lo escribe `probe`; una candidata no lo trae |
| `support`, `difficulty`, `features`, `adaptations`, `gaps` | Una `KC-…` los dice todos: cómo se soporta (`exact`, `adapted`, `unsupported`), la dificultad de 1 a 4, qué rasgos tiene (lista cerrada `FEATURES`), qué se adaptó y qué falta |

`format` (siempre 1) lo agrega `probe`. **`features`** dice lo que el mueble tiene, de la lista cerrada `FEATURES` (`src/domain/furniture/references.ts`), lo dibuje Knotty o no; **`gaps`** dice lo que Knotty no puede dibujar de él, así que un rasgo que el plan no dibuja va en los dos. `support` es `exact` solo si no hay adaptaciones ni huecos; en cuanto hay uno, `adapted`.

El archivo se escribe siempre igual (`probe` lo hace), para que un cambio mueva pocas líneas. **Las fotos de referencia no se guardan en el repo.**

## Comandos

```bash
npm run probe -- kc-apa-01                          # una ficha, en detalle
npm run probe -- --all                              # todas, una línea cada una
npm run probe -- --diff kc-apa-01 candidata.json    # qué cambiaría una candidata; no escribe nada
npm run probe -- --adopt kc-apa-01 candidata.json   # la vuelve la versión siguiente (o la versión 1 de una nueva)
npm run probe -- --update kc-apa-01                 # reescribe solo su `expect`
```

`npm test` corre la misma comparación de `--all`: un cambio del motor que mueve una compra o agrega un aviso falla con la línea exacta.

## 1. De una idea o unas fotos a una ficha

1. **Mirar el mueble entero.** Para cada foto, no solo la general: bisagras, repisas detrás de las puertas, cómo abren los cajones, la base, las jaladeras. Escribir, de abajo hacia arriba:
   - filas y columnas, y qué hay en cada hueco (puerta, cajón, abierto, cerrado);
   - puertas y cajones embutidos o sobrepuestos, cuántas hojas, repisas detrás;
   - cubierta entre los costados o encima; trasera sí o no;
   - base: zoclo, directa, patas o ruedas;
   - lo que Knotty todavía no modela (cortes en ángulo, curvas, vidrio, un hueco sin trasera…).

   Tres cosas que el plan hace de cierta manera y conviene saber antes de escribirlo:
   - Cada columna llega de arriba abajo y tiene un solo ancho: los divisores verticales de arriba y de abajo son los mismos. Un mueble cuyos niveles tienen divisores verticales en lugares distintos no tiene forma de decirlo sin perder algo (va a `gaps`). Lo que cada columna reparte por su cuenta es la altura de sus celdas, como fracciones de esa columna.
   - En una base con patas, `dimensions.height` incluye las patas.
   - Un mueble alto con puertas o cajones se ancla al muro (`wallMounted: true`); si no, `--diff` lo marca con un aviso crítico de vuelco (`R4_TIPPING`).
2. **Elegir el módulo** (`src/domain/furniture/modules/`: gabinete, cama, mesa, zapatera). Si ninguno cabe, ya sabes que hay soporte por agregar (sección 2).
3. **Escribir la candidata.** Un archivo JSON con el `plan` y, para una referencia nueva, lo demás que dice una ficha. El experto de la app también puede proponer el plan a partir de fotos y una descripción; el resultado es un borrador que una persona revisa, no una ficha.

   ```json
   {
     "id": "night-table",
     "name": "Buró",
     "notes": "Buró con un cajón arriba y un hueco abierto abajo.",
     "plan": {
       "kind": "cabinet", "name": "Buró", "material": "T18", "base": "floor", "wallMounted": false,
       "dimensions": { "width": 450, "height": 500, "depth": 350 },
       "construction": { "doors": "overlay", "drawerFronts": "inset", "top": "between", "back": "nailed", "shelves": "movable" },
       "columns": [{ "width": 1, "cells": [
         { "height": 0.6, "content": "open", "shelves": 0, "doors": null },
         { "height": 0.4, "content": "drawer", "shelves": null, "doors": null }
       ] }]
     }
   }
   ```
4. **Ver qué haría** con `--diff <código> candidata.json`. Dice qué cambia y, siempre, el veredicto del motor (válido o no, piezas y avisos), también para una referencia nueva; un aviso crítico sale marcado. Si el motor no puede construirlo, dice por qué y no se adopta. Todavía no hay una vista previa en 3D de una candidata: se ve en la app después de adoptarla, con `home`.
5. **Adoptarla** con `--adopt`. Una `KC-…` nueva tiene que traer también su soporte, dificultad, rasgos, adaptaciones y huecos. La dificultad parte de la del tipo de mueble en `docs/carpinteria/muebles-y-medidas.md` (§1); cuando ese rango es de dos niveles (por ejemplo 2–3), se toma el más alto si el diseño tiene frentes embutidos, patas o muchos cajones. Es un criterio provisional.
6. **Comprobar** con `probe -- <código>` y abrirla en la app (`home` la pone en la pantalla de inicio).

Sobre una referencia que ya existe, la candidata puede ser solo el `plan`: lo demás se hereda, y si algo cambió sube la versión.

## 2. Cuando Knotty no puede construirlo: agregar soporte

Una ficha que sale inválida, o que se tiene que adaptar, señala un hueco. Antes de tocar código, **cuenta** en cuántos muebles de referencia aparece: un rasgo de un solo mueble se anota en `gaps` y no se construye. Se construye lo que cambia la **compra** o la **seguridad**, o lo que se repite en varios; lo que es solo apariencia se junta después.

Como se agregaron las patas al gabinete es el recorrido típico:

1. **El plan** (`modules/<módulo>.ts`): la opción nueva en el esquema, con su `.describe` (es lo que lee el experto), y sus etiquetas para la hoja de la ficha.
2. **El constructor** (mismo archivo, y `modules/common.ts` para lo que comparten): las piezas y uniones que la opción agrega. Knotty construye cada pieza, así que no se pueden traslapar.
3. **Los supuestos numéricos** (`domain/checks/structure/assumptions.ts`): cada cifra con su fuente.
4. **Las revisiones** (`domain/checks/structure/`): si una regla existente lee lo que cambió, se sube su versión; si hace falta una nueva, va en el registro.
5. **La guía del experto** (`adapters/llm/prompts/modules/<módulo>.vN.md`, escrita a mano para gabinete, cama y mesa): se sube su versión y su presupuesto en `prompts.test.ts`. Como cambia lo que ve el experto, hay que correr `npm run compare` a mano (cuesta tokens) y comparar con el último reporte.
6. **Pruebas** del módulo (`<módulo>.test.ts`): la opción, sus piezas y lo que no debe pasar.
7. **Las fichas.** `probe -- --all` dice cuáles se movieron. Las diferencias esperadas se aceptan con `--update`; una inesperada es un error. Después, adoptar la candidata que antes se adaptó, ya sin la adaptación, y quitarla de `gaps`.
8. **Un paso en `docs/PROPUESTA.md`.**

El detalle de qué correr según lo que tocaste está en [CONTRIBUTING.md](../CONTRIBUTING.md).
