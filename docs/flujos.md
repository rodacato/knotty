# Flujos de trabajo

Qué hacer, en qué orden y dónde va cada cosa según lo que quieras lograr. Cada flujo apunta a la guía que tiene el detalle; aquí solo está el recorrido.

## Dos modos

| Modo | Comando | Cuándo |
|---|---|---|
| Sin experto | `npm test` | Siempre. Revisa el motor, lo que el chat entiende solo y cómo reacciona Knotty a una respuesta del experto |
| Con experto | `npm run compare` | A mano, cuando cambia lo que ve el experto. Cuesta tokens ([guía](compare.md)) |

`npm run probe` y `npm run autonomy` no son otro modo: son herramientas para trabajar una ficha o el intérprete, y lo que cuidan ya corre en `npm test`.

## 1. Que el chat entienda un pedido sin experto

1. Agrega las frases a `scripts/autonomy/corpus/<módulo>.ts`, con lo que significan y sobre una variante del banco.
2. `npm run autonomy` las lista como `unread`.
3. Enséñaselas al intérprete (`src/domain/furniture/intent/`), con su caso en `intent.test.ts`.
4. `npm run autonomy` otra vez: suben a `read` y nada queda `misread`.

Solo sirve para lo que el plan ya sabe decir. Si el pedido necesita un campo que no existe, primero va el flujo 3. Detalle: [autonomía](autonomy.md).

## 2. Usar al experto para saber qué enseñarle al chat

1. Usa la app con el experto conectado y exporta la bitácora (barra de depuración → «Exportar»): trae cada pedido que llegó al experto y lo que contestó.
2. Un pedido cuya respuesta cambió un solo campo del plan lo pudo leer Knotty sola: va al corpus y sigue el flujo 1.

Todavía no hay un comando que mande los pedidos `unread` del corpus al experto y compare las respuestas (`src/application/bench/preservation.ts` ya sabe decir qué campos cambió una). Hoy ese paso es a mano.

## 3. Una acción, un material o un corte nuevo

Primero el motor lo construye; después el chat aprende a pedirlo.

| Qué | Dónde | Detalle |
|---|---|---|
| Una opción que el plan no sabía decir, o un corte | El esquema y el constructor del módulo (`src/domain/furniture/modules/`), sus variantes y sus pruebas | [Fichas, sección 2](fichas.md#2-cuando-knotty-no-puede-construirlo-agregar-soporte) |
| Un material | El catálogo (`public/catalog/catalog.json`) | Banco sin experto y la pestaña Materiales |
| Cómo se pide en el chat | Flujo 1 | |

Para elegir qué sigue, cuenta en cuántas fichas aparece el rasgo en `gaps`: se construye lo que cambia la compra o la seguridad, o lo que se repite.

## 4. Un mueble nuevo y si es viable

1. Escribe la candidata: el `plan`, o el `design` pieza por pieza si ningún módulo lo construye.
2. `npm run probe -- --diff <código> candidata.json`: dice si el motor lo construye, con cuántas piezas y qué avisos; uno crítico sale marcado. No escribe nada.
3. `npm run probe -- --adopt <código> candidata.json` la guarda con su `expect`; desde ahí `npm test` la vigila.
4. Si abre un módulo o un uso nuevo: sus variantes en el módulo y sus frases en el corpus (flujo 1).

Viable quiere decir que el motor lo construye y las comprobaciones no encuentran nada crítico. No prueba que el mueble real aguante. Detalle: [Fichas, sección 1](fichas.md#1-de-una-idea-o-unas-fotos-a-una-ficha).

## 5. Que el experto arme o mejore una ficha

Lo que escribe el experto es un borrador: quien decide si es una ficha es `--diff`, y después una persona.

**Armar una desde una descripción.** En la barra de depuración abre la ficha o la variante del banco más parecida (entra al sandbox), pídele al experto en el chat lo que la hace distinta y baja el archivo con «Exportar ficha». Sigue en el paso 2 del flujo 4.

**Mejorar una cuando Knotty gana soporte.** Las fichas que se adaptaron por ese rasgo lo tienen en `gaps` (`grep -l '"<etiqueta>"' src/adapters/references/*.json`). Abre cada una en el sandbox, pide el cambio con la opción nueva, exporta y revisa con `--diff`; al adoptarla, quita la etiqueta de `gaps` y la adaptación.

Dos límites de hoy:

- «Exportar ficha» solo sale en el sandbox. Un diseño hecho en el Studio desde fotos no se puede bajar como candidata: hay que pedir lo mismo sobre una ficha abierta desde la barra.
- Solo se exporta lo que cabe en un plan. Si el experto resolvió algo pieza por pieza, el archivo no sale y lo dice.

## Dónde va un caso nuevo

Un caso va en el lugar más barato que pueda fallar por lo que quieres cuidar.

| Quieres cuidar que… | El caso es… | Va en | Lo corre |
|---|---|---|---|
| Un plan dé el mueble esperado | Una ficha, o una variante del módulo | `src/adapters/references/`; `benchVariants` del módulo | `npm test`; `npm run probe` para trabajarla |
| Un pedido del chat se lea sin experto | Una frase y lo que significa | `scripts/autonomy/corpus/`; al enseñárselo, también `intent.test.ts` | `npm test`; `npm run autonomy` para la lista |
| Knotty reaccione bien a una respuesta del experto, buena o mala | Un pedido, una respuesta fija y lo que puede cambiar | `src/application/useCases/reactions.test-util.ts` | `npm test` |
| El experto real haga lo pedido | Un pedido y lo que debe salir | `src/application/bench/cases.ts` | `npm run compare` |
| Un consejo sea correcto y seguro | Una pregunta difícil con su revisión | La carpeta privada | `npm run compare:hard` |

Las frases y las respuestas fijas se dicen sobre una variante del banco, no sobre un mueble inventado aparte.
