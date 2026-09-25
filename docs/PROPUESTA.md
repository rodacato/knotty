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
   ├─ domain/                TypeScript puro: sin React, sin LLM, sin navegador
   │  ├─ design/             schema · resolve (cotas → geometría) · normalize · builders · drawers · joints · hardware · diff
   │  ├─ modules/            fichas de gabinete, cama y mesa (cabinet, bed, table), cómo se arman (plan, rebuild) y sus cambios (planChanges)
   │  ├─ operations/         schema · apply · drawer (macro de cajón)
   │  ├─ validation/         geometry · contact (grafo) · errors
   │  ├─ structure/          assumptions · review · finding · rules/ (deflection, jointThickness, racking, screws, drawers, usage)
   │  ├─ repair/ · fixes/    reparaciones por reglas y soluciones que Knotty construye para cada aviso
   │  ├─ materials/          catalog · cutList · layout (acomodo en hoja) · purchase
   │  ├─ viability/          revisión antes de comprar
   │  ├─ session/            estado guardado (state) y migración de formatos viejos (migrate)
   │  ├─ history/ · requirements/ · changes/ · reading/ · trace/ · tray/ · typology/
   │  ├─ fixtures/           ejemplos (bookcase, nightstand, wallCabinet) y catálogo de prueba
   │  └─ analysis.ts         análisis completo de un diseño: geometría, contactos, avisos, reglas y requisitos
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
   ├─ ui/                    system/ · capture/ · studio/ · scene/ · chat/ · settings/ · debug/ · store.ts · services.ts
   ├─ composition.ts         raíz de composición: instancia adapters e inyecta casos de uso
   ├─ main.tsx               arranque de React y del service worker
   └─ architecture.test.ts   fronteras entre capas
```

- **Fronteras** comprobadas por `src/architecture.test.ts`: `domain/` solo importa zod y no toca el navegador; `application/` y `ports/`, dominio y puertos; `ui/`, todo menos `adapters/`.
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

- **Fichas** (`domain/modules/`): gabinete, cama y mesa se describen con una ficha (`CabinetPlan`, `BedPlan`, `TablePlan`) y Knotty arma todas las piezas, uniones y holguras. Lo que la ficha no expresa se agrega encima como operaciones libres (`extras`).
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

Los supuestos viven en `domain/structure/assumptions.ts` como datos y cada regla en `domain/structure/rules/`. Cada hallazgo devuelve `{ code, severity, pieces, message, data, alternatives }` (severidad `critical`, `recommendation` o `detail`): el LLM narra, no calcula. Las alternativas las simula el motor (siguiente espesor, divisor al centro, claro máximo con el espesor actual).

### R1 — Flecha de entrepaños

- Viga simplemente apoyada con carga uniforme: `δ = 5·q·b·L⁴ / (384·E·I) × k_fluencia`, con `I = b·t³/12`.
- L = claro libre entre apoyos (del grafo de uniones); b = fondo; t = espesor.
- Supuestos:
  - Apoyo simple siempre (conservador).
  - Triplay de pino: E = 6 000 MPa con veta paralela al claro, 3 500 MPa perpendicular. A calibrar.
  - k_fluencia = 1.5 por carga sostenida.
  - q: ligera 50, media 100, pesada (libros) 150 kg/m².
- Umbrales: ≤ L/360 OK; L/360 – L/200 recomendación; > L/200 crítico.

| 18 mm, fondo 300, libros | Flecha | Resultado |
|---|---|---|
| Claro 600 mm | 1.3 mm | OK |
| Claro 900 mm | 6.5 mm | Crítico |
| 900 mm con divisor al centro (2 × 441) | 0.4 mm | OK |
| 15 mm, claro 600 mm | 2.2 mm | Recomendación |

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

- alto / fondo ≥ 3 → recomendación de kit antivuelco.
- Crítico si alto > 1 200 mm, alto / fondo ≥ 4 y `wallAnchored = false`.

### R5 — Escuadrado

El casco necesita al menos uno de: trasera ≥ 6 mm fijada en todo el perímetro; trasera de 3 mm pegada en rebaje; o marco rígido (zoclo + faja superior + entrepaño fijo con bolsillo o tarugo). La regla y sus soluciones suponen una caja: un mueble abierto de varios marcos (un exhibidor escalonado) sale siempre crítico y sin solución que Knotty pueda construir; está en Preguntas abiertas. Si no: crítico con alto > 600 mm, recomendación si es menor.

### R6 — Puertas

Bisagras: ≤ 900 mm → 2; ≤ 1 500 → 3; más → 4. Ancho > 600 mm → recomendación de dividir en dos hojas.

### R7 — Base

Piso con claro > 800 mm sin apoyo intermedio → recomendación.

### R8 — Veta

Entrepaño o lateral con veta perpendicular a su largo → detalle (R1 ya usa el E menor).

### R9 — Cajones

Holgura de la corredera a cada lado, fondo del cajón suficiente para su ancho, una pieza a la que atornillar cada corredera y holgura del frente con lo que lo rodea. Aplica a los cajones del módulo y a los que arma el experto.

### R10 — Uso

Revisiones por tipo de mueble (`domain/typology`): alto de una mesa o un escritorio, espacio para las piernas, medidas de la cama contra el colchón, fondo de un librero, anclaje de lo que cuelga.

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
