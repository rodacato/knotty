# Studio audit — Sofía (2026-09-27)

Persona 4 from `design/AUDIENCE.md`: first rented apartment, no tools, no car. She taps Materials first to see the cost. Current = `design/assets/studio/` (+ `states/`), proposal = `design/exports/playground/`. Everything here is a hypothesis until a real person confirms it.

## First impression

«Ok, el 3D está bonito y se ve como mueble de verdad, eso me gusta. Pero yo nomás quiero saber cuánto me sale y si me lo cortan en la tienda. Le pico a Materiales y me sale un texto de un carpintero que revisa. ¿Y el precio? En las dos versiones tengo que pedir permiso para ver cuánto cuesta. Y luego me salen cosas de "claro de 864 mm" que ni sé qué son.»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| mobile-materials.jpg | «Antes de comprar, una revisión» · «Revisar y ver materiales» | «Le piqué a Materiales para ver el precio y me pone una lista de checks. ¿Por qué tengo que revisar para ver cuánto cuesta?» | Lost | gap |
| mobile-materials.jpg | «Tarda unos segundos; con tu experto conectado, hasta un par de minutos.» | «¿Cuál experto? ¿Tengo uno? ¿Me cobra?» | Lost | gap |
| states/mobile-materials-verdict.jpg | «(Esto es el modo simulado: conecta un experto real para una revisión con criterio.)» | «O sea que lo que me dijo no vale. ¿Entonces para qué me lo enseñas?» | Feel | vice |
| states/mobile-materials-verdict.jpg | «ya sin los 15 mm por orilla que se recortan» | «No entendí nada, pero trae palomita, así que supongo que bien.» | Lost | slop |
| states/mobile-materials-list.jpg | «COSTO APROXIMADO» «~$3,165» | «¡Ahí está! Hasta abajo, pero ahí está. Esto sí me sirve, es lo que vine a buscar.» | Useful | keep |
| states/mobile-materials-list.jpg | «Pide los cortes largos en la tienda y deja los chicos para casa.» | «¿Con qué los corto en casa? No tengo sierra. Yo quiero que me corten todo allá.» | Missing | gap |
| states/mobile-materials-list.jpg | «Para el taller» | «No tengo taller, tengo un depa con piso de loseta.» | Feel | vice |
| states/mobile-notices-pending.jpg | «Entrepaño 1 se pandearía ~9.8 mm … Entrepaño 2 se pandearía ~9.8 mm …» | «Es el mismo párrafo cinco veces. Me asusté y no sé qué hacer.» | Feel | vice |
| states/mobile-notices-fixes.jpg | «CRÍTICO» · «AL INSTANTE» · «Aplicar» | «Ah, aquí sí: hay un botón que lo arregla ya. Eso quiero, que lo decida la app.» | Useful | keep |
| states/mobile-chat-answer.jpg | «Aplicar así, bajo mi riesgo» | «Suena a contrato. ¿Qué riesgo? ¿Que se me caigan los libros?» | Feel | vice |
| states/mobile-chat-tray.jpg | «Listo, apliqué "Ensanchar a 90 cm" como lo pediste. Los puntos críticos siguen» | «La tarjeta de la bandeja tapa el mensaje; no alcanzo a leer qué siguen.» | Lost | bug |
| states/mobile-piece-editing.jpg | «Lateral izquierdo: clavo y pegamento» | «Si va con pegamento no lo voy a poder desarmar cuando me mude. Eso nadie me lo dice.» | Missing | gap |
| states/mobile-piece-editing.jpg | card over the 3D, «Mover … de 10 mm» | «Se tapó el mueble entero. No pedí editar nada, solo quería ver qué pieza era.» | Feel | vice |
| mobile-furniture.jpg | «Alto» «Ancho» «Fondo» in mm · «Sin cambios todavía.» | «Un formulario. Paso.» | Feel | vice |
| states/mobile-history-versions.jpg | «Volver a esta» | «Me gusta poder regresar si la riego.» | Useful | keep |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| 8-materials-expert-working.png | «Antes de comprar, una revisión» · «Revisar y ver materiales» | «Igual que antes: le pico a Materiales y no hay precio. Ahora ni siquiera veo la lista de qué va a revisar, es un botón y ya.» | Missing | gap |
| 9-materials-expert-answered.png | «Revisar y ver materiales» (same as 8) · dot on «Conversación» | «Ya contestó el experto, pero Materiales está igual. El puntito en Conversación no me dice nada.» | Lost | gap |
| 8-materials-expert-working.png | «Pensando el cambio… 24 s» over the 3D | «Bien que no me tapa el mueble y que me dice cuánto lleva.» | Feel | keep |
| 2-piece-selected.png | the door highlighted in an x-ray 3D, card below | «¡Esto está padrísimo! Veo cuál pieza es sin que se tape nada.» | Useful | keep |
| 2-piece-selected.png | «Divisor 2: bisagras de cazoleta» | «¿Cazoleta? Tampoco me dice si se desarma.» | Lost | gap |
| 4-conversation-proposal-pending.png | «Aplicar con un apoyo al centro» | «Un botón grande que ya lo arregla. Eso es lo que quiero, no pensarle.» | Useful | lift |
| 4-conversation-proposal-pending.png | «claro de 864 mm (lo aceptable es hasta 2.4 mm)» | «¿Claro? ¿2.4 mm de qué? Nomás dime si se va a doblar o no.» | Lost | vice |
| 4-conversation-proposal-pending.png | «Ver el actual  Aplicar así, bajo mi riesgo  Descartar» | «Tres cosas en una fila, parecen texto; no sé cuál es botón.» | Lost | vice |
| 4-conversation-proposal-pending.png | «1800 × 570 × 300 mm · 57 cm» | «¿57 cm qué? ¿Ancho? Tuve que adivinar.» | Lost | slop |
| 5-notices-critical.png | «Y 4 piezas más igual.» | «Mucho mejor que el párrafo repetido de antes.» | Feel | lift |
| 5-notices-critical.png / 4 | «Aceptar así, bajo mi riesgo» vs «Aplicar así, bajo mi riesgo» | «¿Aceptar y aplicar son lo mismo? Cambia la palabra de una pantalla a otra.» | Lost | slop |
| 5-notices-critical.png | «A la bandeja, para el experto» · «Que el experto decida» | «¿Qué es la bandeja? ¿Cuánto tarda, me cuesta? Yo le pico a lo de "al instante".» | Lost | gap |
| 6-conversation-tray.png | «Bandeja · 1» | «Antes veía qué había en la bandeja; ahora es un número y ya. ¿Qué le voy a mandar?» | Missing | vice |
| 6-conversation-tray.png | «Los puntos críticos siguen» | «La frase se corta. ¿Siguen qué? ¿Está bien o no?» | Lost | bug |
| 7-notices-several-resolve.png | «1 al instante  1 al experto» · «Resolver 2» | «Un solo botón para todo, sin que me pregunte cada cosa. Me encanta.» | Useful | lift |
| 1-conversation-default.png | «⋯» (replaces «+» and the gear) | «Menos botones, mejor. Aunque no sé qué hay ahí.» | Feel | keep |

## Current vs proposal

«Me quedo con la propuesta para arreglar el mueble: no me tapa el 3D, "Resolver 2" y "Aplicar con un apoyo al centro" deciden por mí, y ya no me repite el mismo párrafo cinco veces. Pero para lo que yo vine, que es el precio, la propuesta está peor: ni una pantalla de Materiales enseña cuánto cuesta, y la actual por lo menos llega a "~$3,165". En ninguna de las dos me dicen si me lo cortan en la tienda ni si lo puedo desarmar cuando me mude.»

## Top 3 findings

1. The price never shows up on the first tap: `mobile-materials.jpg` and `8-materials-expert-working.png` both put «Revisar y ver materiales» ahead of any cost, and in the proposal it is still missing after the expert answers (`9-materials-expert-answered.png`). gap
2. Nothing speaks to a person with no tools: «Pide los cortes largos en la tienda y deja los chicos para casa» / «Para el taller» (`states/mobile-materials-list.jpg`) assumes a saw, and «clavo y pegamento» (`states/mobile-piece-editing.jpg`) says the furniture won't come apart for a move, without warning her. gap
3. The proposal's one-tap fixes win («Aplicar con un apoyo al centro» in `4-…`, «Resolver 2» in `7-…`), but its secondary actions are unclear: «Aceptar/Aplicar así, bajo mi riesgo» uses two different verbs, and «Bandeja · 1» in `6-conversation-tray.png` no longer says what's in the tray. slop/vice
