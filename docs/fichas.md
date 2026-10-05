# Fichas de referencia

Una ficha de referencia es un mueble que Knotty sabe construir, escrito como archivo y comprobado por el motor. Sirve de punto de partida en la pantalla de inicio, de caso para el banco y de regresión: si el motor cambia y una ficha ya no sale igual, se ve.

## Qué es un archivo de ficha

Vive en `src/adapters/references/<código>.v<N>.json` (por ejemplo `kc-apa-01.v1.json`). El número va en el nombre, como en los prompts: solo existe la versión vigente y el resto está en git.

| Campo | Para qué |
|---|---|
| `code` | Lo da el argumento de `--adopt`/`--diff`, no el archivo candidato. `KC-…`: un producto de referencia comprobado contra sus fotos. `GN-…`: un punto de partida genérico, sin producto detrás |
| `id`, `name`, `notes` | Para la persona: el id en inglés, el nombre y las notas en español. Obligatorios en una referencia nueva |
| `rooms` | Los cuartos donde va, uno o varios de `bedroom`, `living`, `dining`, `office`, `kitchen`, `entry` y `workshop` (`ROOMS` en `src/domain/furniture/references.ts`). Obligatorio: así el lab la encuentra por cuarto sin que nadie toque código, y una ficha sin cuarto no se adopta. La portada no los usa; ella tiene `home` |
| `kind`, `finish` | Opcionales: qué mueble es (`DesignKind`, `src/domain/design/kind.ts`) y su acabado (`src/domain/materials/finishes.ts`). Un gabinete no dice por sí mismo si es aparador o librero |
| `plan` | La ficha que entiende el motor (`FurniturePlan`): medidas, base, construcción, columnas y celdas |
| `home` | Opcional. Con él es una tarjeta de la pantalla de inicio: `order`, `category` y, si es `featured`, también en «Destacados» (hasta 11, para que la última celda sea «Diseña tu propio mueble»). Sin él sigue siendo referencia para las pruebas. Una base del inicio tiene el mismo nombre en la ficha y en su `plan`, y no hay dos con el mismo nombre; los destacados van primero en `order` |
| `expect` | Lo que el motor hace del plan: válido, piezas, avisos, hojas y herrajes. Lo escribe `probe`; una candidata no lo trae |
| `support`, `difficulty`, `features`, `adaptations`, `gaps` | Una `KC-…` los dice todos: cómo se soporta (`exact`, `adapted`, `unsupported`), la dificultad de 1 a 4, qué rasgos tiene y cuáles no puede dibujar Knotty (etiquetas de la lista cerrada `FEATURES`) y qué se adaptó (texto) |

`format` (siempre 1) lo agrega `probe`. **`features`** dice lo que el mueble tiene, de la lista cerrada `FEATURES` (`src/domain/furniture/references.ts`), lo dibuje Knotty o no; **`gaps`** dice, con las mismas etiquetas, lo que Knotty no puede dibujar de él: siempre es un subconjunto de `features` (una etiqueta en `gaps` que no está en `features` se rechaza). Contar huecos entre muebles es contar etiquetas. Si lo que ves no cabe en ninguna, no se inventa una: se anota en la respuesta como etiqueta propuesta y se agrega a `FEATURES` a propósito. `no-back` vale para cualquier parte sin trasera, no solo para el mueble entero. Las `adaptations` sí son texto libre. `support` es `exact` solo si no hay adaptaciones ni huecos; en cuanto hay uno, `adapted`.

Cuatro etiquetas que conviene no confundir:
- `splayed-legs`: patas que se abren o se estrechan, sueltas o en A. `angled-cut` queda para costados, tableros y remates cortados en ángulo.
- `raised-sides`: los costados suben por encima de la cubierta. Son cajas; no es un corte en ángulo.
- `slatted-fronts`: frentes hechos de tiras pegadas. `routed-fronts` es una ranura de router sobre una cara lisa.
- `slatted-base`: la base de una cama hecha de tablillas sueltas en lugar de un tablero corrido.

- `finger-joints`: el mueble tiene esquinas de dedos (*box joint*) a la vista. En un gabinete se dibuja con `construction.drawerCorners: "fingers"` y, si no son los 5 de siempre, `drawerFingers` (de 3 a 21 por esquina): vale para todos los cajones del mueble y se ve de atrás o con el cajón fuera, porque el frente lo tapa. Las esquinas de la cubierta con los costados, como en el KC-BUR-05, se dibujan con `construction.top: "fingers"` (el mismo `drawerFingers`): los costados suben hasta la cara de arriba y quedan a la vista de frente.

`routed-fronts` también se dibuja en el gabinete (`construction.fronts: "grooved"`), con ranuras verticales; si el frente es de tiras pegadas y no de router, sigue siendo un hueco. `notch-pulls` ya se dibuja en el gabinete (`construction.pulls: "notch"`), así que una ficha que lo usa lo pone en `features` y no en `gaps`; con herrajes es `"handle"`, que suma una jaladera por hoja de puerta y frente de cajón a la compra.

El archivo se escribe siempre igual (`probe` lo hace), para que un cambio mueva pocas líneas. **Las fotos de referencia no se guardan en el repo.**

## Comandos

```bash
npm run probe -- kc-apa-01                          # una ficha, en detalle
npm run probe -- --all                              # todas, una línea cada una
npm run probe -- --diff kc-apa-01 candidata.json    # qué cambiaría una candidata; no escribe nada
npm run probe -- --adopt kc-apa-01 candidata.json   # la vuelve la versión siguiente (o la versión 1 de una nueva)
npm run probe -- --update kc-apa-01                 # reescribe solo su `expect`
npm run probe -- --explain kc-apa-01                # la ficha en palabras, generada de su plan y sus metadatos
npm run probe -- --explain kc-apa-01 candidata.json # lo mismo para una candidata, como quedaría adoptada
```

`npm test` corre la misma comparación de `--all`: un cambio del motor que mueve una compra o agrega un aviso falla con la línea exacta.

## Mejorar una ficha en el taller

El banco (cajón de la barra de depuración: Konami, `Ctrl+Shift+D`, ajustes o `?debug`) lista todas las fichas: ábrela, pídele cambios al experto o muévele los campos, y con «Exportar ficha» baja un archivo candidato. El taller no escribe en el repositorio: el archivo se revisa con `--diff` y se adopta con `--adopt`, como cualquier candidata. Solo exporta lo que cabe en un plan; si se cambiaron piezas sueltas después del plan, lo dice y no exporta (esos cambios se vuelven a pedir en los campos de la ficha).

## 1. De una idea o unas fotos a una ficha

1. **Mirar el mueble entero.** Para cada foto, no solo la general: bisagras, repisas detrás de las puertas, cómo abren los cajones, la base, las jaladeras. Escribir, de abajo hacia arriba:
   - filas y columnas, y qué hay en cada hueco (puerta, cajón, abierto, cerrado);
   - puertas y cajones embutidos o sobrepuestos, cuántas hojas, repisas detrás;
   - cubierta entre los costados o encima; trasera sí o no;
   - base: zoclo, directa, patas o ruedas;
   - lo que Knotty todavía no modela (cortes en ángulo, curvas, vidrio, un hueco sin trasera…).

   Tres cosas que el plan hace de cierta manera y conviene saber antes de escribirlo:
   - Cada columna de la cuadrícula tiene un solo ancho de arriba abajo, y reparte por su cuenta la altura de sus celdas, como fracciones de esa columna. Si los niveles ponen sus divisores en lugares distintos, se dice con celdas divididas (abajo), no con `gaps`.
   - Una columna puede **no llegar al piso o al techo**: su primera o su última celda es `content: "void"` y ahí no se construye nada (cajas que cuelgan a distinta altura bajo una tapa, tapas escalonadas). Va solo en un extremo de la columna, y al menos una columna llega al piso y otra al techo. El experto no la escribe: solo una ficha o el editor.
   - Una celda puede **dividirse en columnas**: en vez de contenido trae `columns`, cada una con su `width` y sus `cells`. Así se dicen los divisores distintos por nivel (una sola columna cuyas celdas son niveles divididos) y el cajón que cruza columnas (una celda sin dividir debajo de una dividida). Lleva al menos dos columnas y ningún vacío dentro. El experto tampoco la escribe.
   - Una celda puede llevar **trasera propia o ninguna**: `"back": true` o `false`, contra lo que dice `construction.back` (las traseras en damero, un nicho abierto al muro). Va solo en una celda con algo, no en un vacío ni en una dividida, y cada tramo seguido de celdas con trasera es una tabla. El experto tampoco la escribe.
   - En una base con patas, `dimensions.height` incluye las patas.
   - Un mueble alto con cajones se ancla al muro (`wallMounted: true`), y uno con puertas también cuando es ancho y poco profundo; si no, `--diff` lo marca con un aviso crítico de vuelco (`R4_TIPPING`).
2. **Elegir el módulo** (`src/domain/furniture/modules/`: gabinete, cama, mesa, zapatera). Si ninguno cabe, ya sabes que hay soporte por agregar (sección 2).
3. **Escribir la candidata.** Un archivo JSON con el `plan` y, para una referencia nueva, lo demás que dice una ficha. El experto de la app también puede proponer el plan a partir de fotos y una descripción; el resultado es un borrador que una persona revisa, no una ficha.

   ```json
   {
     "id": "night-table",
     "rooms": ["bedroom"],
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
4. **Ver qué haría** con `--diff <código> candidata.json`. Dice qué cambia y, siempre, el veredicto del motor (válido o no, piezas y avisos), también para una referencia nueva; un aviso crítico sale marcado. Si el motor no puede construirlo, dice por qué y no se adopta. Para leerla antes de adoptar, `--explain <código> candidata.json` la dice en palabras, y `--diff` marca las líneas que cambian respecto a la versión vigente. Todavía no hay una vista previa en 3D de una candidata: se ve en la app después de adoptarla, con `home`.
5. **Adoptarla** con `--adopt`. Una `KC-…` nueva tiene que traer también su soporte, dificultad, rasgos, adaptaciones y huecos. La dificultad parte de la del tipo de mueble en `docs/carpinteria/muebles-y-medidas.md` (§1); cuando ese rango es de dos niveles (por ejemplo 2–3), se toma el más alto si el diseño tiene frentes embutidos, patas o muchos cajones. Es un criterio provisional.
6. **Comprobar** con `probe -- <código>` y abrirla en la app (`home` la pone en la pantalla de inicio).

Sobre una referencia que ya existe, la candidata puede ser solo el `plan`: lo demás se hereda, y si algo cambió sube la versión.

## 2. Cuando Knotty no puede construirlo: agregar soporte

Una ficha que sale inválida, o que se tiene que adaptar, señala un hueco. Antes de tocar código, **cuenta** en cuántos muebles de referencia aparece: un rasgo de un solo mueble se anota en `gaps` y no se construye. Se construye lo que cambia la **compra** o la **seguridad**, o lo que se repite en varios; lo que es solo apariencia se junta después.

Como se agregaron las patas al gabinete es el recorrido típico:

1. **El plan** (`modules/<módulo>.ts`): la opción nueva en el esquema, con su `.describe` (es lo que lee el experto), y sus etiquetas para la hoja de la ficha.
2. **El constructor** (mismo archivo, y `modules/common.ts` para lo que comparten): las piezas y uniones que la opción agrega. Knotty construye cada pieza, así que no se pueden traslapar.
3. **Los supuestos numéricos** (`domain/assumptions.ts`): cada cifra con su fuente.
4. **Las revisiones** (`domain/checks/structure/`): si una regla existente lee lo que cambió, se sube su versión; si hace falta una nueva, va en el registro.
5. **La guía del experto** (`adapters/llm/prompts/modules/<módulo>.vN.md`, escrita a mano para gabinete, cama y mesa): se sube su versión y su presupuesto en `prompts.test.ts`. Como cambia lo que ve el experto, hay que correr `npm run compare` a mano (cuesta tokens) y comparar con el último reporte.
6. **Pruebas** del módulo (`<módulo>.test.ts`): la opción, sus piezas y lo que no debe pasar.
7. **Las fichas.** `probe -- --all` dice cuáles se movieron. Las diferencias esperadas se aceptan con `--update`; una inesperada es un error. Después, adoptar la candidata que antes se adaptó, ya sin la adaptación, y quitarla de `gaps`.
8. **Una decisión o un invariante en `docs/PROPUESTA.md`**, solo si hay un porqué que el código no dice; el diario de la entrega va en el cuerpo del PR.

El detalle de qué correr según lo que tocaste está en [CONTRIBUTING.md](../CONTRIBUTING.md).
