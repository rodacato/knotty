# Studio audit — Doña Carmen (2026-09-27)

Persona 5 (accessibility lens): presbyopia, largest phone font, types slowly, her nephew builds. Phone frames 390 px, exported at 2x. Sizes below are estimated from the 2x export, not measured in code. Every finding here is a hypothesis until a real person confirms it.

## First impression

«Ay, mijo, el mueble sí se ve bonito y grandote, eso me gusta. Las letras de la plática las leo bien sin lentes. Pero los numeritos pegados al mueble y los dibujitos de arriba, la campanita, los puntitos, la reglita, esos no sé qué son ni los alcanzo a leer. Y yo lo que quiero es mandárselo a mi sobrino, y no veo dónde.»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| mobile-chat.jpg | «Aparador de comedor de cuatro columnas: abajo tres puertas…» | «Esto sí lo leo bien, letra grande y oscura. Entiendo qué es el mueble.» | Understand | keep |
| mobile-chat.jpg | «940 mm · 94 cm» (etiquetas sobre el 3D) | «No le veo, mijo, está muy chiquito. Parecen hormiguitas.» (~6–7 px) | Lost | gap |
| mobile-chat.jpg | campanita, engrane y «+» sin texto en el encabezado | «¿Y este dibujito qué hace? ¿El más es para agregar otro mueble o para agrandar la letra?» | Lost | gap |
| mobile-chat.jpg | «940 × 1600 × 400 …» | «¿Y los puntitos? Se cortó lo demás.» | Lost | vice |
| mobile-chat.jpg | botón negro redondo con la reglita junto a «Armado» | «Ese botón negro es el más grande de arriba y no dice nada. Lo aprieto nomás por ver.» | Lost | gap |
| mobile-chat.jpg | «Hazlo de 90 cm de ancho» / «Que aguante libros pesad…» | «Estos botones sí, grandes y con letras. Pero el segundo se corta y no sé que hay que deslizarlo.» | Useful | lift |
| mobile-piece.jpg | «LARGO 553 · 55.3 cm» | «Los numerotes los leo. Pero la tarjeta me tapó el mueble, ya no veo cuál puerta es.» | Feel | vice |
| mobile-piece.jpg | «Divisor 2: bisagras de cazoleta» | «¿Cazoleta? Eso que lo lea mi sobrino.» | Lost | gap |
| mobile-furniture.jpg | «Aplicar» gris / «Sin cambios todavía.» | «El botón grande está apagado y el gris sobre gris casi no se lee. ¿Está roto?» | Lost | vice |
| mobile-materials.jpg | «Antes de comprar, una revisión» + lista con palomitas | «Me gusta que un carpintero revise antes de gastar. Esto me da confianza.» | Feel | keep |
| mobile-chat-answer.jpg | «Aplicar así, bajo mi riesgo» (gris claro, sin borde) | «¿Bajo mi riesgo? ¿Qué riesgo? Y está tan clarito que casi no lo veo, pegadito a "Descartar".» | Feel | vice |
| mobile-chat-answer.jpg | «Viendo la propuesta sin aplicar» + encabezado «1800 × 570 × 300» | «El mueble dice 90 y arriba dice 570. ¿Cuál es el bueno?» | Lost | bug |
| mobile-notices-pending.jpg | «Piso se pandearía ~9.8 mm con libros en un claro de 864 mm…» repetido cinco veces | «Es la misma frase cinco veces. Me cansé a la segunda. ¿Se me va a caer o no?» | Feel | slop |
| mobile-notices-fixes.jpg | «CRÍTICO» con sello rojo | «Me asusté. Pero luego dice "Y 4 piezas más igual", eso sí se entiende mejor.» | Feel | lift |
| mobile-notices-fixes.jpg | «AL INSTANTE» (mayúsculas chiquitas) | «Las letras de arriba del cuadro están chiquitas y clarito; lo de abajo sí lo leo.» | Lost | vice |
| mobile-notices-fixes.jpg | «Ver» junto a «Aplicar» | «Están muy juntitos, con mi dedo le pego al que no es.» | Lost | gap |
| mobile-chat-tray.jpg | «BANDEJA · 1» / chip con «×» | «¿Bandeja de qué? Y la tachita está tan chica que la voy a apretar sin querer.» | Lost | gap |
| mobile-chat-tray.jpg | «Consultar al experto» | «Ese sí dice qué hace. Botón grande y negro, lo entiendo.» | Useful | keep |
| mobile-piece-editing.jpg | «Mover ↑ ↓ de 10 mm» | «Las flechitas sí, pero la tarjeta tapa todo, hasta la campanita.» | Feel | vice |
| mobile-materials-verdict.jpg | «Las piezas suman exacto 1800 × 900 × 300 mm (alto, ancho, fondo).» | «Lo grande lo leo; esto de abajo, chiquito y gris, ya no.» (~12 px) | Lost | vice |
| mobile-materials-verdict.jpg | «(Esto es el modo simulado: conecta un experto real…)» | «¿Simulado? ¿Entonces no es de verdad? Ya no le creo.» | Feel | gap |
| mobile-materials-list.jpg | «COSTO APROXIMADO ~$3,165» | «¡Eso! El precio grandote, clarito. Esto se lo enseño a mi sobrino.» | Useful | keep |
| mobile-history-versions.jpg | «Volver a esta» / «Ver» | «Me gusta que puedo regresar a como estaba si la riego.» | Feel | keep |
| all screens | (no share / send button anywhere) | «¿Y cómo se lo mando a mi sobrino por WhatsApp?» | Missing | gap |
| all screens | «Pide un cambio: «refuerza la base»…» | «Escribir me cuesta. ¿No le puedo hablar como en WhatsApp?» | Suggest | gap |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| 1-conversation-default.jpg | «940 × 1600 × 400 mm · 160 cm» | «Ahora sí sale completo, no con puntitos. Pero ¿160 cm es el alto o qué?» | Understand | lift |
| 1-conversation-default.jpg | «···» en la esquina | «¿Y los tres puntitos? Antes había engrane y un "+", ahora ni eso. Menos le entiendo.» | Lost | vice |
| 1-conversation-default.jpg | íconos de pantalla completa y reglita en la barra de vistas | «Antes decía "Armado" al lado; ahora son dos dibujitos solos. Uno de ellos en círculo negro, el más llamativo, y no sé qué hace.» | Lost | vice |
| 1-conversation-default.jpg | «940 mm · 94 cm» (etiquetas sobre el 3D) | «Siguen igual de chiquitas.» | Lost | gap |
| 2-piece-selected.jpg | «553 mm» / «Editar a mano» | «¡Esto sí! El mueble se sigue viendo, la puerta pintada de naranja, los números grandotes y un botón ancho abajo que dice qué hace.» | Useful | keep |
| 2-piece-selected.jpg | mueble transparente con piezas negras | «¿Por qué se volvió como de vidrio? ¿Se rompió?» | Lost | gap |
| 3-conversation-thinking.jpg | «Pensando el cambio… · 12 s» | «Qué bueno que me dice que está pensando y cuánto lleva.» | Feel | keep |
| 3-conversation-thinking.jpg | botón con cuadrito «□» en lugar de la flecha | «¿El cuadrito es para parar o para qué? No dice.» | Lost | gap |
| 4-conversation-proposal-pending.jpg | «Aplicar con un apoyo al centro» | «Un solo botón grande que me dice qué hacer. Ese le aprieto.» | Useful | lift |
| 4-conversation-proposal-pending.jpg | «Ver el actual  Aplicar así, bajo mi riesgo  Descartar» | «Tres cosas en un renglón, sin bordes, pegaditas. No sé dónde empieza una y termina la otra.» | Lost | vice |
| 4-conversation-proposal-pending.jpg | «1800 × 570 × 300 mm · 57 cm» arriba, «900 mm · 90 cm» en el mueble | «Arriba 57 y abajo 90. Me confundo igual que antes.» | Lost | bug |
| 4-conversation-proposal-pending.jpg | «Piso se pandearía ~9.8 mm con libros en un claro de 864 mm» | «¿Claro? ¿Pandearía? Nomás dígame si se me caen las macetas.» | Lost | gap |
| 5-notices-critical.jpg | «Ver» / «Aplicar» (botones anchos, separados) | «Así sí: dos botones grandes, bien separados. No me equivoco.» | Useful | lift |
| 5-notices-critical.jpg | «Piso se pandearía… Y 4 piezas más igual.» en gris | «La explicación ahora está en gris clarito y más chica que antes. La tengo que acercar a la cara.» | Lost | vice |
| 5-notices-critical.jpg | «Aceptar así, bajo mi riesgo» | «Otra vez esas letras clarititas sin botón. ¿Se puede apretar?» | Lost | vice |
| 5-notices-critical.jpg | «A la bandeja, para el experto» / «Que el experto decida» | «"Que el experto decida" sí lo entiendo; "bandeja" no, pero ya no importa.» | Understand | lift |
| 6-conversation-tray.jpg | «Bandeja · 1» con dibujito, sin texto de qué contiene | «Antes decía qué había en la bandeja; ahora nomás "1". ¿Uno qué?» | Lost | vice |
| 6-conversation-tray.jpg | «Consultar al experto» montado sobre el renglón de «Bandeja» | «El botón negro tapa la orilla del renglón, se ve encimado.» | Lost | bug |
| 7-notices-several-resolve.jpg | «Resolver 2» | «Botón enorme hasta abajo, con palomitas ya puestas. Eso me gusta: nomás aprieto uno.» | Useful | keep |
| 7-notices-several-resolve.jpg | «1 al instante · 1 al experto» | «¿Al instante de qué? Esto chiquito de arriba del botón no lo entiendo.» | Lost | gap |
| 8-materials-expert-working.jpg | «Pensando el cambio… 24 s» con «×» encima del mueble | «Ya no me tapa la plática, está bien. Pero la tachita está chiquita junto al número.» | Feel | vice |
| 9-materials-expert-answered.jpg | «Conversación ●» y campanita sin número | «¿El puntito negro qué es? ¿Me contestaron? No dice.» | Lost | gap |
| 9-materials-expert-answered.jpg | texto gris «Un carpintero revisa tu diseño…» | «El mismo texto de antes, pero más clarito y más chico. Lo leía mejor en la otra.» | Lost | vice |
| all screens | (no share / send button; «···» might hide it) | «Si lo de mandarlo está en los tres puntitos, nunca lo voy a encontrar.» | Missing | gap |

## Current vs proposal

«Me quedo con la nueva para decidir: los botones "Aplicar", "Resolver 2" y "Editar a mano" son grandes, dicen qué hacen y ya no me tapan el mueble. Pero para leer, la de antes era mejor: las explicaciones venían más grandes y oscuras, y la nueva las puso en gris chiquito. Y la nueva escondió cosas en dibujitos: los tres puntitos, la reglita y el cuadrito. Si arreglan las letras grises, me quedo con la nueva sin pensarlo.»

## Top 3 findings

1. The proposal lowers body contrast and size: body and explanation copy moves to light gray and gets smaller (5-notices-critical.jpg «Piso se pandearía… Y 4 piezas más igual.»; 9-materials-expert-answered.jpg «Un carpintero revisa tu diseño…»), in the text the persona actually has to read. `vice`
2. More actions are icon-only in the proposal: the «···» menu replaces the gear and «+», the «Armado» label is gone next to the fullscreen and ruler icons (1-conversation-default.jpg), the stop button is a bare «□» (3-conversation-thinking.jpg), and «Conversación ●» is an unexplained dot (9-materials-expert-answered.jpg). The persona quits on exactly these. Neither version has a way to send the design to someone. `gap`
3. The secondary actions are unbordered gray text in a row: «Ver el actual  Aplicar así, bajo mi riesgo  Descartar» (4-conversation-proposal-pending.jpg) and «Aceptar así, bajo mi riesgo» (5-notices-critical.jpg) are hard to see and easy to mis-tap. In contrast, the separated «Ver» / «Aplicar» pair (5) and «Resolver 2» (7) are the best targets in either version, so they should be kept. `vice` / `keep`
