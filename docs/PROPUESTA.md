# Despiece — Propuesta de diseño

Web app que convierte fotos de un mueble en un diseño 3D de triplay que se explora y se ajusta conversando con un carpintero experto (un LLM). No hay edición manual: todo cambio se pide en lenguaje natural. El objetivo final es saber cómo se arma y cuántas hojas de triplay comprar.

Este documento es la referencia viva del proyecto. Las decisiones tomadas se anotan en [Decisiones](#decisiones); lo pendiente de discutir, en [Preguntas abiertas](#preguntas-abiertas).

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

Todo lo que decide vive en `domain/` y es determinista. El LLM propone; el dominio acepta o rechaza.

```
despiece/
├─ .github/workflows/        ci.yml · deploy.yml (GitHub Pages)
├─ docs/                     PROPUESTA.md (este documento)
├─ public/catalogo/          materiales.json · herrajes.json
└─ src/
   ├─ domain/                TypeScript puro: sin React, sin LLM, sin navegador
   │  ├─ diseno/             esquema · resolver (cotas → geometría) · normalizador · diff
   │  ├─ operaciones/        esquema · aplicar · propagacion
   │  ├─ validacion/         geometria · contacto (grafo) · catalogo · requisitos · errores
   │  ├─ estructura/         supuestos · motor · reglas/* · simulaciones (alternativas)
   │  ├─ materiales/         despiece · acomodo/guillotina · herrajes · costo
   │  ├─ historial/          versiones · bitacora · compactacion
   │  └─ requisitos/         esquema · verificacion
   ├─ application/           ReconstruirDesdeFotos · AjustarDiseno · ResponderPregunta
   │                         RevisarEstructura · EstimarMateriales · VolverAVersion · NuevoDiseno
   │                         contexto/ConstruirContexto · cicloCorreccion
   ├─ ports/                 LLMProvider · DesignRepository · MaterialCatalog
   │                         ProcesadorImagen · Preferencias
   ├─ adapters/
   │  ├─ llm/comun/          mensajes · Zod → JSON Schema · errores en español
   │  ├─ llm/prompts/        sistema.v1.md · reconstruccion.v1.md · ajuste.v1.md · revision.v1.md
   │  ├─ llm/anthropic/      tool_use forzado + cache_control
   │  ├─ llm/openai/         structured outputs (json_schema strict)
   │  ├─ llm/simulado/       fixtures fijos por escenario
   │  ├─ persistencia/localStorage/   con versión de esquema y migraciones
   │  ├─ catalogo/json/      fetch de public/catalogo + overrides del usuario
   │  └─ imagen/canvas/      reducción a ~1500 px JPEG y miniaturas
   ├─ ui/                    sistema/ · escena/ · captura/ · chat/ · revision/
   │                         materiales/ · historial/ · ajustes/
   └─ composicion.ts         raíz de composición: instancia adapters e inyecta casos de uso
```

- **Fronteras forzadas** con `eslint-plugin-boundaries` (o `dependency-cruiser`): `domain/` no importa React, `window` ni `adapters/`; `ui/` solo consume `application/`.
- **Zod en el dominio** es aceptable: es TypeScript puro.
- **`LLMProvider` expresa intenciones**: `reconstruir(fotos, medidas)`, `proponerAjuste(contexto, erroresPrevios?)`, `redactarRevision(reporte)`. Anthropic y OpenAI comparten `comun/` y `prompts/` y solo difieren en transporte; el simulado implementa la interfaz con fixtures. El ciclo de corrección vive en `application/` y se prueba sin red.
- **Salida estructurada**: los esquemas Zod son la única fuente; de ahí sale el JSON Schema (`z.toJSONSchema`). Por el modo estricto de OpenAI (sin `oneOf`, todos los campos requeridos) los esquemas usan uniones discriminadas por `op` y opcionales como `nullable`. Siempre se re-valida con Zod.
- **Prompts versionados**: cada archivo lleva frontmatter `id: ajuste@1`; cada versión del diseño guarda qué prompt y modelo la produjeron.

### BYOK (tomado de ai-town)

Se reutiliza el enfoque de `ai-town/src/providers/llm/`:

- `config.ts`: presets por proveedor (`mock` = Simulado, `anthropic`, `openai`) con host, modelo y etiqueta; la configuración se guarda **sin llaves**.
- `vault.ts`: llaves recordadas **cifradas con frase de paso** (PBKDF2 600k + AES-GCM); si no, viven solo en memoria.
- `transport.ts`: `listModels` para elegir modelo de una lista; `describeError` con mensajes en español (key inválida, límite, CORS, timeout).

Cambios para Despiece:

- Solo Simulado, Anthropic y OpenAI (sin SheLLM ni personalizado).
- Salida estructurada en vez de extraer JSON del texto: tool use forzado en Anthropic, `response_format: json_schema` en OpenAI. El campo `explicacion` se puede ir mostrando mientras llega, con la técnica de `partialStringField`.
- Imágenes en la reconstrucción (content blocks de imagen en ambos proveedores).
- Se atienden los pendientes de `REVIEW-1.0.md` §3: al recargar se ve qué llave falta y se pide; desbloqueo claro con frase de paso; elección explícita entre "solo esta pestaña", "este navegador (cifrada)" o "no guardar"; si una consulta falla por llave, se ofrece arreglarla ahí mismo; tests del ciclo guardar → recargar → desbloquear → olvidar.
- CSP estricta sin scripts de terceros.

---

## 3. Modelo del mueble y operaciones

### Convenciones

- Todo en **mm enteros**.
- Ejes: **X = ancho** (izq → der), **Y = alto** (piso → arriba), **Z = fondo** (trasera → frente). Origen en la esquina inferior-izquierda-trasera.

### Cotas con referencias

Cada extremo de una pieza es una **cota** que puede ser absoluta o apuntar a una cara de otra pieza o del mueble. Un resolvedor calcula las coordenadas en orden topológico. Así, "hazlo de 90 cm" o "sube a 18 mm" se propagan solos.

```ts
Diseno {
  esquema: 1
  nombre: string
  dimensiones: { ancho: mm, alto: mm, fondo: mm }
  anclajeMuro: boolean
  piezas: Pieza[]
  uniones: Union[]
  observaciones: string         // lo que el experto vio en las fotos (≤ 600 car.)
}

Pieza {
  id: string                    // estable y legible: "lat-izq", "entrepano-2"
  nombre: string                // "Lateral izquierdo"
  rol: 'lateral' | 'piso' | 'techo' | 'entrepano' | 'divisor' | 'trasera' | 'zoclo' | 'faja'
     | 'puerta' | 'frente-cajon' | 'costado-cajon' | 'fondo-cajon' | 'refuerzo' | 'otro'
  material: MaterialId          // "T12" | "T15" | "T18" | "TR3" | "TR6" (del catálogo)
  normal: 'x' | 'y' | 'z'       // eje del espesor
  x: Tramo; y: Tramo; z: Tramo  // en el eje normal se ancla una sola cara; el largo es el espesor
  veta: 'largo' | 'ancho' | 'libre'
  carga: 'ninguna' | 'ligera' | 'media' | 'pesada'
  apoyo: 'fijo' | 'movil'
  cantos: ('frente' | 'atras' | 'izq' | 'der' | 'arriba' | 'abajo')[]   // con cubrecanto
  grupo: string | null          // "puerta-1", "cajon-2"
  confianza: 'alta' | 'media' | 'baja'
}

Tramo   = { desde: Cota, hasta: Cota }            // ejes de la cara
        | { cara: Cota, lado: 'desde' | 'hasta' } // eje normal
Cota    = { mm: number }                          // absoluta desde el origen
        | { ref: CaraRef, mas: number }           // "lat-izq.x1" + 0
        | { entre: [CaraRef, CaraRef], t: number } // proporcional (divisor al centro: t = 0.5)
CaraRef = "mueble.x0" | "mueble.x1" | … | "<piezaId>.x0" | "<piezaId>.y1" | …

Union {
  id: string
  a: PiezaId; b: PiezaId        // a se fija a b
  tipo: 'tope-tornillo' | 'bolsillo' | 'tarugo' | 'minifix' | 'canal' | 'rebaje' | 'escuadra'
      | 'clavo-pegamento' | 'soporte-repisa' | 'bisagra-cazoleta' | 'corredera'
  pegamento: boolean
  penetracion: mm | null        // canal / rebaje: traslape permitido
  herrajes: { herrajeId: string, cantidad: number | null }[]   // null → la calcula R3
}
```

- **Normalizador**: al LLM le cuesta generar grafos de referencias, así que puede mandar cotas absolutas; toda cota a ±3 mm de una cara existente se "imanta" y se convierte en `ref`.
- **Derivados**: la geometría resuelta, el grafo de contacto, el despiece y el acomodo nunca se guardan. Al LLM sí se le manda la caja resuelta de cada pieza como dato de solo lectura.

### Operaciones (unión discriminada por `op`)

| `op` | Parámetros | Notas |
|---|---|---|
| `agregarPieza` | `pieza` | id nuevo |
| `eliminarPieza` | `id` | elimina sus uniones; las cotas que la referían se congelan a mm y se reporta |
| `eliminarGrupo` | `grupo` | |
| `duplicarPieza` | `id, nuevoId, nombre, eje, cota` | "agrega otra repisa igual" |
| `redimensionar` | `id, eje, extremo, cota` | |
| `mover` | `id, eje, cota` | conserva el largo |
| `distribuir` | `ids[], eje, entre: [CaraRef, CaraRef]` | reparte con cotas proporcionales |
| `cambiarEspesor` | `ids[], material` | lo referido se recorre solo |
| `cambiarPropiedades` | `id, { nombre?, veta?, carga?, apoyo?, cantos?, rol? }` | |
| `agregarUnion` / `cambiarUnion` / `eliminarUnion` | `union` / `id, cambios` / `id` | |
| `cambiarDimensionGlobal` | `eje, valor, regla: 'estirar' \| 'proporcional'` | ver abajo |
| `cambiarAnclajeMuro` | `valor` | |

`cambiarDimensionGlobal`:

- **estirar**: mueve la cara del mueble; lo referido se estira o se recorre; lo proporcional conserva su proporción.
- **proporcional**: además escala las cotas absolutas del eje.

### Respuesta del LLM en un ajuste

```ts
{
  explicacion: string            // qué cambia y por qué
  resumen: string                // ≤ 80 car., para la línea de tiempo
  operaciones: Operacion[]       // vacía si solo pregunta
  preguntas: { texto, opciones: string[] | null }[]
  requisitos: { agregar: Requisito[], quitar: string[] }
  decisiones: { tema: string, texto: string }[]
  aceptaRiesgo: { codigo, justificacion }[]   // si el usuario eligió "bajo mi riesgo"
}
```

### Ciclo de validación

1. Zod valida la respuesta.
2. Se aplican las operaciones sobre una copia y se resuelven las cotas.
3. Se valida: geometría → catálogo → requisitos → estructura.
4. **Errores bloqueantes**: se reenvían al LLM con código y datos (`E_TRASLAPE {a, b, volumen}`). Máximo 2 reintentos; si falla, el experto lo dice ("No logré hacer ese cambio sin romper X") y no se aplica nada.
5. **Críticos estructurales nuevos**: se devuelven al LLM con las alternativas simuladas por el motor. El LLM incluye la mitigación si no es ambigua, o propone opciones en botones y el cambio queda en vista previa.
6. Si todo pasa: versión nueva, diff y animación.

Códigos bloqueantes: `E_ESQUEMA`, `E_REF_INEXISTENTE`, `E_CICLO`, `E_TRAMO_INVALIDO`, `E_TRASLAPE`, `E_FLOTANTE`, `E_MEDIDA_GLOBAL`, `E_ESPESOR_CATALOGO`, `E_NO_CABE_EN_HOJA`, `E_UNION_SIN_CONTACTO`, `E_REQUISITO`. Aviso: `A_CONTACTO_SIN_UNION`.

Flotantes: grafo de contacto (caras coincidentes a ±0.5 mm más uniones declaradas); toda pieza debe conectarse con alguna que toque `y = 0`.

---

## 4. Contexto e historial para el LLM

### Tres memorias

| Memoria | Qué guarda | Quién la escribe | Límite |
|---|---|---|---|
| **Requisitos** | Hechos del usuario: espacio, carga, herramientas disponibles | El LLM los propone; el usuario los ve y puede borrarlos | ~15, sin duplicados por tipo |
| **Decisiones** | Razonamiento de diseño: "trasera de 6 mm para escuadrar" | El LLM, con clave `tema` | 15; la nueva del mismo tema reemplaza |
| **Bitácora** | Por versión: número, resumen, motivo, operaciones abreviadas | Determinista | ver compactación |

Los requisitos tienen forma estructurada cuando se puede (`{tipo:'espacio', eje:'x', max:900}`), así el dominio los verifica (`E_REQUISITO`) sin depender de que el LLM los recuerde.

### Qué se envía en cada ajuste

Del más estable al más volátil, para aprovechar el caché de prompts:

1. **Sistema** (fijo, cacheable, ~4–5k tokens): rol, convenciones, esquema, operaciones con ejemplos, catálogos con ids, cómo leer los resultados estructurales.
2. **Diseño actual** (~2–4k tokens para ~30 piezas): modelo, caja resuelta por pieza y `observaciones`.
3. **Reporte estructural vigente**: solo hallazgos que no están OK, con sus datos.
4. **Requisitos y decisiones.**
5. **Bitácora compactada**: últimas 8 versiones completas; de la 9 a la 30 solo `vN: resumen`; más allá, una línea "N cambios anteriores".
6. **Chat**: últimos 6 mensajes (respuestas de botón como texto).
7. **Petición actual**, y en reintentos los errores del intento anterior.

`ConstruirContexto` estima tokens; si pasa de ~14k recorta en orden: chat antiguo → bitácora media → decisiones más viejas. Nunca recorta el modelo ni los requisitos.

### Fotos

Solo se mandan en la reconstrucción. En los ajustes, lo visual vive en `observaciones`. Durante la sesión las fotos reducidas quedan en memoria por si el experto pide re-mirarlas; en localStorage solo miniaturas (≤ 6 de 160 px, JPEG 0.6, ~8 KB cada una).

### Persistencia

- Clave `despiece:v1:diseno` → `{ modelo, versiones[{ n, snapshot, resumen, motivo, promptId, modelo }], requisitos, decisiones, chat, miniaturas }`.
- Snapshots completos (~10 KB). Tope de 40 versiones: se conserva la v1 y se podan las intermedias más viejas.
- Guardia de cuota y migraciones por `esquema`.

---

## 5. Reglas estructurales

Los supuestos viven en `domain/estructura/supuestos.ts` como datos. Cada hallazgo devuelve `{ codigo, severidad, piezas, datos, alternativas }`: el LLM narra, no calcula. Las alternativas las simula el motor (siguiente espesor, divisor al centro, claro máximo con el espesor actual).

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
- Crítico si alto > 1 200 mm, alto / fondo ≥ 4 y `anclajeMuro = false`.

### R5 — Escuadrado

El casco necesita al menos uno de: trasera ≥ 6 mm fijada en todo el perímetro; trasera de 3 mm pegada en rebaje; o marco rígido (zoclo + faja superior + entrepaño fijo con bolsillo o tarugo). Si no: crítico con alto > 600 mm, recomendación si es menor.

### R6 — Puertas

Bisagras: ≤ 900 mm → 2; ≤ 1 500 → 3; más → 4. Ancho > 600 mm → recomendación de dividir en dos hojas.

### R7 — Base

Piso con claro > 800 mm sin apoyo intermedio → recomendación.

### R8 — Veta

Entrepaño o lateral con veta perpendicular a su largo → detalle (R1 ya usa el E menor).

Las fallas geométricas (traslape, flotante, medida total, pieza mayor que la hoja útil) son errores bloqueantes, no severidades.

---

## 6. Materiales

- **Catálogo** en `public/catalogo/*.json`, cargado en tiempo de ejecución; desde Ajustes se pueden sobreescribir precios (localStorage). SKU y precios de Home Depot MX: placeholders marcados hasta llenarlos.
- **Acomodo guillotina** por espesor:
  - Área útil = hoja − 2 × refilado (10 mm). Corte de sierra 4 mm, holgura 2 mm por pieza. Todo configurable.
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

---

## Estado

### Fase 1 — implementada (2026-09-24)

- Dominio completo con 68 tests: esquema, cotas y resolvedor, normalizador, las 14 operaciones, validación geométrica, reglas R1, R2 y R5 con alternativas, diff, historial y requisitos.
- Casos de uso con ciclo de corrección, contexto compacto y propuestas pendientes.
- Experto simulado, Anthropic y OpenAI con BYOK básico; prompts v1.
- Interfaz: inicio con ejemplos, captura de medidas y fotos, análisis por etapas, estudio 3D (veta, cantos, cotas, vistas, armado, ficha de pieza), chat con respuestas rápidas y propuestas, lista de piezas y revisión.
- Verificado en el navegador en escritorio, celular y build de producción, con el experto simulado.

Pendiente de validar con una API key real:
- Que el esquema estricto de la respuesta lo acepten ambos proveedores (es grande: 14 operaciones y cotas anidadas).
- La calidad de la reconstrucción desde fotos reales y de los 5 ajustes guionizados (criterios de éxito de la fase).

## Preguntas abiertas

- Precios y SKU reales de triplay de pino 12/15/18 mm y trasera 3/6 mm en Home Depot MX.
- Calibrar E del triplay de pino con una prueba casera (entrepaño cargado, medir flecha) cuando haya app.
