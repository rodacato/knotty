# Studio audit — Mariana (2026-09-27)

Persona 1 in `design/AUDIENCE.md`: DIY homemaker, phone, thinks in cm and colors, ~$2,000 MXN budget, does not know *claro*, *flecha*, *canto*, *veta*. Fictional — every finding here is a hypothesis until a real person confirms it.

## First impression

«Ay, qué bonito se ve el librero, lo puedo girar y todo, eso me encanta. Le pedí que fuera de 90 y me salió un sello rojo de "CRÍTICO" con puros números en milímetros… ¿se me va a caer o qué? En la propuesta por lo menos hay un botón grandote que me dice cómo arreglarlo. Pero sigo sin saber cuánto me sale.»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| mobile-chat.jpg | «Hazlo de 90 cm de ancho» | «Ah, mira, ya me dan la idea de qué pedirle. Y en centímetros, como yo pienso.» | Useful | keep |
| mobile-chat.jpg | «940 × 1600 × 400 …» | «¿Cuál es el alto y cuál el ancho? Y los tres puntitos, ¿qué me esconden?» | Lost | gap |
| mobile-piece.jpg | «Puerta de la columna 3 (hueco 1)» (the card covers the furniture) | «Toqué la puerta y ahora ya no veo el mueble. ¿Cuál puerta era?» | Lost | vice |
| mobile-piece.jpg | «Veta a lo largo» | «¿Veta? ¿Eso es algo que tengo que comprar?» | Lost | gap |
| mobile-piece.jpg | «Divisor 2: bisagras de cazoleta» | «¿Cazoleta? Yo nomás conozco la bisagra normal.» | Lost | gap |
| mobile-furniture.jpg | «Lo dice el ejemplo.» | «¿Quién lo dice? Suena raro, como a medias.» | Lost | slop |
| mobile-furniture.jpg | Alto «940» «mm» | «Todo en milímetros, tengo que andar dividiendo entre diez.» | Feel | gap |
| mobile-chat-answer.jpg | «Viendo la propuesta sin aplicar» | «Ok, esto todavía no es de verdad, nomás lo estoy viendo. Eso sí se entiende.» | Understand | keep |
| mobile-chat-answer.jpg | «¿Cómo lo resolvemos?» · «Agregar un apoyo al centro, debajo del piso» | «¡Eso! Dime qué hago y ya. Un apoyo, eso lo entiendo.» | Useful | keep |
| mobile-notices-pending.jpg | «Piso se pandearía ~9.8 mm con libros en un claro de 864 mm (lo aceptable es hasta 2.4 mm)» ×5 | «Me repite lo mismo cinco veces y ni sé qué es "claro". Aquí cierro la app.» | Feel | vice |
| mobile-notices-fixes.jpg | «CRÍTICO» | «Rojo, en mayúsculas, como sello… me asusté. ¿Es peligroso o nomás se va a doblar tantito?» | Feel | gap |
| mobile-notices-fixes.jpg | «AL INSTANTE» · «Un apoyo al centro, debajo de cada una (5 piezas)» · «Aplicar» | «Ah, sí hay salida, y con botón. Pero la tuve que buscar abajo del texto feo.» | Useful | keep |
| mobile-chat-tray.jpg | «BANDEJA · 1» · «Consultar al experto» | «¿Bandeja de qué? El botón negro me tapa lo que me estaba diciendo el experto.» | Lost | vice |
| mobile-chat-tray.jpg | «Listo, apliqué "Ensanchar a 90 cm" como lo pediste. Los puntos críticos siguen» | «¿Siguen? ¿Entonces lo arreglaste o no?» | Lost | gap |
| mobile-piece-editing.jpg | «Mover» ↑ ↓ «de 10 mm» | «Eso de subir y bajar está fácil. Pero la tarjeta tapa todo, hasta arriba.» | Feel | vice |
| mobile-materials-verdict.jpg | «(Esto es el modo simulado: conecta un experto real para una revisión con criterio.)» | «¿Simulado? ¿Entonces lo de arriba es de mentiras? Ya no sé si confiar.» | Lost | gap |
| mobile-materials-list.jpg | «Pide los cortes largos en la tienda y deja los chicos para casa.» | «Esto sí me sirve, yo siempre pido que me corten en Home Depot.» | Useful | keep |
| mobile-materials-list.jpg | «~$3,165» (way below, after the tips) | «¡Tres mil! Y lo encontré hasta el final. Eso era lo primero que quería ver.» | Missing | gap |
| mobile-history-versions.jpg | «Volver a esta» | «Qué bueno que puedo regresar al de antes si la riego.» | Useful | keep |
| mobile-history-versions.jpg | «Simulado · 1 operación» · «9 piezas se ajustaron solas» | «¿Operación? ¿Se ajustaron solas? Suena a cirugía.» | Lost | slop |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| 1-conversation-default.png | «940 × 1600 × 400 mm · 160 cm» | «Ya dice mm, pero ¿160 cm qué? ¿el ancho? Sigo sin saber cuál es cuál.» | Lost | gap |
| 1-conversation-default.png | «···» (where «+» and the gear used to be) | «¿Y dónde empiezo otro mueble? Los tres puntitos no me dicen nada.» | Missing | gap |
| 2-piece-selected.png | door highlighted in orange with the rest see-through | «¡Ay, qué padre! Veo exactito cuál puerta es y el mueble sigue ahí.» | Feel | lift |
| 2-piece-selected.png | «Triplay de pino 18 mm · Veta a lo largo» | «Otra vez la veta. Nadie me explica qué es.» | Lost | gap |
| 2-piece-selected.png | «Editar a mano» (alone at the bottom, empty space above) | «Hay un hueco enorme y el botón hasta abajo. Casi no lo veo.» | Feel | vice |
| 3-conversation-thinking.png | «Pensando el cambio… · 12 s» | «Bien, sé que está trabajando y cuánto lleva. No me desespero.» | Feel | keep |
| 4-conversation-proposal-pending.png | «Aplicar con un apoyo al centro» (big button with ⚡) | «¡Esto! No me dejas con el susto, me das la solución en un botón.» | Useful | lift |
| 4-conversation-proposal-pending.png | «CRÍTICO» · «Piso se pandearía ~9.8 mm con libros en un claro de 864 mm» | «Ya no lo repite cinco veces, pero sigo sin saber qué es "claro" ni si 9.8 mm es mucho.» | Lost | gap |
| 4-conversation-proposal-pending.png | «Ver el actual» «Aplicar así, bajo mi riesgo» «Descartar» | «Tres cositas chiquitas juntas. "Bajo mi riesgo" me da miedo tocarlo por error.» | Feel | vice |
| 5-notices-critical.png | «Al instante» · «Ver» · «Aplicar» | «Dos botones grandes, uno para ver y otro para hacerlo. Clarísimo.» | Understand | keep |
| 5-notices-critical.png | «A la bandeja, para el experto» | «¿Qué bandeja? ¿Como la de la cocina? Yo nomás quiero saber si el experto me contesta.» | Lost | gap |
| 5-notices-critical.png | «Aceptar así, bajo mi riesgo» (screen 4 says «Aplicar así, bajo mi riesgo») | «¿Aceptar o aplicar? ¿Es lo mismo o es otra cosa?» | Lost | bug |
| 6-conversation-tray.png | «Bandeja · 1» · «Consultar al experto» | «Hay algo en la bandeja pero no me dice qué. Antes por lo menos lo decía.» | Missing | vice |
| 6-conversation-tray.png | bell with «1» still red | «Ya lo mandé al experto, ¿por qué sigue la campanita roja?» | Lost | gap |
| 7-notices-several-resolve.png | «1 al instante · 1 al experto» · «Resolver 2» | «Palomeo y un solo botón. Así sí: rápido y sé qué va a pasar con cada uno.» | Useful | lift |
| 7-notices-several-resolve.png | «Con 200 mm de fondo, los libros grandes quedan de fuera» | «Eso sí lo entiendo sin ser carpintera. Así deberían ser todos.» | Understand | keep |
| 8-materials-expert-working.png | «Pensando el cambio… 24 s» over the 3D | «Puedo seguir viendo el mueble mientras piensa. Bien.» | Feel | keep |
| 8-materials-expert-working.png | «Revisar y ver materiales» (no price anywhere) | «Entré a Materiales para ver cuánto me sale y nomás me dan un botón. ¿Y el precio?» | Missing | gap |
| 9-materials-expert-answered.png | «Conversación •» and the same «Antes de comprar, una revisión» | «¿Ya contestó el experto? Un puntito nada más. No me di cuenta de nada.» | Lost | gap |

## Current vs proposal

«Me quedo con la propuesta: el mueble nunca se me tapa, y cuando algo sale mal me dan el botón "Aplicar con un apoyo al centro" en vez de un párrafo repetido. "Resolver 2" me encantó.
Pero extraño que la bandeja me dijera qué llevaba adentro, y en ninguna de las dos veo rápido cuánto me cuesta.
Y las dos me hablan de "claro" y "veta" como si yo fuera carpintera.»

## Top 3 findings

1. The warning's wording has jargon and no scale: «en un claro de 864 mm (lo aceptable es hasta 2.4 mm)» (mobile-notices-fixes.jpg, 4-conversation-proposal-pending.png, 5-notices-critical.png). Mariana can't tell whether the shelf fails or just sags a bit, so the red «CRÍTICO» only scares her. Tagged gap; it shows up in both versions.
2. There is no price where she looks for it: in the current app «~$3,165» is buried at the bottom of mobile-materials-list.jpg, and in the proposal the Materials tab shows only «Revisar y ver materiales» (8-materials-expert-working.png). Tagged gap; the proposal does not fix it.
3. The tray means nothing to her and doesn't show what's in it: «A la bandeja, para el experto» (5-notices-critical.png), and «Bandeja · 1» (6-conversation-tray.png) no longer lists the item. On top of that, the answered state is just a dot on «Conversación •» (9-materials-expert-answered.png). Tagged gap/vice; this is where the proposal is worse than the current app.
