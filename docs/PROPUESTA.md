# Despiece — Propuesta de diseño

Web app que convierte fotos o una descripción de un mueble en un diseño 3D de triplay. **El mueble es la interfaz**: se cambia tocándolo, en su ficha o pieza por pieza, y el cambio es instantáneo; un carpintero experto (un LLM) entra donde hace falta criterio, agrupado en la bandeja o libre en la conversación (D34). Celular y escritorio pesan igual. El destino es saber cómo se arma y cuántas hojas de triplay comprar.

Este documento es la referencia viva del proyecto. Las decisiones tomadas se anotan en [Decisiones](#decisiones); lo pendiente de discutir, en [Preguntas abiertas](#preguntas-abiertas). El conocimiento de carpintería (material, uniones, medidas, estructura, términos) vive en [`docs/carpinteria/`](carpinteria/README.md).

---

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | ~~Dominio, casos de uso y código de negocio en español~~ **Reemplazada por D33**: el código va en inglés y solo lo que lee la persona en español | Era el lenguaje del problema y del usuario; D33 separa los dos públicos |
| D2 | La fuente de verdad es un modelo paramétrico con **cotas que referencian caras** de otras piezas | Cambiar un ancho o un espesor se propaga de forma determinista, sin pedirle al LLM que recalcule |
| D3 | El LLM propone **operaciones tipadas**; el dominio las aplica y valida | El LLM nunca regenera el modelo completo en un ajuste |
| D4 | Un cambio con un problema estructural crítico nuevo se muestra como **vista previa** con opciones, no se aplica directo | "Si algo no se puede determinar, pregunta en vez de suponer" |
| D5 | Los requisitos del usuario no se revierten al volver a una versión | Son hechos del mundo ("mi espacio mide 90 cm"), no del diseño |
| D6 | La compactación del contexto es determinista (sin llamadas extra al LLM) | Costo y previsibilidad |
| D7 | Material base: **triplay de pino**, con la rigidez (E) por espesor y por dirección de la veta, en `src/domain/materials/grades.ts` | Es el que se consigue en Home Depot MX; valores conservadores, calibrables |
| D8 | Cajones fuera de la primera fase; entran después como grupo de piezas (cumplida: D23) | Validar primero lo esencial |
| D9 | BYOK tomado de [ai-town](https://github.com/rodacato/ai-town) (`src/providers/llm/`), corrigiendo lo pendiente de su `docs/REVIEW-1.0.md` §3 | Reusar lo que ya funciona |
| D10 | Solo piezas ortogonales (prismas alineados a los ejes) | Cubre el triplay DIY; las piezas inclinadas quedan fuera de alcance |
| D11 | Stack: Vite, React 19, TypeScript, Zod 4, Vitest; three.js + react-three-fiber + drei + postprocessing + @react-spring/three; Radix, Tailwind v4, Zustand, Phosphor, Fontsource. Sin Pixi.js | El centro es 3D; Pixi es 2D y sumaría un segundo motor gráfico |
| D12 | Fronteras de capas verificadas con un test de arquitectura (Vitest) en vez de ESLint | TypeScript 7 aún no tiene soporte estable en typescript-eslint; el test no agrega dependencias |
| D13 | Dirección de arte "maqueta sobre el banco de trabajo" (ver §1) | Sensación física y dinámica, no de visor técnico |
| D14 | En celular, 3D arriba y panel abajo con un botón para cambiar la proporción, en vez de una hoja arrastrable (se quitaron vaul y Motion) | El 3D nunca queda tapado y el diseño es más estable; las animaciones de interfaz se resuelven con CSS |
| D15 | Salida estructurada con `output_config.format` (Anthropic) y `response_format: json_schema` (OpenAI), no herramienta forzada | Algunos modelos nuevos de Anthropic rechazan `tool_choice` forzado |
| D16 | Ante un crítico sin opciones del experto, la app ofrece como botones las alternativas que calculó el motor | El usuario siempre tiene una salida concreta y el experto no tiene que inventarlas |
| D17 | Las cotas se dibujan como etiquetas dentro de la escena (sprites), no como HTML | El HTML de drei se perdía al remontar la escena |
| D18 | El repo y la app se llaman **Knotty** (*naughty knots*); la marca, en D24 | Nombre amplio y memorable para cuando crezca más allá del despiece |
| D19 | SheLLM como proveedor, compatible con OpenAI; si el host no acepta esquema estricto o imágenes, la app se degrada sola y lo recuerda | Funciona con el SheLLM de hoy y aprovecha lo nuevo sin cambios |
| D21 | Las decisiones de diseño se guardan con cada versión y se restauran al volver a ella; los requisitos no | Las decisiones describen el diseño; los requisitos, el mundo del usuario |
| D22 | Precios del catálogo estimados (no consultados en tienda) y editables en la app; los cambios de precio y de parámetros de corte viven en el dispositivo | Hay costo desde el día uno sin fingir precisión; el usuario los corrige con su tienda |
| D23 | Los cajones se piden con una operación compuesta (`addDrawer`): el LLM da el hueco y el dominio arma las seis piezas, las uniones y elige la corredera | Colocar seis piezas con holguras de corredera a mano es frágil para un LLM; así el cajón siempre sale correcto y paramétrico |
| D24 | Marca Knotty: un nudo de madera como símbolo (pino con veta) y como la «o» del logotipo en Fraunces. La funcionalidad sigue llamándose despiece | Un símbolo de madera se entiende al instante y funciona desde el favicon de 16 px hasta el ícono de la app |
| D25 | También se puede diseñar sin fotos, con una descripción; el experto pregunta lo que falte y los cajones los ofrece como pregunta para armarlos con `addDrawer` | Sirve para diseñar un mueble que todavía no existe o probar sin tener el mueble enfrente |
| D26 | Primer uso: las medidas son opcionales (el experto estima las típicas y lo dice), el pedido inicial queda en el chat, varias preguntas se contestan en un solo mensaje y el experto propone `sugerencias` de siguiente paso | Retroalimentación del primer uso: muchas preguntas una por una y medidas obligatorias frenaban el arranque |
| D27 | Para diseñar se pide conectar un experto real; el simulado queda como «ejemplos» y dice que no sabe cuando le piden otro mueble | El simulado siempre armaba un librero, lo que parecía un error del experto |
| D28 | Reintentar sin perder nada: la captura se conserva si falla y el chat ofrece reenviar el último pedido. Las peticiones compatibles tienen un tope de espera y SheLLM explica qué revisar si no conecta | Una espera larga que termina en «no se pudo conectar» obligaba a empezar de cero |
| D29 | La hoja es la real de la tienda (Home Depot MX) y se refila por orilla: la hoja útil es menor que la de fábrica; las medidas están en el catálogo de materiales | Las orillas de fábrica llegan golpeadas; los optimizadores usan 5–6 mm por orilla en tablero de taller, y el triplay de tienda pide más sin tirar el 8 % que costarían 5 cm |
| D30 | La lista de compra aparece después de una revisión: primero cuentas deterministas (medidas, hoja útil, estructura, tiras, boceto, margen) y luego el dictamen del carpintero (prompt `review`). El carpintero puede endurecer el veredicto, nunca suavizarlo; si no contesta, valen las cuentas. Si no es viable, la lista se ve solo a propósito | Que nadie compre material para algo que matemáticamente no se puede armar o que tiene un error de origen |
| D31 | Diseñar por pasos: lectura de cada foto (en paralelo y guardada), esqueleto de medidas y módulos, módulos convertidos en piezas por Knotty, reparación por reglas y, al final, detalles del experto. Cada paso guarda su resultado con la huella de lo que recibió y no se repite | La línea base con SheLLM mostró que casi todo el tiempo y el costo se iban en reescribir el diseño completo en cada reintento; en pasos chicos, cada uno se ve en cuanto llega |
| D32 | Nunca tirar un diseño pagado: si los intentos no pasan la validación, se muestra el último con los problemas marcados y se corrige desde el chat | Tres intentos fallidos costaban dinero sin mostrar nada |
| D33 | La interfaz y los textos para la persona quedan en español de México; el código (nombres, archivos, carpetas, lógica y comentarios), los datos guardados, los ids y los prompts van en inglés, y los prompts piden al experto que escriba en español lo que lee la persona. Lo guardado con el formato anterior se migra al leerlo | Pedido del autor el 2026-09-25; los datos, prompts y carpetas, pedido posterior del mismo día |
| D34 | Tres velocidades para cambiar el mueble: **instantáneo** (ficha, edición a mano y soluciones que Knotty construye), **agrupado** (lo que necesita criterio va a una bandeja y se manda al experto en un solo pedido) y **libre** (el chat, para lo creativo). El experto solo interviene donde aporta criterio | La revisión de uso mostró que cada decisión chica costaba un minuto de espera y que el experto se usaba para cosas que Knotty puede resolver |
| D35 | Todo cambio es un **cambio con origen y diferencias** (qué piezas se agregaron, quitaron o cambiaron) y se puede deshacer completo o por partes, sin experto | El experto quitó dos divisores sin que se lo pidieran y no había forma de regresarlos conservando lo demás |
| D36 | El experto no quita ni cambia estructura que no se pidió: si su respuesta lo hace, queda como propuesta que la persona confirma; si trae preguntas, sus operaciones esperan a las respuestas | Confianza: nada que sostenga el mueble desaparece sin permiso, con cualquier modelo |
| D37 | Las revisiones son **avisos con estado** (pendiente, viendo solución, resuelto, aceptado así) en un solo lugar, junto con las propuestas y preguntas del experto; cada aviso ofrece soluciones con vista previa en 3D, pedírselo al experto (a la bandeja) o aceptarlo así | El panel de Revisión informaba pero no dejaba decidir, y no había salida de «no hacer nada» |
| D38 | **El mueble es la interfaz**: lo principal es cambiarlo al instante (tocarlo, su ficha, pieza por pieza) y el experto entra donde aporta criterio. Celular y escritorio pesan igual. El destino del recorrido es cómo se arma y qué comprar. El rediseño se hace con Pencil en `design/`, empezando por el Estudio | La interfaz se acomodó fase por fase y quedó con cosas en lugares raros; la frase de arriba todavía decía «no hay edición manual», contra D34 |
| D39 | Fotos sin ranuras. Un solo «Agregar fotos», hasta 5, de cámara o galería, con repeticiones. Cada foto se lee al agregarla (la lectura de D31, guardada por huella) y el modelo la clasifica en la misma llamada (campo `view` en la lectura); la persona solo corrige la etiqueta si está mal. La nota por foto queda a la vista. Ya no hay fotos obligatorias. El experto no pide fotos después en el chat: si una vista faltó, pedirla cuando la persona ya va avanzada llega tarde | Menos decisiones al empezar: nadie tiene que saber qué es un «3/4» antes de subir una foto, y las fotos se suben como se tengan. Revisión de diseño del 2026-09-27 (UI-8, UI-19) |
| D40 | Empezar un diseño es **una sola pantalla**, en el orden en que se piensa: qué mueble es, las medidas si se saben (opcionales; «Agregar medidas» pone las típicas de ese tipo y las que la persona toque se quedan aunque cambie el tipo), las fotos (D39) y al final lo que quiera decir con sus palabras. Dibujada en `design/flows/capture.pen` | Dos pasos pedían medidas antes de saber qué mueble era, y el tipo quedaba después de las fotos de las que dependía (UI-7). Adrian, 2026-09-27: *«más natural, tengo todo en la misma pantalla»* |
| D20 | Llaves: no guardarlas, en la pestaña, o cifradas con frase (bóveda de ai-town). Al llegar, un aviso pide la frase o la llave que falte | Los pendientes de BYOK de ai-town `REVIEW-1.0.md` §3, adelantados de la fase 7 |
| D41 | Los términos del oficio se explican **al tocarlos**, en el lugar: un «?» abre la definición bajo el control, con área de toque de 44 px. Nunca un tooltip. El texto sale de `docs/carpinteria/glosario.md` | En el celular no hay cursor: la ayuda de «Ajustes de corte» era un `title` que nadie veía |
| D42 | Una pregunta del experto en Avisos se puede **descartar** sin contestarla: baja el contador, queda en «Ver lo que descartaste» y se reabre; el experto no se entera. Las recomendaciones y detalles van aparte, en «Para que dure más», con «Dejarlo así»; la campana cuenta solo lo que pide una decisión, y dejarlas así no aparece como riesgo en la revisión de compra | La persona quería decir «no, gracias» a lo que no le interesa o no entiende; lo opcional no debe competir con lo crítico |
| D43 | **Ahorrar material**: la persona fija con candado los campos de la ficha que no se mueven y Knotty busca, sin experto y con el mismo acomodo de Materiales, unos pocos cambios en lo libre que bajen el número de hojas. Reglas de `fabricacion-y-armado.md` §2.5; nada que agregue un crítico; la búsqueda tiene un tope de armados. Cada módulo declara sus candados por omisión | El costo real son las hojas, no los milímetros; la persona decide qué gana y qué pierde |
| D44 | **Nivel de herramienta** en Ajustes (nivel 1 por omisión, los niveles de `fabricacion-y-armado.md` §1): dice qué uniones y qué perfiles de canto puede hacer la persona. En la ficha se elige la unión por grupo (cuerpo, trasera, cajones) entre las que no cambian las medidas de las piezas; ranura, rebaje y confirmat se muestran pero no se eligen todavía | Elegir sin saber la herramienta lleva a planos que no se pueden armar; las uniones que cambian el despiece piden otra entrega |
| D45 | **Perfil de los cantos** por pieza: matar arista, redondeo 3 o 6 mm, chaflán; cualquier canto de la cara se puede elegir: uno que toca otra pieza, un tablero muy delgado para ese radio, un redondeo de router sin router o un canto con cubrecanto lo dice con un aviso que se abre al tocarlo, sin bloquear. Se guarda en el diseño como el acabado y sale en Materiales (un canto que no se ve no entra en la lista) y se dibuja en 3D a escala real, solo en los cantos que se ven | Es lo que haría un router de mesa; un perfil que no se ve no vale la pena (`acabados.md` §11) |
| D46 | **Empezar de una base**: en el inicio, 7 muebles armados por su módulo (con ficha), dibujados en SVG desde sus piezas. Cada uno pasa la revisión estructural sin hallazgos; los que se parecen a un producto del catálogo de referencia llevan su código KC solo en los datos, nunca la marca ni el nombre | Empezar de algo cercano y ajustarlo en la ficha es más rápido que describirlo desde cero |
| D47 | **La app funciona sola; el experto es opcional.** Las bases ya hechas se ajustan sin experto ni llave (catálogo → «Ajusta tu base» → Estudio). El experto entra en «Diseña el tuyo» (fotos o descripción) y en las consultas del Estudio. En Inicio, el botón de esa puerta es primario solo con un experto conectado; sin él queda secundario («Conectar experto») y las bases llevan el peso. No se le pone la etiqueta «avanzado». Decidido el 2026-09-30 (UI-29 y UI-31 en `design/DECISIONS.md`) | La parte calculada (fichas, revisiones, ajustes rápidos) ya da valor sin llave; poner primero el camino que pide una llave es lo que más estorba a quien llega. Vuelve a discutirse si la mayoría llega con una pieza que copiar o con un experto ya conectado |

---

## 1. Experiencia y diseño visual

Cómo es la app hoy, según `src/ui/`. El diseño que se busca vive en `design/flows/*.pen` (ver `design/README.md`); cuando no coinciden, la diferencia es trabajo pendiente, no esta sección.

### Flujo

```
Inicio (catálogo de bases) → Ajusta tu base → Estudio
Inicio → Captura («Diseña el tuyo») → El experto analiza → Estudio
```

`App.tsx` elige la pantalla por la fase del store: `Home` (y, con una base elegida, `AdjustBase`), `Capture`, `Analyzing` o `Studio` (este último se carga aparte, porque trae el 3D). Ajustes (`Settings`), el diálogo «Conecta tu experto» (`ConnectExpert`), el aviso de llaves (`KeysGate`) y la bitácora de depuración van encima de cualquiera.

- **Inicio** (`capture/Home.tsx`, D47): las bases primero, con filtro por categoría, y la puerta «Diseña el tuyo» (botón primario «Nuevo diseño» con experto conectado, secundario «Conectar experto» sin él); el último mosaico, «¿No está el tuyo?», lleva al mismo camino. Una base abre «Ajusta tu base» (`capture/AdjustBase.tsx`): lo que su ficha deja cambiar, el resumen de hojas y costo, y «Abrir en el Studio». El encabezado lleva el estado del experto y Ajustes.
- **Captura** (`capture/Capture.tsx`, D40): una sola pantalla con el tipo de mueble (opcional: «Que el experto lo decida»), el espacio disponible (opcional, en cm, por lado; llega al experto como un límite y no como las medidas del mueble, y si el diseño se pasa el experto lo dice), las fotos y lo que quiera decir con sus palabras. Fotos según D39: un solo «Agregar fotos», hasta 5, sin ranuras; cada una se lee al agregarla, el modelo propone su vista y la persona solo la corrige si está mal; cada foto admite una nota. Sin fotos, la descripción pide al menos 15 caracteres y el botón dice «Diseñar mi mueble» (o «Conectar experto» si no hay uno). En escritorio las fotos van en una columna a la derecha. Si el diseño falla, la captura se conserva y se ofrece «Reintentar» con «Ver qué pasó» (D28).
- **Análisis** (`capture/Analyzing.tsx`): las etapas reales del caso de uso («Mirando las fotos (n de m)», «Pensando el diseño» o «Diseñando pieza por pieza», «Midiendo que todo cierre», «Revisando la estructura»), un reloj, un trazo de lápiz dibujando un mueble, el historial de las últimas líneas de lo que el experto ha hecho y «Cancelar». Pasados 30 s explica por qué tarda.

### Estudio

`studio/Studio.tsx`. A partir de 768 px, el 3D a la izquierda y un panel de 360 a 420 px a la derecha; en celular, el 3D arriba (52 % del alto) y el panel abajo, con un botón que cambia la proporción a 30 % para el 3D. No hay hoja arrastrable (D14).

- **Encabezado**: nombre del mueble y su resumen de medidas; la versión («v3»), que abre el historial; la campana de avisos, en óxido con el número por decidir; el experto conectado, que abre ajustes; y «Nuevo diseño», que confirma antes de borrar.
- **Escena**: encima del 3D, una barra con Frente · Lado · 3/4 · Arriba · Armado (vista explosionada) · Cotas, y debajo una sola ficha de estado (`StatusChip`), la de mayor prioridad: versión vieja a la vista, el experto trabajando (si no se ve el chat), pieza enfocada («Ver todo el mueble»), piezas ocultas («Mostrar todo»), propuesta o solución en vista previa, problemas sin resolver, piezas por confirmar y lo último que se resolvió. Al elegir una pieza la cámara gira y se acerca alrededor de ella y no del mueble (el zoom va hacia donde apuntas), para llegar a una esquina; salir del foco deja la pieza elegida y regresa al mueble completo.
- **Panel**: tres pestañas, Conversación · Mueble · Materiales.
  - *Conversación* (`chat/Chat.tsx`): los mensajes del experto con lo que cambió cada versión (`ChangeList`), sus preguntas con respuestas en botón, las propuestas que esperan confirmación (D36: «Sí, aplícalo», «Ver propuesta», «No, déjalo como estaba») y chips de sugerencia. La bandeja (`chat/Tray.tsx`, D34) junta avisos, respuestas y pedidos para mandarlos al experto en un solo pedido.
  - *Mueble* (`studio/FurniturePanel.tsx`): el tipo de mueble y de dónde salió, la ficha (`PlanSheet`) para los módulos que la tienen, que se aplica con «Aplicar» o se deja con «Descartar», lo que el experto recuerda (requisitos y decisiones, que se pueden quitar), las fotos y, sin ficha, la lista de piezas.
  - *Materiales* (`studio/Materials.tsx`, D30): primero la revisión («Revisar y ver materiales») y su veredicto; si es viable o se puede arreglar, el costo aproximado, las hojas de triplay con su acomodo en SVG y el desperdicio, herrajes y consumibles, el acabado y la lista de corte. Los precios son de referencia y se tocan para poner el de la tienda. Si no es viable, la lista se ve solo con «Ver la lista de todos modos».
- **Avisos e historial** toman el lugar de las pestañas, no tapan el 3D. *Avisos* (`studio/NoticePanel.tsx`, D37): cada aviso con su sello de severidad y sus salidas, «Al instante» (con «Ver» para la vista previa en 3D), «A la bandeja, para el experto» o «Aceptar así, bajo mi riesgo»; abajo, «Resolver n» aplica lo elegido. *Historial* (`studio/HistoryPanel.tsx`): versiones de la más nueva a la más vieja, con lo que cambió; «Ver» la muestra en el 3D y «Volver a esta» crea una versión nueva igual.
- **Pieza**: tocarla en el 3D o en una lista la abre en el panel (`studio/PieceSheet.tsx`): material, veta, largo, ancho y espesor en mm y cm, uniones con enlace a la otra pieza y «Editar a mano» (`PieceEditor`: largo, ancho, espesor y mover por pasos, al instante y revisado como cualquier cambio). Las demás piezas quedan tenues. `Escape` o tocar fuera la cierra. Una pieza que el experto no pudo confirmar ofrece «Está bien así».

### Dirección visual: taller moderno

- **Paleta** (`src/ui/system/tokens.css`, con modo oscuro por `prefers-color-scheme`):

| Uso | Color |
|---|---|
| Fondo | Hueso `#F5F0E8`, con una textura de papel apenas perceptible |
| Superficies | Kraft `#EDE3D3` y `#E3D5BF` |
| Texto | Grafito `#2B2825`; secundario `#6A6158` |
| Maderas | Abedul `#E2C9A2`, pino `#D9B27C`, nogal `#6B4A2E` |
| Selección y foco | Ámbar de lápiz de carpintero `#D98A2B` (K6): pestaña activa, pieza o versión seleccionada, foco de los controles. También el lápiz que traza mientras el experto trabaja y, en el 3D, lo que un cambio toca |
| Crítico / Recomendación / Detalle | Óxido `#B4452F` / Grafito / Pizarra `#56697A` |

- **Tipografía**: Fraunces (títulos), Inter (interfaz), JetBrains Mono con cifras tabulares (cotas y medidas, clase `numerals`).
- **Componentes** (`src/ui/system/`): `Button` (primario grafito, secundario kraft, fantasma, peligro óxido), `Chip`, `Stamp` (severidad como sello de tinta ladeado), `Pencil` (el lápiz que traza mientras el experto piensa), `Title`, y `Field` con `Input`, `Select` y `TextArea`: etiqueta arriba, caja de 44 px, unidad dentro y 16 px de texto para que iOS no haga zoom. Los controles tocables miden al menos 44 px.

### Arte: "maqueta sobre el banco de trabajo"

- **Del boceto a la madera**: al cargar un diseño las aristas en grafito se ven de inmediato y las piezas se llenan de madera en cascada, de abajo hacia arriba. Una pieza de baja confianza se ve como papel con achurado de lápiz hasta confirmarse.
- **Madera sin descargas**: la veta de las caras y las capas del triplay en los cantos se dibujan en el navegador (`scene/textures.ts`).
- **Escena** (`scene/Scene.tsx`): luz de estudio con `Lightformer` (sin HDRI externo), sombra de contacto, cuadrícula tenue tipo tapete de corte y oclusión ambiental. Las cotas son líneas punteadas con etiquetas «900 mm · 90 cm»; con Cotas en la vista armada, cada pieza lleva las suyas.
- **Movimiento**: armado y cámara con resorte (`@react-spring/three`, `CameraControls`); la pieza nueva cae a su lugar con aserrín; la eliminada sube y se desvanece en óxido; la que cambió brilla en ámbar y se apaga; las piezas nuevas de una propuesta se ven en ámbar translúcido. Con `prefers-reduced-motion` no hay animaciones.
- **Rendimiento**: el lienzo solo dibuja cuando algo cambia; `PerformanceMonitor` quita la oclusión ambiental y baja la resolución cuando el equipo no alcanza; densidad de píxeles máxima 2 en escritorio y 1.5 en pantallas táctiles.

---

## 2. Arquitectura

Todo lo que decide vive en `domain/` y es determinista. El LLM propone; el dominio acepta o rechaza. El código, los datos guardados y los prompts están en inglés; lo que lee la persona, en español de México (D33).

```
knotty/
├─ .github/workflows/        ci.yml (typecheck, pruebas y build en cada PR) · deploy.yml (GitHub Pages)
├─ docs/                     PROPUESTA.md (este documento) · carpinteria/ (referencia del dominio)
├─ public/catalog/           catalog.json: triplay, herrajes y acomodo; se edita sin tocar código
├─ scripts/brand/            SVG de la marca y generate.sh (íconos, favicon, imagen para compartir)
├─ scripts/compare/          models.compare.ts: el banco contra expertos reales (npm run compare) · results/
└─ src/
   ├─ domain/                TypeScript puro: sin React, sin LLM, sin navegador; seis grupos por intención
   │  ├─ materials/          catalog · cutList · layout (acomodo en hoja) · purchase · finishes · grades
   │  ├─ design/             schema · resolve (cotas → geometría) · normalize · builders · drawers · doors · joints · hardware · boxes · diff
   │  │  └─ validation/      geometry · contact (grafo) · errors
   │  ├─ checks/             analysis.ts (análisis completo: geometría, contactos, avisos, reglas y requisitos)
   │  │  ├─ structure/       assumptions · review · finding · accepted · rules/ (deflection, jointThickness, racking, screws, drawers, usage)
   │  │  └─ typology/ · viability/ · requirements/   revisiones por tipo de mueble, revisión antes de comprar, requisitos
   │  ├─ furniture/          modules/ (fichas de gabinete, cama, mesa y zapatera; plan, rebuild) · fixtures/ (ejemplos y catálogo de prueba) · reading/ (lectura de fotos)
   │  ├─ editing/            operations/ (schema · apply · drawer) · repair/ · fixes/ · changes/ · intent/ (pedidos que Knotty entiende solo)
   │  ├─ session/            estado guardado (state) y migración (migrate) · history/ · trace/ · tray/
   │  └─ sources.ts          de dónde sale cada umbral (docs/carpinteria)
   ├─ application/           useCases (reconstruct, adjust, applyPlan, reviewPurchase…) · context · notices
   │  └─ bench/              casos fijos y banco de pruebas (también lo usa scripts/compare)
   ├─ ports/                 LLMProvider · DesignRepository · MaterialCatalog · ImageProcessor · Preferences · DebugLog
   ├─ adapters/
   │  ├─ llm/                anthropic · compatibleOpenAI (OpenAI y SheLLM) · simulated/
   │  │  ├─ common/          expert (arma los pedidos) · prompts · configuration · vault · jsonSchema · errors
   │  │  └─ prompts/         un archivo por prompt (`nombre.vN.md`), más `modules/` y `kinds/`
   │  ├─ persistence/        localStorage, con migración de formatos
   │  ├─ catalog/            catálogo JSON y ajustes de precio y corte de la persona
   │  ├─ image/              reducción de fotos y miniaturas
   │  ├─ debug/              bitácora de depuración (localDebugLog) y proveedor que la alimenta (loggedProvider)
   │  └─ storedKey.ts        claves de localStorage (y mueve las de Despiece)
   ├─ ui/                    system/ · capture/ · studio/ · scene/ · chat/ · settings/ · debug/ · store/ · services.ts
   ├─ composition.ts         raíz de composición: instancia adapters e inyecta casos de uso
   ├─ main.tsx               arranque de React y del service worker
   └─ architecture.test.ts   fronteras entre capas
```

- **Fronteras** comprobadas por `src/architecture.test.ts`: `domain/` solo importa zod y no toca el navegador; `application/` y `ports/`, dominio y puertos; `ui/`, todo menos `adapters/`. Dentro del dominio, cada grupo importa solo lo que hoy importa: nadie importa `session/`; `design/` y `materials/` no importan `furniture/`, `editing/` ni `session/`; `checks/` no importa `editing/` ni `session/`.
- **Zod en el dominio** es aceptable: es TypeScript puro.
- **`LLMProvider` expresa intenciones**: `reconstruct`, `planDesign` (esqueleto), `adjustPlan`, `proposeAdjustment`, `readPhoto` y `reviewPurchase`. `planDesign` y `adjustPlan` son `null` cuando el proveedor no los tiene (el simulado): sin esqueleto, el diseño va pieza por pieza. Anthropic, OpenAI y SheLLM comparten `common/` y `prompts/` y solo difieren en transporte; el simulado implementa la interfaz con reglas fijas. El ciclo de corrección vive en `application/` y se prueba sin red.
- **Salida estructurada**: los esquemas Zod son la única fuente; de ahí sale el JSON Schema. Por el modo estricto (sin `oneOf`, todos los campos requeridos) los esquemas usan uniones discriminadas por `op` y opcionales como `nullable`. Siempre se re-valida con Zod.
- **Prompts versionados**: cada archivo lleva frontmatter `id: nombre@versión` (por ejemplo `system@11`); cada versión del diseño guarda qué prompt y modelo la produjeron.

### BYOK (tomado de ai-town)

Se reutiliza el enfoque de `ai-town/src/providers/llm/`:

- `ports/Preferences.ts` y `common/configuration.ts`: presets por proveedor (`simulated`, `anthropic`, `openai` y `shellm`) con modelo sugerido y etiqueta; la configuración se guarda **sin llaves**.
- `vault.ts`: llaves recordadas **cifradas con frase de paso** (PBKDF2 + AES-GCM); si no, viven solo en memoria.
- `listModels` (en el puerto de preferencias) para elegir modelo de una lista; `common/errors.ts` con mensajes en español (key inválida, límite, CORS, timeout).

Cambios para Knotty (entonces Despiece):

- Simulado, Anthropic, OpenAI y SheLLM (una suscripción de Claude Code o Codex como API local), sin proveedor personalizado.
- Salida estructurada en vez de extraer JSON del texto: tool use forzado en Anthropic, `response_format: json_schema` en OpenAI. El campo `explanation` se puede ir mostrando mientras llega, con la técnica de `partialStringField`.
- Imágenes en la reconstrucción (content blocks de imagen en ambos proveedores).
- Al recargar se ve qué llave falta y se pide; desbloqueo claro con frase de paso; elección explícita entre "solo esta pestaña", "este navegador (cifrada)" o "no guardar"; si una consulta falla por llave, se ofrece arreglarla ahí mismo; tests del ciclo guardar → recargar → desbloquear → olvidar.
- CSP estricta sin scripts de terceros.

---

## 3. Modelo del mueble y operaciones

La fuente de verdad es `src/domain/design/schema.ts` (y `operations/schema.ts`); aquí va el resumen.

### Convenciones

- Todo en **mm**.
- Ejes: **X = ancho** (izq → der), **Y = alto** (piso → arriba), **Z = fondo** (trasera → frente). Origen en la esquina inferior-izquierda-trasera.

### Cotas con referencias

Cada extremo de una pieza es una **cota** que puede ser absoluta o apuntar a una cara de otra pieza o del mueble. Un resolvedor calcula las coordenadas en orden topológico. Así, "hazlo de 90 cm" o "sube a 18 mm" se propagan solos.

```ts
Design {
  schema: 1
  name: string                  // para la persona, en español: "Librero"
  dimensions: { width, height, depth }   // mm
  wallAnchored: boolean
  pieces: Piece[]
  joints: Joint[]
  notes: string                 // lo que el experto vio y no cabe en el modelo (≤ 1200 car.)
}

Piece {
  id: string                    // estable y legible: "side-left", "shelf-2"
  name: string                  // para la persona: "Lateral izquierdo"
  role: 'side' | 'bottom' | 'top' | 'shelf' | 'divider' | 'back' | 'kick' | 'apron'
      | 'door' | 'drawer-front' | 'drawer-side' | 'drawer-bottom' | 'brace' | 'other'
  material: string              // "T12" | "T15" | "T18" | "TR3" | "TR6" (del catálogo)
  normal: 'x' | 'y' | 'z'       // eje del espesor
  x: Extent; y: Extent; z: Extent
  grain: 'length' | 'width' | 'any'
  load: 'none' | 'light' | 'medium' | 'heavy'
  support: 'fixed' | 'movable'
  edges: ('front' | 'back' | 'left' | 'right' | 'top' | 'bottom')[]   // con cubrecanto
  group: string | null          // "drawer-2", "headboard"
  confidence: 'high' | 'medium' | 'low'   // "low" se dibuja en boceto
}

Extent   = { from: Position | null, to: Position | null, length: mm | null }
           // en los ejes de la cara van dos de tres; en el eje normal, solo from o solo to
Position = { type: 'mm', mm }                                     // absoluta desde el origen
         | { type: 'ref', ref: FaceRef, offset }                  // "side-left.x1" + 0
         | { type: 'between', a: FaceRef, b: FaceRef, t, offset } // proporcional (divisor al centro: t = 0.5)
FaceRef  = "furniture.x0" | "furniture.x1" | … | "<pieceId>.x0" | "<pieceId>.y1" | …

Joint {
  id: string
  a: PieceId; b: PieceId        // a se fija a b
  type: 'butt-screw' | 'pocket-screw' | 'dowel' | 'cam-lock' | 'dado' | 'rabbet' | 'bracket'
      | 'glue-nail' | 'shelf-pin' | 'cup-hinge' | 'drawer-slide'
  glue: boolean
  depth: mm | null              // canal / rebaje: cuánto entra a en b
  hardware: { hardwareId: string, count: number | null }[]   // null → lo calcula Knotty
}
```

- **Fichas** (`domain/furniture/modules/`): gabinete, cama y mesa se describen con una ficha (`CabinetPlan`, `BedPlan`, `TablePlan`) y Knotty arma todas las piezas, uniones y holguras. Lo que la ficha no expresa se agrega encima como operaciones libres (`extras`).
- **Normalizador**: al LLM le cuesta generar grafos de referencias, así que puede mandar cotas absolutas; toda cota a ±3 mm de una cara existente se "imanta" y se convierte en `ref`.
- **Uniones comunes**: las pone Knotty (`design/joints.ts`) donde dos piezas se tocan; el experto solo declara las especiales.
- **Derivados**: la geometría resuelta, el grafo de contacto, la lista de corte y el acomodo nunca se guardan. Al LLM sí se le manda la caja resuelta de cada pieza como dato de solo lectura.

### Operaciones (unión discriminada por `op`)

| `op` | Parámetros | Notas |
|---|---|---|
| `addPiece` | `piece` | id nuevo |
| `removePiece` | `id` | elimina sus uniones; las cotas que la referían se congelan a mm y se reporta |
| `removeGroup` | `group` | |
| `duplicatePiece` | `id, newId, name, axis, at` | "agrega otra repisa igual" |
| `resize` | `id, axis, end: 'from' \| 'to', at` | |
| `move` | `id, axis, at` | conserva el largo |
| `distribute` | `ids[], axis, a, b` | reparte con huecos iguales entre dos caras |
| `changeMaterial` | `ids[], material` | lo referido se recorre solo |
| `changeProperties` | `id, name, role, grain, load, support, edges, confidence` | null en lo que no cambia |
| `addJoint` / `changeJoint` / `removeJoint` | `joint` / `joint` / `id` | |
| `resizeFurniture` | `axis, value, rule: 'stretch' \| 'proportional'` | ver abajo |
| `setWallAnchored` | `value` | |
| `addDrawer` | `group, name, left, right, bottom, top, front, back, material, bottomMaterial` | Knotty arma el cajón completo con correderas |

`resizeFurniture`:

- **stretch**: mueve la cara del mueble; lo referido se estira o se recorre; lo proporcional conserva su proporción.
- **proportional**: además escala las cotas absolutas del eje.

### Respuesta del LLM en un ajuste

```ts
{
  explanation: string            // qué cambia y por qué, en español
  summary: string                // ≤ 90 car., para la línea de tiempo
  operations: Operation[]        // vacía si solo pregunta
  questions: { text, options: string[] | null }[]
  suggestions: string[]
  requirements: { add: Requirement[], remove: string[] }
  decisions: { topic, text }[]
  acceptedRisks: { code, justification }[]   // si la persona eligió "bajo mi riesgo"
}
```

Con ficha, el ajuste usa `PlanAdjustment` (`action: 'plan' | 'freeform' | 'answer'` y la ficha completa en `cabinet`, `bed` o `table`).

### Ciclo de validación

1. Zod valida la respuesta.
2. Se aplican las operaciones sobre una copia y se resuelven las cotas.
3. Se repara por reglas lo que tiene arreglo obvio (piezas encimadas, uniones sin contacto) y queda anotado.
4. Se valida: geometría → catálogo → requisitos → estructura.
5. **Errores bloqueantes**: se reenvían al LLM con código y datos (`E_OVERLAP {a, b, …}`), hasta 3 intentos en total; si no pasa, se muestra el último diseño con sus problemas marcados (D32).
6. **Críticos estructurales nuevos**: se devuelven al LLM con las alternativas que calculó el motor. El LLM incluye la mitigación si no es ambigua, o propone opciones y el cambio queda como propuesta.
7. Si todo pasa: versión nueva, diferencias y animación.

Códigos bloqueantes (`validation/errors.ts`): `E_SCHEMA`, `E_DUPLICATE_ID`, `E_UNKNOWN_PIECE`, `E_UNKNOWN_JOINT`, `E_UNKNOWN_REF`, `E_REF_AXIS`, `E_CYCLE`, `E_INVALID_EXTENT`, `E_OVERLAP`, `E_FLOATING`, `E_OVERALL_SIZE`, `E_UNKNOWN_MATERIAL`, `E_TOO_BIG_FOR_SHEET`, `E_JOINT_WITHOUT_CONTACT`, `E_REQUIREMENT`, `E_INVALID_OPERATION`. Avisos: `W_CONTACT_WITHOUT_JOINT`, `W_FROZEN_REFERENCE`.

Flotantes: grafo de contacto (caras coincidentes a ±0.5 mm más uniones declaradas); toda pieza debe conectarse con alguna que toque `y = 0`.

---

## 4. Contexto e historial para el LLM

### Tres memorias

| Memoria | Qué guarda | Quién la escribe | Límite |
|---|---|---|---|
| **Requisitos** | Hechos del usuario: espacio, carga, herramientas disponibles | El LLM los propone; el usuario los ve y puede borrarlos | ~15, sin duplicados por tipo |
| **Decisiones** | Razonamiento de diseño: "trasera de 6 mm para escuadrar" | El LLM, con clave `topic` | 15; la nueva del mismo tema reemplaza |
| **Bitácora** | Por versión: número, resumen, motivo, operaciones abreviadas | Determinista | ver compactación |

Los requisitos tienen forma estructurada cuando se puede (`{type:'space', axis:'x', max:900}`), así el dominio los verifica (`E_REQUIREMENT`) sin depender de que el LLM los recuerde. Un requisito de espacio es la medida del mueble completo, nunca de una parte.

### Qué se envía en cada ajuste

Del más estable al más volátil, para aprovechar el caché de prompts:

1. **Sistema** (fijo, cacheable, ~4–5k tokens): rol, convenciones, esquema, operaciones con ejemplos, catálogos con ids, cómo leer los resultados estructurales.
2. **Diseño actual** (~2–4k tokens para ~30 piezas): modelo, caja resuelta por pieza y `notes`.
3. **Reporte estructural vigente**: solo hallazgos que no están OK, con sus datos.
4. **Requisitos y decisiones.**
5. **Bitácora compactada**: últimas 8 versiones completas; de la 9 a la 30 solo `vN: resumen`; más allá, una línea "N cambios anteriores".
6. **Chat**: últimos 6 mensajes (respuestas de botón como texto).
7. **Petición actual**, y en reintentos los errores del intento anterior.

`buildContext` (`application/context.ts`) estima tokens; si pasa de ~12k recorta en orden: chat antiguo → bitácora media → decisiones más viejas. Nunca recorta el modelo ni los requisitos.

### Fotos

Solo se mandan en la reconstrucción. En los ajustes, lo visual vive en `notes`. Durante la sesión las fotos reducidas quedan en memoria por si el experto pide re-mirarlas; en localStorage solo miniaturas (≤ 6 de 160 px, JPEG 0.6, ~8 KB cada una).

### Persistencia

- Clave `knotty:design` → `DesignState` (`domain/session/state.ts`): `{ format, measures, versions[{ n, design, summary, reason, operations, date, origin, decisions, plan, extras }], current, requirements, decisions, chat, thumbnails, proposal, review, trace, accepted, tray }`.
- Snapshots completos (~10 KB). Tope de 40 versiones: se conserva la v1 y se podan las intermedias más viejas. Si no cabe, primero se sueltan las miniaturas.
- **Formatos**: el vigente es el `format` de `domain/session/state.ts`. `domain/session/migrate.ts` lee cualquier formato anterior, uno a la vez. Cambiar un campo guardado pide subir el formato y agregar su migración con prueba.
- Otras claves: `knotty:expert` (configuración sin llaves), `knotty:vault` (llaves cifradas), `knotty:tab-keys` (sessionStorage), `knotty:catalog-settings` (precios y corte). Lo guardado con las claves `despiece:v1:*` se mueve al leerlo (`adapters/storedKey.ts`).

---

## 5. Reglas estructurales

Los supuestos viven en `domain/checks/structure/assumptions.ts` como datos y cada regla en `domain/checks/structure/rules/`. Cada hallazgo devuelve `{ code, severity, pieces, message, data, alternatives }` (severidad `critical`, `recommendation` o `detail`): el LLM narra, no calcula. Las alternativas las simula el motor (siguiente espesor, divisor al centro, claro máximo con el espesor actual).

### R1 — Flecha de entrepaños

- Viga simplemente apoyada con carga uniforme: `δ = 5·q·b·L⁴ / (384·E·I) × k_fluencia`, con `I = b·t³/12`.
- L = claro libre entre apoyos (del grafo de uniones); b = fondo; t = espesor.
- Supuestos (los de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §1 y §4):
  - Apoyo simple siempre (conservador).
  - Triplay de pino radiata, conservador y por espesor (`materials/grades.ts`): E∥ 4 500 MPa en 18 mm, 5 000 en 15, 5 500 en 12 y 9; E⊥ 2 000 / 1 500 / 1 000 / 800 / 700 en 18 / 15 / 12 / 9 / 6 mm.
  - k_fluencia = 2.0 con la carga que se queda (libros, trastes, ropa); 1.0 con la que pasa: la plataforma de una cama y el asiento de una banca cargan a una persona.
  - q: ligera 50, media 100, pesada (libros) 150 kg/m².
- Umbrales sobre la flecha final: ≤ L/360 OK; L/360 – L/100 recomendación; > L/100 crítico.

| 18 mm, fondo 300, libros | Flecha | Resultado |
|---|---|---|
| Claro 540 mm | 1.5 mm | OK (el claro más largo sin pandeo visible) |
| Claro 600 mm | 2.3 mm | Recomendación |
| Claro 864 mm (librero de 90 cm) | 9.8 mm | Crítico (el límite es ≈ 830 mm) |
| 864 mm con divisor al centro (2 × 423) | 0.6 mm | OK |
| 15 mm, claro 600 mm | 3.5 mm | Recomendación |


### R2 — Espesor mínimo por unión

| Unión | Mínimo | Si no cumple |
|---|---|---|
| Tornillo al canto | receptor ≥ 15 mm | 12 → recomendación; < 12 → crítico |
| Tornillo de bolsillo | ambas ≥ 12 mm | crítico |
| Tarugo 8 mm | ambas ≥ 15 mm | crítico |
| Minifix | ambas ≥ 15 mm | crítico |
| Canal / rebaje | receptor ≥ 15; profundidad ≤ t/3 (recomendado), > t/2 crítico | |
| Bisagra de cazoleta 35 mm | puerta ≥ 15 mm | crítico |
| Soporte de repisa 5 mm | lateral ≥ 15 mm | crítico |
| Trasera 3 mm | solo clavo o grapa + pegamento, o en rebaje; nunca tornillo | recomendación |

### R3 — Tornillos y cantos

- Distancia al extremo ≥ 25 mm (≈ 6 d con #8).
- Separación entre tornillos 150–250 mm; cantidad = `max(2, ceil((largo − 100) / 200) + 1)`.
- Penetración en la pieza receptora ≥ 25 mm; sugiere el largo comercial en pulgadas.

### R4 — Vuelco

- Mueble de guardado con cajones o puertas desde 686 mm de alto (ASTM F2057-23, [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §12): crítico si `wallAnchored = false`, sin importar el fondo ni el nombre (`check: 'tipping.storage'`). En el margen de 10 % justo debajo (617–685 mm) es solo recomendación (`check: 'tipping.storage-near'`), para que unos milímetros de medida no cambien el veredicto de crítico a nada; el margen es de Knotty (`ASSUMPTIONS.tipping.storageMargin`), la referencia no da banda. Se detecta por lo que tiene (frentes de cajón, puertas) y su alto; no aplica a camas, bancas, escritorios y mesas (sus cajones van bajos en un mueble largo o ancho) ni a la alacena, que tiene su propia revisión de colgado.
- Sin cajones ni puertas: alto / fondo ≥ 3 → recomendación de kit antivuelco; crítico si alto > 1 200 mm, alto / fondo ≥ 4 y `wallAnchored = false`.

### R5 — Escuadrado

El casco necesita al menos uno de: trasera ≥ 6 mm fijada en todo el perímetro; trasera de 3 mm pegada en rebaje; o marco rígido (zoclo + faja superior + entrepaño fijo con bolsillo o tarugo). La regla y sus soluciones suponen una caja: un mueble abierto de varios marcos (un exhibidor escalonado) sale siempre crítico y sin solución que Knotty pueda construir; está en Preguntas abiertas. Si no: crítico con alto > 600 mm, recomendación si es menor.

### R6 — Puertas

Bisagras por alto, como la tabla de Blum de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §8: ≤ 900 mm → 2; ≤ 1 600 → 3; ≤ 2 000 → 4; ≤ 2 400 → 5. La bisagra es la del montaje de la puerta (`door.hinge-mount`): recta si tapa todo el canto, codo si lo comparte con otra puerta, súper codo si va embutida; embutida contra sobrepuesta es crítico y recta contra codo, recomendación. Ancho > 600 mm → recomendación de dividir en dos hojas.

### R7 — Base

Piso con claro > 800 mm sin apoyo intermedio → recomendación.

### R8 — Veta

Entrepaño o lateral con veta perpendicular a su largo → detalle (R1 ya usa el E menor).

### R9 — Cajones

Holgura de la corredera a cada lado (12.7 mm, hasta 0.8 de más y nada de menos), fondo del cajón suficiente para su ancho (6 mm desde 300 de ancho), una pieza a la que atornillar cada corredera, la corredera del largo de la caja (`drawer.slide-too-long`, crítico; `drawer.slide-too-short`, recomendación cuando le queda una más larga) y holgura del frente con lo que lo rodea. Aplica a los cajones del módulo y a los que arma el experto.

### R10 — Uso

Revisiones por tipo de mueble (`domain/checks/typology`): alto de una mesa o un escritorio, espacio para las piernas, medidas de la cama contra el colchón, fondo de un librero, anclaje de lo que cuelga. Cada revisión es una entrada de `domain/checks/typology/constraints.ts` con sus límites y su fuente en `docs/carpinteria`.

Las fallas geométricas (traslape, flotante, medida total, pieza mayor que la hoja útil) son errores bloqueantes, no severidades.

---

## 6. Materiales

- **Catálogo** en `public/catalog/catalog.json`, cargado en tiempo de ejecución; en Materiales se pueden sobreescribir precios y ajustes de corte (localStorage). SKU y precios de Home Depot MX: placeholders marcados hasta llenarlos.
- **Acomodo guillotina** por espesor:
  - Área útil = hoja − 2 × refilado (15 mm, D29). Corte de sierra 4 mm, holgura 2 mm por pieza. Todo configurable.
  - Piezas con veta fija no rotan; la veta va sobre el lado de 2 440.
  - Varias heurísticas (mejor área, lado más corto, con y sin rotación); gana la de menos hojas y luego menos desperdicio. Determinista.
- **Herrajes comunes en México**: tornillo para madera #8 × 1¼", 1½" y 2"; tornillo de bolsillo 1¼" rosca gruesa; tarugo 8 × 40; soporte de repisa 5 mm; bisagra de cazoleta 35 mm (recta, codo, súper codo); corredera telescópica 30–50 cm; escuadra; clavo sin cabeza; pegamento blanco; cubrecanto por metro; pata niveladora; kit antivuelco.

---

## 7. Invariantes y trampas

Lo que sigue es lo que el código no dice solo: el porqué, las reglas que no se deben romper y las trampas. Los valores (umbrales, versiones de prompts, conteos, rutas) están en el código; el diario de cada entrega está en su PR.

### Migración del código a inglés (D33)

El código, los datos guardados y los prompts están en inglés; la interfaz y todo lo que lee la persona, en español de México, y los prompts le piden al experto que escriba así, con palabras de taller («triplay», nunca «plywood»). Lo que una versión vieja guardó se lee con migración en `domain/session/migrate.ts`, que encadena un formato tras otro hasta el actual (`format` en `domain/session/state.ts`), y las claves viejas de `localStorage` (`despiece:v1:*`) se mueven al leerlas (`adapters/storedKey.ts`): la vieja solo se borra si la nueva se escribió. **Cambiar un campo guardado pide subir `format`, escribir el paso de migración y probarlo con una sesión real guardada por la versión anterior** (`state-v1.fixture.json` es el modelo). Los ids de piezas en español de sesiones viejas siguen valiendo: son datos del diseño.

### Avisos y reglas

- **La clave de un aviso incluye su `check`** (`findingKey`). Sin él, aceptar el anclaje de una alacena aceptaba en silencio otro aviso de la misma regla sobre las mismas piezas. Una regla que puede encontrar dos cosas en las mismas piezas necesita `check`.
- **Lo aceptado se reabre si empeora o si la regla cambió** (`isAccepted`). Cada aceptación guarda la severidad y la `version` de su regla. Sube `version` cuando la regla juzga distinto (un umbral, el modelo), no por cambiar el texto. Una aceptación sin severidad guardada vale salvo que el hallazgo sea crítico hoy: lo que no puede pasar es esconder un crítico.
- **R5 juzga cada caja** (`baysOf`). Si una pieza une todos los costados, el mueble es una caja; si ninguna, cada par de costados unido por una misma pieza es una caja, con su alto, sus travesaños y su trasera. Exigir un solo travesaño para un escalonado era imposible.
- **El anclaje se decide por lo que el mueble tiene (puertas, cajones) y su alto, no por su nombre** (`storageTipping`).
- **Todo umbral con nombre tiene fuente.** `sources.test.ts` falla si un número del oficio no está en `ASSUMPTIONS` o en un registro de fuentes (`archivo#ancla` o `no reference:` con el porqué), o si una regla trae un número propio. Si la referencia y el código difieren, manda `valores-de-referencia.md`.
- **El montaje de una puerta no se guarda: sale de dónde están las piezas** (`doorMount`). Por eso el herraje se escoge por geometría (`hingeFor`, `slideFor`) y R6/R9 lo revisan con la misma función que lo eligió.

### Fichas, módulos y tipo de mueble

- **Cada tipo de mueble es un módulo registrado** (`MODULES`, `MODULE_OF_KIND`) y no compila si a un tipo le falta el suyo. Agregar uno no debe tocar la ficha, el banco ni el esquema del experto: se generan desde el registro. Si agregar un módulo obliga a editar otro lado, ese lado hay que generalizarlo.
- **`legHeight` (gabinete con patas):** milímetros, de 100 a 300, 150 por omisión (una ficha sin el campo sigue valiendo). La altura total incluye las patas: cambiarlas mueve el piso, no el techo, y la caja que queda (alto − patas) no baja de 200 mm (si no, «No cupo»). Los tres números son sin referencia (`MODULE_SOURCES`). No medido con `npm run compare` (diferido hasta 1.0).
- **Los cortes (`Piece.cuts`) solo se dibujan.** No cambian la lista de corte, la compra ni las reglas: la pieza sigue siendo el tablero entero. El experto no los ve.
- **Quién decide el tipo** (`settleKind`): la persona siempre, y nada la pisa salvo ella; después ejemplo o ficha, foto y palabras, y a igual confianza el más nuevo. Un uso afina la palabra de su módulo. El tipo pasa de versión en versión (`addVersion`), igual que el acabado y los cantos: un gabinete rearmado desde su ficha sigue siendo librero.
- **Cambiar de módulo no convierte la ficha:** se ofrece «Rehacer como…», que diseña de nuevo con las medidas de antes solo como referencia.
- **Las referencias (`adapters/references/`) llevan su `expect` y `npm test` lo recalcula.** Un cambio del motor que mueva una compra o agregue un aviso falla con la línea exacta, y el diff que lo acepta enseña qué cifras cambiaron. Una referencia cambia de versión cuando cambian sus datos.

### Prompts y el experto

- **Ningún número del oficio va escrito en un prompt**: dice `{{nombre}}` y el valor sale del código que lo hace cumplir (`promptValues.ts`); una prueba falla si uno vuelve a aparecer. Así el experto oye lo que Knotty de verdad revisa.
- **El experto ve un plan; Knotty ve las piezas.** Al ajustar una ficha viva el experto recibe la ficha, la revisión con códigos y la conversación, no el diseño en JSON ni la geometría (`buildPlanContext`). Mandarle las piezas cuesta miles de tokens que solo sirven para escribir operaciones.
- **El enrutado por tipo ahorra tokens, y una guía por tipo no le cuesta a los demás.** Si se sabe el mueble, el esqueleto y el ajuste llevan solo su módulo, su campo del esquema y, si existe, la guía de su uso (`kinds/`); sin tipo va el genérico con todos. El id de la combinación (`skeleton@N+módulo@N+uso@N`) queda en la versión y en la bitácora para saber qué leyó el experto. Un tipo sin módulo va directo a pieza por pieza.
- **Hay campos que el experto nunca escribe:** `kind`, `kindSource`, `mattress`, `pulls`, `finish`, `edgeProfiles` y `cuts` son de Knotty o de la persona, y sus esquemas los dejan fuera. El acabado, los cantos y el tipo sí pasan de versión en versión aunque el diseño nuevo no los traiga.
- **`planDesign` / `adjustPlan` nulos en un proveedor significan pieza por pieza.** Es el respaldo caro (minutos): por eso el esqueleto se reintenta una vez antes de rendirse (con lo ilegible como corrección), y la ficha inválida vuelve una vez con sus errores.
- **Una cancelación no se reintenta** (`expertCall` relanza el error original); ni en el esqueleto, ni en la corrección, ni en la revisión de compra.
- **Una ficha pasa por el mismo juez que pieza por pieza** (`judge()`, pura y con pruebas por tabla): preguntas pendientes o quitar estructura que no se pidió esperan a la persona; los críticos nuevos de una ficha van a pendiente sin vuelta extra, porque Knotty ya construye esas opciones.
- **Knotty entiende solo lo que se lee de una sola manera** (`parseIntent`): una negación, una duda, dos cosas, una pregunta, una foto o una palabra desconocida van al experto. Ante la duda, al experto: una lectura equivocada cuesta más que una llamada. Todo se lee de los campos y etiquetas de la ficha, así que un módulo nuevo lo entiende sin tocar nada.
- **El conteo de puertas y cajones pedidos solo corrige al gabinete** y solo si cada mención trae una cuenta clara (`askedParts`). Una parte con lectura dudosa no se revisa: una corrección falsa es peor que dejar pasar.
- **El espacio de la persona es un límite, no las medidas del mueble.** `measures` es solo para medidas exactas y mandan sobre el espacio; si el mueble se pasa del espacio, el experto lo dice en el chat.

### Acabado, compra y cantos

- **El acabado es del diseño entero**, no de una pieza, y es una versión propia (`chooseFinish`), no un campo del plan. Un diseño que reconstruye la ficha o escribe el experto conserva el actual.
- **Elegir acabado o cantos no pide otra revisión de compra** (`reviewed()` los quita de la firma). La revisión sigue al contenido estructural del diseño, no al número de versión.
- **La compra es determinista y el experto solo puede endurecer un veredicto** (`worst`). La revisión lee el `Analysis`, no vuelve a calcular lo que `analyze()` ya sabe; si el carpintero no contesta, la revisión se sostiene con las cuentas.
- **Lo que la referencia no da se queda vacío y dicho** (rendimiento de una laca, secado, precios): la lista de compra le dice a la persona que lo pregunte en la tienda, no inventa un número. El sellador que es el mismo barniz diluido cuenta como mano entera: se compra de más, no de menos.

### Banco y comparativo

- **Una variante del banco con avisos es un error de Knotty**, no del experto: el banco sin experto revisa todas las variantes de cada módulo.
- **Un resultado de `npm run compare` solo vale si mide `origin/main`**; el script avisa cuando no es así. Solo `scripts/compare/baseline.json` vive en git; los reportes se ignoran.
- **Con SheLLM, los tokens de entrada se comparan con la llamada más baja de cada prompt**: envuelve al CLI de Claude, que suma un prompt de sistema cacheado propio. Los presupuestos de tokens de `prompts.test.ts` frenan el crecimiento y están en caracteres ÷ 3.5: no cuentan tokens reales (el JSON gasta más).
- **Un requisito de espacio es la medida del mueble completo**, nunca de una parte: el experto anotaba «cada escalón mide 25 cm de fondo» y la app rechazaba su propio diseño. Un caso del banco puede nombrar su camino (`path`, ficha o pieza por pieza) y, si el diseño llega por el otro, cuenta como no razonable.
- **Un caso del banco ambiguo a propósito se queda ambiguo.** `sideboard` no dice «contra el muro»: un R4 crítico ahí significa que el experto no aplicó la regla, no que la persona pidió algo inseguro. Sin la variante explícita no se sabría si falló leer el acomodo o las cuentas.

### Historial y sesión

- **La bitácora cuenta solo las llamadas al experto**; lo que Knotty resuelve solo deja un renglón «Knotty, sin experto», sin prompt ni tokens.


## Preguntas abiertas

- El banco sin experto revisa hallazgos estructurales pero no las advertencias de geometría: `W_CONTACT_WITHOUT_JOINT` («se tocan pero no tienen unión») sale en la cama base y en unas 140 variantes de los módulos sin que nada lo marque.
- R5 en un mueble abierto que no es caja: se juzga por caja (ver «Invariantes») y tiene solución construible (fajas). Queda: ¿aplicarla sola en el primer diseño, como una reparación por reglas? Y la regla todavía ignora los `brace` diagonales que ponga el experto.

- Precios y SKU reales de triplay de pino 12/15/18 mm y trasera 3/6 mm en Home Depot MX.
- Calibrar E del triplay de pino con una prueba casera (entrepaño cargado, medir flecha) cuando haya app.
