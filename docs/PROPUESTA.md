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
| D10 | Solo piezas ortogonales (prismas alineados a los ejes). Una pieza puede llevar esquinas cortadas en diagonal (D60) o redondeadas (D65): sigue parada derecha y sigue siendo su tablero completo | Cubre el triplay DIY; las piezas inclinadas o giradas quedan fuera de alcance |
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
| D46 | **Empezar de una base**: en el inicio, muebles armados por su módulo (con ficha), dibujados en SVG desde sus piezas. Cada uno pasa la revisión estructural sin hallazgos; los que se parecen a un producto del catálogo de referencia llevan su código KC solo en los datos, nunca la marca ni el nombre | Empezar de algo cercano y ajustarlo en la ficha es más rápido que describirlo desde cero |
| D47 | **La app funciona sola; el experto es opcional.** Las bases ya hechas se ajustan sin experto ni llave (catálogo → «Ajusta tu base» → Estudio). El experto entra en «Diseña el tuyo» (fotos o descripción) y en las consultas del Estudio. En Inicio, el botón de esa puerta es primario solo con un experto conectado; sin él queda secundario («Conectar experto») y las bases llevan el peso. No se le pone la etiqueta «avanzado». Decidido el 2026-09-30 (UI-29 y UI-31 en `design/DECISIONS.md`) | La parte calculada (fichas, revisiones, ajustes rápidos) ya da valor sin llave; poner primero el camino que pide una llave es lo que más estorba a quien llega. Vuelve a discutirse si la mayoría llega con una pieza que copiar o con un experto ya conectado |
| D48 | **Tres estados del mueble en la escena**: Cerrado, Abierto (cajones fuera a 60 % de su fondo y puertas a 100° sobre su bisagra, hacia afuera) y Armado (el despiece); un solo selector, uno a la vez, y Cotas aparte. Es solo vista: no toca el diseño ni el dominio. Decidido el 2026-10-04 (UI-67 en `design/DECISIONS.md`) | Ver cómo se usa el mueble (si la puerta choca, si el cajón sale) sin tener que imaginarlo; un selector impide el estado «armado y abierto» y dice cuál está activo |
| D49 | **R4 (vuelco) se juzga por un balance de momentos**, no por la altura sola: lo que sostiene el casco contra lo que jalan los cajones llenos y fuera, las puertas abiertas y un niño colgado del cajón más alto al alcance. La altura de 686 mm queda como el alcance de la norma. Crítico desde 1, recomendación desde 0.8 (tolerancia de Knotty). Decidido el 2026-10-04 (#218) | La referencia dice que el fondo no salva una cajonera y que un mueble de solo puertas puede sostenerse solo; un umbral de altura marcaba crítico a ambos por igual. Es una simplificación (cajones con salida completa, sin el calce de la norma) y no está ensayada |
| D50 | **R5 (escuadrado): un anclaje por arriba cuenta, con condiciones.** Con `wallAnchored` y una cubierta o faja fija unida a los dos costados, un casco sin trasera ni marco rígido es solo recomendación (`racking.anchored`) y dice por dónde va el anclaje; sin anclar, o sin pieza donde anclar, sigue crítico. Una repisa fija pegada en ranura cuenta como marco. El umbral de 600 mm no cambia. Decidido el 2026-10-04 (#219); reabre en parte la decisión del 2026-10-03 de no relajar R5 por el anclaje | Con la parte de arriba fija a un muro rígido el casco no se desplaza de lado respecto al piso. Es un razonamiento de estática, sin ensayo ni fuente, y `wallAnchored` sigue siendo un booleano que una correa sola puede marcar: se reabre si un diseño anclado sin trasera se descuadra |
| D51 | **Esquinas de dedos en los cajones del gabinete**: `construction.drawerCorners: "fingers"` y `drawerFingers` (5 por omisión, de 3 a 21; el mismo número para todos los cajones). El frente y el fondo del cajón pasan a medir el ancho completo de la caja y los cuatro rincones son una unión `finger` con `depth` (se encima, como canal y rebaje); los huecos son solo dibujo. No se elige en el catálogo de uniones (cambia el despiece), se elige en la ficha. Se ve de atrás o con el cajón fuera: el frente del cajón tapa las dos esquinas de adelante | Una unión expuesta que se ve bien en triplay, hecha con lo que el modelo ya sabe (cajas y recortes rectangulares); el costo en el experto es de unos 75 tokens por petición del gabinete |
| D52 | **El inicio tiene destacados y categorías.** «Destacados» lista solo las bases marcadas `featured`, a lo más 11, para que la celda 12 de la cuadrícula sea siempre «Diseña tu propio mueble»; cada categoría (Recámara, Guardar, Mesas y Asientos) lista todas las suyas, destacadas o no. Una base entra al inicio solo si su revisión no trae hallazgos por encima de «detalle». Decidido el 2026-10-04 | Mostrar más diseños sin que «Destacados» deje de ser una selección, y que las variaciones de un mismo mueble se encuentren en su categoría sin competir en la portada. La pantalla de inicio en `capture.pen` queda por actualizar |
| D53 | **Una celda de gabinete puede ser un vacío** (`content: 'void'`): ahí no se construye nada. Va en un extremo de su columna, uno por extremo, y alguna columna llega al piso y alguna al techo. El piso, la cubierta, el zoclo y la trasera pasan a ir en tramos; el entrepaño junto al vacío es el piso o el techo de esa columna. Un vacío que no tiene de dónde colgar se arma como hueco abierto y se avisa. Sobre patas, las de un extremo cuya columna no llega abajo suben hasta el piso de esa columna, con su faldón de ese lado; los faldones del frente y de atrás se quedan abajo y hacen de travesaño. **El experto no lo ve:** su esquema de columnas es el de antes. Decidido el 2026-10-04 | Las columnas a distinta altura (cajas que cuelgan de una tapa, tapas escalonadas) aparecen en seis muebles de referencia y no necesitan un modelo nuevo. Dejar fuera al experto evita cambiar prompts sin poder medirlos. Queda abierto: un mueble con vacíos que se le manda al experto vuelve sin ellos, y con tapas escalonadas el anclaje no baja el aviso de escuadrado |
| D54 | **Cubierta con dedos en el gabinete**: `construction.top: "fingers"`. La cubierta va encima de los costados, como en «Cubierta encima», y los costados exteriores suben hasta su cara de arriba; las dos esquinas son una unión `finger` con `depth` y los dedos corren a lo largo del fondo (el número de `drawerFingers`, 5 por omisión). Los costados miden lo que el mueble de alto, así que el despiece cambia. Solo la cubierta: el piso no lleva dedos. Es lo que sí se ve de frente, a diferencia de los del cajón | La unión expuesta que se ve bien en triplay (D51 lo dejaba tapado por el frente del cajón); el costo en el experto es de unos 25 tokens por petición del gabinete |
| D55 | **Una celda de gabinete puede dividirse en columnas** (`columns` dentro de la celda), cada una con sus celdas, a la profundidad que haga falta. Así se dicen los divisores distintos por nivel y el cajón o hueco que cruza columnas (una celda sin dividir debajo de una dividida). Una celda dividida lleva al menos dos columnas, no es un vacío y no lleva vacíos dentro; un vacío ahí se arma como hueco abierto y se avisa. Los ids de un plan sin celdas divididas no cambian. **El experto no lo ve**, como el vacío, y el editor muestra la celda dividida sin dejar editarla. El ajuste rápido cuenta lo que hay dentro pero no lo parte ni lo quita. Decidido el 2026-10-04 | Es la entrega 2 de `PARTICIONES`: el modelo de columnas ya era una vuelta de recursión, y dejar que una celda repita esa vuelta cubre cuatro muebles de referencia limpios (divisores por nivel, cajones que cruzan) sin un tipo nuevo |
| D56 | **Una celda de gabinete puede llevar trasera propia o ninguna** (`back` en la celda, contra lo que dice `construction.back`). Sin ninguna celda que cambie lo heredado, la trasera es la de siempre y los ids no cambian. Con alguna, va una tabla por cada tramo seguido de celdas con trasera en una columna: cubre entera la tabla de afuera y llega a la mitad del divisor o del entrepaño que comparte; la primera se llama `back` y el casco se para delante de ella aunque otras celdas queden abiertas. Va solo en una celda con algo, no en un vacío ni en una dividida. **El experto no la ve**, y el editor la muestra sin dejar editarla. **R5 no cambia:** una trasera de celda unida a tres piezas del perímetro escuadra como cualquiera, aunque no cubra todo el mueble (la de los cajones de una cajonera de una columna, unida a los dos costados y al piso, trabaja como una faja ancha). Decidido el 2026-10-04 | Las traseras en damero y los nichos abiertos al muro salen en las fotos de cinco muebles de referencia; además, varias traseras chicas caben en la hoja donde una sola de 1200 mm no cabía. Una regla de «una trasera parcial no escuadra» se descartó: no tiene fuente en `estructura.md` §2, pediría marcar las piezas y no cambiaba ninguna ficha |
| D57 | **El inicio es la librería de bases.** Todas las fichas salen en una sola lista, primero las que tienen lugar en el inicio (`home` en su archivo) y luego el resto por código, con buscador por nombre y filtro por cuarto (`rooms`) con su conteo; ya no hay «Destacados» ni categorías por tipo. «Diseña el tuyo» va al final de la lista y en un botón flotante abajo a la derecha, que se quita cuando esa banda está a la vista; los dos botones son oscuros y llevan siempre al formulario, con experto o sin él (reemplaza de D47 el botón secundario «Conectar experto»: sobre el kraft se perdía, y abrir el diálogo de la llave antes de ver el formulario estorbaba); la pantalla tiene un solo título. «Empezar de cero» en el Estudio lleva al inicio, no al formulario del experto. Las medidas de cada base se dicen en cm, ancho × fondo × alto, como las pide el formulario. Una ficha con hallazgos por encima de «detalle» también sale: el inicio es el único lugar donde se encuentran, y se corrigen sobre la marcha; `home` queda como el orden de las primeras y la marca de las que pasan lo que las pruebas le piden a una base. Decidido el 2026-10-05 (UI-79 en `design/DECISIONS.md`); reemplaza D52 | Con decenas de fichas, recorrer y filtrar por el cuarto que se quiere llenar sirve más que una selección de once; quien llega al final sin encontrar su mueble es quien necesita la puerta del experto. La pantalla de inicio en `capture.pen` queda por actualizar |
| D58 | **El experto simulado solo se ofrece con el acceso de depuración.** El formulario de «Diseña el tuyo» no lo ofrece: su recuadro lleva «Conectar experto» y «Ver bases». «Conecta tu experto» lo muestra solo con ese acceso. En el Estudio, sin experto la Conversación cambia el cuadro de texto y las sugerencias por «Conectar experto» y manda a «Editar» para medidas y opciones. Sigue en Ajustes y en las pruebas. Decidido el 2026-10-05; reemplaza de D27 que el simulado se ofrezca como «ejemplos» | El simulado devuelve uno de tres muebles fijos o falla con cualquier otro: ofrecerlo donde la persona pide un mueble a la medida es mandarla a fallar, y las bases ya cubren el probar sin llave. Un cuadro de texto libre sin experto invita a pedir cualquier cosa y solo entendería medidas y conteos |
| D59 | **Puertas corredizas en el gabinete**: `construction.doors: "sliding"`. Las hojas no llevan bisagra: cada una corre en una ranura del tablero de abajo de su hueco y otra del de arriba, y en el modelo eso es una unión `dado` sin pegamento con su `depth` (lo que la hoja entra), no un tipo de unión nuevo: así el esquema del diseño y lo que lee el experto no cambian, y `slides` (`design/doors.ts`) es lo que distingue una hoja corrediza de una abatible. La ranura de arriba se fresa al doble para meter y sacar la hoja levantándola; va en la nota del diseño porque el modelo solo guarda lo que la hoja entra. Dos hojas se traslapan en dos carriles, la izquierda atrás; una sola tapa la mitad del hueco y deja la otra abierta. Una celda `door` dividida en columnas lleva las hojas al frente de todo el hueco y sus columnas detrás, remetidas (el divisor a media luz que evita una repisa larga); ahí solo van huecos abiertos, y eso solo lo escribe una ficha. No se compran rieles: es la corrediza de ranura en la madera, para hojas bajas; la de riel colgado para hojas de más de 1 200 mm no está. Los cuatro números (`ASSUMPTIONS.sliding`) son de Knotty salvo el traslape. |
| D60 | **Esquinas cortadas en diagonal** (`Piece.slants`): a una esquina de la cara de una pieza se le quita un triángulo, con un cateto en cada eje de la cara; un cateto puede decir «todo el canto menos tanto», para que siga a la pieza. Como los recortes (`cuts`), es solo dibujo: el despiece, la compra, el contacto y las revisiones leen el tablero completo, y es dato de Knotty, no del experto. Una pieza con recortes y esquinas cortadas dibuja solo los recortes, y sus cantos no dibujan perfil. La primera que lo usa es la pata cónica (`legStyle`) | Da forma a patas y remates sin romper D10: el tablero no se inclina, así que nada de lo que calcula Knotty cambia. Las patas abiertas en dos direcciones, giradas en planta o cruzadas en X siguen fuera |
| D61 | **Patas abiertas sin girar ninguna pieza** (`legStyle: "splayed"`, en el gabinete; en la mesa, D66). D10 sigue en pie: la pata no se inclina, se recorta. Es una tabla más ancha que la pata recta, parada derecha, con dos esquinas opuestas cortadas en diagonal (D60): por fuera de arriba al piso y por dentro de abajo del faldón al piso. Arriba queda donde va una pata recta, así que toca las mismas tablas y lleva las mismas uniones; el pie queda más afuera. A diferencia de la cónica, aquí la caja de la pieza sí cambia: la tabla que se compra es más ancha y la base se apoya más honda, que es lo que ve R4. Solo se abren las cuatro patas de las esquinas, y solo hacia el frente y hacia atrás, que es el plano de la tabla: de lado se ve la inclinación, de frente la pata se ve recta. Una pata intermedia tiene un faldón enfrente y solo se adelgaza. Patas en V, en A o abiertas hacia los lados siguen siendo un hueco. |
| D62 | **Baúl en el gabinete**: una celda `content: "chest"`, tapada al frente y abierta por arriba. Su tapa es el piso del hueco abierto de encima: del entrepaño fijo de siempre solo queda una tira atrás (`ASSUMPTIONS.lids.strip`), y el resto es la tapa, una pieza `door` acostada, entre los costados y hasta la cara del frente, sobre cuyo canto descansa. Con `shelves: 1` lleva un fondo fijo a media altura. La unión de la tapa con la tira es un tipo nuevo, `lid-hinge`, que compra una bisagra de piano y un compás de fricción; `lifts` (`design/doors.ts`) es lo que distingue una tapa de una puerta abatible, como `slides` a una corrediza. Va debajo de un hueco abierto sin dividir, o **hasta arriba en todas las columnas**: entonces la cubierta es la tapa, una sola (`top-lid`) sobre los costados y los divisores, y de la cubierta queda la tira de atrás (`top`); no va con `top: "fingers"`. En cualquier otro lugar se construye tapada y se dice. Los compases se cuentan por el peso de la tapa sobre su bisagra (`lidTorque`, `staysFor`): uno hasta 3 N·m y dos, uno por costado, hasta 6. **El experto no la escribe** (solo una ficha o el editor), pero `lid-hinge` sí queda en el esquema de uniones que ve, sin que el prompt lo explique: no se midió con `npm run compare` (diferido hasta 1.0). Los precios de los dos herrajes y los números de `ASSUMPTIONS.lids` son de Knotty. Decidido el 2026-10-06 | El frente de un mueble que va detrás de una cama queda tapado por el colchón: por arriba es el único acceso. Una bisagra con eje horizontal y un compás no cabían en `cup-hinge` (cazoletas a lo alto de la puerta, bisagras por altura), y sin unión propia la compra no los traía |
| D63 | **Base de tablillas en la cama**: `platform: "slats"` en la ficha de cualquier cama; ausente es el tablero de siempre, que va **sobre** los costados. Las tablillas van **embutidas**: de 100 mm, a lo ancho, de un extremo de la base al otro, con 75 mm o menos de hueco, 20 mm abajo del canto de los costados (`SLAT_RECESS`: los 18 de la tablilla y 2 de holgura, así el colchón sigue apoyando en ese canto y la cama no cambia de medida) y 2 mm más cortas por extremo que el hueco. Descansan en un **listón** de dos tablas pegadas cara a cara (`ledger-…`), pegado y atornillado por dentro de cada costado, entre sus travesaños, y en la espina, que baja con ellas. Cada tablilla lleva un tornillo por extremo en la tabla del listón que cubre entera, a 25 mm o más de su extremo, y los suyos en la espina; en la tabla pegada al costado solo descansa. Sobre los cajones el costado es un larguero corrido (`slat-rail-<lado>`) con su listón: los divisores entre cajones quedan debajo, atornillados a él con tornillo de bolsillo, y los cajones abren bajo el larguero. De la queen en adelante la tablilla correría más de 700 mm y lleva un larguero a media distancia (`slat-runner-…`). Con patas, el listón empieza después de cada pata. **El tope del colchón, con tablillas, son las mismas tablas de la base**, que suben 40 mm más: no hay plataforma donde parar un listón. **Se revisan como tablillas, no como entrepaños:** `bed.span` mide su claro a lo ancho de la cama (crítico pasados 700 mm), `bed.slats` avisa de una tablilla de menos de 18 × 100 o de un hueco de más de 75, y `bed.mattress-fit` cuenta como base el canto de las tablas que quedan hasta 5 mm arriba de las tablillas; R1 no les mide la flecha, porque la referencia da por buena en una tablilla una flecha que en una repisa se vería. Qué es una tablilla lo dice la forma (`slatsOf`). El experto la escribe (`bed@6`); no se midió con `npm run compare`. El rebaje, la holgura, la sección del listón y el alto del larguero son de Knotty (`MODULE_SOURCES`): la referencia no los trae. Decidido el 2026-10-07; ese mismo día se cambió de tablillas sobre los costados a embutidas | La base de tablillas es la común en una cama comprada, deja respirar el colchón y pesa menos. Embutida, los costados encierran las tablillas y no se les ve el canto; sobre el costado quedaban a la vista, y en la cama de día su extremo contra el respaldo solo lo sostenía un tornillo al canto. Un tablero cruza de divisor a divisor y una tablilla no: sin el larguero, sobre un cajón quedaba en voladizo |
| D64 | **Tubo para colgar en el gabinete**: `rod: true` en una celda abierta o con puerta, sin dividir; toma el lugar de las repisas. El tubo no es un tablero ni une nada, así que no es una pieza ni una unión: es un dato del diseño (`Design.rods`: bajo qué tablero cuelga y de qué costado sale), como las jaladeras. Una unión no servía: Knotty da por hecho una sola por par de piezas, y la del tubo le quitaba los tornillos al techo. Dónde corre, cuánto cruza y qué hay debajo se leen de las piezas (`design/rods.ts`); la compra suma por tubo el tramo más corto del catálogo que alcanza y dos bridas, y el 3D lo dibuja. Tres revisiones, las tres recomendación y de R10, donde haya un tubo y se llame como se llame el mueble: claro de más de 1 000 mm sin soporte al centro (`rod.span`), menos de 550 mm de fondo para los ganchos (`rod.depth`) y menos de 900 mm libres debajo (`rod.height`). No se revisa cuánto carga: las guías que dan kilos por metro no coinciden y ninguna cita fuente. **El experto no lo escribe** (solo una ficha o el editor) y su esquema no cambió: las columnas que devuelve al ajustar una ficha (`ExpertColumns`) no lo traen, igual que el baúl, el vacío o la trasera por celda. Los precios de tubo y brida son de Knotty. Decidido el 2026-10-08 | El clóset es de lo más pedido en mueble a la medida y sin dónde colgar era un librero alto con puertas |
| D65 | **Esquinas redondeadas en la cubierta de la mesa** (`corners: "rounded"`, `Piece.rounds`): a una esquina de la cara se le quita lo que queda fuera de un arco, a un radio. Como las esquinas en diagonal (D60), es solo dibujo y dato de Knotty: el despiece, la compra, el contacto y las revisiones leen el tablero completo, y la lista de corte dice «esquinas redondeadas» bajo el renglón (`afterCut`). El radio es uno solo, 40 mm, elección de Knotty (el tamaño de una tapa, fácil de marcar y de cortar con caladora); la referencia solo pide 3 mm o más en lo que alcanza un niño. Solo se redondea la esquina que vuela sobre lo que va debajo: la esquina de una pata o de un costado queda dentro del arco mientras esté metida `r·(1 − 1/√2)` ≈ 12 mm por los dos lados. Por eso un escritorio redondea solo las de enfrente (atrás los costados llegan a la orilla) y una cubierta al ras no redondea ninguna y lo dice en una nota. **El experto sí lo escribe**: `corners` es un campo de la ficha de la mesa, así que el prompt del módulo subió a `table@8` y los presupuestos de tokens del esqueleto subieron lo que cuesta nombrarlo. No se midió con `npm run compare`, que sigue aplazado hasta la 1.0. Fuera: la cubierta redonda u ovalada (el dibujo ya la sabe hacer, pero las patas y los costados de hoy asomarían por las esquinas: pide otra base), el radio a elegir y las esquinas redondeadas en otros muebles. Decidido el 2026-10-08 | La cubierta de esquinas redondeadas es de lo más común en mesas y escritorios y las fichas la dibujaban recta |
| D66 | **Patas abiertas también en la mesa** (`legStyle: "splayed"`), con la misma pata de D61: una tabla 20 mm más ancha, parada derecha, con dos diagonales; arriba queda donde va la pata recta, así que faldones, uniones y herrajes no cambian. En el gabinete las patas van metidas 30 mm y siempre hay hacia dónde abrirlas; en la mesa van a `overhang` de la orilla, así que **una fila de patas solo se abre si la cubierta vuela 20 mm o más sobre ella**: el pie nunca sale de debajo de la cubierta. Con menos vuelo las patas solo se adelgazan y una nota lo dice; en un escritorio las de atrás van a la orilla, contra el muro, así que solo se abren las de enfrente. Las intermedias de una mesa larga se adelgazan, como en el gabinete. Los faldones largos dejaron de medirse desde la cara de la pata y se miden desde la orilla, para que no se muevan con ella. El experto lo escribe: el prompt del módulo es `table@9`, sin medir con `npm run compare` (aplazado hasta la 1.0). **Sigue sin revisarse si una mesa con patas se ladea** (pendiente en el tablero): abrir las patas no lo arregla ni lo empeora para Knotty, que lee los mismos faldones. Fuera, como en D61: abiertas hacia los lados o hacia las esquinas, en V o en A, con travesaños entre patas, y la cama. Decidido el 2026-10-08 | Era el hueco más repetido en las fichas de mesas, y la pata ya existía |
| D67 | **Pasacables en el gabinete y en el escritorio** (en el gabinete, `cable: true` en una celda abierta o con puerta, sin dividir): un barreno redondo de 60 mm en la trasera, al centro del hueco y a 60 mm de su piso. Como todo recorte es solo dibujo: la trasera sigue siendo el mismo tablero y la lista de corte dice que lleva un barreno. El barreno va en la trasera que quede detrás de la celda, sea la de todo el mueble, una de varias o la de la celda; donde no hay trasera no se hace nada y una nota lo dice. Las dos medidas son elección de Knotty: la referencia solo nombra el pasacables del mueble de TV. No se compra nada: la tapa de plástico es opcional y no está en el catálogo. **El experto no lo escribe** (solo una ficha o el editor), igual que el tubo de D64. **En el escritorio** (`cable: true` en la ficha de la mesa, con uso escritorio o de pie) el barreno va en la cubierta, 60 mm delante del faldón trasero y lo más cerca del centro del largo donde no haya nada debajo: se recorre de 10 en 10 mm hacia los lados hasta librar cajonera, patas y travesaños, y si no hay dónde, una nota lo dice. Aquí el experto sí lo escribe, porque es un campo de la ficha: el prompt es `table@10`, sin medir con `npm run compare`. El barreno dejó de ser un recorte: es un dato propio de la pieza (`Piece.holes`: centro y diámetro), y el 3D lo corta dentro del contorno, así que una cubierta puede llevar esquinas redondeadas y barreno a la vez. Una pieza con recortes de caja (`cuts`) sigue dibujando solo esos. Decidido el 2026-10-08 | Un mueble de TV o un librero con aparatos sin por dónde sacar los cables se termina barrenando a ojo |
| D68 | **Sin experto, la Conversación ofrece lo que Knotty hace solo**: hasta seis peticiones de un toque sobre «Conectar experto» (`application/quickActions.ts`). Salen de una lista fija y solo se ofrece la que hoy se lee como un cambio a la ficha de ese mueble y arma un mueble válido, una por campo; con una propuesta en espera o un diseño que ya no es su ficha no se ofrece ninguna. Sigue sin cuadro de texto libre sin experto (D58). Decidido el 2026-10-09 | Una petición ofrecida no puede fallar; una escrita sí: el intérprete deja sin leer una de cada cuatro frases de gabinete y una de cada tres de mesa de su propio corpus. Acerca «el experto es opcional» (D47) sin reabrir D58 |
| D69 | **Sin experto no contesta nadie en su lugar.** Con el proveedor en «Simulado» y sin haberlo elegido en la sesión, la app no arma el simulado sino un proveedor ausente (`adapters/llm/absent`) que rechaza toda llamada diciendo que eso necesita al experto. La revisión antes de comprar da entonces solo las cuentas de Knotty, sin opinión de carpintero; en los avisos, las salidas que solo aplica el experto se leen como consejo, con «Conectar experto»; «Rehacer como…» ofrece conectar, y el encabezado del Estudio dice «Sin experto». Completa D58. Decidido el 2026-10-09 | Sin llave, la revisión salía firmada por el simulado («Esto es el modo simulado…») y una salida de un aviso mandada «al experto» contestaba «En modo simulado solo entiendo algunos pedidos»: lo que necesita al experto debe decirlo y ofrecer conectarlo, no fallar con otra voz. El consejo se queda a la vista porque sirve a quien lo hace a mano |
| D70 | **Hoja para llevar**: con el diseño revisado, «Hoja para llevar» en Materiales abre una página en lugar del Estudio que solo lee el diseño (`ui/takeaway`). Lleva el aviso de revisar antes de cortar, la lista de corte del mostrador como tabla (los mismos renglones y números de `counterLines`) y las piezas separadas en dibujo de líneas, cada una con el número de su renglón. Cada pieza se aleja del centro del mueble (`spreadApart`), no por subconjuntos como la vista «Armado»: dos tablas que se tocan nunca se leen como una más larga. Se dibuja desde cinco ángulos, porque en papel no se puede girar. Se imprime o se guarda como PDF con el navegador, sin librería de PDF. Una pieza inclinada o redondeada se dibuja como su rectángulo. No dice cuánto aguanta el mueble ni que sea seguro. Es el primer paso de tres: siguen el armado por fases de un tipo de mueble y luego los demás. Decidido el 2026-10-09 | El despiece puede estar mal con o sin experto, y quien corta es quien paga la hoja: la persona necesita algo que revisar antes de cortar y que pueda enseñarle a un carpintero. Un dibujo de líneas se imprime como tinta y no depende del 3D; el aviso dice qué revisar, no deslinda nada por sí solo |

---

## 1. Experiencia y diseño visual

Cómo es la app hoy, según `src/ui/`. El diseño que se busca vive en `design/flows/*.pen` (ver `design/README.md`); cuando no coinciden, la diferencia es trabajo pendiente, no esta sección.

### Flujo

```
Inicio (catálogo de bases) → Ajusta tu base → Estudio
Inicio → Captura («Diseña el tuyo») → El experto analiza → Estudio
```

`App.tsx` elige la pantalla por la fase del store: `Home` (y, con una base elegida, `AdjustBase`), `Capture`, `Analyzing` o `Studio` (este último se carga aparte, porque trae el 3D). Ajustes (`Settings`), el diálogo «Conecta tu experto» (`ConnectExpert`), el aviso de llaves (`KeysGate`) y el buscador de muebles (`Spotlight`, `Ctrl+K`) van encima de cualquiera.

- **Inicio** (`capture/Home.tsx`, D47 y D57): las bases primero, con buscador por nombre y filtro por cuarto; al final, «¿No está el tuyo?» con la puerta «Diseña el tuyo» (botón primario; lleva siempre al formulario, que es donde se pide conectar al experto si falta), y un botón flotante al mismo camino mientras esa banda no está a la vista. Una base abre «Ajusta tu base» (`capture/AdjustBase.tsx`): lo que su ficha deja cambiar, el resumen de hojas y costo, y «Abrir en el Studio». El encabezado lleva el estado del experto y Ajustes.
- **Captura** (`capture/Capture.tsx`, D40): una sola pantalla con el tipo de mueble (opcional: «Que el experto lo decida»), el espacio disponible (opcional, en cm, por lado; llega al experto como un límite y no como las medidas del mueble, y si el diseño se pasa el experto lo dice), las fotos y lo que quiera decir con sus palabras. Fotos según D39: un solo «Agregar fotos», hasta 5, sin ranuras; cada una se lee al agregarla, el modelo propone su vista y la persona solo la corrige si está mal; cada foto admite una nota. Sin fotos, la descripción pide al menos 15 caracteres y el botón dice «Diseñar mi mueble» (o «Conectar experto» si no hay uno). En escritorio las fotos van en una columna a la derecha. Si el diseño falla, la captura se conserva y se ofrece «Reintentar» con «Ver qué pasó» (D28).
- **Análisis** (`capture/Analyzing.tsx`): las etapas reales del caso de uso («Mirando las fotos (n de m)», «Pensando el diseño» o «Diseñando pieza por pieza», «Midiendo que todo cierre», «Revisando la estructura»), un reloj, un trazo de lápiz dibujando un mueble, el historial de las últimas líneas de lo que el experto ha hecho y «Cancelar». Pasados 30 s explica por qué tarda.

### Estudio

`studio/Studio.tsx`. A partir de 768 px, el 3D a la izquierda y un panel de 360 a 420 px a la derecha; en celular, el 3D arriba (52 % del alto) y el panel abajo, con un botón que cambia la proporción a 30 % para el 3D. No hay hoja arrastrable (D14).

- **Encabezado**: nombre del mueble y su resumen de medidas; la versión («v3»), que abre el historial; la campana de avisos, en óxido con el número por decidir; el experto conectado, que abre ajustes; y «Nuevo diseño», que confirma antes de borrar.
- **Escena**: encima del 3D, una barra con Frente · Lado · 3/4 · Arriba · Armado (vista explosionada) · Cotas, y debajo una sola ficha de estado (`StatusChip`), la de mayor prioridad: versión vieja a la vista, el experto trabajando (si no se ve el chat), pieza enfocada («Ver todo el mueble»), propuesta o solución en vista previa, problemas sin resolver, piezas por confirmar y lo último que se resolvió. Abajo a la derecha, sobre el interruptor de cotas, «Ocultar» quita del 3D la pieza elegida y «Mostrar todo» aparece mientras haya alguna oculta: es el único lugar para las dos cosas. Al elegir una pieza la cámara gira y se acerca alrededor de ella y no del mueble (el zoom va hacia donde apuntas), para llegar a una esquina; salir del foco deja la pieza elegida y regresa al mueble completo.
- **Panel**: tres pestañas, Conversación · Mueble · Materiales.
  - *Conversación* (`chat/Chat.tsx`): los mensajes del experto con lo que cambió cada versión (`ChangeList`), sus preguntas con respuestas en botón, las propuestas que esperan confirmación (D36: «Sí, aplícalo», «Ver propuesta», «No, déjalo como estaba») y chips de sugerencia. La bandeja (`chat/Tray.tsx`, D34) junta avisos, respuestas y pedidos para mandarlos al experto en un solo pedido.
  - *Mueble* (`studio/FurniturePanel.tsx`): el tipo de mueble y de dónde salió, la ficha (`PlanSheet`) para los módulos que la tienen, que se aplica con «Aplicar» o se deja con «Descartar», lo que el experto recuerda (requisitos y decisiones, que se pueden quitar), las fotos y, sin ficha, la lista de piezas.
  - *Materiales* (`studio/Materials.tsx`, D30): primero la revisión («Revisar y ver materiales») y su veredicto; si es viable o se puede arreglar, el costo aproximado, las hojas de triplay con su acomodo en SVG y el desperdicio, herrajes y consumibles, el acabado y la lista de corte. Los precios son de referencia y se tocan para poner el de la tienda. Si no es viable, la lista se ve solo con «Ver la lista de todos modos». La lista de corte es la del mensaje para la maderería (`counterLines`): los mismos renglones con el mismo número, y «Copiar lista para la maderería» la deja en el portapapeles como texto (UI-82 en `design/DECISIONS.md`).
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
- **Movimiento**: abrir (cajones que salen, puertas que giran), armado y cámara con resorte (`@react-spring/three`, `CameraControls`); la pieza nueva cae a su lugar con aserrín; la eliminada sube y se desvanece en óxido; la que cambió brilla en ámbar y se apaga; las piezas nuevas de una propuesta se ven en ámbar translúcido. Con `prefers-reduced-motion` no hay animaciones.
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
├─ scripts/compare/          targets/models.compare.ts: el banco contra expertos reales (npm run compare) · results/
└─ src/
   ├─ domain/                TypeScript puro: sin React, sin LLM, sin navegador; siete grupos por intención y sin ciclos entre ellos
   │  ├─ materials/          el catálogo: catalog · finishes · grades · edgeProfiles · tools
   │  ├─ design/             schema · resolve (cotas → geometría) · normalize · builders · drawers · doors · joints · hardware · hardwareCount · boxes · diff
   │  │  └─ validation/      geometry · contact (grafo) · errors
   │  ├─ estimate/           lo que sale de un diseño: cutList · layout (acomodo en hoja) · purchase · finishPurchase
   │  ├─ checks/             analysis.ts (análisis completo: geometría, contactos, avisos, reglas y requisitos)
   │  │  ├─ structure/       assumptions · review · finding · accepted · rules/ (deflection, jointThickness, racking, screws, drawers, usage)
   │  │  └─ typology/ · viability/ · requirements/   revisiones por tipo de mueble, revisión antes de comprar, requisitos
   │  ├─ furniture/          modules/ (fichas de gabinete, cama, mesa y zapatera; plan, rebuild) · fixtures/ (ejemplos y catálogo de prueba) · reading/ (lectura de fotos) · intent/ (pedidos que Knotty entiende solo)
   │  ├─ editing/            operations/ (schema · apply · drawer) · repair/ · fixes/ · changes/
   │  ├─ session/            estado guardado (state) y migración (migrate) · history/ · trace/ · tray/
   │  └─ sources.ts          de dónde sale cada umbral (docs/carpinteria)
   ├─ application/           useCases (reconstruct, adjust, applyPlan, reviewPurchase…) · context · notices
   │  └─ bench/              casos fijos y banco de pruebas (también lo usa scripts/compare)
   ├─ ports/                 LLMProvider · DesignRepository · MaterialCatalog · ImageProcessor · Preferences · DebugAccess
   ├─ adapters/
   │  ├─ llm/                anthropic · compatibleOpenAI (OpenAI y SheLLM) · simulated/
   │  │  ├─ common/          expert (arma los pedidos) · prompts · configuration · vault · jsonSchema · errors
   │  │  └─ prompts/         un archivo por prompt (`nombre.vN.md`), más `modules/` y `kinds/`
   │  ├─ persistence/        localStorage, con migración de formatos
   │  ├─ catalog/            catálogo JSON y ajustes de precio y corte de la persona
   │  ├─ image/              reducción de fotos y miniaturas
   │  ├─ debug/              el interruptor guardado del acceso de depuración
   │  └─ storedKey.ts        claves de localStorage (y mueve las de Despiece)
   ├─ ui/                    system/ · capture/ · studio/ · scene/ · chat/ · settings/ · spotlight/ · lab/ · debug/ · store/ · services.ts
   ├─ composition.ts         raíz de composición: instancia adapters e inyecta casos de uso
   ├─ main.tsx               arranque de React y del service worker
   └─ architecture.test.ts   fronteras entre capas
```

- **Fronteras** comprobadas por `src/architecture.test.ts`: `domain/` solo importa zod y no toca el navegador; `application/` y `ports/`, dominio y puertos; `ui/`, todo menos `adapters/`. Dentro del dominio, cada grupo importa solo lo que hoy importa: nadie importa `session/`; `materials/` no importa ningún grupo; `design/`, solo `materials/`; `estimate/`, solo `design/` y `materials/`; `checks/` no importa `editing/`, `furniture/` ni `session/`; `editing/` no importa `furniture/`.
- **Zod en el dominio** es aceptable: es TypeScript puro.
- **`LLMProvider` expresa intenciones**: `reconstruct`, `planDesign` (esqueleto), `adjustPlan`, `proposeAdjustment`, `readPhoto` y `reviewPurchase`. `planDesign` y `adjustPlan` son `null` cuando el proveedor no los tiene (el simulado): sin esqueleto, el diseño va pieza por pieza. Anthropic, OpenAI y SheLLM comparten `common/` y `prompts/` y solo difieren en transporte; el simulado implementa la interfaz con reglas fijas. El ciclo de corrección vive en `application/` y se prueba sin red.
- **Salida estructurada**: los esquemas Zod son la única fuente; de ahí sale el JSON Schema. Por el modo estricto (sin `oneOf`, todos los campos requeridos) los esquemas usan uniones discriminadas por `op` y opcionales como `nullable`. Siempre se re-valida con Zod.
- **Prompts versionados**: cada archivo lleva frontmatter `id: nombre@versión` (por ejemplo `system@12`); cada versión del diseño guarda qué prompt y modelo la produjeron.

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
| **Requisitos** | Hechos del usuario: espacio, carga, herramientas disponibles | El LLM los propone; el usuario los ve y puede borrarlos. El LLM no quita ni cambia uno que ya está: con un cambio, queda como propuesta hasta que el usuario la aplique; en una respuesta, se deja como estaba y se le dice | ~15, sin duplicados por tipo |
| **Decisiones** | Razonamiento de diseño: "trasera de 6 mm para escuadrar" | El LLM, con clave `topic` | 15; la nueva del mismo tema reemplaza |
| **Bitácora** | Por versión: número, resumen, motivo, operaciones abreviadas | Determinista | ver compactación |

Los requisitos tienen forma estructurada cuando se puede (`{type:'space', axis:'x', max:900}`), así el dominio los verifica (`E_REQUIREMENT`) sin depender de que el LLM los recuerde. El contexto le manda al experto esos mismos límites junto al texto, para que lea lo que la validación revisa. Lo que una propuesta pendiente agregó (requisitos y decisiones) se conserva cuando la persona la contesta por el chat. Un requisito de espacio es la medida del mueble completo, nunca de una parte.

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

Los supuestos viven en `domain/assumptions.ts` como datos y cada regla en `domain/checks/structure/rules/`. Cada hallazgo devuelve `{ code, severity, pieces, message, data, alternatives }` (severidad `critical`, `recommendation` o `detail`): el LLM narra, no calcula. Las alternativas las simula el motor (siguiente espesor, divisor al centro, claro máximo con el espesor actual).

### R1 — Flecha de entrepaños

- Viga simplemente apoyada con carga uniforme: `δ = 5·q·b·L⁴ / (384·E·I) × k_fluencia`, con `I = b·t³/12`.
- L = claro libre entre apoyos (del grafo de uniones); b = fondo; t = espesor. El claro se busca a lo ancho del mueble; una tabla sin apoyos en ese eje (la repisa de una cabecera, que detienen los costados de la cama) se mide de frente a fondo, con b y la veta leídos respecto a ese eje. Ahí no se ofrece «divisor al centro»: ese arreglo pone el divisor a lo ancho (v5, 2026-10-08).
- Supuestos (los de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §1 y §4):
  - Apoyo simple siempre (conservador).
  - Triplay de pino radiata, conservador y por espesor (`materials/grades.ts`): E∥ 4 500 MPa en 18 mm, 5 000 en 15, 5 500 en 12 y 9; E⊥ 2 000 / 1 500 / 1 000 / 800 / 700 en 18 / 15 / 12 / 9 / 6 mm.
  - k_fluencia = 2.0 con la carga que se queda (libros, trastes, ropa); 1.0 con la que pasa: la plataforma de una cama y el asiento de una banca cargan a una persona.
  - q: ligera 50, media 100, pesada (libros) 150 kg/m².
- Umbrales sobre la flecha final: ≤ L/360 OK; L/360 – L/100 recomendación; > L/100 crítico.
- El «apoyo al centro» que Knotty construye va al centro del claro que se pandea, no de la tabla, y pone otro mientras la pieza siga igual de grave (`centerSupports`): el piso sobre zoclo ya lleva un apoyo bajo cada divisor, así que se pandea en el tramo de cada lado y el centro de la tabla está ocupado.

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

- Mueble de guardado con cajones o puertas desde 686 mm de alto (alcance de ASTM F2057-23, [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §12) y `wallAnchored = false`: se juzga por un balance de momentos, no por la altura sola (`rules/tippingBalance.ts`). Sostiene el casco; jalan los cajones llenos y fuera, las puertas abatibles abiertas a 90° (una corrediza se queda en su carril y una tapa de baúl sube sobre el casco: las dos sostienen como él) y un niño colgado del borde del cajón más alto que esté a 1 422 mm o menos. Con jalado ÷ sostenido ≥ 1 es crítico (`check: 'tipping.storage'`) y entre 0.8 y 1 es recomendación (`check: 'tipping.storage-near'`); el aviso dice si lo voltean los cajones solos, el niño o las puertas, con las cifras. El fondo no saca de crítico a una cajonera, como dice la referencia, pero unas puertas sí se sostienen solas cuando el mueble es profundo. El 0.8 y el 10 % de altura justo debajo (617–685 mm, solo recomendación) son tolerancias de Knotty (`ASSUMPTIONS.tipping.balanceMargin` y `storageMargin`). El modelo es una simplificación (cajones con salida completa, sin el calce de la norma). Se detecta por lo que tiene, no por el nombre; no aplica a camas, bancas, escritorios y mesas ni a la alacena, que tiene su propia revisión de colgado. Si el balance no llega a 0.8, decide la proporción de abajo.
- Sin cajones ni puertas, o con un balance que se sostiene solo: alto / fondo ≥ 3 → recomendación de kit antivuelco; crítico si alto > 1 200 mm, alto / fondo ≥ 4 y `wallAnchored = false`.
- **Anclar es una indicación de seguridad, no un hallazgo** (2026-10-08): un mueble anclado está bien hecho, así que R4 no deja rastro aunque el ancla sea lo que lo sostiene (18 fichas y 26 variantes del banco serían críticas sin ella; un hallazgo ahí sería permanente y sin arreglo posible). Lo que la persona lee está en el formulario: la leyenda de «Anclado al muro» dice dónde va el anclaje (`HOW_TO_ANCHOR`, de `estructura.md` §6.3), en el gabinete y en la zapatera. No se le dice todavía «en este mueble el ancla es obligatoria»: eso pide el balance y un lugar en la interfaz que no sea un hallazgo.
- Anclado (`wallAnchored = true`) R4 no avisa, así que la lista de compra lleva el kit antivuelco del catálogo (`estimate/purchase.ts`); una alacena de pared no: cuelga de su listón, uno por columna cuando lleva divisores.

### R5 — Escuadrado

El casco necesita al menos uno de: trasera ≥ 6 mm fijada en todo el perímetro; trasera de 3 mm pegada en rebaje; o marco rígido (al menos dos travesaños rígidos, uno de ellos zoclo, faja o un entrepaño fijo pegado en ranura). La regla y sus soluciones suponen una caja: un mueble abierto de varios marcos (un exhibidor escalonado) sale siempre crítico y sin solución que Knotty pueda construir; está en Preguntas abiertas. Si no: crítico con alto > 600 mm, recomendación si es menor. Con `wallAnchored` y una cubierta (o faja) fija unida a los dos costados, el anclaje escuadra el casco en el plano del muro: es solo recomendación (`check: 'racking.anchored'`) y dice por dónde va el anclaje, nunca por la trasera. Sin anclar y con dónde anclar, ofrece «anclar al muro»; sin pieza donde anclar sigue crítico.

R5 no juzga una mesa sobre patas, y así se queda (2026-10-09): la regla busca dos costados y las patas no lo son. El módulo de mesa siempre pone faldón todo alrededor, atornillado a cada pata, así que una mesa de ficha no nace sin marco; una regla para ella no dispararía en ningún mueble que Knotty arma. Se reabre con un diseño real de mesa sin faldones (del experto pieza por pieza, o de una edición a mano).

### R6 — Puertas

Bisagras por alto, como la tabla de Blum de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §8: ≤ 900 mm → 2; ≤ 1 600 → 3; ≤ 2 000 → 4; ≤ 2 400 → 5. La bisagra es la del montaje de la puerta (`door.hinge-mount`): recta si tapa todo el canto, codo si lo comparte con otra puerta, súper codo si va embutida; embutida contra sobrepuesta es crítico y recta contra codo, recomendación. Ancho > 600 mm → recomendación de dividir en dos hojas. Una hoja corrediza (D59) no cuelga de nada: ni bisagras ni ancho máximo. Una tapa de baúl (D62) tampoco lleva cazoletas ni ancho máximo; tiene tres revisiones propias, las tres recomendación: sin compás se azota (`lid.stay`); si pesa sobre su bisagra más de lo que detienen dos compases, 6 N·m, pide pistones o una tapa más chica (`lid.weight`); y si lo que tiene encima no la deja abrir 60° cuesta meter la mano (`lid.room`; el ángulo es de Knotty).

### R7 — Base

Piso con claro > 800 mm sin apoyo intermedio → recomendación. Patas a más de 1 200 mm entre sí → recomendación de patas intermedias. Las patas se miden a lo ancho y, desde la v4 (2026-10-08), también de frente a fondo (`check: 'base.legs-across'`): en cada lugar a lo ancho donde algo llega al piso, qué tan lejos queda lo que ahí se apoya. Se mide por lugar y no en el mueble entero porque una cabecera lisa llega al piso a todo lo ancho y tapaba el hueco de media cama. El umbral es el mismo; de frente a fondo no se ofrece «apoyo al centro», que ese arreglo pone a lo ancho.

Una caja de un extremo que cuelga (`check: 'base.hanging'`): su costado de afuera y el piso al pie de ese costado no llegan al suelo ni descansan en nada, así que solo la sostiene la cubierta → **crítico**, con «anclar al muro» como salida. Anclado al muro no avisa: lo sostiene el muro (las repisas de pared). Una columna que no llega al piso entre dos que sí llegan no cuenta: la cargan sus vecinas, como los cajones colgados de un aparador.

### R8 — Veta

Entrepaño o lateral con veta perpendicular a su largo → detalle (R1 ya usa el E menor).

### R9 — Cajones

Holgura de la corredera a cada lado (12.7 mm, hasta 0.8 de más y nada de menos), fondo del cajón suficiente para su ancho (6 mm desde 300 de ancho), una pieza a la que atornillar cada corredera, la corredera del largo de la caja (`drawer.slide-too-long`, crítico; `drawer.slide-too-short`, recomendación cuando le queda una más larga) y holgura del frente con lo que lo rodea. Aplica a los cajones del módulo y a los que arma el experto.

Lo que la corredera pide es el piso de esa banda, no la medida de diseño: la caja que arma Knotty (`expandDrawer`) deja `ASSUMPTIONS.drawers.boxClearance` por lado, al centro de la banda (`valores-de-referencia.md` §9), para que un corte medio milímetro largo todavía entre. La regla no cambió: sigue aceptando desde lo que pide la corredera.

### R10 — Uso

Revisiones por tipo de mueble (`domain/checks/typology`): alto de una mesa o un escritorio, espacio para las piernas, medidas de la cama contra el colchón, fondo de un librero, anclaje de lo que cuelga. Un tubo para colgar se revisa donde lo haya, sin importar el tipo (`typology/rods.ts`, D64). Cada revisión es una entrada de `domain/checks/typology/constraints.ts` con sus límites y su fuente en `docs/carpinteria`.

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

- **De qué ficha sale un diseño (`ficha: { code, version }` en el estado):** se guarda al abrir una base de la portada o del buscador; un diseño de fotos o palabras no tiene. El Studio lo dice discreto junto a las medidas: el código y la versión, «con cambios» si el plan ya no es el de la primera versión o se cambiaron piezas fuera de él, y «Personalizado» si no sale de ninguna. Volver a la primera versión desde el historial lo devuelve a la ficha sin cambios.
- **Cada tipo de mueble es un módulo registrado** (`MODULES`, `MODULE_OF_KIND`) y no compila si a un tipo le falta el suyo. Agregar uno no debe tocar la ficha, el banco ni el esquema del experto: se generan desde el registro. Si agregar un módulo obliga a editar otro lado, ese lado hay que generalizarlo.
- **`legHeight` (gabinete con patas):** milímetros, de 100 a 300, 150 por omisión (una ficha sin el campo sigue valiendo). La altura total incluye las patas: cambiarlas mueve el piso, no el techo, y la caja que queda (alto − patas) no baja de 200 mm (si no, «No cupo»). Los tres números son sin referencia (`MODULE_SOURCES`). No medido con `npm run compare` (diferido hasta 1.0).
- **`legStyle` (gabinete con patas):** `straight` (por omisión; una ficha sin el campo se arma igual que antes) o `tapered`. Cónica, cada pata se adelgaza por su lado de adentro, de 72 mm bajo el faldón a 36 mm en el piso (`LEG_FOOT`, sin referencia); el corte empieza debajo del faldón, que conserva su cara derecha. Las piezas, las uniones, el despiece y los avisos son los mismos que con patas rectas. El triplay se adelgaza por la cara y no por el grosor: se nota de lado, de frente la pata se ve recta. Una pata intermedia que llena el hueco entre faldones queda recta. La mesa y la cama toman el mismo campo. En la mesa el corte es el del gabinete, bajo su faldón. En la cama la pata sube por dentro del marco hasta la plataforma, cara con cara con las tablas a las que se atornilla: solo se adelgaza lo que asoma bajo el marco (`legHeight`). Le cuesta al experto unos 35 tokens por petición del gabinete. No medido con `npm run compare` (diferido hasta 1.0).
- **Patas en la cama (`legs: 'none' | 'legs'` + `legHeight`):** las patas van dentro del marco, del piso a la plataforma, atornilladas a las caras del piecero o la cabecera, del costado y de un travesaño (antes solo tocaban el canto de abajo del marco y no llevaban unión ni tornillos); `legHeight` sigue siendo cuánto sube el marco, con la misma regla de altura que el gabinete (100 a 300 mm, 150 por omisión, el alto de la base incluye las patas: el marco mide alto − patas y no baja de 200 mm, si no «No cupo»). Cuatro patas de 36 × 72 en las esquinas por dentro y más a lo largo de cada costado, contra un travesaño, si el claro pasa `MAX_SPAN`. Una cama con cajones no lleva patas (el zoclo sostiene el banco): el campo se oculta con su razón y la ficha con las dos cosas se rechaza. Las fichas viejas siguen valiendo (`none`). Sin R4, R5 ni R7 nuevos en las variantes del banco. No medido con `npm run compare` (diferido hasta 1.0).
- **Fila de patas bajo la espina (`spineLegs`):** de la matrimonial en adelante, una cama sobre patas lleva una tercera fila al centro, una pata junto a cada una de las de un costado (cabecera, pie e intermedias), del piso a la plataforma y atornillada a la cara de la espina. Así la espina descansa en vez de colgar a tope de las tablas de sus extremos. La individual no la lleva: entre sus dos filas quedan 840 mm. Decidido el 2026-10-08 con el panel: Don Rigo y Tomy la pedían desde la matrimonial y la Inge desde la queen (la flexión de la espina pasa; lo que no tiene número es su unión). Se construye desde la matrimonial por criterio de taller y R7 no ganó un umbral: sigue en 1 200 mm, así que la matrimonial (1 190) no se marca aunque le falte. La ficha avisa que en piso desnivelado se calza la pata que no asiente. Subirla a queen es cambiar `spineLegs`.
- **La plataforma en dos mitades solo descansa en la espina (`spineSeats`):** de la matrimonial en adelante la plataforma va en dos tableros que se encuentran sobre el canto de la espina, y a cada uno le tocan 9 mm de ese canto. Ahí no va tornillo: caería en la junta, a 4.5 mm de la orilla del tablero, y la referencia pide unos 13 para un #8 (`uniones-y-herrajes.md`). Cada mitad se pega a la espina y se atornilla al costado, a los extremos y a los travesaños o divisores que cruzan debajo; la unión se declara con 0 tornillos, que es como una unión dice «solo descansa» (igual que la tablilla en la tabla del listón pegada al costado), y la ficha de la pieza lo escribe así. Decidido el 2026-10-08 con el panel: doblar la espina para darle 18 mm a cada mitad subía una hoja en 60 de 172 variantes y dejaba el tornillo a 9 mm, todavía corto. Una cama desarmable conserva lo que la unión decía de sus tornillos (`knockDown`): antes los volvía a contar por el largo del contacto, y a una cama de tablillas con pernos le ponía dos tornillos donde la tablilla solo descansa. Una cama de un solo tablero (individual) sigue atornillada a la espina: la cruza entera.
- **La cabecera sube de la base, y el formulario dice el fondo que se construye (2026-10-08):** una cabecera lisa, o los brazos y el respaldo de una cama de día, que no pasan del alto de la base se rechazan (`headboardRises`); antes se construían al ras de la plataforma y el resumen seguía dando su alto. Una cabecera librero o con compartimento ya tenía su regla (`headboardFits`). Y con `headboard.depth: 0` esas cabeceras se construyen de 250 mm: el campo «Fondo» ahora muestra 250 y no 0.
- **Cama de día (`headboard.style: 'daybed'`):** un respaldo a lo largo del costado sin cajones y un brazo en cada extremo, al alto de la cabecera; la plataforma queda entre ellos en vez de apoyarse encima, y la cama crece el grueso del respaldo para que el colchón conserve su holgura (antes le quedaban 2 mm). El respaldo tiene el papel de trasera: unido a los dos brazos y a la plataforma, escuadra la base y R5 no la marca. Cajones de un solo lado (el respaldo va del otro; sin cajones, a la derecha) y sin patas, porque brazos y respaldo llegan al piso; elegirla en la ficha arregla las dos cosas. Nadie revisa todavía el respaldo como respaldo (alguien que se sienta y se recarga lo empuja de lado): no hay un valor en `docs/carpinteria` para esa carga. No medido con `npm run compare` (diferido hasta 1.0).
- **Brazos en diagonal de la cama de día (`headboard.arms: 'sloped'`):** a cada brazo se le corta la esquina de arriba al frente (`Piece.slants`, D60), del lado contrario al respaldo. Es de vista: el brazo se sigue comprando y revisando como tablero entero. Lo único que cambia de verdad es el copete del brazo, que llega hasta donde empieza el corte para no quedar volando. El corte nunca baja hasta el tope del colchón, que se atornilla a la cara del brazo: en un brazo bajo es menos hondo, y en uno demasiado bajo no se hace y la nota lo dice. La otra esquina de arriba no se corta nunca: ahí llega el respaldo, que escuadra la base.
- **Remates y frentes de la cama (`lip`, `headboard.cap`, `drawers.mount/style/pulls/corners/fingers`):** todos opcionales; una ficha sin ellos se arma igual que antes. El tope del colchón va sobre la plataforma en cada orilla que no cierran la cabecera, los brazos o el respaldo (en una cama de día, solo el frente), y la cama crece su grueso por cada uno para que la holgura no cambie; sin cabecera, también sube el alto total. El copete es una tapa sobre la cabecera (y sobre los brazos y el respaldo de una cama de día) que vuela solo hacia el colchón: por fuera queda al ras, porque las piezas no pueden salirse de las medidas del mueble (`E_OVERALL_SIZE`); si la cabecera es tan baja que chocaría con el tope, no se pone y se dice. Con frentes sobrepuestos, los divisores y zoclos de ese lado se meten un grueso, el costado cerrado tapa el divisor de junto y cada frente llega a la mitad del divisor que comparte. Los 40 y 20 mm son sin referencia (`MODULE_SOURCES`). No medido con `npm run compare` (diferido hasta 1.0).
- **Colchones y espesor de la plataforma (revisión de carpintero, 2026-10-08):** `MATTRESSES` son las medidas mexicanas de `valores-de-referencia.md` §11 (individual 1000 × 1900, queen 1500 × 1900, king 2000 × 1900); antes eran una mezcla que no era ni la mexicana ni la de EE. UU. y la base de una king salía 50 mm angosta. Como el king es más ancho que largo, `bed.mattress-fit` compara lado corto con lado corto. No hay medida libre: la ficha dice que se mida el colchón. `bed.board` (R10) avisa de una plataforma de menos de 18 mm y es crítica bajo 15; las tablillas siguen en `bed.slats`. Tres notas nuevas en la ficha: el buró tapa los cajones junto a la cabecera, una base de más de 1.8 m por lado no se dobla como el colchón, y no pararse en una sola tablilla. `bed.height` (R10) es recomendación fuera de 250–450 mm de base (`muebles-y-medidas.md` §2.7): la ficha sigue dejando patas de hasta 300, que con los 200 del marco dan 500 y reciben el aviso, y el banco arma hasta 250. La cama de día avisa en su ficha cuando el respaldo sube menos de 30 cm sobre un colchón de 26; los 30 son criterio de taller, sin fila en la referencia (`BACKREST_RISE`). La revisión antes de comprar ya no dice «Estructura firme» ni «Aguanta»: dice que pasó la revisión, que es lo que se comprobó. No medido con `npm run compare` (diferido hasta 1.0).
- **Tramos de la cabecera librero o con compartimento (`headBays`):** las repisas de una cabecera profunda ya no cruzan la cama en una tabla (984 mm en individual, hasta 1984 en king): van por tramos, los menos que dejen cada repisa dentro del claro que R1 da por bueno con carga media, con un divisor entre uno y otro, del piso de las repisas al techo (un divisor en individual, dos en matrimonial y queen, tres en king). En la de compartimento el divisor se para sobre la tapa y detrás del frente: el compartimento queda entero, y su tapa y el piso de la cabecera no llevan divisor porque se apoyan a lo largo en el fondo y en el frente. Sin repisas no hay divisores. Se decidió el 2026-10-08 sin contar la trasera como apoyo de la repisa: cuánto carga una trasera pegada no está medido, y dos metros de repisa sin apoyo no van con ninguna respuesta.
- **Armado desarmable (`assembly: 'glued' | 'bolts' | 'cams'`, en cama, mesa y gabinete):** una ficha sin el campo es `glued` y se arma igual que antes. Desarmable no es desarmar a tableros sueltos: el mueble se parte en bloques que se pegan y llegan armados, y solo lo que une un bloque con otro va sin pegamento (§8.4). En la cama los bloques son la base entera (espina, costados, divisores, travesaños, zoclos, patas y sus extremos bajos), la cabecera, el brazo del pie y el respaldo de la cama de día, cada uno con su copete, y la plataforma con sus topes. La base mide lo que el colchón y se carga de canto; lo alto va aparte porque es lo que la vuelve voluminosa. Es una recomendación, y la nota lo dice: quien arma puede pegar también esas uniones. Una cama sin cabecera queda sin herraje: solo se quita la plataforma. En la mesa los bloques son cada extremo (sus patas con su faldón corto, o su costado, y la cajonera de un escritorio), los faldones largos con sus travesaños, la repisa baja con sus apoyos, cada pata intermedia y la cubierta, que se atornilla encima. El gabinete es una sola caja: si llega armado a su lugar (`needsKnockDown` dice que no hace falta) se pega entero y no lleva herraje aunque el plan diga `bolts` o `cams`; si no, se desarma tablero por tablero como antes, porque todavía no se puede partir en dos cuerpos. El herraje (perno M6 con tuerca de barril, o minifix con dos tarugos sueltos) va donde un tablero vertical atraviesa hacia el canto de otro; lo que va acostado sobre el armazón (plataforma, cubierta), los remates y la trasera se atornillan en sitio sin pegamento, como dice `fabricacion-y-armado.md` §8.4. Un perno pedido en tablero de menos de 18 mm se vuelve minifix. `needsKnockDown` dice cuándo una pieza no llega armada a su lugar (puerta, techo y escalera de §8.2 y §8.3); **no cambia ninguna ficha sola**: las de referencia que lo cumplen lo traen escrito, y al experto se lo pide el prompt. Lo que no se sabe: no hay prueba del perno en triplay de pino, y su separación (dos por unión, uno más cada 400 mm) y su precio son de Knotty. La zapatera no lo lleva. Armado, el 3D muestra la cabeza del perno por fuera y su tuerca o la excéntrica del minifix (a 34 mm del canto) en la cara que mira hacia adentro del mueble, o por debajo si el tablero va acostado: son lugares típicos que pone Knotty, no una plantilla de barrenado. La parte «Armado» lista cada unión con herraje por el nombre de sus dos piezas. No medido con `npm run compare` (diferido hasta 1.0).
- **Trasera del gabinete cuando no cabe en una hoja:** una caja de varias columnas cuya trasera entera mide más que la hoja útil (acostada o parada) la lleva por columna, como ya pasaba con un vacío (D53): las tablas se encuentran a la mitad de cada divisor. Una sola columna más ancha y más alta que la hoja se sigue rechazando: no hay divisor donde unir dos tablas, y a ese ancho sus entrepaños ya no aguantan. El caso `bookcase-wide-books` del banco fallaba por esa trasera; no se volvió a medir con `npm run compare` (diferido hasta 1.0).
- **Lo que arma un módulo se corta en milímetros enteros (`wholeMillimetres`):** un módulo coloca tableros a una fracción de un hueco que solo conoce por sus caras, así que la fracción se ajusta cuando esas caras ya tienen medida y todo lo demás la sigue por referencia: no hay un redondeo aparte que contradiga la geometría que leen el contacto y las reglas. Lo que forma un hueco (divisor, entrepaño, repisa) va al milímetro más cercano, y la mitad exacta hacia donde el hueco empieza: el milímetro que sobra queda en el último. Lo que entra en un hueco (la hoja de dos puertas, una corrediza) solo se acorta: la holgura absorbe el milímetro impar y nunca queda menor que la diseñada. Lo que se mueve a mano sobre el diseño (una medida con decimales, `distribute`, una pieza del experto) todavía puede dar fracción; por eso la lista de corte sigue redondeando y la de la maderería sigue diciendo «(redondeado)».
- **Medidas de una ficha (`PLAN_MEASURE`):** cada medida de fuera (alto, ancho o largo, fondo, y el alto de la base de una cama) va de 100 a 2400 mm. Es una regla de cada módulo (`measureRules`), no del esquema: así el formulario la dice por el nombre del campo, y una ficha del experto fuera de rango vuelve una vez con el motivo, como cualquier otra regla, en vez de irse pieza por pieza; lo que el experto ve no cambia. Los límites son de Knotty, sin fila en la referencia: los rangos de `valores-de-referencia.md` son lo usual y los avisan las revisiones de uso (R10).
- **Ranuras de las corredizas (D59):** además de la unión `dado`, cada ranura es un saque (`Piece.cuts`) en el tablero de abajo y en el de arriba de su hueco, de pared a pared, la de arriba al doble de hondo y las dos 1 mm más anchas que la hoja por lado (`withTrackGrooves`). Así se ven en el 3D y la lista de cortes cuenta esos tableros entre los que llevan «saques o ranuras»; como todo saque, no cambia la medida del tablero ni la compra. Se quedan en ranura fresada y no en riel comprado: el riel doble de plástico no se encontró a la venta en México (solo importado), y lo que sí hay en mostrador (riel de piso con carretillas, Ducasse D-52, perfil de vitrina) no publica cuánto se descuenta a la hoja. Donde se eligen corredizas se dice que piden router.
- **`kick: 'kitchen'` (gabinete):** con `base: 'kick'`, el zoclo de cocina mide 100 mm de alto y va 50 remetido (`KITCHEN_KICK`), contra los 70 × 30 de recámara y sala; una ficha sin el campo se arma igual que antes. Es una elección del plan y no sale del tipo del mueble: el plan no sabe qué mueble es, y una isla o una despensa llevan el mismo zoclo que un gabinete bajo. El tipo `kitchenBase` solo decide los avisos de uso (`kitchen-base.height`, `kitchen-base.depth`).
- **`legs` (mesa y escritorio):** `panel` (por omisión; una ficha sin el campo se arma igual que antes) o `legs`. Con `legs`, cuatro patas rectas de 36 × 72 mm (las del gabinete) de piso a cubierta reemplazan los dos costados de panel, con faldón por los cuatro lados y patas de en medio si el claro pasa el máximo de R7 (1 200 mm). No hay `legHeight`: el alto de la mesa es el largo de la pata. Con cajonera, ese lado conserva su panel y las patas van en las otras dos esquinas. Sin faldón no se soporta (bambolea). No medido con `npm run compare` (diferido hasta 1.0).
- **`use: 'standing'` (mesa):** una superficie para trabajar de pie, banco de taller o escritorio de pie, con su tipo `workbench` («una mesa de trabajo»). R10 la juzga de 850 a 1 100 mm (`workbench.height`): del banco de taller de `muebles-y-medidas.md` §2.1 a la barra alta. Carga pesada en la cubierta, así que los travesaños bajo ella se reparten con el claro máximo de R1 para esa carga y no con los 600 mm de siempre; en las demás mesas no cambia nada. Lleva repisa baja y no cajonera. Una cubierta doble o de caja de torsión no se dibuja. No medido con `npm run compare` (diferido hasta 1.0).
- **Los cortes (`Piece.cuts`) solo se dibujan.** No cambian la lista de corte, la compra ni las reglas: la pieza sigue siendo el tablero entero. El experto no los ve. La lista de corte sí lo dice bajo la medida de cada renglón (`afterCut`): cuántos de sus tableros llevan después un corte diagonal (`slants`), esquinas redondeadas (`rounds`), un barreno (`holes`) o saques y ranuras (`cuts`), para que la maderería entregue el rectángulo y la persona sepa qué le falta.
- **Quién decide el tipo** (`settleKind`): la persona siempre, y nada la pisa salvo ella; después ejemplo o ficha, foto y palabras, y a igual confianza el más nuevo. Un uso afina la palabra de su módulo. El tipo pasa de versión en versión (`addVersion`), igual que el acabado y los cantos: un gabinete rearmado desde su ficha sigue siendo librero.
- **Cambiar de módulo no convierte la ficha:** se ofrece «Rehacer como…», que diseña de nuevo con las medidas de antes solo como referencia.
- **Las referencias (`adapters/references/`) llevan su `expect` y `npm test` lo recalcula.** Un cambio del motor que mueva una compra o agregue un aviso falla con la línea exacta, y el diff que lo acepta enseña qué cifras cambiaron. Una referencia cambia de versión cuando cambian sus datos.

### Prompts y el experto

- **Ningún número del oficio va escrito en un prompt**: dice `{{nombre}}` y el valor sale del código que lo hace cumplir (`promptValues.ts`); una prueba falla si uno vuelve a aparecer. Así el experto oye lo que Knotty de verdad revisa.
- **El experto ve un plan; Knotty ve las piezas.** Al ajustar una ficha viva el experto recibe la ficha, la revisión con códigos y la conversación, no el diseño en JSON ni la geometría (`buildPlanContext`). Mandarle las piezas cuesta miles de tokens que solo sirven para escribir operaciones.
- **El enrutado por tipo ahorra tokens, y una guía por tipo no le cuesta a los demás.** Si se sabe el mueble, el esqueleto y el ajuste llevan solo su módulo, su campo del esquema y, si existe, la guía de su uso (`kinds/`); sin tipo va el genérico con todos. El id de la combinación (`skeleton@N+módulo@N+uso@N`) queda en la versión y en la bitácora para saber qué leyó el experto. Un tipo sin módulo va directo a pieza por pieza.
- **El criterio de oficio y las herramientas son bloques opcionales al final del prompt** (`prompts/craft/`): los elige `selectKnowledge`, quedan en el id (`+core@N[+tools@N]`) y sin selección el prompt y su id son idénticos a los de siempre. La lectura de fotos solo recibe el núcleo de foto, sin herramientas.
- **El prompt base y el criterio de oficio no se contradicen.** Se pregunta solo lo que cambia la decisión (si la petición ya lo responde o un supuesto es seguro y fácil de deshacer, se responde y se declara); `acceptedRisks` se llena solo tras explicar qué se acepta, y un «ok» o «dame tu visto bueno» general no lo es; y una aprobación cubre solo lo que se revisó, dejando abierto cualquier riesgo planteado antes. La sierra circular y la caladora ya no se suponen: las trae la persona o no existen (`system@12`, `adjust@12`, `plan-adjust@13`, `core@2`).
- **La guía de un uso llega a las seis llamadas, no solo al esqueleto y al ajuste de ficha.** Su cuerpo va completo a esqueleto, ajuste de ficha y reconstrucción; a ajuste y revisión de compra solo llega la sección `# short` del archivo (sin ella no mandan nada), después del núcleo y las herramientas, y el id lo dice (`…+core@N+tools@N+uso@N`). La lectura de fotos nunca la lleva. Sin plan, el módulo sale del uso.
- **Hay campos que el experto nunca escribe:** `kind`, `kindSource`, `mattress`, `pulls`, `finish`, `edgeProfiles`, `rods` y `cuts` son de Knotty o de la persona, y sus esquemas los dejan fuera. El acabado, los cantos y el tipo sí pasan de versión en versión aunque el diseño nuevo no los traiga.
- **`planDesign` / `adjustPlan` nulos en un proveedor significan pieza por pieza.** Es el respaldo caro (minutos): por eso el esqueleto se reintenta una vez antes de rendirse (con lo ilegible como corrección), y la ficha inválida vuelve una vez con sus errores.
- **Una cancelación no se reintenta** (`expertCall` relanza el error original); ni en el esqueleto, ni en la corrección, ni en la revisión de compra.
- **Una ficha pasa por el mismo juez que pieza por pieza** (`judge()`, pura y con pruebas por tabla): preguntas pendientes o quitar estructura que no se pidió esperan a la persona; los críticos nuevos de una ficha van a pendiente sin vuelta extra, porque Knotty ya construye esas opciones.
- **Knotty entiende solo lo que se lee de una sola manera** (`parseIntent`): una negación, una duda, una pregunta, una foto o una palabra desconocida van al experto. Ante la duda, al experto: una lectura equivocada cuesta más que una llamada. **Varios cambios en un pedido** («de 2 m de alto y 40 de fondo», hasta tres, unidos con «y» o coma) se parten y cada parte se lee contra la ficha que deja la anterior; se toma todo o nada: si una parte no se lee de una sola manera, o dos partes mueven el mismo campo a valores distintos («quítale las patas y ponle zoclo»), el pedido entero va al experto. El mismo cambio dicho dos veces («mejor con zoclo, sin patas») es uno. Los cambios entran juntos, en una sola versión (2026-10-08). **Los huecos de un gabinete, sin decir dónde** (`openingsIntent`, 2026-10-08): «ponle puertas» pone puerta en cada hueco abierto (dos hojas si el hueco pasa de 600 mm de ancho), «quítale las puertas» los deja abiertos y «divídelo en dos columnas» repite su única columna. Lo que nombra un lugar («la puerta de la izquierda», «el hueco de abajo») sigue con el experto, igual que «ponle puertas» en un mueble que ya tiene alguna (no dice dónde van las nuevas; «a los huecos abiertos» sí) y que cualquier cuadrícula con un hueco partido, un baúl o un vacío. Decidido con el panel: las posiciones se quedan en el formulario, donde se toca el hueco. Todo se lee de los campos y etiquetas de la ficha, así que un módulo nuevo lo entiende sin tocar nada.
- **El conteo de puertas y cajones pedidos solo corrige al gabinete** y solo si cada mención trae una cuenta clara (`askedParts`). Una parte con lectura dudosa no se revisa: una corrección falsa es peor que dejar pasar.
- **El espacio de la persona es un límite, no las medidas del mueble.** `measures` es solo para medidas exactas y mandan sobre el espacio; si el mueble se pasa del espacio, el experto lo dice en el chat.

### Acabado, compra y cantos

- **El acabado es del diseño entero**, no de una pieza, y es una versión propia (`chooseFinish`), no un campo del plan. Un diseño que reconstruye la ficha o escribe el experto conserva el actual.
- **Elegir acabado o cantos no pide otra revisión de compra** (`reviewed()` los quita de la firma). La revisión sigue al contenido estructural del diseño, no al número de versión.
- **La compra es determinista y el experto solo puede endurecer un veredicto** (`worst`). La revisión lee el `Analysis`, no vuelve a calcular lo que `analyze()` ya sabe; si el carpintero no contesta, la revisión se sostiene con las cuentas.
- **Lo que la referencia no da se queda vacío y dicho** (rendimiento de una laca, secado, precios): la lista de compra le dice a la persona que lo pregunte en la tienda, no inventa un número. El sellador que es el mismo barniz diluido cuenta como mano entera: se compra de más, no de menos.

### Banco y comparativo

- **Una variante del banco con avisos es un error de Knotty**, no del experto: `bench.test.ts` revisa todas las variantes de cada módulo.
- **Un resultado de `npm run compare` solo vale si mide `origin/main`**; el script avisa cuando no es así. Solo `scripts/compare/baseline.json` vive en git; las corridas (`scripts/compare/results/`) se ignoran.
- **Guardar una corrida y fijar la base son cosas distintas.** Toda corrida tiene identidad y manifiesto (commit, estado, hashes de casos, calificador, prompts, esquemas y catálogo) y guarda las respuestas reales del experto; la base solo cambia con `compare:promote --accept`, de una corrida completa, reproducible y sin fallos sin declarar, en el PR que cambia lo que ve el experto. Ningún script la escribe solo.
- **Solo se comparan resultados compatibles.** Una base de otra versión del calificador, el catálogo, el corpus o el proveedor no se compara; que los prompts o los esquemas cambien no lo impide (es lo que se mide) y solo se lista como variación, aunque sí impide reanudar; una sin identidad se compara por caso y lo dice. Un fallo es regresión, falla conocida (`knownFailures.ts`) o infraestructura (tiempo límite o 429 del proveedor, fuera de las tasas). Declarar una falla conocida la etiqueta, nunca la pone en verde.
- **La corrida en vivo no es determinista; la calificación y el replay sí.** SheLLM ignora la temperatura del adaptador de Claude: lo que se promete es que las entradas, el calificador y `compare:replay` sean reproducibles, y lo vivo se mide con repeticiones. Reanudar solo repite lo pendiente de una corrida compatible y ningún intento anterior se descarta.
- **Con SheLLM, los tokens de entrada se comparan con la llamada más baja de cada prompt**: envuelve al CLI de Claude, que suma un prompt de sistema cacheado propio. Los presupuestos de tokens de `prompts.test.ts` frenan el crecimiento y están en caracteres ÷ 3.5: no cuentan tokens reales (el JSON gasta más).
- **Un requisito de espacio es la medida del mueble completo**, nunca de una parte: el experto anotaba «cada escalón mide 25 cm de fondo» y la app rechazaba su propio diseño. Un caso del banco puede nombrar su camino (`path`, ficha o pieza por pieza) y, si el diseño llega por el otro, cuenta como no razonable.
- **Un caso del banco ambiguo a propósito se queda ambiguo.** `sideboard` no dice «contra el muro»: un R4 crítico ahí significa que el experto no aplicó la regla, no que la persona pidió algo inseguro. Sin la variante explícita no se sabría si falló leer el acomodo o las cuentas.
- **El buscador cambia el mueble del Studio de verdad, sin sandbox** (`swapTo`, `swapLoss`): directo si lo abierto es una ficha tal como se abrió (una sola versión, sin mensajes de la persona, notas, bandeja, avisos aceptados, candados ni revisión) y con confirmación si se perdería algo suyo, una captura a medias o una corrida del experto. Es para todos (`Ctrl+K`) y busca por nombre, cuarto, estilo o modelo (`found`); una dirección con `?ficha=<código>` abre esa ficha bajo la misma regla y el Studio la copia desde su encabezado (`fichaLink`). **La dirección solo dice opciones con nombre y valores que Knotty enumera** (`LINK_OPTIONS`: `acabado`, `armado`, `material`), nunca el plan entero: un plan empacado se rompería con cada cambio de esquema, y una opción que ya no existe solo se ignora y la ficha abre como viene. Las palabras valen igual después del `?` que del `#`; con el acceso de depuración suma la versión y los hallazgos de cada ficha. El banco, las fichas y la bitácora dejaron de ser cajones de la app (2026-10-09): el banco corre en `npm run compare` y en `bench.test.ts`, y lo que los sustituya está por definirse.
- **Una variante del banco con un aviso de geometría («se tocan pero no tienen unión») es un error de Knotty**, igual que una con hallazgos: `bench.test.ts` lo exige (`ModuleCheck.warnings`). Tres cosas no piden unión: dos tableros del mismo rol, en un mismo plano y canto con canto, mientras un apoyo unido a los dos deje cada tramo de la junta dentro del claro de una plataforma (`supportedSeam`); dos partes ya unidas entre sí (una cabecera y la base) que se tocan en un canto (`joinedParts`); y una pata que se atornilla a las caras contra las que está.
- **«Exportar ficha» entrega una candidata, nunca escribe la ficha** (`candidateOf`): solo si el diseño sigue siendo su plan (sin cambios pieza por pieza), y lo que descarga es lo que `probe --diff/--adopt` ya acepta.
- **Un mensaje de las reglas habla de las piezas por su nombre** donde la persona lo lee (`named`), y el taller marca en el 3D las piezas de un aviso (`flag`, solo vista, como `hidden`).

### Historial y sesión

- **La bitácora cuenta solo las llamadas al experto**; lo que Knotty resuelve solo deja un renglón «Knotty, sin experto», sin prompt ni tokens.


## Preguntas abiertas
- R5 en un mueble abierto que no es caja: se juzga por caja (ver «Invariantes») y tiene solución construible (fajas). Queda: ¿aplicarla sola en el primer diseño, como una reparación por reglas? Y la regla todavía ignora los `brace` diagonales que ponga el experto.
- R5 y el anclaje al muro: resuelto con condiciones en D50. Queda abierto que el modelo no sabe dónde va el anclaje (`wallAnchored` es un booleano) y que el argumento es de estática, sin ensayo.
- Patas de la cama: las patas bajo la esquina de lateral y cabecera dan unos 18 × 36 mm de contacto. ¿Alcanza esa unión, o hace falta otra?

- Precios y SKU reales de triplay de pino 12/15/18 mm y trasera 3/6 mm en Home Depot MX.
- Calibrar E del triplay de pino con una prueba casera (entrepaño cargado, medir flecha) cuando haya app.
