# Studio audit — Luis (2026-09-27)

Persona 6 (not a target). One question only: does sharing a design matter? Captures are mobile; Luis's device is a laptop, so layout findings are out of his scope. One persona = hypothesis, not a finding (AUDIENCE.md §5).

## First impression

«Ok, el 3D está padre: le doy vuelta, veo las medidas en mm y cm, justo lo que le enseñaría al carpintero. Pero lo primero que busco es "compartir" o "descargar" y arriba solo hay un reloj, una campana, un engrane y un "+". Me pongo a picarle a todo y no encuentro cómo mandarlo. Si no lo puedo mandar, ¿pa' qué lo diseño aquí y no en una servilleta?»

## Current app

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| mobile-chat.jpg | `940 × 1600 × 400 …` | «Las medidas totales cortadas con "…", justo lo que le quiero dictar al carpintero.» | Lost | gap |
| mobile-chat.jpg | header icons (reloj `v1`, campana, engrane, `+`) | «Ninguno dice "compartir". El "+" ¿es nuevo mueble o es para mandarlo? Me da miedo picarle y perder esto.» | Missing | gap |
| mobile-chat.jpg | `940 mm · 94 cm` / `1600 mm · 160 cm` | «Esto sí: mm para el carpintero, cm para mí. Una captura de esto ya casi sirve para cotizar.» | Useful | keep |
| mobile-piece.jpg | `Puerta de la columna 3 (hueco 1)` · `553` `55.3 cm` | «Pieza por pieza con medida; eso le ahorra tiempo al carpintero… si se lo pudiera mandar.» | Useful | keep |
| mobile-piece.jpg | `Divisor 2: bisagras de cazoleta` | «No sé qué es cazoleta, pero no me toca a mí saberlo; eso es pa'l carpintero.» | Understand | keep |
| mobile-furniture.jpg | `Lo dice el ejemplo.` | «¿Quién lo dice? Suena a que no es mío todavía.» | Lost | vice |
| mobile-materials.jpg | `Un carpintero revisa tu diseño completo` | «¿Un carpintero de verdad? Entonces ¿ya no necesito el mío? No me queda claro quién es.» | Lost | vice |
| mobile-materials-verdict.jpg | `(Esto es el modo simulado: conecta un experto real para una revisión con criterio.)` | «"Modo simulado", "experto real"… ¿entonces lo de arriba era de mentira? Pierdo confianza.» | Feel | vice |
| mobile-notices-pending.jpg | `Entrepaño 1 se pandearía ~9.8 mm con libros en un claro de 864 mm` (×5) | «La misma frase cinco veces. Entiendo "se pandea", lo demás no lo leo.» | Feel | slop |
| mobile-chat-answer.jpg | `Aplicar así, bajo mi riesgo` | «Claro: si lo aplico, es mi bronca. Me gusta que no me lo esconda.» | Understand | keep |
| mobile-materials-list.jpg | `Pide los cortes largos en la tienda y deja los chicos para casa.` | «Yo no voy a cortar nada. Esto es para otro; me gustaría mandárselo tal cual.» | Missing | gap |
| mobile-materials-list.jpg | `~$3,165` | «Me sirve para saber si el carpintero me está viendo la cara, aunque él cobra mano de obra aparte.» | Useful | keep |
| mobile-history-versions.jpg | `«Hazlo de 90 cm de ancho»` · `Volver a esta` | «Bien: veo qué pedí y puedo regresarme. Pero no puedo mandar una versión.» | Useful | keep |

## Proposal

| Screen | String | Reaction (in voice) | Kind | Tag |
|---|---|---|---|---|
| 1-conversation-default.jpg | `940 × 1600 × 400 mm · 160 cm` | «Ya se ven completas, con "mm". Pero "· 160 cm" solo convierte el ancho; tuve que adivinarlo.» | Lost | vice |
| 1-conversation-default.jpg | `···` (header) | «Ahora sí hay un menú. Aquí voy a buscar "compartir"; si no está ahí, me voy.» | Missing | gap |
| 1-conversation-default.jpg | `Experto v1` | «Veo quién habla y qué versión es; se entiende mejor que antes.» | Understand | keep |
| 2-piece-selected.jpg | pieza resaltada en naranja + `Largo 553 mm` `55.3 cm` | «El resto transparente y la puerta marcada: esto es exactamente la captura que le mandaría.» | Useful | keep |
| 2-piece-selected.jpg | `Editar a mano` (botón grande) | «Es lo más grande de la pantalla y no quiero editar nada; quiero mandarlo.» | Feel | vice |
| 4-conversation-proposal-pending.jpg | `CRÍTICO` · `Aplicar con un apoyo al centro` | «Un problema, una salida, un botón. No tengo que entender "claro de 864 mm" para decidir.» | Feel | lift |
| 4-conversation-proposal-pending.jpg | `Ver el actual  Aplicar así, bajo mi riesgo  Descartar` | «Tres textos pegados en una línea; no sé dónde termina uno.» | Lost | vice |
| 7-notices-several-resolve.jpg | `Con 200 mm de fondo, los libros grandes quedan de fuera` | «Esto sí lo entiendo sin ser carpintero; me evita que el mueble no sirva.» | Useful | keep |
| 7-notices-several-resolve.jpg | `1 al instante` · `1 al experto` · `Resolver 2` | «¿Al experto? ¿Le tengo que pagar a alguien? No sé qué pasa al picarle.» | Lost | vice |
| 9-materials-expert-answered.jpg | `Un carpintero revisa tu diseño completo para que no compres algo que no se puede armar` | «Yo no voy a comprar ni armar; aquí es donde esperaba "mándaselo a tu carpintero" y no está.» | Missing | gap |
| 9-materials-expert-answered.jpg | `v5` | «Cinco versiones: si le mando algo al carpintero, ¿cómo sabe cuál es la buena?» | Missing | gap |

## Does sharing matter?

Sí, para Luis es lo único que importa: diseñar sin poder mandarlo es no terminar. Ninguna de las dos versiones muestra una salida hacia otra persona; en la propuesta el `···` es la única esperanza y no sé qué contiene (no hay captura del menú abierto). Hoy Luis resolvería con capturas de pantalla del 3D y de la pieza (`2-piece-selected.jpg`), lo cual indica que el material ya existe y solo falta el camino. Pero Luis no es target: es una hipótesis hasta que una persona real que manda hacer muebles lo confirme — no es razón para construir nada todavía.

## Top 3 findings

1. gap — Sin salida para compartir: header de `mobile-chat.jpg` (reloj, campana, engrane, `+`) y `···` en `1-conversation-default.jpg`; ningún texto dice compartir/descargar.
2. vice — «Carpintero» ambiguo: `Un carpintero revisa tu diseño completo` (`mobile-materials.jpg`, `9-materials-expert-answered.jpg`) + `modo simulado` (`mobile-materials-verdict.jpg`) hace creer a Luis que un humano revisa.
3. keep/lift — `2-piece-selected.jpg`: pieza resaltada con `553 mm` / `55.3 cm` es justo el entregable para el carpintero; hoy solo viaja como captura de pantalla.
