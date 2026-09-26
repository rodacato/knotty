# Despiece — Propuesta de diseño

Web app que convierte fotos de un mueble en un diseño 3D de triplay que se explora y se ajusta conversando con un carpintero experto (un LLM). No hay edición manual: todo cambio se pide en lenguaje natural. El objetivo final es saber cómo se arma y cuántas hojas de triplay comprar.

Este documento es la referencia viva del proyecto. Las decisiones tomadas se anotan en [Decisiones](#decisiones); lo pendiente de discutir, en [Preguntas abiertas](#preguntas-abiertas). El conocimiento de carpintería (material, uniones, medidas, estructura, términos) vive en [`docs/carpinteria/`](carpinteria/README.md).

---

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Dominio, casos de uso y código de negocio en español | Es el lenguaje del problema y del usuario |
| D2 | La fuente de verdad es un modelo paramétrico con **cotas que referencian caras** de otras piezas | Cambiar un ancho o un espesor se propaga de forma determinista, sin pedirle al LLM que recalcule |
| D3 | El LLM propone **operaciones tipadas**; el dominio las aplica y valida | El LLM nunca regenera el modelo completo en un ajuste |
| D4 | Un cambio con un problema estructural crítico nuevo se muestra como **vista previa** con opciones, no se aplica directo | "Si algo no se puede determinar, pregunta en vez de suponer" |
| D5 | Los requisitos del usuario no se revierten al volver a una versión | Son hechos del mundo ("mi espacio mide 90 cm"), no del diseño |
| D6 | La compactación del contexto es determinista (sin llamadas extra al LLM) | Costo y previsibilidad |
| D7 | Material base: **triplay de pino**, E = 6 000 MPa (veta paralela) / 3 500 MPa (perpendicular) | Es el que se consigue en Home Depot MX; valores conservadores, calibrables |
| D8 | Cajones fuera de la primera fase; entran después como grupo de piezas | Validar primero lo esencial |
| D9 | BYOK tomado de [ai-town](https://github.com/rodacato/ai-town) (`src/providers/llm/`), corrigiendo lo pendiente de su `docs/REVIEW-1.0.md` §3 | Reusar lo que ya funciona |
| D10 | Solo piezas ortogonales (prismas alineados a los ejes) | Cubre el triplay DIY; las piezas inclinadas quedan fuera de alcance |
| D11 | Stack: Vite, React 19, TypeScript, Zod 4, Vitest; three.js + react-three-fiber + drei + postprocessing + @react-spring/three; Radix, Tailwind v4, Zustand, Phosphor, Fontsource. Sin Pixi.js | El centro es 3D; Pixi es 2D y sumaría un segundo motor gráfico |
| D12 | Fronteras de capas verificadas con un test de arquitectura (Vitest) en vez de ESLint | TypeScript 7 aún no tiene soporte estable en typescript-eslint; el test no agrega dependencias |
| D13 | Dirección de arte "maqueta sobre el banco de trabajo" (ver §1) | Sensación física y dinámica, no de visor técnico |
| D14 | En celular, 3D arriba y panel abajo con un botón para cambiar la proporción, en vez de una hoja arrastrable (se quitaron vaul y Motion) | El 3D nunca queda tapado y el diseño es más estable; las animaciones de interfaz se resuelven con CSS |
| D15 | Salida estructurada con `output_config.format` (Anthropic) y `response_format: json_schema` (OpenAI), no herramienta forzada | Algunos modelos nuevos de Anthropic rechazan `tool_choice` forzado |
| D16 | Ante un crítico sin opciones del experto, la app ofrece como botones las alternativas que calculó el motor | El usuario siempre tiene una salida concreta y el experto no tiene que inventarlas |
| D17 | Las cotas se dibujan como etiquetas dentro de la escena (sprites), no como HTML | El HTML de drei se perdía al remontar la escena |
| D18 | El repo se llama **Knotty** (*naughty knots*); la app sigue presentándose como Despiece por ahora | Nombre amplio y memorable para cuando crezca más allá del despiece |
| D19 | SheLLM como proveedor, compatible con OpenAI; si el host no acepta esquema estricto o imágenes, la app se degrada sola y lo recuerda | Funciona con el SheLLM de hoy y aprovecha lo nuevo sin cambios |
| D21 | Las decisiones de diseño se guardan con cada versión y se restauran al volver a ella; los requisitos no | Las decisiones describen el diseño; los requisitos, el mundo del usuario |
| D22 | Precios del catálogo estimados (no consultados en tienda) y editables en la app; los cambios de precio y de parámetros de corte viven en el dispositivo | Hay costo desde el día uno sin fingir precisión; el usuario los corrige con su tienda |
| D23 | Los cajones se piden con una operación compuesta (`agregarCajon`): el LLM da el hueco y el dominio arma las seis piezas, las uniones y elige la corredera | Colocar seis piezas con holguras de corredera a mano es frágil para un LLM; así el cajón siempre sale correcto y paramétrico |
| D24 | Marca Knotty: un nudo de madera como símbolo (pino con veta) y como la «o» del logotipo en Fraunces. La funcionalidad sigue llamándose despiece | Un símbolo de madera se entiende al instante y funciona desde el favicon de 16 px hasta el ícono de la app |
| D25 | También se puede diseñar sin fotos, con una descripción; el experto pregunta lo que falte y los cajones los ofrece como pregunta para armarlos con `agregarCajon` | Sirve para diseñar un mueble que todavía no existe o probar sin tener el mueble enfrente |
| D26 | Primer uso: las medidas son opcionales (el experto estima las típicas y lo dice), el pedido inicial queda en el chat, varias preguntas se contestan en un solo mensaje y el experto propone `sugerencias` de siguiente paso | Retroalimentación del primer uso: muchas preguntas una por una y medidas obligatorias frenaban el arranque |
| D27 | Para diseñar se pide conectar un experto real; el simulado queda como «ejemplos» y dice que no sabe cuando le piden otro mueble | El simulado siempre armaba un librero, lo que parecía un error del experto |
| D28 | Reintentar sin perder nada: la captura se conserva si falla y el chat ofrece reenviar el último pedido. Las peticiones compatibles se cortan a los 5 min y SheLLM explica qué revisar si no conecta | Una espera larga que termina en «no se pudo conectar» obligaba a empezar de cero |
| D29 | Hoja real de 2440 × 1218 mm (así la lista Home Depot MX) y refilado de 15 mm por orilla: hoja útil de 2410 × 1188 | Las orillas de fábrica llegan golpeadas; los optimizadores usan 5–6 mm por orilla en tablero de taller, y el triplay de tienda pide más sin tirar el 8 % que costarían 5 cm |
| D30 | La lista de compra aparece después de una revisión: primero cuentas deterministas (medidas, hoja útil, estructura, tiras, boceto, margen) y luego el dictamen del carpintero (prompt `dictamen@1`). El carpintero puede endurecer el veredicto, nunca suavizarlo; si no contesta, valen las cuentas. Si no es viable, la lista se ve solo a propósito | Que nadie compre material para algo que matemáticamente no se puede armar o que tiene un error de origen |
| D31 | Diseñar por pasos: lectura de cada foto (en paralelo y guardada), esqueleto de medidas y módulos, módulos convertidos en piezas por Knotty, reparación por reglas y, al final, detalles del experto. Cada paso guarda su resultado con la huella de lo que recibió y no se repite | La línea base con SheLLM mostró que casi todo el tiempo y el costo se iban en reescribir el diseño completo en cada reintento; en pasos chicos, cada uno se ve en cuanto llega |
| D32 | Nunca tirar un diseño pagado: si los intentos no pasan la validación, se muestra el último con los problemas marcados y se corrige desde el chat | Tres intentos fallidos costaban ~$0.33 USD sin mostrar nada |
| D33 | La interfaz y los textos para la persona quedan en español de México; el código (nombres, archivos, carpetas, lógica y comentarios), los datos guardados, los ids y los prompts van en inglés, y los prompts piden al experto que escriba en español lo que lee la persona. Se migró un módulo por PR, con migración de formato para lo guardado (terminada el 2026-09-25) | Pedido del autor el 2026-09-25; los datos, prompts y carpetas, pedido posterior del mismo día |
| D34 | Tres velocidades para cambiar el mueble: **instantáneo** (ficha, edición a mano y soluciones que Knotty construye), **agrupado** (lo que necesita criterio va a una bandeja y se manda al experto en un solo pedido) y **libre** (el chat, para lo creativo). El experto solo interviene donde aporta criterio | La revisión de uso mostró que cada decisión chica costaba un minuto de espera y que el experto se usaba para cosas que Knotty puede resolver |
| D35 | Todo cambio es un **cambio con origen y diferencias** (qué piezas se agregaron, quitaron o cambiaron) y se puede deshacer completo o por partes, sin experto | El experto quitó dos divisores sin que se lo pidieran y no había forma de regresarlos conservando lo demás |
| D36 | El experto no quita ni cambia estructura que no se pidió: si su respuesta lo hace, queda como propuesta que la persona confirma; si trae preguntas, sus operaciones esperan a las respuestas | Confianza: nada que sostenga el mueble desaparece sin permiso, con cualquier modelo |
| D37 | Las revisiones son **avisos con estado** (pendiente, viendo solución, resuelto, aceptado así) en un solo lugar, junto con las propuestas y preguntas del experto; cada aviso ofrece soluciones con vista previa en 3D, pedírselo al experto (a la bandeja) o aceptarlo así | El panel de Revisión informaba pero no dejaba decidir, y no había salida de «no hacer nada» |
| D20 | Llaves: no guardarlas, en la pestaña, o cifradas con frase (bóveda de ai-town). Al llegar, un aviso pide la frase o la llave que falte | Los pendientes de BYOK de ai-town `REVIEW-1.0.md` §3, adelantados de la fase 7 |

---

## 1. Experiencia y diseño visual

### Flujo

```
Inicio → Medidas → Fotos guiadas → El experto analiza → Preguntas rápidas → Estudio
                                                                          ├─ 3D + cotas
                                                                          ├─ Chat (ajustes)
                                                                          ├─ Revisión
                                                                          ├─ Materiales
                                                                          └─ Historial
```

- **Nuevo diseño**: alto, ancho y fondo en mm con el equivalente en cm debajo ("900 mm · 90 cm"). Después, captura guiada con ranuras con silueta: frente, lateral, 3/4, interior y uniones. Cada ranura abre la cámara o la galería (`<input capture>`). Frente y 3/4 son obligatorias; el resto, sugeridas. Cada foto lleva su etiqueta de ángulo, que se envía al LLM.
- **Análisis**: el estado de carga muestra etapas reales del caso de uso: "Mirando las fotos → Proponiendo piezas → Revisando que todo cierre → Revisando estructura". La animación es un trazo de lápiz de carpintero dibujando el contorno.
- **Preguntas**: tarjetas en el chat con respuestas en botón, por ejemplo "¿La trasera va clavada o en canal? [Clavada] [En canal] [No sé]". Si falta una foto: "Tomar foto del interior". Las piezas de baja confianza se ven rayadas en 3D hasta confirmarse.
- **Estudio**:

| Móvil | Escritorio |
|---|---|
| 3D arriba (~55 % del alto) con barra flotante: Frente · Lado · 3/4 · Arriba · Explosionar · Cotas | 3D grande a la izquierda con la misma barra |
| Hoja inferior arrastrable (asomada / media / completa) con pestañas Chat · Revisión · Materiales · Historial | Panel lateral de ~400 px con las mismas pestañas |
| Entrada del chat fija abajo, con chips de respuesta rápida | Igual |

- **Vista de armado**: cada pieza se separa del centro del mueble en dirección de su normal, con un resorte suave de ~600 ms. Al tocar una pieza, las demás quedan al 15 % de opacidad y aparece una ficha: nombre, medidas en mm y cm, espesor, veta y uniones ("→ Lateral izq.: 3 tornillos de bolsillo 1¼"").
- **Cambios en vivo**: las piezas afectadas brillan en ámbar y se asientan; las nuevas crecen desde su cara de apoyo; las eliminadas se desvanecen como fantasma; las recorridas por propagación se interpolan. El diff entre versiones es determinista.
- **Propuestas con consecuencias**: vista previa (piezas nuevas en fantasma) con botones como `[Aplicar con divisor al centro] [Aplicar así, bajo mi riesgo] [Cancelar]`.
- **Historial**: línea de tiempo vertical con número, resumen y hora. "Volver a v3" no borra nada: crea una versión nueva igual a v3.
- **Revisión**: observaciones agrupadas por severidad, cada una con "Pedir al experto que lo corrija", que prellena el chat.
- **Materiales**: lista de piezas, hojas por espesor con diagrama de acomodo (SVG, desperdicio por hoja) y herrajes con costo. El aviso "Estimación para compra, no es plano de corte" siempre visible.

### Dirección visual: taller moderno

- **Paleta** (tokens, con modo oscuro "taller de noche"):

| Uso | Color |
|---|---|
| Fondo | Hueso `#F5F0E8` |
| Superficies | Kraft claro `#EDE3D3` |
| Texto | Grafito `#2B2825` |
| Maderas en 3D | Abedul `#E2C9A2`, pino `#D9B27C`, nogal `#6B4A2E` |
| Acento | Ámbar de lápiz de carpintero `#D98A2B` |
| Crítico / Recomendación / Detalle | Óxido `#B4452F` / Ámbar / Pizarra `#56697A` |

- **Tipografía**: Fraunces (títulos), Inter (interfaz), JetBrains Mono con cifras tabulares (cotas y medidas).
- **3D**: luz cálida, sombra de contacto, aristas finas en grafito, cantos con la textura de capas del triplay, cotas estilo dibujo técnico.
- **Microinteracciones**: transiciones de cámara suaves (`CameraControls` de drei), vibración háptica al seleccionar en móvil, chips que se deshabilitan tras usarse.

### Arte: "maqueta sobre el banco de trabajo"

- **Del boceto a la madera**: mientras el experto analiza, el mueble aparece como trazo de lápiz; al validarse, cada pieza se llena de madera en cascada. Las piezas de baja confianza quedan en boceto con achurado hasta confirmarse.
- **Veta procedural**: shader sin texturas descargadas; sigue la `veta` del modelo. Cantos con las capas del triplay.
- **Escena**: iluminación de estudio con `Lightformer` (sin HDRI externo), piso con cuadrícula tenue tipo tapete de corte, sombra de contacto, cotas como líneas de lápiz fino.
- **Sabor de juego**: explosión con resorte y leve rebote; pieza nueva que cae a su lugar con un "puf" de aserrín; eliminadas como fantasma; pulso ámbar en afectadas; contorno ámbar y vibración al seleccionar. Sonidos de madera opcionales, apagados por defecto.
- **Interfaz**: papel kraft y hueso con textura apenas perceptible; severidades como sellos de tinta; medidas con regla deslizable tipo cinta métrica; lápiz que traza mientras el experto piensa, con la etapa real debajo.
- **Rendimiento**: `PerformanceMonitor` baja resolución y apaga postproceso en teléfonos lentos; densidad de píxeles máxima 2.

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
   │  │  └─ prompts/         system.v9 · reconstruction.v11 · skeleton.v10 · adjust.v10 · plan-adjust.v8 · reading.v3 · review.v4
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

- **Fronteras** comprobadas por `src/architecture.test.ts`: `domain/` solo importa zod y no toca el navegador; `application/` y `ports/`, dominio y puertos; `ui/`, todo menos `adapters/`. Dentro del dominio, cada grupo importa solo lo que hoy importa (paso 28): nadie importa `session/`; `design/` y `materials/` no importan `furniture/`, `editing/` ni `session/`; `checks/` no importa `editing/` ni `session/`.
- **Zod en el dominio** es aceptable: es TypeScript puro.
- **`LLMProvider` expresa intenciones**: `reconstruct`, `planDesign` (esqueleto), `adjustPlan`, `proposeAdjustment`, `readPhoto` y `reviewPurchase`. Anthropic, OpenAI y SheLLM comparten `common/` y `prompts/` y solo difieren en transporte; el simulado implementa la interfaz con reglas fijas. El ciclo de corrección vive en `application/` y se prueba sin red.
- **Salida estructurada**: los esquemas Zod son la única fuente; de ahí sale el JSON Schema. Por el modo estricto (sin `oneOf`, todos los campos requeridos) los esquemas usan uniones discriminadas por `op` y opcionales como `nullable`. Siempre se re-valida con Zod.
- **Prompts versionados**: cada archivo lleva frontmatter `id: system@9`; cada versión del diseño guarda qué prompt y modelo la produjeron.

### BYOK (tomado de ai-town)

Se reutiliza el enfoque de `ai-town/src/providers/llm/`:

- `config.ts`: presets por proveedor (`mock` = Simulado, `anthropic`, `openai`) con host, modelo y etiqueta; la configuración se guarda **sin llaves**.
- `vault.ts`: llaves recordadas **cifradas con frase de paso** (PBKDF2 600k + AES-GCM); si no, viven solo en memoria.
- `transport.ts`: `listModels` para elegir modelo de una lista; `describeError` con mensajes en español (key inválida, límite, CORS, timeout).

Cambios para Knotty (entonces Despiece):

- Simulado, Anthropic, OpenAI y SheLLM (una suscripción de Claude Code o Codex como API local), sin proveedor personalizado.
- Salida estructurada en vez de extraer JSON del texto: tool use forzado en Anthropic, `response_format: json_schema` en OpenAI. El campo `explanation` se puede ir mostrando mientras llega, con la técnica de `partialStringField`.
- Imágenes en la reconstrucción (content blocks de imagen en ambos proveedores).
- Se atienden los pendientes de `REVIEW-1.0.md` §3: al recargar se ve qué llave falta y se pide; desbloqueo claro con frase de paso; elección explícita entre "solo esta pestaña", "este navegador (cifrada)" o "no guardar"; si una consulta falla por llave, se ofrece arreglarla ahí mismo; tests del ciclo guardar → recargar → desbloquear → olvidar.
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
  requestedPhotos: { angle, reason }[]
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
- **Formatos**: hoy `format: 6`. `domain/session/migrate.ts` lee cualquier formato anterior, uno a la vez (1 en español, 2 con códigos en español, 3 con ids de herrajes viejos, 4 con la cara `mueble.`, 5 con la comprobación `aceptados`). Cambiar un campo guardado pide subir el formato y agregar su migración con prueba.
- Otras claves: `knotty:expert` (configuración sin llaves), `knotty:vault` (llaves cifradas), `knotty:tab-keys` (sessionStorage), `knotty:catalog-settings` (precios y corte). Lo guardado con las claves `despiece:v1:*` se mueve al leerlo (`adapters/storedKey.ts`).

---

## 5. Reglas estructurales

Los supuestos viven en `domain/checks/structure/assumptions.ts` como datos y cada regla en `domain/checks/structure/rules/`. Cada hallazgo devuelve `{ code, severity, pieces, message, data, alternatives }` (severidad `critical`, `recommendation` o `detail`): el LLM narra, no calcula. Las alternativas las simula el motor (siguiente espesor, divisor al centro, claro máximo con el espesor actual).

### R1 — Flecha de entrepaños

- Viga simplemente apoyada con carga uniforme: `δ = 5·q·b·L⁴ / (384·E·I) × k_fluencia`, con `I = b·t³/12`.
- L = claro libre entre apoyos (del grafo de uniones); b = fondo; t = espesor.
- Supuestos (desde el paso 21, los de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §1 y §4):
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

Hasta el paso 20 eran E = 6 000 / 3 500 MPa para todo espesor, fluencia 1.5 y crítico desde L/200.

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

- Mueble de guardado con cajones o puertas desde 686 mm de alto (ASTM F2057-23, [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §12): crítico si `wallAnchored = false`, sin importar el fondo ni el nombre (`check: 'tipping.storage'`). Se detecta por lo que tiene (frentes de cajón, puertas) y su alto; no aplica a camas, bancas, escritorios y mesas (sus cajones van bajos en un mueble largo o ancho) ni a la alacena, que tiene su propia revisión de colgado. Desde el paso 21; antes, la cajonera se anclaba desde 700 mm y con dos cajones, y el clóset desde 1 500.
- Sin cajones ni puertas: alto / fondo ≥ 3 → recomendación de kit antivuelco; crítico si alto > 1 200 mm, alto / fondo ≥ 4 y `wallAnchored = false`.

### R5 — Escuadrado

El casco necesita al menos uno de: trasera ≥ 6 mm fijada en todo el perímetro; trasera de 3 mm pegada en rebaje; o marco rígido (zoclo + faja superior + entrepaño fijo con bolsillo o tarugo). La regla y sus soluciones suponen una caja: un mueble abierto de varios marcos (un exhibidor escalonado) sale siempre crítico y sin solución que Knotty pueda construir; está en Preguntas abiertas. Si no: crítico con alto > 600 mm, recomendación si es menor.

### R6 — Puertas

Bisagras por alto, como la tabla de Blum de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §8: ≤ 900 mm → 2; ≤ 1 600 → 3; ≤ 2 000 → 4; ≤ 2 400 → 5 (desde el paso 23; antes 3 hasta 1 500 y 4 para lo demás). La bisagra es la del montaje de la puerta (`door.hinge-mount`): recta si tapa todo el canto, codo si lo comparte con otra puerta, súper codo si va embutida; embutida contra sobrepuesta es crítico y recta contra codo, recomendación. Ancho > 600 mm → recomendación de dividir en dos hojas.

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

## 7. Plan por fases

### Fase 1 — Validar la idea

Una rebanada vertical que responda: **¿un LLM puede sacar un modelo paramétrico razonable de fotos, y ajustarlo con operaciones que el dominio valida?** Desplegada en GitHub Pages para probarla desde el celular.

Incluye:

- Proyecto: Vite + React + TypeScript + Vitest + ESLint con fronteras de capas; CI y deploy a Pages.
- Dominio: esquema Zod, cotas y resolvedor, normalizador, todas las operaciones, validación geométrica, reglas **R1, R2 y R5** con alternativas, diff entre versiones. Tres fixtures (librero, buró, alacena). Tests.
- Aplicación: `ReconstruirDesdeFotos`, `AjustarDiseno`, `ResponderPregunta`, `NuevoDiseno`, ciclo de corrección, construcción de contexto.
- LLM: Simulado, Anthropic y OpenAI con BYOK básico (llave en memoria o en la pestaña; la bóveda cifrada llega después). Prompts v1.
- UI (tokens base, sin pulido final): medidas y fotos con etiqueta de ángulo; 3D con órbita, zoom, cuatro vistas y cotas generales; vista explosionada con selección y ficha; chat con respuestas rápidas y vista previa de propuestas; lista de piezas simple; persistencia en localStorage y "Nuevo diseño".

Fuera de la fase 1: historial visible, animación fina de cambios, acomodo en hojas y costos, revisión completa, captura guiada elaborada, cajones.

Criterios de éxito:

- Con fotos de 2–3 muebles reales, el modelo resultante es reconocible y válido tras ≤ 3 preguntas.
- De 5 ajustes guionizados ("refuerza la base", "hazlo de 90 cm", "que aguante libros", "baja una repisa", "agrega una puerta"), al menos 4 se aplican bien.
- "Hazlo de 90 cm" en el librero detecta el crítico R1 y propone el divisor.
- Usable en el celular.

### Fase 2 — Historial y cambios en vivo

Línea de tiempo, "volver a versión", animación de piezas afectadas, requisitos y decisiones visibles y editables.

### Fase 3 — Materiales

Catálogo editable, acomodo guillotina con diagramas SVG, herrajes, costo aproximado, aviso de estimación.

### Fase 4 — Revisión del experto

Reglas R3, R4, R6, R7, R8; reporte por severidad; "pedir corrección" desde el reporte.

### Fase 5 — Captura guiada completa

Ranuras con silueta, confianza por pieza en 3D, petición de fotos, preguntas afinadas.

### Fase 6 — Cajones

Grupo de piezas con correderas, reglas propias.

### Fase 7 — BYOK sólido y pulido

Bóveda cifrada con frase de paso y pendientes de `ai-town/docs/REVIEW-1.0.md` §3; modo oscuro, accesibilidad, rendimiento 3D, PWA opcional.

### Fase 8 — Diseño por pasos

Lo que mostró el comparativo con SheLLM (9 pedidos fijos, `npm run compare`): los diseños salen válidos con medidas razonables, pero 4 de 9 necesitaron reintentos por piezas encimadas y cada reintento reescribe el diseño completo (60–90 s y ~$0.13 USD cada uno). La fase cambia un pedido grande por pasos chicos, con Knotty haciendo lo que se puede hacer sin modelo.

| Paso | Quién | Qué ve la persona |
|---|---|---|
| 0. Forma aproximada por la descripción | Knotty | Silueta en boceto al instante, con frases de taller |
| 1. Lectura de cada foto, en paralelo y guardada por huella | Modelo | «Mirando la foto 2 de 3…»; una foto que falla se reintenta sola |
| 2. Esqueleto: medidas generales y módulos | Modelo, respuesta chica | Volúmenes en boceto |
| 3. Módulos convertidos en piezas y reparación por reglas | Knotty | El mueble ya sólido |
| 4. Uniones especiales, preguntas y sugerencias | Modelo, respuesta chica | El chat se llena |
| 5. Dictamen antes de comprar | Modelo | Ya existe (D30) |

- **Módulos**: como `agregarCajon`, el modelo elige el módulo y sus parámetros, y Knotty construye piezas, uniones y holguras; las piezas no se pueden encimar por construcción. Lo que no encaje en un módulo va como piezas libres, como hoy.
- **Reparación por reglas**: piezas encimadas (se recorta la de menor jerarquía hasta la cara de la otra), piezas flotantes (se pegan al apoyo más cercano), uniones sin contacto (se quitan), medidas que no cierran. Solo lo que no tenga arreglo vuelve al modelo, con un pedido chico sobre esas piezas. Cada reparación queda anotada y se puede deshacer.
- **Bitácora**: cada paso deja su renglón (qué se pidió, qué contestó, tiempo, tokens, errores, reparaciones), visible con «Ver qué pasó». Sirve para validar y afinar los prompts.
- **Nunca tirar un diseño** (D32).

Entregas, cada una útil por sí sola:
1. Bitácora y nunca tirar un diseño.
2. Reparación determinista de los errores comunes.
3. Lectura de fotos en paralelo y guardada.
4. Esqueleto y módulos con entrega por pasos, empezando por los módulos que piden los casos del comparativo: casco, cajonera, librero, base de cama y cabecera.

Riesgos: el catálogo de módulos es el trabajo grande; las reparaciones pueden cambiar algo que el modelo quería así (por eso se anotan y se deshacen); juntar lecturas de varias fotos sin contar dos veces la misma pieza.

### Fase 9 — Decidir rápido, con confianza

Nace de la revisión de uso del 2026-09-25. Todo gira alrededor de un solo modelo de interacción:

**Tres velocidades (D34)**
| Velocidad | Qué | Quién lo hace | Espera |
|---|---|---|---|
| Instantáneo | Ficha, edición a mano, soluciones de los avisos que Knotty construye (apoyo al centro, divisor, más grosor, faldón, antivuelco), deshacer | Knotty | ninguna |
| Agrupado | Soluciones que piden criterio, respuestas a preguntas, sugerencias | El experto, todo en un pedido desde la bandeja | ~10 s–1 min por pedido, no por decisión |
| Libre | Lo creativo o lo que no cabe en la ficha | El experto por chat; queda como extra sobre la ficha | lo que tarde |

**Cómo se conectan las piezas**
- **Cambio con diferencias (D35):** cada versión sabe de dónde vino (ficha, a mano, Knotty, experto) y qué piezas agregó, quitó o cambió. De ahí salen el historial visible, el «qué cambió» bajo cada respuesta del experto, «Regresar» por pieza y «Deshacer este cambio».
- **Avisos (D37):** un solo lugar para lo que espera una decisión: problemas de estructura y de uso, requisitos, problemas sin resolver, propuestas del experto (incluidas las de D36) y preguntas pendientes. Una burbuja en el encabezado cuenta los pendientes; cada aviso se resuelve con una solución instantánea con vista previa, se manda a la bandeja o se acepta así.
- **Bandeja:** junto a la caja del chat. Las soluciones que piden criterio, las respuestas y las sugerencias se juntan ahí; «Consultar al experto» manda todo en un pedido, y al volver cada aviso o pregunta se marca resuelto en su lugar.
- **Confianza (D36):** la red de seguridad convierte en propuesta cualquier respuesta que quite estructura no pedida; la propuesta aparece como aviso con «Sí, quítalos» / «No, déjalos».

**Acomodo de la pantalla**
- A la izquierda, el mueble en 3D: cotas legibles (tamaño fijo, líneas de referencia, ocultas de canto), medidas por pieza en la vista de armado, herrajes dibujados (correderas, bisagras) y vista previa de soluciones como fantasma.
- La pieza seleccionada abre su tarjeta con medidas, uniones y edición a mano (como hoy).
- En el encabezado: la versión actual con su historial desplegable (línea de tiempo con diferencias y deshacer) y la burbuja de avisos.
- A la derecha, tres pestañas: **Conversación** (chat con la bandeja), **Mueble** (la ficha; en muebles sin ficha, lo que el experto decidió y sus piezas) y **Materiales** (revisión antes de comprar y lista). Revisión e Historial dejan de ser pestañas: viven en los avisos y en el encabezado.

**Entregas**, en este orden porque cada una se apoya en la anterior:
1. ✅ **Confianza y deshacer:** diferencias por versión, «qué cambió» bajo cada respuesta, «Regresar» por pieza, «Deshacer este cambio», red de seguridad de estructura y prompts que no cambian lo no pedido.
2. ✅ **Avisos con estado:** burbuja en el encabezado, estados, «Aceptar así», catálogo de soluciones que Knotty construye con vista previa en 3D y flecha nueva, y las propuestas y preguntas del experto como avisos.
3. ✅ **Bandeja:** decisiones que piden criterio agrupadas en un pedido; las respuestas del experto resuelven sus avisos. Con una sola pregunta abierta y la bandeja vacía, la respuesta se manda al momento; con más, todo espera en la bandeja.
4. ✅ **Acomodo de la pantalla:** tres pestañas, historial en el encabezado, avisos fuera de las pestañas. Avisos e historial ocupan el lugar de las pestañas, no el del 3D, para que la vista previa de una solución siga a la vista.
5. ✅ **El 3D se entiende:** cotas legibles, medidas en la vista de armado, herrajes dibujados, reglas de cajón (pieza entre cajones, holgura al piso, correderas) también para diseños libres. Un cajón sin correderas declaradas las recibe de las piezas junto a su caja; si un lado no tiene dónde atornillarla, Knotty ofrece la pieza como solución instantánea.
6. ✅ **Módulo de cama** con variantes y ficha (base con cajones de un lado o de los dos, hacia la cabecera o el pie; cabecera lisa, librero o con compartimento). El largo y el ancho salen del colchón; la cama corre a lo largo del eje x con la cabecera en un extremo, y los cajones del otro lado abren hacia atrás. Las 64 combinaciones de colchón, cajones y cabecera se arman sin avisos. Mesas (comedor, centro, lateral) y escritorios también tienen ficha: cubierta sobre dos costados, faldones con tornillo de bolsillo que la escuadran, travesaños para que ningún claro pase de 60 cm, repisa baja con apoyos y, en el escritorio, cajonera a un lado con espacio libre para las piernas. Las bancas siguen pieza por pieza.
7. ✅ **Código en inglés:** código, datos, prompts, ids y carpetas (D33, ver «Migración del código a inglés»).

### Banco de pruebas (2026-09-25)

Oculto junto a la bitácora: los casos fijos del comparativo corren contra el experto conectado desde la app (tiempo, llamadas, si fue por ficha o pieza por pieza, medidas razonables, críticos, veredicto; se abre el diseño en el estudio y se exporta), y todas las variantes de los módulos se revisan al instante sin experto. Al estrenarse encontró dos huecos de Knotty, ya corregidos: cajones de cama centrados que dejaban tiras de 65 mm, y gabinetes con zoclo cuyo piso no tenía apoyo bajo los divisores (más el listón de colgar que ahora lleva una alacena).

Caso pieza por pieza (2026-09-25): todos los casos iban por la ficha, así que el camino donde el experto escribe cada pieza, sus cotas y sus ids no se probaba con un experto real. El caso `plant-stand` (un exhibidor escalonado para plantas: ninguna ficha tiene escalones) lo obliga; un caso puede nombrar su camino (`path`) y, si el diseño llega por el otro, cuenta como no razonable. Lo que encontró con SheLLM:
- El experto anotaba «cada escalón mide 25 cm de fondo» como requisito de espacio y la app rechazaba su propio diseño (750 mm de fondo): un reintento de 60–90 s en 3 de 3 corridas. Los prompts (`system@9`, `skeleton@9`, `plan-adjust@7`) aclaran que un requisito de espacio es la medida del mueble completo, nunca de una parte; ya no pasa.
- Pieza por pieza tarda 140–240 s y 14–26 mil tokens de salida (la ficha, 10–30 s y 1–3 mil), y a veces reintenta por piezas que flotan.
- Sale con escuadrado crítico (R5): un mueble abierto sin trasera ni travesaño rígido se descuadra. El prompt lo pide y el experto no lo agrega; la persona lo ve como aviso con su solución y el dictamen dice que necesita cambios. Pregunta abierta: aplicar sola la solución (el travesaño) en el primer diseño, como las reparaciones por reglas.

### Migración del código a inglés (D33)

Un módulo por PR, con las pruebas pasando; la interfaz y los textos para la persona siguen en español. Terminada: pasos 1 a 10. El orden fue de lo que no toca datos guardados a lo que sí:

1. ✅ `domain/trace` (nació en inglés) y `domain/diseno/uniones.ts` → `joints.ts`.
2. ✅ Validación y contacto: `domain/validacion` → `domain/validation` (`contact`, `errors`, `geometry`). Los campos del error (`codigo`, `mensaje`, `datos`) y sus códigos (`E_FLOTANTE`…) quedan en español hasta el paso 4, porque comparten forma con los hallazgos y el experto los lee; los campos de `Result` (`valor`, `errores`), hasta el paso 6, con `aplicar`.
3. ✅ Resolución y normalización: `resolver` → `resolve` (`resolveGeometry`, `Geometry` con `boxes`, `thicknesses` y `measure`, `Box`, `faceSize`, `roundTo`), `normalizador` → `normalize` y `construir` → `builders` (`makePiece`, `makeJoint`, `extent`, `startAt`, `endAt`, `partway`). Los campos de las cotas (`desde`, `hasta`, `largo`, `tipo`, `mas`) son del esquema y cambian en el paso 7.
4. ✅ Reglas estructurales: `domain/estructura` → `domain/structure` (`finding`, `review`, `assumptions`, `rules/*`). Hallazgos (`Finding`: `code`, `severity`, `pieces`, `message`, `data`, `alternatives` con `key`, `description`, `data`) y errores (`code`, `message`, `data`) con campos en inglés. Siguen en español los datos: códigos de regla y de error, severidades, claves de alternativas y del contenido de `data`, que lee el experto y usan los avisos guardados; y los críticos guardados de una propuesta, que son del esquema (paso 7).
5. ✅ Materiales y viabilidad: `catalogo` → `catalog` (`Catalog`, `BoardMaterial`, `Hardware`, `materialById`, `usableSheet`), `acomodo` → `layout` (`layOut`, `MaterialLayout`), `compra` → `purchase` (`estimatePurchase`, `Purchase` con `layout`, `sheets`, `hardware`, `edgeBanding`, `cost`), `despiece` → `cutList` y `viabilidad` → `viability` (`reviewViability`, `Check`, `Verdict`, `CarpenterOpinion`). Los campos del catálogo (JSON), de los ajustes guardados y del dictamen guardado quedan para el paso 9.
6. ✅ Operaciones: `aplicar` → `apply` (`applyOperations`, `Applied` con `design` y `warnings`), `cajon` → `drawer` (`expandDrawer`, `DrawerRequest`, `runners`, `runnerFor`) y `esquema` → `schema` (`Operation`); `Result` pasa a `value` y `errors`. Los nombres de las operaciones y sus campos los escribe el experto y cambian en el paso 9.
7. ✅ Esquema, estado y análisis: `esquema` → `schema` (`Design`, `Piece`, `Joint`, `Extent`, `Position`, `Axis`…), `sesion/estado` → `state` (`DesignState`, `Message`, `Proposal`, `PurchaseReview`, `currentDesign`), `historial` → `history`, `requisitos` → `requirements`, `analisis` → `analysis` (`analyze`, con `valid`, `errors`, `warnings`, `findings`, `contacts`), `diff` (`differences`) y los ejemplos (`exampleBookcase`…). Los campos guardados, lo que escribe el experto y los `.describe()` de los esquemas cambian en el paso 9.
8. Aplicación, adaptadores e interfaz. ✅ Primera parte (aplicación, puertos y adaptadores): `casosDeUso` → `useCases` (`createUseCases` con `reconstruct`, `adjust`, `applyProposal`…), `contexto` → `context`, puertos (`ExpertResponse` con `value`, `origin`, `usage`, `warnings`; `ReconstructionRequest`, `Preferences`, `ImageProcessor`, `DesignRepository` con `load`/`save`/`clear`) y adaptadores (`expert`, `configuration`, `vault`, `simulated`, `composition`), nombres, comentarios y pruebas. Siguen en español lo guardado (preferencias, bóveda, ajustes del catálogo, el campo viejo `recordarEnPestana` que se lee para migrar) y lo que escribe el experto. ✅ Segunda parte (interfaz): la tienda es `useStore` (`store.ts`, con `state`, `phase`, `view`, `reconstruct`, `openSettings`…), `services.ts` con `useServices`, componentes y props (`Studio`, `Scene`, `Capture`, `PieceMesh`, `VerdictCard`…), valores internos (`Phase`, `View`, variantes de botón, texturas y tonos), los archivos de `ui` y los comentarios. Los textos de la pantalla siguen en español, y también lo que viene del dominio (ángulos de foto, severidades, etapas) hasta el paso 9.
9. Todo en inglés, por consistencia (pedido del autor el 2026-09-25, al final de todo lo demás): los datos y estructuras que hoy se quedan en español a propósito (códigos de regla y de error, severidades, claves de alternativas y del contenido de `data`, roles, tipos de unión, nombres de operaciones y el esquema guardado), y los prompts, escritos en inglés y pidiendo al experto que le conteste a la persona en español. La interfaz y los textos para la persona siguen en español. Lo guardado en el navegador y la bitácora se leen con migración de formato. Va en partes:
   - 9a ✅ El diseño, las operaciones y la sesión guardada: campos y valores (roles, tipos de unión, veta, carga, cantos, confianza, operaciones, veredictos, autor de cada mensaje) y las respuestas del experto (`explanation`, `questions`, `requestedPhotos`…; en el ajuste de ficha el gabinete va en `cabinet`, como en el esqueleto). La sesión guardada pasa a `format: 2`; `domain/sesion/migrate.ts` lee el formato 1 y su prueba usa una sesión real guardada por la versión anterior. Los prompts siguen en español con los nombres nuevos (`sistema@5`, `ajuste@7`, `ajuste-ficha@4`, `esqueleto@5`, `reconstruccion@7`, `dictamen@2`). Los mensajes para la persona nombran las medidas con `DIMENSION_LABEL` («ancho», «alto», «fondo»). Los ids de piezas que arma Knotty (`lat-izq`, `piso`, `cajon-1-frente`) y las caras (`mueble.z1`) no cambian: son datos del diseño y el experto los inventa igual. Con el experto real (SheLLM, los 9 casos del banco): 9/9 válidos, razonables y viables, todos por la ficha al primer intento, 17 s en promedio.
   - 9b ✅ Códigos y severidades: códigos de regla (`R1_SAG`…), de error (`E_OVERLAP`…) y de aviso (`W_…`), severidades (`critical`, `recommendation`, `detail`), ids de comprobaciones, claves y datos de las alternativas y del contenido de `data`, etapas del experto y ángulos de foto (`front`, `three-quarter`, `side`, `inside`, `joints`). Lo que ve la persona usa `angleLabel` («frente», «3/4»…). La sesión pasa a `format: 3`: `migrate.ts` traduce los códigos que viven dentro de textos (la llave de un hallazgo aceptado, la de un aviso en la bandeja), la bitácora, las comprobaciones, las fotos pedidas, las miniaturas y las respuestas `f:ángulo`, y encadena la migración del formato 1. Prompts `ajuste@8`, `esqueleto@6`, `reconstruccion@8`. Banco con el experto real: 9/9 válidos y razonables; el librero de 1.80 m sale sin anclar al muro en 1 de cada 3 corridas (crítico R4, lo marca bien la regla): el esqueleto debería anclar por su cuenta un mueble alto y angosto.
   - 9c ✅ Prompts (`sistema@6`, `ajuste@9`, `ajuste-ficha@5`, `esqueleto@7`, `reconstruccion@9`, `lectura@2`, `dictamen@3`), descripciones del esquema y textos que el código le arma al experto (contexto, correcciones, lista de corte) en inglés. Los prompts piden que todo lo que lee la persona vaya en español de México, con palabras de taller («triplay», nunca «plywood»). El esqueleto ahora ancla al muro un librero o cajonera alta salvo que la persona diga otra cosa. Banco con el experto real, dos corridas por caso: 18/18 válidos y viables, 17 s en promedio como antes; el librero salió anclado las dos veces (en 9b falló 1 de 3). El rango del caso «cama» admite ahora el fondo de una cabecera con librero.
   - 9d ✅ Catálogo (`materials`, `hardware`, `layout`, `priceNote`; tipos `plywood`/`back`; unidades; ids de herrajes como `screw-8x2`, `drawer-slide-40`, `cup-hinge-35-full`; los de triplay, `T18`, no cambian) y preferencias (`active`, `connections`, `keyStorage`, `model`; `simulated`, `memory`, `tab`, `encrypted`). Todo lo guardado se sigue leyendo: los precios y el acomodo de la persona (con los ids viejos de herrajes), la configuración del experto y la bóveda (sobre `v: 2`, abre el `v: 1` sin tocar las llaves). La sesión pasa a `format: 4`: las uniones guardan ids de herrajes y el origen de cada versión nombra al proveedor simulado. Al renombrar, las pruebas detectaron que la copia sin llaves que se guarda en `localStorage` se armaba con la clave vieja y conservaba la API key; ahora esa copia tiene tipo. Banco con el experto real: 9/9 válidos, razonables y viables, 15 s en promedio.
   - 9e ✅ Ids que arma Knotty en inglés (pedido del autor): piezas de los módulos, cajones, arreglos y ejemplos (`side-left`, `bottom`, `shelf-1`, `drawer-1-front`, `head-back`…), uniones (`j-…`), la cara reservada del mueble (`furniture.z1`), los casos del banco (`bookcase`, `bed-drawers`…) y las pestañas del estudio. Los ids guardados en español siguen funcionando: son datos del diseño; solo las caras `mueble.` se migran (`format: 5`). Los cajones se cuentan por su frente, no por el prefijo del grupo, para que los diseños viejos también cuenten. Banco con el experto real: 9/9 válidos, razonables y viables, 19 s en promedio (todos por la ficha: el banco no tiene un caso pieza por pieza, donde el experto escribe ids y caras).

10. ✅ Carpetas y archivos en inglés (pedido del autor el 2026-09-25): `domain/design`, `materials`, `viability`, `operations`, `session`, `history`, `requirements`; `ui/studio`, `scene`, `capture`, `settings`, `system`; `adapters/catalog`, `image`, `persistence`, `llm/common`, `llm/simulated`; `src/architecture.test.ts`; `public/catalog/catalog.json`, `icon-*.png`, `share.png`; `scripts/brand` (`generate.sh`, `knot*.svg`) y `scripts/compare` (`models.compare.ts`, `results/`) con `npm run compare` y variables `KNOTTY_MODELS`, `KNOTTY_CASES`, `KNOTTY_REPEAT`, `KNOTTY_PARALLEL`, `KNOTTY_LABEL`, `KNOTTY_RAW` (las de antes siguen funcionando). Los prompts se llaman `system`, `adjust`, `plan-adjust`, `review`, `skeleton`, `reading` y `reconstruction`. Las claves guardadas pasan de `despiece:v1:*` a `knotty:*`; lo guardado con las viejas se mueve al leerlo (la bóveda incluida), y la clave vieja solo se borra si la nueva se escribió. Las rutas que aparecen en las secciones anteriores de este documento son las de su momento.

11. ✅ Lo que quedaba en español (auditoría del 2026-09-25): tokens de estilo (`graphite`, `bone`, `amber`, `line`, `rust`, `slate`, `paper`, `font-display`, `numerals`, `animate-appear`), nombres internos (`position` en vez de `cota`, constantes de los ejemplos, locales de las pruebas), comentarios, valores (`kind: 'text' | 'image'`, el camino del banco `'plan' | 'pieces'`, el veredicto `invalid`, los ids del experto simulado, los métodos en la bitácora exportada, `knotty-bench-…json` y `knotty-debug-…json`) y lo que se le manda al experto (el formato de salida y el aviso de fotos del proveedor compatible con OpenAI, `(root)`, «ficha» → «plan»; prompts `plan-adjust@8` y `skeleton@10`). La comprobación `aceptados` pasa a `accepted` y la sesión a `format: 6`. De paso: la bitácora decía «Abrir el ejemplo undefined» (leía `design.nombre`), cinco pruebas mostraban `$nombre` en su título, una prueba de uniones no probaba nada (usaba la clave vieja `grupo`) y el resumen de cambios de la ficha decía «door», «top», «back» y «shelf» en vez de «puerta», «techo», «trasera» y «repisa».

12. Arquitectura, fase 0 (auditoría del 2026-09-25): errores e higiene antes de crecer el catálogo. «Hacer más grueso» cambiaba las dos piezas de una unión; ahora solo la delgada, y un aviso con varias uniones delgadas engruesa cada una una vez (`fixesForNotice`). Cada comprobación lleva su `check` en la clave del aviso: aceptar el anclaje de una alacena ya no aceptaba en silencio su listón (tipología, R2, R3, R6 y R9); las claves viejas de esos avisos dejan de coincidir y se vuelven a mostrar una vez. El tornillo de bolsillo se elige por espesor (1" hasta 16 mm, 1¼" hasta 19; el de 1" entra al catálogo sin precio) y el cubrecanto por su id. Un JSON inválido del experto (Claude y compatibles con OpenAI) ahora se corrige como cualquier respuesta inválida, en vez de abortar. La revisión de compra sigue al contenido del diseño, no al número de versión. Fuera código muerto y `export` de lo que solo se usa en su archivo.

13. Menos viajes al experto, primera parte: cuando una propuesta deja críticos y el experto no ofreció opciones, las que salen de las reglas y Knotty sabe construir quedan ligadas a su solución (`solutions` en el mensaje, sin tocar lo que ve el experto). Al elegirla se aplica la propuesta y luego la solución, en dos versiones y sin llamar al experto; si no se puede construir, va al experto como antes. En modo bandeja la opción sigue yendo como texto.

14. Los números del oficio salen del código (punto 4.2 del plan de arquitectura): los prompts ya no escriben a mano medidas mínimas, hoja útil, colchones ni tornillos; dicen `{{nombre}}` y el valor sale de `src/adapters/llm/common/promptValues.ts`, del mismo código que lo hace cumplir. Una prueba falla si un número vuelve a aparecer escrito en un prompt. Prompts `system@10`, `skeleton@11`, `plan-adjust@9`, `reconstruction@12` y `review@5`. Con eso el experto oye lo que Knotty de verdad revisa: cajón de 92 mm como mínimo, tornillo de bolsillo de 1" hasta 16 mm y de 1¼" hasta 19, escritorio de 70–78 cm y librero de 23–30 cm de fondo. Falta correr `npm run compare` y compararlo con el reporte anterior.

15. Cada tipo de mueble es un módulo registrado (puntos 1.1 a 1.3 del plan de arquitectura): cama, mesa y gabinete exportan cada uno un `FurnitureModule` (`src/domain/modules/module.ts`) con su esquema, cómo se arma, cómo describe sus cambios, cómo cambia de medida, la línea del encabezado, las etiquetas de sus opciones y sus variantes del banco; `MODULES` en `plan.ts` los reúne y no compila si a un tipo le falta el suyo. La ficha, el encabezado, los ajustes y el banco los recorren en vez de preguntar si es cama o mesa, y la ficha del gabinete dice su tipo (`kind: 'cabinet'`): las sesiones guardadas pasan al `format: 7` y la migración se lo pone a las fichas que no lo tenían. Lo que ve el experto no cambia: su gabinete sigue sin `kind` (el tipo lo dice el campo que llena), aunque la ficha actual que se le manda al ajustar ya lo lleva, como las de cama y mesa. Las etiquetas de cada opción viven con su módulo, una sola vez. Lo que se repetía al armar (el tablero, el cajón que no cabe, los apoyos cada tanto, el espesor de 18 por omisión) está en `common.ts`, junto con dos números que no cuadran y quedan para otro cambio: el claro de 600 mm de camas y mesas contra los 800 que permiten las reglas, y el zoclo de 70 mm del gabinete y la cajonera contra 80 en la cama.

16. El tipo de mueble es un dato, no se adivina del nombre (punto 1.4 del plan de arquitectura): el diseño lleva un `kind` opcional con un solo vocabulario (`src/domain/design/kind.ts`) que junta los tipos de módulo (`cabinet`, `bed`, `table`) y los usos que revisa la tipología (librero, clóset, alacena, zapatera, cajonera, buró, escritorio, mesa de comedor, de centro o lateral, banca); `MODULE_OF_KIND` en `plan.ts` dice qué módulo arma cada uno, y la banca, que no tiene, va directo a pieza por pieza. La cama pone `kind: 'bed'` y su colchón (`mattress`), la mesa el uso de su ficha (el escritorio, `desk`; la de centro, `coffeeTable`…) y los tres ejemplos el suyo; el gabinete no sabe si es librero o clóset y lo deja sin poner. `detectKind` usa el `kind` del diseño y, si no lo tiene, el nombre como antes: renombrar una cama ya no le apaga sus revisiones, el colchón sale de la ficha y la mesa se revisa por su uso aunque se llame distinto. `MATTRESSES` pasa al módulo de la cama y las reglas (`appliesTo`) usan el mismo vocabulario. Las sesiones guardadas no cambian de formato: el campo es opcional y un diseño viejo sin él se revisa por su nombre. Lo que escribe el experto no cambia (su esquema deja fuera `kind` y `mattress`), aunque el diseño actual que se le manda al ajustar ya los lleva. El banco sin experto da lo mismo que antes: 178 de 178 sin avisos.

17. Los casos de uso por tema y un solo juez del ajuste (puntos 4.3, 4.4 y 4.4b del plan de arquitectura). 4.3–4.4 (#77): `src/application/useCases.ts` se parte en `src/application/useCases/` (reconstruir, ajustar, propuestas, historial, ediciones a mano, revisión y sesión); `createUseCases` solo los compone y la API no cambia. Lo que decide qué pasa con el cambio del experto (aplicarlo, dejarlo pendiente, solo contestar o regresarlo con sus errores) es `judge()`, una función pura con pruebas por tabla; la propuesta pendiente se arma en un solo lugar y aplicar, normalizar y analizar un candidato también. 4.4b: el camino de la ficha pasaba por alto lo que el de pieza por pieza sí cuida; ahora también pasa por `judge()`. Un cambio de ficha que llega con preguntas espera las respuestas («Hizo preguntas: el cambio espera tus respuestas.») y uno que quita piezas que sostienen el mueble sin que se pidiera (la trasera con `back: 'none'`, el zoclo con `base: 'floor'`) espera a la persona («Quiere quitar Trasera, que sostienen el mueble y no pediste quitar.»); si la persona lo pidió («Quita la trasera»), no se detiene por eso. Con críticos nuevos, la ficha va directo a pendiente con las opciones de las reglas, sin la vuelta extra del experto: ahorra una llamada y Knotty construye esas opciones sin experto. Ya no es casualidad: `judge()` recibe la política del camino (`extraRound`: pieza por pieza sí, la ficha no). La vuelta extra de pieza por pieza avisa su propia etapa (`reviewing-criticals`, «Revisando los puntos críticos…» en el chat) en vez de repetir «Pensando el cambio…». Para que contestar una propuesta de ficha pendiente no pierda el cambio, el contexto del experto trae la ficha propuesta cuando la propuesta es de ficha. Falta correr `npm run compare` para confirmar que el experto real contesta sobre la ficha propuesta.
18. La ficha sale de los campos de su módulo (punto 1.5 del plan de arquitectura): cada módulo declara `fields` en su `FurnitureModule`, una lista de campos (`src/domain/modules/fields.ts`: elección, triplay por uso, contador, medida en mm, nota, sección con su título y un campo propio) con `get` y `set` tipados contra la ficha y `visibleWhen` para lo que depende de ella; las opciones salen de las etiquetas del módulo, una sola vez. `PlanFields` dibuja cualquier ficha con un solo `Row`, así que un tipo de mueble nuevo ya no necesita formulario; `BedFields` y `TableFields` desaparecen y la cuadrícula de columnas y huecos del gabinete queda como su campo propio (`CabinetColumns`). Lo que se ve no cambia: las capturas de la ficha de cama, escritorio, mesa de comedor y gabinete, en quince estados (cabecera, cajones, cajonera, repisa baja, uso, columna nueva), salen idénticas píxel por píxel antes y después, con el mismo árbol de accesibilidad. Las pruebas piden que los campos de cada módulo cubran todas las claves de su esquema salvo `kind` y `name` (dichas y con su razón), que cada elección ofrezca justo los valores de su enum, que poner el valor que ya tiene no cambie la ficha y que cada cambio que ofrece arme un mueble válido.

19. Acabados en el modelo y en la lista de compra (punto 2.6 del plan de arquitectura, primera parte; el tono en el 3D va después): `src/domain/materials/finishes.ts` guarda lo que dice [acabados.md](carpinteria/acabados.md) de siete acabados (sin acabado, barniz de poliuretano, barniz marino, barniz de color base agua, sellador y laca, pintura con primario y esmalte, aceite danés) y de sus productos: manos, rendimiento de la ficha en m²/L, secado, granos de lija, si es solo para interiores y un consejo para quien empieza, cada uno con su sección de origen. Lo que la referencia no da queda vacío y dicho: la laca y el sellador de nitro no tienen rendimiento en m²/L (el del sellador está en g/m²), la laca no dice cuántas manos, la pintura y el aceite no dicen qué grano va entre manos, y no hay precios ni cuántos pliegos de lija por m². El catálogo trae una lista `finishes` con cada producto en botes de 1 y 4 L, sin precio; la persona pone el suyo como en los herrajes. El diseño lleva `finish` opcional (sin él es «sin acabado»), así que lo guardado no cambia de formato; el experto no lo escribe (su esquema lo deja fuera) y lo lee en una línea del contexto. Se elige en Materiales y es una versión propia que conserva la ficha; un diseño que se reconstruye desde la ficha o que escribe el experto se queda con el acabado actual (también al volver a una versión anterior: el acabado se cambia en Materiales), y elegirlo no pide otra revisión de compra. La cuenta: área = las dos caras de cada pieza (para que no se tuerza) menos la cara de la trasera que va al muro, más los cantos con cubrecanto; litros = área × manos ÷ (rendimiento más bajo de la ficha × 0.8), como dice [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §13; el sellador que es el mismo barniz diluido cuenta como una mano entera (compra de más, no de menos); se redondea a los botes que dejen menos sobrante y luego menos botes, o a los más baratos si todos tienen precio. El librero de ejemplo: 5.39 m², 1 mano de sellador y 3 de poliuretano, 3.37 L, un bote de 4 L. Acabado por pieza, tinta y brillo quedan para después.

20. Las revisiones por tipo de mueble son datos y la geometría se comparte (puntos 3.3 y 3.4 del plan de arquitectura). R10 es una lista (`src/domain/typology/constraints.ts`): cada entrada dice su `check`, a qué tipos aplica, sus límites y de dónde salen (`source`: sección y renglón de `docs/carpinteria`, o por qué no hay referencia). Las medidas con mínimo o máximo (fondo de librero, clóset y zapatera; alto de escritorio, mesa y banca; alto del clóset sin anclar) las evalúa una sola función; el anclaje, el colchón, el claro de la cama y el espacio para las piernas traen la suya en la misma lista. Una revisión nueva es una entrada. Los avisos, sus mensajes y sus claves no cambian (comparado aviso por aviso en más de 32 000 variantes del banco, ejemplos y gabinetes con cada tipo). Lo que se repetía de geometría (traslape entre cajas, la caja que las envuelve, la tolerancia de contacto, el claro libre y los grupos de cajones) vive en `src/domain/design/boxes.ts`. Quedan para otro cambio los valores que no coinciden con la referencia, anotados junto a cada entrada: escritorio desde 700 (referencia 680) y hueco para piernas de 620 de alto (650); mesa de centro desde 350 (380) y de comedor de 720 a 770 (700–780); banca desde 420 (400); clóset desde 550 (580–600) y anclado desde 1500 (686 con puertas; corregido en el paso 21); cajonera anclada desde 700 y con dos cajones (686, con cualquier cajón; corregido en el paso 21); librero desde 230 (280 para libros comunes, 330 para grandes); zapatera de 300–350 (300–380); holgura del colchón de 20 menos a 80 más (10–30 por lado) y claro de la base de 800 (600–700).

21. Los valores de referencia del pandeo y del anclaje (punto 2.5 del plan de arquitectura; decisiones del autor del 2026-09-25). **Pandeo** (R1, un solo cambio porque solo tiene sentido junto): el triplay de pino toma la rigidez conservadora de [valores-de-referencia.md](carpinteria/valores-de-referencia.md) §1 por espesor (E∥ 4 500 en 18 mm, 5 000 en 15, 5 500 en 12 y 9; E⊥ 2 000 / 1 500 / 1 000 / 800 / 700 en 18 / 15 / 12 / 9 / 6; antes 6 000 / 3 500 para todo), la fluencia es 2.0 con la carga que se queda (antes 1.5) y el crítico empieza en L/100 (antes L/200); la recomendación sigue en L/360. Con eso una repisa de 18 mm con libros llega a 540 mm sin pandeo visible y a ≈ 830 al límite, los claros de la referencia. La fluencia distingue la carga que pasa (1.0): la plataforma de una cama y el asiento de una banca, la superficie de uso que ya encuentra la tipología, cargan a una persona; el aviso dice «con una persona encima». **Anclaje** (R4): un solo umbral, 686 mm (ASTM F2057-23, §12), para cualquier mueble con cajones o puertas, encontrado por lo que tiene y su alto, no por su nombre; no aplica a camas, bancas, escritorios, mesas ni a la alacena (que tiene su revisión de colgado). Salen las revisiones `drawers.anchor` (700 mm y dos cajones) y `wardrobe.anchor` (1 500): lo que se aceptó con esas claves se vuelve a mostrar una vez, como R4. Lo abierto sigue con alto contra fondo. **Banco sin experto:** con los valores nuevos y sin la carga pasajera, 121 de 178 variantes avisaban: las 120 camas con cajones (plataformas de 600–628 mm «con libros») y la alacena de 76 cm (claros de 724 mm con carga media, el máximo es ≈ 620). Las camas quedan limpias al contar a la persona como carga pasajera; la alacena del banco y la de ejemplo pasan al módulo de cocina de 60 cm (claro de 564), y el librero de ejemplo de 60 a 57 cm (claro de 534, «cada 550 mm» de [estructura.md](carpinteria/estructura.md)): 178 de 178 sin avisos otra vez, y los ejemplos sin avisos nuevos. El librero de ejemplo cambia sus cifras: 5.22 m² y 3.26 L de acabado (un bote de 4 L). Lo que el experto lee no cambia de número, así que ningún prompt sube de versión; pero `skeleton@11` y `system@10` le dicen que ancle lo alto (más de 1.2 m) o poco profundo, y ahora una cajonera se ancla desde 686 mm: falta decírselo con un valor nuevo del código (y correr `npm run compare`), después del módulo de zapatera que toca los mismos prompts. Siguen pendientes de la referencia: el librero abierto que pasa de 1 200 mm se ancla «siempre» (hoy solo si alto/fondo ≥ 3), la persona como carga (110 kg × 2 dinámico, hoy 150 kg/m² uniformes), el fondo de cajón delgado hasta 300 de ancho (hoy 450), la tira de refuerzo al frente de la repisa (triplica la rigidez, no está en el modelo) y los demás valores del paso 20.

22. La zapatera, prueba de fuego del registro (punto 1.7 del plan de arquitectura). Un tipo de mueble nuevo como su propio módulo, `src/domain/modules/shoeRack.ts`: medidas, niveles para zapato bajo (150–200 mm libres, 170 lo típico), un nivel para botas abajo (450), frente abierto o con puertas, zoclo o directa, asiento arriba (banca zapatera) y anclaje, con las medidas de [muebles-y-medidas.md](carpinteria/muebles-y-medidas.md) §2.6. Se arma como un gabinete de repisas fijas; las columnas salen del claro que permite la regla de pandeo (zapatos con carga ligera, el asiento con carga pesada), así que la zapatera ancha o la banca llevan divisor sola. El diseño lleva `kind: 'shoeRack'` y le aplica `shoe-rack.depth`, aunque se llame distinto. Las repisas inclinadas no se pueden armar todavía (todas las piezas son cajas a lo largo de los ejes): van planas. Cuánto costó agregarla, que era la pregunta: el módulo, su prueba, tres líneas del registro (`plan.ts`: la unión, `MODULES` y `shoeRack` en `MODULE_OF_KIND`, que antes apuntaba al gabinete), el caso del banco y el experto simulado. Lo que además hubo que tocar se generalizó para que el siguiente módulo no lo toque: el banco y la ficha vacía nombran los módulos desde `MODULES`; el esquema del experto (`PlanResponse`, `PlanAdjustment`) arma un campo anulable por módulo desde el registro, con la descripción de `expert.what` del módulo, y `expertPlans` y `answerWith` también; los prompts `skeleton@12` y `plan-adjust@10` escriben la sección de cada módulo sin prosa a mano desde su descriptor y los `.describe()` de su esquema (`src/adapters/llm/common/modulePrompts.ts`), y la lista de campos es `{{planFields}}`. Cama, mesa y gabinete siguen escritos a mano, afinados con el banco. Cambió lo que ve el experto (un campo nuevo, el orden de los campos y las descripciones del ajuste): falta correr `npm run compare`. El banco suma el caso `shoe-rack` y cada caso puede decir de qué módulo debe salir (`module`). Banco sin experto: 183 de 183 limpias (las 178 de antes y 5 zapateras).

23. Lo aceptado se vuelve a abrir si empeora (punto 3.7 del plan de arquitectura). Antes, aceptar un aviso («Aceptar así, bajo mi riesgo») guardaba solo la clave del hallazgo, que no dice qué tan grave es: una recomendación aceptada que después se volvía crítica seguía aceptada en silencio, y lo aceptado con los valores viejos de una regla también. Ahora cada aceptación guarda la severidad que tenía y la versión de su regla (`src/domain/structure/accepted.ts`); una sola función, `isAccepted(finding, accepted)`, decide si sigue valiendo, y la usan el tablero de avisos y la revisión de compra (que solo lista «Aceptado por ti» lo que sigue aceptado). Vale mientras el hallazgo no sea más grave que cuando se aceptó (crítico > recomendación > detalle; si mejora, sigue aceptado) y la regla tenga la misma versión. Si no, el aviso vuelve a pendientes y dice por qué: «Lo habías aceptado como recomendación; ahora es crítico.» o «Knotty cambió cómo revisa esto desde que lo aceptaste.». Aceptarlo otra vez reemplaza la aceptación anterior. Las reglas llevan `version` en el registro (1 por omisión); se sube cuando la regla juzga distinto (un umbral, el modelo), no por cambiar el texto. R1 (pandeo) y R4 (vuelco) pasan a la 2 por los valores de referencia del paso 21. Lo guardado pasa al `format: 8`: la migración deja lo aceptado antes con severidad desconocida (`null`) y versión 1. Una aceptación sin severidad sigue valiendo salvo que el hallazgo sea crítico hoy («Lo aceptaste con una versión anterior de Knotty, que no guardaba qué tan grave era; ahora es crítico.»): no se sabe si se aceptó como crítico o como recomendación, y lo que no puede pasar es esconder un crítico; el costo es que un crítico aceptado a propósito se vuelve a preguntar una vez. Por la versión 1, lo aceptado antes en pandeo y vuelco también se vuelve a mostrar una vez. Banco sin experto sin cambios.

24. La revisión antes de comprar lee el análisis, no lo repite (punto 3.5 del plan de arquitectura, recortado). `reviewViability` recibía la geometría y los hallazgos y volvía a calcular dos cosas que ya hace `analyze()`: si las piezas suman las medidas del mueble (con 2 mm de tolerancia; la validación usa 1) y si cada pieza cabe en la hoja. Ahora recibe el `Analysis` completo y arma «Las cuentas» con lo que encontró: `E_OVERALL_SIZE` es la comprobación `measures`, `E_TOO_BIG_FOR_SHEET` se junta con lo que no se acomoda en la hoja (`sheet`, cada pieza una vez) y cualquier otro error del análisis va en `structure` como problema imposible; la tolerancia de las medidas es una sola, la de `validation/geometry.ts`. Lo que solo sabe la compra se queda aquí: los ajustes de corte de la persona, el acomodo en las hojas, las tiras angostas, las piezas en boceto y el material de sobra. Un análisis inválido también tiene revisión: cada error sale una vez, y la estructura dice «Estructura sin revisar» porque las reglas estructurales solo corren sobre un diseño válido (hoy la app no revisa la compra de un diseño con errores; lo usan las pruebas). Los ids, títulos y textos de las comprobaciones no cambian: comparadas una por una contra el commit anterior, 576 revisiones (los tres ejemplos, sin anclar y altos, y todas las variantes del banco de cama, mesa, zapatera y gabinete, cada una con el recorte de fábrica, de 50 y de 400 mm) salen idénticas. Lo único que cambia de resultado es un diseño con una medida entre 1 y 2 mm fuera, o con las piezas desplazadas sin cambiar de tamaño: antes la revisión decía «Las medidas cierran» aunque el análisis lo marcaba inválido; ahora dice «Las medidas no cierran», como el análisis (en la app no pasaba, porque la revisión se niega antes con un diseño inválido). Los cuatro vocabularios siguen separados porque tienen lectores distintos (el error, para el experto; el hallazgo, para los avisos; la comprobación, para la persona antes de comprar; la gravedad del carpintero, opinión del modelo), y un comentario al inicio de `analysis.ts` y de `viability.ts` dice cómo se relacionan. Queda una diferencia de fondo, sin casos hoy: el acomodo exige la holgura de corte y respeta la veta, y `E_TOO_BIG_FOR_SHEET` no; una pieza que el análisis acepta puede no acomodarse, y la revisión la marca.

25. Menos viajes al experto, segunda parte: Knotty entiende solo los pedidos más comunes (puntos 4.5 y 4.8 del plan de arquitectura). `parseIntent` (`src/domain/intent/`) lee un pedido completo del chat y devuelve una intención solo si se lee de una manera: **medidas** con las palabras de la ficha («hazlo de 90 cm de ancho», «1.80 de alto», «más angosto 10 cm», «quítale 10 cm de alto»; sin unidad, «1.80» son metros y «90» centímetros, y fuera de 100–3 000 mm no se adivina), **cuentas** («agrega un cajón», «pon 2 puertas», «4 repisas», «una repisa menos», «5 niveles») y **opciones** («sin zoclo», «quita el zoclo», «sin trasera», «repisas fijas», «anclado al muro», «sin anclar», «cabecera librero», «cajonera a la derecha», «con puertas»). Nada de eso está escrito por módulo: las medidas salen de los campos de número de la ficha y su etiqueta (Ancho, Largo, Alto, Fondo), las cuentas de sus contadores (su etiqueta dice el sustantivo, y uno «por lado» se tiene que decir), y las opciones de la frase de cada etiqueta del módulo (`phrase`, que ahora llega a la ficha por `fromLabels`), o de la etiqueta del campo y la de la opción, con «con X» / «sin X» entre dos valores; así un módulo nuevo las entiende sin tocar nada. Lo único propio es la cuadrícula del gabinete, y solo donde la cuenta no tiene dos lecturas: la única abertura con repisas, la única puerta (hasta dos hojas) o una sola columna de cajones iguales. Se va al experto, sin excepción, lo que tiene una negación o una duda («no», «ni», «pero», «o»), dos cosas («90 de ancho y con puertas», una coma), un signo de pregunta en un cambio, una foto, palabras que no conoce («hazlo más bonito», «agrega un cajón abajo»), una respuesta a una pregunta del experto o una propuesta pendiente. **Preguntas** que se contestan con los números de Knotty, con ficha o sin ella: «¿cuántas hojas?» y «¿cuánto cuesta?» salen de la lista de compra (con el aviso de precios de referencia y lo que no tiene precio), «¿cuánto mide?» de las medidas del diseño (o de la nota de la cama, que salen del colchón); no hacen versión. **Cómo se aplica:** el cambio pasa por lo mismo que un cambio de ficha del experto: se reconstruye con sus extras, y si queda inválido va al experto como antes (anotado en la bitácora); si es válido lo decide `judge()` con la política de la ficha: quitar estructura que no se pidió espera a la persona, y los críticos nuevos van a pendiente con las opciones de las reglas, sin vuelta extra. La versión no tiene origen (como un cambio a mano) y su resumen es el de la ficha («Sin zoclo»); Knotty contesta «Listo, lo cambié en la ficha: sin zoclo.», o que ya estaba así. Cada respuesta sin experto deja un renglón en la bitácora con asunto «Knotty, sin experto», sin prompt ni tokens: la bitácora cuenta solo las llamadas al experto y dice cuántas cosas hizo Knotty sin él. Lo guardado no cambia de formato. **Banco:** un caso puede traer pedidos para después del diseño (`adjust`): el librero pregunta «¿Cuánto cuesta?» y la zapatera pide «Sin zoclo» y «¿Cuántas hojas?»; el reporte de `npm run compare` y el banco dicen de cada uno si lo hizo Knotty (0 llamadas) o el experto y con cuántas, y la columna de intentos sigue contando solo el diseño. Con el experto simulado, las tres salen de Knotty. El recorrido de CONTRIBUTING («Hazlo de 90 cm de ancho» en el librero de ejemplo) no cambia: ese librero no tiene ficha, así que sigue yendo al experto y sale la propuesta con su crítico. Con el experto simulado en el navegador, «Sin zoclo» en una zapatera tarda 76 ms en vez de 900 ms. Falta correr `npm run compare` con un experto real para ver cuántas llamadas se ahorran en los casos con ficha.

26. Uniones y herrajes emparejados, y la fuente de cada umbral (puntos 2.7 y 2.4 del plan de arquitectura). **Correderas:** una sola `slideFor(catalog, fondo)` en `src/domain/materials/catalog.ts` escoge la corredera más larga que cabe en el fondo detrás del frente menos 10 mm (`SLIDE_BACK_CLEARANCE`, [estructura.md](carpinteria/estructura.md) §4.1 «Profundidad útil»), y `slideForBox` la de una caja ya armada, tan larga como la caja. La usan el cajón del módulo, las correderas que Knotty agrega a un cajón del experto, el apoyo de corredera que construye y R9; antes las tres últimas tomaban la primera del catálogo (30 cm) sin ver el fondo, así que un cajón del experto de 45 cm de fondo compraba correderas de 30 y ahora compra de 45. **Bisagras:** cada bisagra del catálogo dice para qué puerta es (`mount`: `overlay` recta, `half-overlay` codo, `inset` súper codo; un catálogo sin ese campo carga igual y los precios guardados siguen por id), `hingeFor(catalog, montaje)` la escoge y `doorMount` (`src/domain/design/doors.ts`) lee el montaje de la geometría: delante del canto del lateral, si tapa dos tercios o más es sobrepuesta y si menos, a medio canto; dentro del hueco, embutida. El diseño no guarda el montaje de cada puerta: sale de dónde están las piezas. El gabinete ya no nombra la bisagra de súper codo a mano, y la puerta sobrepuesta que cuelga de un divisor compartido lleva codo (antes recta). **Revisiones nuevas**, sin código de regla nuevo: R6 `door.hinge-mount` y R9 `drawer.slide-too-long` y `drawer.slide-too-short`, con soluciones que Knotty construye (`matching-hinge`, `matching-slide`: cambia el herraje de la unión por el que va). **Fuentes:** cada supuesto de `ASSUMPTIONS` tiene su fuente en `ASSUMPTION_SOURCES` y las constantes sueltas de la geometría, el dictamen, los módulos, la corredera y la bisagra, en un registro junto a ellas, con la misma forma que la tipología (`archivo#ancla «renglón»` o `no reference:` y el porqué, `src/domain/sources.ts`). Los números sueltos de las reglas pasan a `ASSUMPTIONS` (trasera de 6 unida a 3 piezas y 2 travesaños para escuadrar, t − 3 cara contra cara, 20 entre dos tornillos, 0.8 del piso sobre un zoclo, 1.5 para la veta, 2 de holgura del frente). `src/domain/sources.test.ts` falla si un umbral con nombre en esos archivos no tiene fuente, si una regla declara un número propio o si el archivo, el encabezado o el renglón citado no existen. Sin referencia, con su porqué: gravedad, 20 entre tornillos, 0.8 del zoclo corrido, 1.5 de la veta, 10 mm del cajón al suelo, tolerancias de medida (1 y 2 mm), alcance de la corredera (20), tira mínima (50), aprovechamiento justo (85 %), retranqueo del zoclo (30; la referencia solo da 50 en cocina) y la pulgada. **Valores que cambian, cada uno en su commit:** bisagras por alto como la tabla (3 hasta 1 600, 4 hasta 2 000, 5 hasta 2 400); fondo de cajón de 3 mm solo por debajo de 300 de ancho (antes 450); holgura de corredera +0.8/−0 (antes ±1, que aceptaba un cajón que no entra); zoclo de la cama de 70 (50–70 en recámara; antes 80); claro de la plataforma de cama crítico desde 700 (el tope del 600–700; antes 800), con `MAX_SPAN` 600 como el piso de ese rango; y el tornillo más corto sugerido en ta + tb − 3 (antes − 5). `ASSUMPTIONS.floorSpan` (800) se queda: es el piso de un mueble sobre patas, otro caso ([estructura.md](carpinteria/estructura.md) §7.1). **Banco sin experto:** todas las variantes de cama, mesa, zapatera y gabinete siguen válidas y sin avisos. Lo que lee el experto no cambia (el catálogo le llega con id y nombre), así que ningún prompt sube de versión.

27. Menos tokens y menos vueltas en el camino de la ficha (punto 4.6 del plan de arquitectura). **Contexto de la ficha:** cuando el experto ajusta una ficha viva (`adjustPlan`, desde `throughPlan` en `src/application/useCases/adjust.ts`) ya no recibe el diseño completo en JSON ni la geometría resuelta, que solo sirven para escribir operaciones sobre piezas: la ficha va aparte (`## Current plan`) y Knotty arma todas las piezas desde ella. `buildPlanContext` (`src/application/context.ts`) le da la versión, el acabado que escogió la persona, los cambios libres que viajan sobre la ficha (solo la operación y a qué pieza), la revisión estructural con código, gravedad y mensaje (sin piezas ni alternativas) y cuáles aceptó la persona así, los requisitos, la propuesta pendiente (su resumen, sus críticos y, si fue por ficha, «It changes the plan to…» con la ficha propuesta; si fue pieza por pieza, sin las operaciones), las decisiones, la bitácora de cambios y la conversación reciente, con el mismo recorte por presupuesto. El camino pieza por pieza y la revisión de compra siguen con `buildContext`, que ahora solo se arma si el pedido llega a ese camino. Con el estimado de `context.ts` (caracteres / 3.5), contexto más ficha recién diseñados: gabinete de dos columnas (31 piezas) de ≈ 8 540 a ≈ 300 tokens, cama queen con cajones de ambos lados y cabecera librero (62 piezas) de ≈ 17 360 (pasaba el presupuesto de 12 000 aun recortado) a ≈ 250, y escritorio con cajonera (30 piezas) de ≈ 8 250 a ≈ 240. **Corregir la ficha antes de rendirse:** si la ficha que devuelve el experto se reconstruye en un diseño inválido, antes se iba pieza por pieza (hasta 4 llamadas más); ahora vuelve una vez a `adjustPlan` con los errores (`planCorrection` en `src/application/useCases/forExpert.ts`, con `listErrors`, y el mismo bloque «Your previous answer could not be used» del camino de piezas, vía `correction` en `PlanAdjustRequest`), con la etapa «corrigiendo» y el intento 1 en la bitácora; si la corregida sirve se juzga y aplica como cualquier ficha, y solo si vuelve a salir inválida (o el experto contesta «freeform») se va pieza por pieza como antes. El texto de `plan-adjust@10` no cambia, así que no sube de versión; pero cambia lo que lee el experto (el contexto se arma en código): falta correr `npm run compare`. Lo guardado no cambia de formato. Banco sin experto: todas las variantes siguen válidas y sin avisos.

28. El dominio en seis grupos por intención (punto 5.2 del plan de arquitectura). `src/domain/` tenía 19 carpetas hermanas y un archivo suelto (`analysis.ts`), cortadas por dónde se escribieron y no por lo que hacen. Ahora son seis grupos, y cada carpeta se movió entera con `git mv`, con sus mismos archivos y nombres; solo cambia la carpeta de arriba: **`materials/`** (catálogo, despiece, acomodo, compra, acabados y grados; igual que antes); **`design/`** (el mueble y su geometría, con `validation/` dentro); **`checks/`** (lo que revisa un diseño: `structure/`, `typology/`, `viability/`, `requirements/` y `analysis.ts`); **`furniture/`** (los tipos de mueble: `modules/`, `fixtures/` y `reading/`); **`editing/`** (lo que cambia un diseño: `operations/`, `repair/`, `fixes/`, `changes/` e `intent/`), y **`session/`** (lo guardado, `state` y `migrate`, con `history/`, `trace/` y `tray/` dentro). `sources.ts` y sus pruebas siguen en la raíz del dominio: de ahí sale la fuente de cada umbral y lo usan todos los grupos. `reading/` (lo que el experto ve en una foto, solo un esquema de zod) iba a ir a `session/`, pero la usan las fichas del gabinete y la zapatera y los pedidos de `intent/`: en `session/` habría hecho que `furniture/` y `editing/` importaran la sesión; en `furniture/` solo la usa lo que está a su lado o encima. Las importaciones se reescribieron con un script que calcula cada ruta relativa desde el lugar nuevo del archivo (512 en 138 archivos, entre `src/` y `scripts/compare/`), y las rutas escritas en `sources.test.ts` apuntan a los lugares nuevos. Nada cambia de comportamiento: las 792 pruebas de antes pasan igual (794 con las dos de fronteras nuevas) y el banco sin experto sigue limpio (183 de 183 variantes). **Fronteras:** `src/architecture.test.ts` comprueba que en la raíz del dominio solo estén los seis grupos y `sources`, y que cada grupo importe solo los grupos que hoy importa (las pruebas quedan fuera, como en las fronteras entre capas): `materials` → design, checks; `design` → materials, checks; `checks` → design, materials, furniture; `furniture` → design, materials, checks, editing; `editing` → design, materials, checks, furniture; `session` → todos, y a `session/` no la importa nadie. Una arista nueva entre grupos se agrega a la lista a propósito. **Ciclos que quedan** (para otro cambio): `design` ↔ `materials` (el diseño lee el catálogo para espesores, herrajes y correderas, y el despiece y la compra leen el diseño); `design` → `checks` y `materials` → `checks` solo por `structure/assumptions.ts` (`hingesFor` y `ASSUMPTIONS` en `design/hardware.ts`, `design/joints.ts` y `materials/purchase.ts`), que son valores del oficio y no reglas: si salen de `structure/` a la base, `design` y `materials` dejan de depender de las revisiones; `checks` → `furniture` solo por `MATTRESSES` de `modules/bed.ts` en `typology/constraints.ts` (las medidas de colchón podrían vivir junto a `MattressSize` en `design/kind.ts`); y `furniture` ↔ `editing`, porque las fichas se arman con `operations/apply` y `repair/` y los pedidos de `intent/` leen las fichas (`plan`, `fields`, `common`), y `furniture` → `checks` porque el gabinete corre el análisis y `rebuild` los requisitos. Cuando se corte un ciclo, la arista sale de la lista de `architecture.test.ts`.

29. El primer producto del catálogo: el aparador como caso del banco y como ejemplo con ficha. Un aparador del catálogo de referencia (`KC-APA-01`; el código lleva a la ficha privada del producto, fuera del repo; 940 × 1600 × 400 mm, triplay de pino, acabado natural) se arma con la ficha de gabinete: dos filas y cuatro columnas; abajo tres puertas embutidas de una hoja con un entrepaño detrás y, a la derecha, dos cajones embutidos; arriba (una cuarta parte del alto) un cajoncito en la primera columna y nichos abiertos en las otras tres; techo entre laterales y trasera clavada. Sale válido con 41 piezas; su único aviso era el vuelco (R4: 940 mm con puertas y cajones), que se va al anclarlo al muro. **Caso del banco** `sideboard` (`src/application/bench/cases.ts`): la petición como la escribiría el autor, con medidas exactas, camino por ficha y módulo gabinete, y «¿Cuánto cuesta?» después. A propósito no dice «va pegado a la pared»: el prompt de la ficha le pide al experto anclar todo lo que tiene puertas o cajones desde 686 mm, así que un crítico R4 en este caso quiere decir que el experto no aplicó esa regla, no que la persona pidió algo inseguro. **Ejemplo con ficha:** los ejemplos viven en el dominio (`src/domain/furniture/examples.ts`); cada uno es un diseño listo (librero, buró, alacena, como antes) o una ficha que Knotty arma con el catálogo de la sesión, con su descripción y su acabado. `openExample` arma la ficha y `fromExample(design, plan)` guarda la ficha en la versión 1, así que la pestaña Mueble muestra la ficha y los pedidos que Knotty entiende solo («sin zoclo», «¿cuánto cuesta?») funcionan desde el primer clic, sin llamar al experto. El inicio muestra el aparador como cuarto ejemplo, anclado y con barniz de poliuretano. **Los ejemplos se revisan** (`examples.test.ts`, semilla de «los ejemplos curados se validan»): todos salen válidos; los de ficha, sin ningún aviso y con cada hueco como se pidió; la compra del aparador queda fija (3 hojas de 18 mm y 1 de 6, 6 bisagras súper codo, 3 pares de correderas de 35 cm). Lo que el aparador tiene y Knotty todavía no: patas abiertas (hoy va con zoclo), jaladeras de muesca en el canto del frente, frentes ranurados, laterales con perfil inclinado y un nicho sin trasera (hoy la trasera cubre todo el mueble).

30. El gabinete sobre patas (hueco 3 del catálogo de referencia, unos 12 productos; el primer caso es el aparador KC-APA-01, 940 × 1600 × 400 sobre cuatro patas abiertas bajo un faldón remetido). La base del gabinete suma `legs` («Con patas» en la ficha, «con patas» en los cambios) a `kick` y `floor`. **Cómo se arma** (`legBase` en `src/domain/furniture/modules/cabinet.ts`): el casco sube sobre las patas (el piso empieza a `LEG_HEIGHT` = 150 del suelo y los laterales y la trasera nacen en él; el alto de la ficha incluye las patas); en cada esquina una pata de dos capas del triplay del casco pegadas y atornilladas cara con cara, 36 × 72 ([estructura.md](carpinteria/estructura.md) §2.1, «2 × 18 = 36 × 72 mm»), remetida 30 del canto; entre ellas un faldón de 80 ([estructura.md](carpinteria/estructura.md) §2.1, «de 80–120 mm de alto») con tornillo de bolsillo a las patas, y el piso atornillado sobre patas y faldones. Si dos patas quedan a más de 1 200 mm lleva patas intermedias, una al frente y otra atrás, pegadas al faldón ([estructura.md](carpinteria/estructura.md) §7.1, «más de ≈ 1 200 mm de ancho → patas intermedias»), bajo el divisor más cercano si así ningún claro pasa del límite ([muebles-y-medidas.md](carpinteria/muebles-y-medidas.md) §1.1: «patas cerca de los divisores») y repartidas si no; y travesaños entre los faldones cada 600 como mucho (`MAX_SPAN`, el mismo de la mesa), para que el piso no cruce más de lo que aguanta una repisa ([estructura.md](carpinteria/estructura.md) §7.1: «un piso sobre patas se revisa como una repisa»). No hay pata comprable en el catálogo: todo sale del triplay, así que la lista de compra suma las piezas y las uniones traen su tornillo y pegamento. Sin referencia, con su porqué (`MODULE_SOURCES`): el alto de 150 (lo que muestra el KC-APA-01; la referencia no da alto de patas) y el remetido de 30 (el del zoclo). **Revisiones:** R1 revisa el piso sobre patas (no está en el suelo, así que no se exenta; los apoyos son laterales, patas y travesaños); R7 suma `base.legs` (recomendación, versión 2): entre dos patas a más de `ASSUMPTIONS.legs.maxSpan` (1 200), con el apoyo al centro que Knotty ya construye; una pata es una pieza en el suelo de no más de 150 × 150 (`legs.footprint`), así que vale también para lo que dibuja el experto. R4 (versión 3): sobre patas, la proporción alto ÷ fondo usa el fondo en que se apoyan las patas, no el del casco, y el «más fondo» que sugiere suma lo que se remeten. **Chat sin experto:** con tres valores, «sin X» va al único valor que dice «sin» algo: «con patas» pone patas y «sin patas» o «quítale las patas» lo deja directo al suelo; «con zoclo» y «sin zoclo» siguen igual. **Experto:** `skeleton@13` explica `legs` (y que las patas abiertas o ahusadas se arman rectas) y pide respetar la base que leyó la foto (que ya tenía `legs`; ruedas va directo, y se dice); `plan-adjust@11` nombra las tres bases. Cambió lo que lee el experto: falta correr `npm run compare`. **Lo guardado** no cambia de formato: la ficha suma un valor al enum y las sesiones viejas (`kick`, `floor`) se leen igual. **Banco sin experto:** dos variantes nuevas, «aparador con patas» (como el KC-APA-01: seis patas y dos travesaños) y «buró con patas», y todas siguen válidas y sin avisos. **Pruebas:** el aparador y los 32 modos de armar con patas, válidos y sin contactos sueltos; patas laminadas y pegadas, bolsillo en los faldones, piso a 150; pata intermedia bajo el divisor o al centro; sin travesaños el piso sobre patas se pandea (R1, claro de 716); sin patas intermedias, R7 `base.legs` con 1 468 y el apoyo al centro lo resuelve; R4 con el fondo de las patas (240 de 300). **Límites:** todas las piezas son cajas a lo largo de los ejes, así que las patas abiertas y ahusadas del KC-APA-01 salen rectas (se dice, no se finge una geometría que las revisiones no ven); el alto de las patas y del faldón no se editan en la ficha; no lleva niveladores (la referencia los recomienda; el catálogo tiene `leveling-foot`, pero no hay unión que lo cuelgue de una pieza); y R1 toma el piso como viga entre patas y travesaños, sin contar los faldones bajo sus cantos, que es del lado seguro.

Los pasos 5 a 8 traducen el código sin cambiar la forma de los datos; el 9 cambia de una vez los datos guardados, lo que escribe el experto y los prompts, con migración de formato; el 10 mueve carpetas.

---

## Estado

### Fase 1 — implementada (2026-09-24)

- Dominio completo con 68 tests: esquema, cotas y resolvedor, normalizador, las 14 operaciones, validación geométrica, reglas R1, R2 y R5 con alternativas, diff, historial y requisitos.
- Casos de uso con ciclo de corrección, contexto compacto y propuestas pendientes.
- Experto simulado, Anthropic y OpenAI con BYOK básico; prompts v1.
- Interfaz: inicio con ejemplos, captura de medidas y fotos, análisis por etapas, estudio 3D (veta, cantos, cotas, vistas, armado, ficha de pieza), chat con respuestas rápidas y propuestas, lista de piezas y revisión.
- Verificado en el navegador en escritorio, celular y build de producción, con el experto simulado.

### Fase 2 — implementada (2026-09-24)

- Pestaña Historial: línea de tiempo con resumen, pedido, hora, proveedor y número de operaciones; ver una versión sin restaurarla (también desde el chip «vN» del chat) y volver a ella.
- «Lo que el experto recuerda»: requisitos y decisiones visibles; se pueden quitar y agregar notas.
- Cambios en vivo: piezas nuevas caen a su lugar con un puf de aserrín, las eliminadas se desvanecen en rojo, las modificadas brillan y cambian de tamaño con resorte. También al ver versiones o alternar la propuesta.
- Los requisitos incumplidos ya no impiden dibujar: se muestran como críticos en la revisión.

### Fase 3 — implementada (2026-09-24)

- Acomodo guillotina por espesor sobre la hoja útil (refilado, corte y holgura configurables), respetando la veta y probando 12 heurísticas; se queda con la de menos hojas.
- Pestaña Materiales: total aproximado, hojas por espesor con desperdicio y diagrama SVG de cada hoja (tocar una pieza la selecciona en 3D), herrajes con paquetes, cubrecanto con merma, pegamento y lista de corte.
- Herrajes sin cantidad se calculan por separación a lo largo de la junta; bisagras según el alto de la puerta.
- Precios editables por renglón y ajustes de corte, guardados en el dispositivo.

### Fase 4 — implementada (2026-09-24)

- Reglas nuevas: R3 tornillos (penetración ≥ 25 mm, tornillo de bolsillo según espesor, juntas cortas), R4 vuelco, R6 puertas (bisagras por alto, ancho máximo), R7 base (piso elevado sin apoyo) y R8 veta. Supuestos en `domain/structure/assumptions.ts`; largo de tornillos en el catálogo.
- Revisión como reporte: conteo por severidad, hallazgos de la misma regla agrupados con sus piezas (tocables), alternativas como botones que mandan el pedido al experto, y «que el experto decida».
- Prompt del sistema a `sistema@2` con las reglas nuevas; el simulado entiende «anclar al muro».

### Fase 5 — implementada (2026-09-24)

- Captura con silueta de referencia por ángulo; cámara y galería en un componente compartido.
- Confianza por pieza: las de confianza baja se dibujan como boceto a lápiz (papel con achurado) y un aviso en la escena las cuenta. Se confirman respondiendo al experto, mandando una foto o con «Está bien así» en la ficha (crea una versión).
- El experto puede pedir fotos al reconstruir y durante los ajustes; se toman desde el chat, viajan al LLM con el siguiente mensaje y quedan como miniatura (también en «Tus fotos» del historial).
- Cada pregunta y foto de un mensaje se responde por separado.
- Prompts `reconstruccion@2` y `ajuste@2`: política de confianza (alta, media, baja), cuándo pedir fotos y cómo preguntar. `cambiarPropiedades` acepta `confianza`.

### Fase 6 — implementada (2026-09-24)

- `agregarCajon`: frente embutido con 2 mm de holgura, caja de cuatro lados atornillada, fondo clavado y correderas telescópicas (30 a 50 cm); elige la más larga que cabe en el fondo. Todo referido a las caras del hueco: si el mueble cambia, el cajón se ajusta. `eliminarGrupo` lo quita.
- La validación acepta la corredera como unión con hueco (hasta 20 mm a lo ancho) y como apoyo contra piezas flotantes.
- R9 cajones: holgura exacta de la corredera (crítico si no entra o queda flojo), fondo delgado en cajones anchos, frente que roza.
- R3 distingue tornillo por el canto (penetración ≥ 25 mm) de tornillo por la cara (que no se asome); corrigió la dirección de la unión del divisor con el piso en el simulado. Nuevo tornillo #8 × 1".
- En la vista de armado los cajones salen enteros hacia el frente. Prompt `ajuste@3` con la operación; el simulado entiende «fondo de N cm» y «agrega un cajón».

### Fase 7 — implementada (2026-09-24)

- BYOK sólido (adelantado en D20): llaves cifradas con frase, en la pestaña o en memoria, y aviso al llegar.
- Rendimiento: el SDK de Anthropic se carga solo al usar Claude (paquete inicial de 713 a 523 KB); el 3D dibuja bajo demanda; en celular, densidad de píxeles máxima 1.5, sombras de 1024 y sin oclusión ambiental por defecto.
- Accesibilidad: respeta «reducir movimiento» (sin resortes, caída, aserrín ni transiciones de cámara), la escena tiene descripción, Escape suelta la pieza, el chat es una región viva, los botones de solo ícono tienen nombre.
- Modo oscuro completo: cotas y papel de boceto con tokens del tema.
- Si el navegador no puede dibujar 3D, un aviso reemplaza la escena y el resto del estudio sigue funcionando.
- PWA: manifest, íconos generados con `scripts/brand/generate.sh` (y `ico.py` para el favicon) y service worker que abre la app sin conexión sin guardar llamadas a proveedores.

Pendiente de validar con una API key real:
- Que el esquema estricto de la respuesta lo acepten ambos proveedores (es grande: 15 operaciones y cotas anidadas). Validado con SheLLM (compatible con OpenAI); falta Anthropic y OpenAI directos.
- La calidad de la reconstrucción desde fotos reales (el banco solo usa descripciones) y de los 5 ajustes guionizados (el banco solo diseña desde cero).

### Fase 8 — implementada (2026-09-25)

- Entrega 1: bitácora y nunca tirar un diseño.
- Entrega 2: reparación por reglas (piezas encimadas, uniones sin contacto).
- Entrega 3: lectura de fotos en paralelo y guardada, con nota por foto.
- Entrega 4: esqueleto y generador de gabinetes (`domain/modules/cabinet.ts`), y revisiones de uso por tipo de mueble (R10). Con SheLLM, los gabinetes del comparativo salen en 10–26 s (antes 60–160 s); camas, escritorios y mesas se siguen diseñando pieza por pieza.

Del plan quedó fuera el paso 0 (silueta en boceto al instante por la descripción) y la reparación de piezas flotantes: solo se reparan las encimadas y las uniones sin contacto.

### Fase 9 — implementada (2026-09-25)

- Entregas 1 a 6: confianza y deshacer, avisos con estado, bandeja, acomodo de la pantalla, 3D legible con reglas de cajón, fichas de cama y de mesa o escritorio.
- Entrega 7: código, datos guardados, prompts, catálogo, preferencias, ids y carpetas en inglés (D33, pasos 1–10), con migración de todo lo guardado.
- Banco de pruebas oculto y `npm run compare` con los mismos casos, incluido uno que obliga el camino pieza por pieza.

### Pendientes de la revisión de uso (2026-09-25)

Quedaron integrados en la fase 9. La lista original:
1. Panel lateral amontonado: las revisiones como avisos tipo notificación, con salida fácil de «no hacer nada».
2. Historial y versiones más a la vista.
3. Medidas en la vista de armado.
4. Cajones viables y visibles: pieza entre cajones, correderas dibujadas en 3D, holgura entre piso y cajón; revisar con reglas de cajón los diseños que no salen del módulo.
5. Cotas legibles: tamaño fijo en pantalla, líneas de referencia al mueble, ocultar las de canto.
6. Interacción más ágil: ficha de decisiones por tipo de mueble ligada al plan (se aplica al instante, sin modelo), varias decisiones en una versión, medidas editables en el estudio, preguntas ligadas a campos del plan, módulo de cama, y qué pasa con la ficha cuando el diseño ya se salió del plan.

## Preguntas abiertas

- ¿Cómo juzgar el escuadrado (R5) de un mueble abierto que no es caja? La regla solo cuenta travesaños unidos a todos los costados, ignora los `brace` que pone el experto y sus soluciones necesitan un techo: el exhibidor escalonado sale crítico sin solución construible. Después de eso: ¿aplicar la solución sola en el primer diseño, como una reparación por reglas? (ver «Caso pieza por pieza»)

- Precios y SKU reales de triplay de pino 12/15/18 mm y trasera 3/6 mm en Home Depot MX.
- Calibrar E del triplay de pino con una prueba casera (entrepaño cargado, medir flecha) cuando haya app.
