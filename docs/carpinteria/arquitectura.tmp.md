# 07 — Arquitectura del conocimiento

Cómo meter en Knotty el conocimiento de carpintería que reúnen los documentos hermanos de `docs/investigacion/` (material, uniones y herrajes, acabados, tipologías y medidas, reglas estructurales, glosario y fabricación) de forma que sea **una sola fuente de verdad** para el dominio, la interfaz y el experto (LLM), que se pueda extender sin tocar el núcleo y que siga siendo determinista y verificable.

> Base: `docs/PROPUESTA.md` (D1–D37, fases 8 y 9, D33) y el código de `main` al 2026-09-25 (commit `54c42aa`, que ya trae `domain/fixes` y `application/notices.ts`). Las líneas citadas son de ese commit.
>
> Unidades: todo en sistema métrico. Lo que en México se vende en pulgadas (tornillos, algunas correderas) se guarda en **mm** y lleva su **designación comercial** como texto de presentación (`tradeName: '#8 × 1¼"'`); nunca se calcula una pulgada para mostrarla.

---

## Resumen

1. Hoy el conocimiento está **repartido en siete lugares** (constantes en `typology.ts`, `supuestos.ts`, `cabinet.ts`, `cajon.ts`, `joints.ts`, el catálogo JSON y los prompts `.md`), con al menos **once datos duplicados** entre prompts, dominio e interfaz, y ya hay desviaciones (el escritorio va de 700–780 mm en el dominio y de 720–760 en el prompt del dictamen).
2. Propuesta: una **base de conocimiento tipada** en `src/domain/knowledge/`, la capa más baja del dominio, con seis capas: vocabulario → materiales y acabados → uniones y herrajes → tipos de mueble → plantillas y prehechos → reglas y soluciones.
3. **Datos en JSON** validado con Zod e importado de forma estática (versionado con el código, sin red); **comportamiento en TypeScript** (métricas geométricas, constructores de plantillas, comprobaciones de reglas y soluciones). La regla de oro: *un número o un texto que un carpintero podría corregir es dato; una cuenta sobre la geometría es código*.
4. Los prompts dejan de repetir números: se **generan** desde los datos (`{{tipologias}}`, `{{uniones}}`…), y una prueba impide que vuelvan a aparecer medidas escritas a mano.
5. Cada dato cita su fuente en la investigación, lleva versión, y lo calibrable (el módulo E del triplay, por ejemplo) se puede ajustar en el dispositivo dentro de límites.
6. Adopción en **once entregas chicas**, cada una útil sola, empezando por lo que no cambia formatos guardados y alineadas con la fase 9 y con el orden de D33.

---

## 1. Diagnóstico

### 1.1 Dónde vive hoy el conocimiento

| Conocimiento | Dónde | Forma |
|---|---|---|
| Qué mueble es | `domain/typology/typology.ts:11-26` (`KINDS`, `detectKind`) | Expresiones regulares sobre `diseno.nombre` |
| Medidas por tipo (colchones, mesas, escritorio, rodillas, banca) | `typology.ts:28-35` | Constantes sueltas |
| Revisiones de uso por tipo (R10) | `typology.ts:67-208` | Una función por tipo en un `switch` |
| Subtipo de mesa, tamaño de colchón | `typology.ts:72-73`, `:133-134` | Otra vez expresiones regulares sobre el nombre |
| Supuestos de ingeniería (E, fluencia, cargas, flecha, espesores por unión, tornillos, vuelco, puertas, cajones) | `domain/estructura/supuestos.ts:5-54` | Objeto `as const`: bien como dato, pero sin fuente, sin versión y sin calibrar |
| Categorías de piezas (perímetro, travesaños, veta visible) | `estructura/reglas/escuadrado.ts:4-5`, `reglas/uso.ts:92` | `Set` de roles dentro de cada regla |
| Jerarquía de piezas para reparar encimados | `domain/repair/repair.ts:23` | `RANK` por rol |
| Nombres para la persona de uniones y cargas | `reglas/uniones.ts:7-19`, `reglas/flecha.ts:7` | Mapas locales |
| Cómo se arma un gabinete (zoclo 70 mm, retranqueo 30, holgura 2, bisagra embutida) | `domain/modules/cabinet.ts:35-40` | Constantes del constructor |
| Opciones de construcción y su explicación | `cabinet.ts:13-22` (`.describe()` para el LLM) | Texto dentro del esquema Zod |
| Las mismas opciones en palabras | `modules/planChanges.ts:6-13` **y** `ui/estudio/PlanSheet.tsx:14-19` | Dos copias con redacción distinta |
| Holguras del cajón | `domain/operaciones/cajon.ts:9-12` | Constantes |
| Qué herraje va en cada unión común | `domain/diseno/joints.ts:14, 25, 32, 41, 54`; `cajon.ts:79-83`; `cabinet.ts:40` | Ids del catálogo escritos a mano en el dominio |
| Soluciones que Knotty construye | `domain/fixes/fixes.ts:87-104` | `switch` por `alternativa.clave` |
| Títulos de los avisos | `application/notices.ts:33-44` | Mapa `TITLES` por código de regla, en la capa de aplicación |
| Qué tipos no son gabinete | `application/casosDeUso.ts:220` (`NOT_CABINETS`) | `Set` en la capa de aplicación |
| Materiales, herrajes, hoja, refilado, precios | `public/catalogo/catalogo.json` + `domain/materiales/catalogo.ts` | JSON validado con Zod, cargado por puerto: **el mejor ejemplo actual** |
| Tiras mínimas, aprovechamiento | `domain/viabilidad/viabilidad.ts:11-14` | Constantes |
| Colores de la madera en 3D | `ui/escena/texturas.ts:10-11` | Constantes por `tipo` de material |
| Medidas típicas, reglas de oficio, lista de gabinetes, valores por omisión | `adapters/llm/prompts/*.md` | Prosa con números escritos a mano |

### 1.2 Qué está duplicado (y ya se desvió)

| Dato | En el dominio | En prompts o interfaz | Estado |
|---|---|---|---|
| Hoja útil 2410 × 1188 | `catalogo.json` (hoja − 2 × refilado) | `sistema.v4.md:49` escrito a mano | Igual hoy; se rompe si cambia el refilado en Ajustes (D22) |
| Largo del tornillo de bolsillo | `supuestos.ts:37-41` (tabla en mm) | `sistema.v4.md:56` («1" en 12–15 mm y 1¼" en 18 mm») | Igual, con redacción distinta |
| Penetración mínima 25 mm | `supuestos.ts:33` | `sistema.v4.md:56` | Igual |
| Uniones comunes que pone la app | `joints.ts:19-44` | `sistema.v4.md:56`, `ajuste.v6.md:15` | La prosa describe el algoritmo; si cambia, miente |
| Qué muebles son gabinete | `casosDeUso.ts:220` (lo contrario: cuáles no) | `esqueleto.v2.md:6` (lista) | Dos listas que se mantienen a mano |
| Construcción por omisión | `cabinet.ts:22` | `esqueleto.v2.md:15` | Igual hoy |
| Alto mínimo de hueco de cajón | `cajon.ts:53` (12 + 20 + 60 = **92 mm**) | `esqueleto.v2.md:23`, `ajuste-ficha.v1.md:14` (**100 mm**) | Distinto |
| Puerta de dos hojas | `supuestos.ts:44` (`anchoMaximo: 600`) | `esqueleto.v2.md:24`, `ajuste-ficha.v1.md:14` | Igual, triplicado |
| Alto de escritorio | `typology.ts:31` (**700–780**) | `dictamen.v1.md:11` (**72–76 cm**) | Distinto |
| Fondo de librero | `typology.ts:199` (mín. 230; mensaje «230–300») | `dictamen.v1.md:11` («25–30 cm») | Distinto |
| Colchones | `typology.ts:29` | `reconstruccion.v6.md:8`, `dictamen.v1.md:11` | Igual, triplicado |
| Etiquetas de construcción | `planChanges.ts:7-13` | `PlanSheet.tsx:14-19` | Redacción distinta («cubierta encima» / «Cubierta encima») |

Además, `docs/PROPUESTA.md` §6 dice «refilado (10 mm)» y D29 dice 15 mm: la misma deriva, en la documentación.

### 1.3 Qué es difícil de extender

- **El tipo de mueble no es un dato del diseño.** `Diseno` no tiene `kind`; se adivina con expresiones regulares sobre el nombre (`typology.ts:23-26`). Renombrar «Zapatera» a «Mueble de entrada» apaga sus revisiones. El orden de `KINDS` importa: «mesa de noche» tiene que ir antes que «mesa» (`:15` contra `:20`). La lectura de fotos devuelve `kind` como texto libre (`reading.ts:22`) y `casosDeUso.ts:232` lo junta con las notas para volver a pasarlo por la misma expresión regular.
- **Un tipo nuevo toca cinco lugares**: `Kind` y `KINDS` en `typology.ts`, su función y su `case`, `NOT_CABINETS` en aplicación, la lista del prompt `esqueleto` y, si tiene medidas típicas, el prompt `dictamen`.
- **Las soluciones no cubren lo que las reglas proponen.** Las reglas emiten unas 20 claves de alternativa (`mas-fondo`, `dos-puertas`, `mas-bisagras`, `trasera-6`, `fondo-6`, `tornillo-mas-largo`, `medida-colchon`, `hueco-piernas`…) y `fixes.ts:87-104` construye 6 (`subir-espesor`, `divisor-al-centro`, `apoyo-central`, `anclar-muro`, `liston-colgar`, `faja-rigida`). Nada distingue «Knotty no sabe construirla todavía» de «esto necesita criterio del experto» (D34). Las claves son texto libre: un error de dedo no lo detecta el compilador.
- **Todo R10 comparte un código** (`R10_USO`): no se puede aceptar (D37) «el fondo de la zapatera» sin aceptar también «anclarla».
- **Los supuestos no llevan fuente, versión ni límites.** `SUPUESTOS` es `as const`: no se puede calibrar en el dispositivo (la pregunta abierta de calibrar E) y no hay forma de saber que un umbral cambió.
- **Sólo hay una plantilla** (`CabinetPlan`), y su ficha (Zod + `.describe()`), sus etiquetas (`planChanges`, `PlanSheet`) y su prompt (`ajuste-ficha`) son cuatro descripciones del mismo objeto.
- **Ids del catálogo dentro del dominio** (`'clavo-sin-cabeza-1'`, `'tornillo-8x2'`, `/^tornillo-8x/`): si la tienda cambia de tornillo, se edita código.
- **Pulgadas calculadas.** `reglas/tornillos.ts:6-13` convierte mm a pulgadas para el mensaje. Con la indicación del autor, la designación comercial sale del catálogo, no de una cuenta.
- **Identificadores en español que se guardan** (`rol: 'entrepano'`, `tipo: 'tope-tornillo'`): D33 los va a pasar a inglés con migración de formato; si el vocabulario no es un dato, la migración es un `switch` más.
- **Una trampa del test de arquitectura:** `arquitectura.test.ts:52` rechaza cualquier archivo de `domain/` que contenga la palabra `document` (la busca como uso del navegador). Un comentario en inglés como «see the research document» rompe la prueba. En `knowledge/` conviene escribir «doc» o «source».

### 1.4 Qué funciona y se conserva

- Supuestos como datos separados de las reglas (`supuestos.ts`) y catálogo JSON validado con Zod detrás de un puerto (`MaterialCatalog`).
- Zod como única fuente de los esquemas del LLM (`esquemaEstricto`).
- Reglas como funciones puras `(ctx) => Hallazgo[]` que **calculan las alternativas** (el LLM narra, no calcula).
- Uniones comunes por geometría (`completeJoints`), cajón y gabinete como constructores deterministas (D23, fase 8).
- El diseño guardado es un snapshot: los derivados (geometría, hallazgos) se recalculan siempre.

---

## 2. Principios

1. **Una sola fuente.** Cada número, rango, sinónimo o texto de oficio existe en un solo lugar; el dominio lo usa, la interfaz lo muestra y el prompt lo recibe generado.
2. **Datos donde un carpintero corregiría; código donde hay geometría.** Un umbral es dato; «el claro libre entre apoyos» es código.
3. **Registro explícito, no magia.** Agregar un tipo, una plantilla o una solución es agregar un archivo y **una línea** en un índice. Nada de `import.meta.glob` en el dominio.
4. **El conocimiento es la capa más baja del dominio.** `knowledge/` sólo importa Zod y sus propias unidades; todo lo demás lo importa a él.
5. **Todo dato cita su fuente** y declara qué tan firme es (norma, fabricante, medición, regla de taller, supuesto).
6. **Determinista y verificable.** Invariantes en pruebas de datos; propiedades en pruebas generativas; nada se decide con el LLM si una tabla basta (D34).
7. **Sistema métrico.** mm, MPa, kg/m²; las pulgadas sólo como `tradeName`.
8. **Español para la persona, inglés para el código** (D33): ids en inglés, `label` y mensajes en español de México.

---

## 3. Propuesta

### 3.1 Capas

```
                      ┌───────────────────────────────────────────────┐
  adapters/llm ──────▶│ render: conocimiento → secciones del prompt   │
  ui (ficha, ajustes) │                                               │
  application ───────▶│ registry: kb = { vocabulary, materials, ... } │
                      └───────────────┬───────────────────────────────┘
                                      │ lee
 domain/                              ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ modules/ (plantillas: build)   estructura/ (reglas: check)          │
 │ fixes/ (soluciones: build)     decide/ (defaults, espesor, unión)   │   comportamiento (TS)
 ├────────────────────────────────────────────────────────────────────┤
 │ knowledge/                                                          │
 │   6 fixes (catálogo de claves)    5 templates + presets (datos)     │
 │   4 kinds (rangos, defaults, comprobaciones declarativas)           │   datos (JSON + Zod)
 │   3 joinery + hardware specs      2 materials + finishes            │
 │   1 vocabulary (glosario)         0 units, source, version          │
 └────────────────────────────────────────────────────────────────────┘
```

Cada capa sólo referencia a las de abajo por **id** (un tipo de mueble nombra sus plantillas y soluciones; una unión nombra sus herrajes). La integridad referencial se comprueba al cargar y en pruebas.

### 3.2 Qué es dato y qué es código

| Pieza | Forma | Por qué |
|---|---|---|
| Glosario (términos, sinónimos, ids antiguos) | JSON | Lo edita quien investiga; sirve a la interfaz, al prompt, a `detectKind` y a la migración D33 |
| Materiales: grados, espesores reales, E, densidad | JSON | Tabla de fabricante o medición; calibrable |
| Acabados: color, brillo, rugosidad, capas, secado | JSON | Parámetros visuales y de proceso; los lee `ui/escena` |
| Especificaciones de uniones: espesores mínimos, herramienta, dificultad, herraje | JSON | Tabla de oficio |
| Especificaciones de herrajes: largo en mm, calibre, holguras, `tradeName` | JSON (se queda en `public/catalogo`) | Depende de la tienda; ya se carga por puerto y tiene precios editables (D22) |
| Tipos de mueble: rangos, defaults, comprobaciones declarativas | JSON | Rangos de la investigación de tipologías |
| Prehechos (plantilla + parámetros + expuestos) | JSON | Es un plan concreto, no lógica |
| Umbrales y parámetros de las reglas | JSON | Lo que hoy es `SUPUESTOS` |
| Métricas geométricas (fondo, superficie de trabajo, hueco para piernas, claro libre, separación de repisas) | TS | Recorren la geometría resuelta |
| Comprobación de cada regla estructural | TS | Fórmulas (flecha), grafos (escuadrado), contactos (cajones) |
| Constructor de cada plantilla | TS | Genera cotas con referencias; debe ser tipado |
| Constructor de cada solución | TS | Genera operaciones o parches de ficha |
| Mensajes para la persona | Plantillas de texto en JSON con `{marcadores}` | Se corrigen sin tocar código; los interpola una función de 10 líneas |

**Dónde se cargan.** Los JSON de `knowledge/` se importan de forma estática (`import kinds from './data/kinds/shoe-rack.json'`): viajan en el paquete, el dominio sigue siendo síncrono y las pruebas no necesitan red. `tsconfig.json` ya tiene `resolveJsonModule`, y el test de arquitectura acepta el import porque es relativo dentro de `domain/`. Sólo lo que depende de la tienda (precios, SKU, herrajes disponibles) sigue en `public/catalogo/` detrás de `MaterialCatalog`.

**Por qué JSON y no objetos TS `as const`.** JSON obliga a que sea sólo dato (no se cuela una función), se puede generar o comprobar con un script a partir de las tablas de la investigación, se diffea limpio y, si algún día hace falta, se puede servir desde `public/` sin reescribirlo. Lo que se pierde (tipos literales) se recupera con Zod: los ids se validan contra el registro al cargar.

### 3.3 Capa 0 — unidades, fuentes y versión

```ts
// src/domain/knowledge/units.ts
import { z } from 'zod'

/** Millimetres. Branded so a fraction or a count cannot be passed where a length is expected. */
export const Mm = z.number().finite().brand<'Mm'>()
export type Mm = z.infer<typeof Mm>
export const mm = (value: number): Mm => value as Mm

export const Mpa = z.number().positive().brand<'Mpa'>()
export const KgPerM2 = z.number().nonnegative().brand<'KgPerM2'>()
export const Fraction = z.number().min(0).max(1).brand<'Fraction'>()

/** A range from the research: what is acceptable and what is typical. */
export const MmRange = z
  .object({ min: Mm, typical: Mm, max: Mm })
  .refine((r) => r.min <= r.typical && r.typical <= r.max, 'Se esperaba min ≤ típico ≤ max')
export type MmRange = z.infer<typeof MmRange>

export const clamp = (value: number, r: MmRange): Mm => mm(Math.min(r.max, Math.max(r.min, value)))
export const within = (value: number, r: Pick<MmRange, 'min' | 'max'>) => value >= r.min && value <= r.max
```

```ts
// src/domain/knowledge/source.ts
import { z } from 'zod'

/** Where a value comes from: a heading of a research file, so every rule can be traced back. */
export const SourceRef = z.object({
  file: z.string().regex(/^docs\/investigacion\/\d{2}-[a-z0-9-]+\.md$/),
  anchor: z.string().regex(/^[a-z0-9-]+$/).describe('Slug del encabezado'),
  /** How firm it is: a standard or a maker's table weighs more than a shop habit. */
  strength: z.enum(['standard', 'manufacturer', 'measured', 'shopRule', 'assumption']),
  note: z.string().nullable().default(null),
})
export type SourceRef = z.infer<typeof SourceRef>

/** Sourced: every piece of knowledge carries at least one reference. */
export const sourced = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, sources: z.array(SourceRef).min(1) })
```

```ts
// src/domain/knowledge/version.ts
/** Bumped whenever a threshold, range or template changes; stored with each version of a design. */
export const KNOWLEDGE_VERSION = '2026.10.1'
```

Los tipos marcados se usan **en la frontera del conocimiento** (datos, `decide/`, parámetros de plantillas). No se imponen todavía en `Diseno`: `Mm + Mm` es `number` en TypeScript y marcar cada cota llenaría el resolvedor de conversiones. Cuando D33 migre el esquema (paso 7, `formato: 2`), se evalúa si vale la pena.

### 3.4 Capa 1 — vocabulario (glosario canónico)

```ts
// src/domain/knowledge/vocabulary.ts
import { z } from 'zod'
import { sourced } from './source'

export const TermCategory = z.enum(['kind', 'role', 'joint', 'hardware', 'material', 'finish', 'operation', 'tool', 'construction'])

export const Term = sourced({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/).describe('Id en inglés, camelCase: "shelf", "shoeRack"'),
  category: TermCategory,
  label: z.string().min(1).describe('Como se dice en México: "Repisa"'),
  plural: z.string().min(1),
  /** Other words people use for it; used to recognize the kind in a description and to explain it to the model. */
  aliases: z.array(z.string().min(1)).default([]),
  /** Spanish ids stored before D33, so format 2 can read format 1. */
  legacyIds: z.array(z.string()).default([]),
  definition: z.string().min(1).describe('Una frase, para la persona y para el experto'),
})
export type Term = z.infer<typeof Term>

/** Longest alias first, so "mesa de noche" wins over "mesa". Replaces the ordered regex list in typology.ts. */
export function recognize(terms: Term[], category: Term['category'], text: string): Term | null {
  const haystack = ` ${normalize(text)} `
  const candidates = terms
    .filter((t) => t.category === category)
    .flatMap((t) => [t.label, ...t.aliases].map((alias) => ({ term: t, alias: normalize(alias) })))
    .sort((a, b) => b.alias.length - a.alias.length)
  return candidates.find((c) => haystack.includes(` ${c.alias} `))?.term ?? null
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
```

```json
// src/domain/knowledge/data/vocabulary/roles.json (extracto)
[
  {
    "id": "shelf", "category": "role", "label": "Repisa", "plural": "Repisas",
    "aliases": ["entrepaño", "anaquel", "charola", "balda", "estante"], "legacyIds": ["entrepano"],
    "definition": "Tablero horizontal entre los laterales que carga lo que se guarda; fija o móvil.",
    "sources": [{ "file": "docs/investigacion/06-glosario.md", "anchor": "11-el-cuerpo-casco", "strength": "shopRule", "note": null }]
  },
  {
    "id": "kick", "category": "role", "label": "Zoclo", "plural": "Zoclos",
    "aliases": ["rodapié", "zócalo"], "legacyIds": ["zoclo"],
    "definition": "Tira al frente, abajo, que levanta el mueble del piso y lo protege de golpes.",
    "sources": [{ "file": "docs/investigacion/06-glosario.md", "anchor": "11-el-cuerpo-casco", "strength": "shopRule", "note": null }]
  }
]
```

Los roles también tienen **atributos** que hoy están escondidos en `Set` dentro de las reglas (`escuadrado.ts:4-5`, `uso.ts:92`, `repair.ts:23`): `perimeter`, `crossMember`, `visibleGrain`, `repairRank`. Pasan a una tabla `roleTraits.json`, y las reglas preguntan `traits(role).perimeter` en lugar de repetir listas.

*Nota de auditoría:* los marcadores `NN-*.md` se sustituyeron por los documentos reales (`06-glosario.md`, `04-tipologias-y-medidas.md`, `05-reglas-estructurales.md`). El `anchor` es el slug del encabezado **sin acentos ni eñes** (GitHub los conserva, pero la expresión regular de `SourceRef.anchor` no los admite): «1. Flecha (pandeo) de repisas (R1)» → `1-flecha-pandeo-de-repisas-r1`, «2.6 Zapateras» → `26-zapateras`, «1.1 El cuerpo (casco)» → `11-el-cuerpo-casco`. La prueba de §6.1 debe normalizar igual que `normalize()`. La etiqueta canónica es «Repisa» (no «Entrepaño»), como recomienda `06-glosario.md` §9.1.

### 3.5 Capa 2 — materiales y acabados

```ts
// src/domain/knowledge/materials.ts
import { z } from 'zod'
import { Mm, Mpa, MmRange } from './units'
import { sourced } from './source'

/** A grade of board, independent of the store: the catalog (public/catalogo) says which ones are for sale and at what price. */
export const BoardGrade = sourced({
  id: z.string().describe('"pinePlywood"'),
  label: z.string().describe('"Triplay de pino"'),
  nominalThicknesses: z.array(Mm).min(1),
  /** Real thickness varies: an 18 mm board measures 17–18. Grooves and inset fronts depend on it. */
  realThickness: z.record(z.string(), MmRange),
  modulus: z.object({ parallel: Mpa, perpendicular: Mpa }).describe('Flexión según la veta respecto al claro'),
  density: z.number().positive().describe('kg/m³'),
  faces: z.enum(['paint', 'stain', 'either']).describe('Qué acabado admite la cara'),
  calibratable: z.array(z.enum(['modulus.parallel', 'modulus.perpendicular'])).default([]),
})
export type BoardGrade = z.infer<typeof BoardGrade>

/** A finish, with what the 3D scene needs to draw it and what the build steps need to plan it. */
export const Finish = sourced({
  id: z.string(),
  label: z.string().describe('"Barniz de poliuretano mate"'),
  visual: z.object({
    tint: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().describe('null = color natural de la madera'),
    opacity: z.number().min(0).max(1).describe('0 transparente (se ve la veta), 1 cubriente'),
    roughness: z.number().min(0).max(1),
    clearcoat: z.number().min(0).max(1),
  }),
  process: z.object({ coats: z.number().int().positive(), dryHoursBetweenCoats: z.number().positive(), sandingGrit: z.array(z.number().int()) }),
  compatibleWith: z.array(z.string()).describe('Ids de BoardGrade'),
})
export type Finish = z.infer<typeof Finish>
```

`ui/escena/texturas.ts:10-11` deja de tener colores propios: lee `visual` del acabado (la interfaz puede importar el dominio). El dictamen y los pasos de armado leen `process`.

### 3.6 Capa 3 — uniones y herrajes

```ts
// src/domain/knowledge/joinery.ts
import { z } from 'zod'
import { Mm } from './units'
import { sourced } from './source'

// Audit note: one list for 02, 06, 07 and 09 (10-auditoria.md §3).
export const ToolId = z.enum([
  'drill', 'impactDriver', 'countersink', 'hammer', 'circularSaw', 'tableSaw', 'jigsaw', 'router',
  'pocketJig', 'dowelJig', 'biscuitJoiner', 'confirmatBit', 'forstner15', 'forstner35', 'shelfPinJig',
  'nailGun', 'stapler', 'clamps', 'square', 'tape', 'sander', 'studFinder',
])
export type ToolId = z.infer<typeof ToolId>

export const JointSpec = sourced({
  id: z.string().describe('"buttScrew", "pocketScrew", "dowel", "groove"… (los ids de hoy migran con D33)'),
  legacyIds: z.array(z.string()).default([]),
  /** Minimum thickness of the piece that is fixed (a) and the one that receives it (b); below `bWarn` it is a recommendation, below `b` critical. */
  minThickness: z.object({ a: Mm.nullable(), b: Mm.nullable(), bWarn: Mm.nullable() }),
  requires: z.array(ToolId).describe('Herramienta sin la cual no se puede hacer'),
  difficulty: z.number().int().min(1).max(5),
  rigid: z.boolean().describe('Cuenta para el escuadrado (R5)'),
  glue: z.boolean(),
  /** Hardware by role, not by catalog id: the catalog says which item fills each role. */
  hardware: z.array(z.object({ role: z.string().describe('"screw", "nail", "hinge"'), perJoint: z.enum(['byLength', 'fixed']), count: z.number().int().positive().nullable() })),
  spacing: z.object({ edge: Mm, min: Mm, max: Mm }).nullable().describe('Separación de tornillos o tarugos a lo largo de la junta'),
})
export type JointSpec = z.infer<typeof JointSpec>
```

En el catálogo (`public/catalogo/catalogo.json`), cada herraje suma dos campos: `role` (`"screw"`, `"pocketScrew"`, `"nail"`, `"hinge.overlay"`, `"slide"`…) y `tradeName` (`'#8 × 1¼"'`), y conserva `largo` en mm. `joints.ts` deja de escribir `'clavo-sin-cabeza-1'`: pide «el herraje de rol `nail` más corto que sirva» al catálogo. `reglas/tornillos.ts` muestra `tradeName` en vez de calcular pulgadas.

### 3.7 Capa 4 — tipos de mueble con rangos

```ts
// src/domain/knowledge/kinds.ts
import { z } from 'zod'
import { MmRange } from './units'
import { sourced } from './source'
import { Severity } from './severity'

/** A declarative check: a named metric compared with a range. Covers most of what R10 does today. */
export const KindCheck = sourced({
  id: z.string().describe('Estable: forma parte de la clave del aviso ("shoeRack.depth")'),
  metric: z.string().describe('Id de una métrica registrada en TS: "depth", "topSurfaceHeight", "shelfClearance"…'),
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** Only when this holds, e.g. only if not anchored. Kept tiny on purpose: a flag of the design, not a language. */
  when: z.object({ wallMounted: z.boolean().nullable(), minHeight: z.number().nullable() }).nullable().default(null),
  severity: Severity,
  message: z.string().describe('Plantilla en español con {value}, {min}, {max}'),
  fixes: z.array(z.string()).describe('Claves de soluciones registradas'),
})
export type KindCheck = z.infer<typeof KindCheck>

export const FurnitureKind = sourced({
  id: z.string().describe('Id del término en el vocabulario: "shoeRack"'),
  family: z.enum(['cabinet', 'bed', 'table', 'seat', 'other']).describe('cabinet: una caja con columnas y huecos'),
  dimensions: z.object({ width: MmRange, height: MmRange, depth: MmRange }),
  templates: z.array(z.string()).describe('Plantillas que lo pueden construir, la primera es la preferida'),
  presets: z.array(z.string()).default([]),
  defaults: z.object({
    material: z.string().describe('Id de material del catálogo para el casco'),
    load: z.enum(['none', 'light', 'medium', 'heavy']),
    wallMountedAbove: z.number().nullable().describe('Alto en mm a partir del cual va anclado por omisión'),
    template: z.record(z.string(), z.unknown()).describe('Parámetros por omisión de su plantilla preferida'),
  }),
  checks: z.array(KindCheck),
  /** One or two lines the expert reads about this kind: generated into the prompts. */
  hints: z.array(z.string()).max(3),
})
export type FurnitureKind = z.infer<typeof FurnitureKind>
```

Las **métricas** son código (TS) y se registran por id:

```ts
// src/domain/estructura/metrics.ts
import type { Contexto } from './hallazgo'

export interface Metric {
  id: string
  label: string
  /** The measured value in mm (or a count), and the pieces it is about, or null if it does not apply. */
  measure(ctx: Contexto): { value: number; pieces: string[] } | null
}

export const METRICS: Metric[] = [
  { id: 'depth', label: 'fondo', measure: ({ diseno }) => ({ value: diseno.dimensiones.fondo, pieces: [] }) },
  { id: 'height', label: 'alto', measure: ({ diseno }) => ({ value: diseno.dimensiones.alto, pieces: [] }) },
  topSurfaceHeight, // from typology.ts:51-63
  kneeClearanceWidth, // from typology.ts:99-112
  drawerCount, // from typology.ts:141
  shelfClearance, // new: smallest vertical gap between shelves of an open cell
]
```

Lo que no cabe en «métrica contra rango» (el colchón, que depende de un tamaño elegido) sigue siendo una regla en TS, registrada igual que las demás.

`detectKind` queda como **respaldo**: el tipo lo declara el esqueleto (`RespuestaPlan.kind`, enum generado del registro) y se guarda en el plan y, con `formato: 2`, en el diseño. Para diseños viejos o para el atajo previo al LLM (`casosDeUso.ts:232`) se usa `recognize(terms, 'kind', texto)`.

### 3.8 Capa 5 — plantillas y prehechos

Una **plantilla** es un constructor paramétrico: `CabinetPlan` + `buildCabinet` son la primera. Un **prehecho** es un plan concreto de una plantilla, con los parámetros que se exponen en la ficha y las restricciones que lo acotan. «Mueble prehecho = plan + parámetros expuestos + restricciones.»

```ts
// src/domain/knowledge/templates.ts  (types only: builders live in domain/modules)
import { z } from 'zod'

/** How a parameter shows up in the ficha, in the change summary and in the prompt: one description, three uses. */
export const FieldSpec = z.discriminatedUnion('type', [
  z.object({ type: z.literal('length'), path: z.string(), label: z.string(), rangeFrom: z.enum(['kind.width', 'kind.height', 'kind.depth']).nullable() }),
  z.object({ type: z.literal('choice'), path: z.string(), label: z.string(), options: z.array(z.object({ value: z.string(), label: z.string(), hint: z.string() })) }),
  z.object({ type: z.literal('count'), path: z.string(), label: z.string(), min: z.number().int(), max: z.number().int() }),
  z.object({ type: z.literal('toggle'), path: z.string(), label: z.string(), on: z.string(), off: z.string() }),
  z.object({ type: z.literal('grid'), path: z.string(), label: z.string() }),
])
export type FieldSpec = z.infer<typeof FieldSpec>

export const Preset = z.object({
  id: z.string().describe('"shoeRack.open4"'),
  template: z.string().describe('"cabinet@1"'),
  kind: z.string(),
  label: z.string().describe('"Zapatera abierta de 4 niveles"'),
  params: z.record(z.string(), z.unknown()).describe('Se valida con el esquema de la plantilla al cargar'),
  /** Paths of the params shown in the ficha; the rest stay fixed unless the person goes free-form. */
  exposed: z.array(z.string()),
})
export type Preset = z.infer<typeof Preset>
```

```ts
// src/domain/modules/template.ts
import type { z } from 'zod'
import type { Diseno } from '../diseno/esquema'
import type { Catalogo } from '../materiales/catalogo'
import type { FieldSpec } from '../knowledge/templates'
import type { KnowledgeBase } from '../knowledge/registry'

export interface Violation { path: string; message: string }

export interface Template<P extends z.ZodType> {
  id: string // "cabinet"
  version: number // 1; stored as "cabinet@1" in each version
  label: string
  params: P // the ficha: also the LLM output schema for this template
  fields: FieldSpec[]
  /** Checked before building: what the ficha cannot allow (a drawer cell lower than the slide needs). */
  constraints(p: z.infer<P>, kb: KnowledgeBase, catalog: Catalogo): Violation[]
  build(p: z.infer<P>, catalog: Catalogo, kb: KnowledgeBase): { design: Diseno; notes: string[] }
  /** Reads a plan saved by an older version of this template. */
  migrate: Record<number, (old: unknown) => unknown>
}

export const defineTemplate = <P extends z.ZodType>(t: Template<P>) => t
```

`buildCabinet` no cambia por dentro; se envuelve (`cabinetTemplate = defineTemplate({ id: 'cabinet', version: 1, params: CabinetPlan, build: buildCabinet, fields: CABINET_FIELDS, ... })`) y sus constantes (`cabinet.ts:35-40`) pasan a `data/templates/cabinet.json`. `CABINET_FIELDS` sustituye a los dos mapas de etiquetas (`planChanges.ts:7-13`, `PlanSheet.tsx:14-19`) y a los `.describe()` de `CabinetConstruction`: `describePlanChanges` y la ficha se generan a partir de los campos.

La **cama** (fase 9, entrega 6) es la primera plantilla nueva: `bed@1` con su propio esquema de parámetros (tamaño de colchón, cajones de un lado o de los dos, cabecera), sus campos y su constructor. No toca `cabinet`.

### 3.9 Capa 6 — reglas como datos + funciones puras

```ts
// src/domain/estructura/rule.ts
import type { z } from 'zod'
import type { SourceRef } from '../knowledge/source'
import type { Contexto, Hallazgo } from './hallazgo'

export interface Rule<P extends z.ZodType> {
  code: string // "R1_FLECHA" today; English with D33 step 4
  version: number
  /** Notice title for the person: replaces TITLES in application/notices.ts. */
  title: string
  params: P // thresholds schema; values come from data/rules/*.json
  sources: SourceRef[]
  check(ctx: Contexto, params: z.infer<P>): Hallazgo[]
}

export const defineRule = <P extends z.ZodType>(r: Rule<P>) => r
```

```ts
// src/domain/estructura/reglas/flecha.ts (the shape after the move; the math is the same)
export const DeflectionParams = z.object({
  creep: z.number().min(1).max(3),
  loads: z.object({ none: KgPerM2, light: KgPerM2, medium: KgPerM2, heavy: KgPerM2 }),
  limit: z.object({ recommendation: z.number().positive(), critical: z.number().positive() }).refine((l) => l.critical < l.recommendation, 'L/crítico debe ser menor que L/recomendación'),
})

export const deflectionRule = defineRule({
  code: 'R1_FLECHA',
  version: 1,
  title: 'Repisas que se pandean',
  params: DeflectionParams,
  sources: [{ file: 'docs/investigacion/05-reglas-estructurales.md', anchor: '1-flecha-pandeo-de-repisas-r1', strength: 'measured', note: 'E 4500/2000 (Eagon, EN 310); calibrable' }],
  check: (ctx, p) => /* reglaFlecha de hoy, leyendo p en vez de SUPUESTOS */ [],
})
```

Las comprobaciones declarativas de los tipos (`KindCheck`) se evalúan con **una sola regla genérica** (`kindChecksRule`) que emite un código por comprobación (`R10_USO:shoeRack.depth`), así cada una se acepta por separado en los avisos (D37).

El motor (`motor.ts:10`) lee la lista del registro en vez de una constante; el orden y `criticosNuevos` no cambian.

### 3.10 Capa 7 — soluciones constructivas reutilizables (D34, D37)

```ts
// src/domain/fixes/fix.ts
import type { Diseno } from '../diseno/esquema'
import type { Alternativa, Hallazgo } from '../estructura/hallazgo'
import type { Catalogo } from '../materiales/catalogo'
import type { Operacion } from '../operaciones/esquema'
import type { KnowledgeBase } from '../knowledge/registry'

/** A fix changes the plan when the design has a live one (so the ficha stays true), or adds operations otherwise. */
export type FixPlan =
  | { kind: 'plan'; patch: (plan: unknown) => unknown }
  | { kind: 'operations'; operations: Operacion[] }

export interface FixInput { design: Diseno; plan: unknown | null; catalog: Catalogo; finding: Hallazgo; alternative: Alternativa; kb: KnowledgeBase }

export interface FixDef {
  key: string
  /** instant: Knotty builds it; expert: it needs judgment and goes to the tray (bandeja); info: nothing to build (a max span). */
  speed: 'instant' | 'expert' | 'info'
  build(input: FixInput): FixPlan | null
}

export const defineFix = (f: FixDef) => f
```

```ts
// src/domain/fixes/library/deeper.ts — "mas-fondo", reusable by R4 and by any kind check on depth
export const deeperFix = defineFix({
  key: 'mas-fondo',
  speed: 'instant',
  build: ({ design, plan, alternative }) => {
    const depth = Number(alternative.datos.fondo)
    if (!Number.isFinite(depth) || depth <= design.dimensiones.fondo) return null
    if (plan) return { kind: 'plan', patch: (p) => ({ ...(p as CabinetPlan), dimensions: { ...(p as CabinetPlan).dimensions, depth } }) }
    return { kind: 'operations', operations: [{ op: 'cambiarDimensionGlobal', eje: 'z', valor: depth, regla: 'estirar' }] }
  },
})
```

`fixesFor` (`fixes.ts:107-117`) no cambia de contrato: busca la definición por `alternativa.clave`, construye, aplica, valida y descarta lo que no deje un diseño válido. Con `kind: 'plan'` reconstruye con `rebuildFromPlan` y se guarda como cambio de ficha, no como extra.

**Invariante tipado.** `FixKey` es la unión de las claves registradas; `Alternativa.clave` pasa a ser `FixKey`. Una prueba recorre todas las reglas con los fixtures y comprueba que toda clave emitida tenga una definición (`instant`, `expert` o `info`). Hoy esa prueba fallaría con unas 15 claves: es exactamente la lista de trabajo de la bandeja (fase 9, entrega 3).

### 3.11 Decisiones programáticas sin preguntar al experto

`src/domain/decide/` concentra lo que Knotty puede decidir con tablas (D34, «instantáneo»):

```ts
// src/domain/decide/decide.ts
import { claroMaximo, flecha, severidadFlecha } from '../estructura/reglas/flecha'

export interface Decision<T> {
  value: T
  /** Said to the person, in Spanish: "Supuse 330 mm de fondo, lo típico de una zapatera". */
  because: string
  assumed: boolean
}

/** Measures for a kind: what the person gave, else scaled from the photo proportions, else typical; always inside the kind's range. */
export function inferDimensions(kind: FurnitureKind, given: Partial<Record<'width' | 'height' | 'depth', number>>, proportions: { width: number; height: number; depth: number | null } | null): Record<'width' | 'height' | 'depth', Decision<Mm>> { /* ... */ }

/** The thinnest board of the catalog whose shelf does not sag past L/limit for that span, depth and load, and that its joints allow. */
export function thicknessFor(input: { role: string; span: Mm; depth: Mm; load: Load; joint: JointSpec | null }, catalog: Catalogo, kb: KnowledgeBase): Decision<string> {
  const boards = catalog.materiales.filter((m) => m.tipo === 'triplay').sort((a, b) => a.espesor - b.espesor)
  const ok = boards.find((m) => {
    const delta = flecha(input.span, input.depth, m.espesor, input.load, kb.materials.pinePlywood.modulus.parallel)
    const minByJoint = input.joint?.minThickness.b ?? 0
    return !severidadFlecha(delta, input.span) && m.espesor >= minByJoint
  }) ?? boards.at(-1)!
  return { value: ok.id, because: `Con ${ok.espesor} mm, un claro de ${input.span} mm aguanta la carga sin pandearse.`, assumed: true }
}

/** The strongest joint the person can make with the tools they said they have; butt screws need only a drill. */
export function jointFor(a: { thickness: Mm }, b: { thickness: Mm }, tools: ToolId[], kb: KnowledgeBase): Decision<JointSpec> { /* filter by requires ⊆ tools and minThickness, sort by rigid then difficulty */ }

/** Default plan of a kind: its preferred template with the kind's defaults and inferred measures. */
export function defaultPlan(kind: FurnitureKind, dims: Record<'width' | 'height' | 'depth', Mm>, kb: KnowledgeBase): unknown { /* ... */ }
```

Dónde se usan:

- **Sin medidas (D26):** `inferDimensions` responde antes que el LLM; el esqueleto ya no inventa medidas típicas, las recibe.
- **Esqueleto:** si el tipo es reconocible y no hay fotos, `defaultPlan` produce la silueta del paso 0 de la fase 8 al instante.
- **Espesor por rol y claro:** en la plantilla (repisas largas suben de 15 a 18 mm solas) y como solución `subir-espesor`.
- **Unión según herramienta:** hoy `Requisito.tipo === 'herramienta'` es texto libre (`requisitos.ts:10`). Se agrega `tools: ToolId[] | null` al requisito (el LLM lo llena con un enum generado del vocabulario), y `completeJoints` elige con `jointFor`: sin `pocketJig`, nunca propone bolsillo; sin `router`, nunca canal.

### 3.12 Registro

```ts
// src/domain/knowledge/registry.ts
import { z } from 'zod'
import roles from './data/vocabulary/roles.json'
import kindTerms from './data/vocabulary/kinds.json'
import pinePlywood from './data/materials/pine-plywood.json'
import joints from './data/joinery/joints.json'
import shoeRack from './data/kinds/shoe-rack.json'
import bookcase from './data/kinds/bookcase.json'
// …one import per file: adding a kind is one file and one line here
import rules from './data/rules.json'
import presets from './data/presets.json'
import { BoardGrade } from './materials'
import { FurnitureKind } from './kinds'
import { JointSpec } from './joinery'
import { Preset } from './templates'
import { Term } from './vocabulary'
import { KNOWLEDGE_VERSION } from './version'

export const KnowledgeBase = z.object({
  version: z.string(),
  terms: z.array(Term),
  materials: z.record(z.string(), BoardGrade),
  joints: z.array(JointSpec),
  kinds: z.array(FurnitureKind),
  presets: z.array(Preset),
  ruleParams: z.record(z.string(), z.unknown()).describe('Se validan con el esquema de cada regla'),
})
export type KnowledgeBase = z.infer<typeof KnowledgeBase>

/** Parsed once at module load: a malformed file fails every test, not a person's session. */
export const KB: KnowledgeBase = KnowledgeBase.parse({
  version: KNOWLEDGE_VERSION,
  terms: [...roles, ...kindTerms],
  materials: { pinePlywood },
  joints,
  kinds: [shoeRack, bookcase],
  presets,
  ruleParams: rules,
})

export const kindById = (id: string) => KB.kinds.find((k) => k.id === id) ?? null
export const termOf = (id: string) => KB.terms.find((t) => t.id === id) ?? null
```

Las plantillas, reglas, métricas y soluciones (código) tienen su propio índice en su módulo (`modules/templates.ts`, `estructura/rules.ts`, `fixes/library/index.ts`), con la misma idea: un archivo y una línea.

---

## 4. Estructura de carpetas y fronteras

```
src/domain/
├─ knowledge/                    capa más baja: sólo zod y sus propios archivos
│  ├─ units.ts  source.ts  version.ts  severity.ts
│  ├─ vocabulary.ts  materials.ts  joinery.ts  kinds.ts  templates.ts
│  ├─ registry.ts  overrides.ts  message.ts        (message: interpola {marcadores})
│  └─ data/
│     ├─ vocabulary/  roles.json  kinds.json  joints.json  tools.json  finishes.json
│     ├─ materials/   pine-plywood.json  finishes/*.json
│     ├─ joinery/     joints.json  roleTraits.json
│     ├─ kinds/       shoe-rack.json  bookcase.json  bed.json  desk.json …
│     ├─ templates/   cabinet.json  bed.json            (constantes de cada constructor)
│     ├─ presets.json
│     └─ rules.json                                    (lo que hoy es SUPUESTOS)
├─ modules/        template.ts  templates.ts (índice)  cabinet.ts  bed.ts
├─ estructura/     rule.ts  rules.ts (índice)  metrics.ts  motor.ts  reglas/*
├─ fixes/          fix.ts  fixes.ts  library/*.ts  library/index.ts
├─ decide/         decide.ts
└─ …               (diseno, operaciones, validacion, materiales: sin cambios de lugar)

src/adapters/llm/comun/conocimiento.ts   genera las secciones del prompt
src/ui/estudio/PlanSheet.tsx             dibuja la ficha desde FieldSpec
```

**Fronteras.** Todo queda dentro de `domain/` y sólo importa `zod`: `arquitectura.test.ts` no cambia para las capas. Se agrega una prueba de **subcapa**, en el mismo estilo que la existente:

```ts
// src/arquitectura.test.ts (nuevo caso)
it('domain/knowledge/ no importa el resto del dominio', () => {
  const fuera = archivos(join(SRC, 'domain/knowledge')).flatMap((a) =>
    imports(a).filter((d) => d.startsWith('.') && !join(a, '..', d).startsWith(join(SRC, 'domain/knowledge'))).map((d) => `${relative(SRC, a)} → ${d}`),
  )
  expect(fuera).toEqual([])
})
```

Para que `Rol`, `TipoUnion` y los demás enums de `diseno/esquema.ts` salgan del vocabulario, la flecha va de `diseno` hacia `knowledge`, nunca al revés. Y en `knowledge/` no se escribe la palabra `document` (§1.3).

---

## 5. Alimentar al LLM desde la misma fuente

### 5.1 Secciones generadas

Los prompts conservan su prosa (tono, formato, política de preguntas) y reciben el conocimiento por marcadores, igual que hoy `{{catalogo}}` y `{{materiales}}`:

| Marcador | Sale de | Sustituye |
|---|---|---|
| `{{hoja_util}}` | catálogo + acomodo efectivo | `sistema.v4.md:49` |
| `{{uniones_comunes}}` | `JointSpec` + reglas de `completeJoints` | `sistema.v4.md:56`, `ajuste.v6.md:15` |
| `{{tornillos}}` | herrajes de rol `screw`/`pocketScrew` con `tradeName` + tabla de bolsillo | `sistema.v4.md:56` |
| `{{tipologias}}` | `kinds` (familia, rangos, `hints`) | `esqueleto.v2.md:6`, `reconstruccion.v6.md:8`, `dictamen.v1.md:11` |
| `{{construccion}}` | `FieldSpec` de la plantilla | `esqueleto.v2.md:15-26`, `ajuste-ficha.v1.md:13-14` |
| `{{tipo_actual}}` | el tipo del diseño, con sus comprobaciones | nuevo: el ajuste sabe qué revisa Knotty para ese mueble |
| `{{herramienta}}` | `ToolId` con etiqueta | nuevo: para llenar `tools` en requisitos |

```ts
// src/adapters/llm/comun/conocimiento.ts
import { KB } from '../../../domain/knowledge/registry'
import { termOf } from '../../../domain/knowledge/registry'

const cm = (mm: number) => `${Math.round(mm / 10)} cm`

/** One line per kind, stable order (by id) so the provider's prompt cache keeps hitting. */
export function kindsSection(): string {
  return [...KB.kinds]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((k) => {
      const t = termOf(k.id)!
      const d = k.dimensions
      const box = k.family === 'cabinet' ? 'gabinete' : 'pieza por pieza'
      return `- ${t.label} (${t.aliases.join(', ')}): ${box}; ancho ${cm(d.width.min)}–${cm(d.width.max)}, alto ${cm(d.height.min)}–${cm(d.height.max)}, fondo ${cm(d.depth.min)}–${cm(d.depth.max)}; típico ${d.width.typical} × ${d.height.typical} × ${d.depth.typical} mm. ${k.hints.join(' ')}`
    })
    .join('\n')
}
```

El id del prompt registra la versión del conocimiento: `idPrompt` devuelve `sistema@5+esqueleto@3+kb@2026.10.1`, así la bitácora (fase 8) y `npm run comparar` separan un cambio de prompt de un cambio de datos.

### 5.2 Esquemas generados

- `RespuestaPlan.kind` es `z.enum(KB.kinds.map((k) => k.id))`: el LLM elige un id válido, el dominio deja de adivinar.
- Los `.describe()` de las opciones de la plantilla salen de `FieldSpec.options[].hint`.
- Con varias plantillas, el esqueleto devuelve `{ template: 'cabinet' | 'bed', params }` como unión discriminada por `template` (compatible con el modo estricto: sin `oneOf` fuera de la discriminación).

### 5.3 Una prueba que impide volver a duplicar

```ts
// src/adapters/llm/prompts/prompts.test.ts
it('los prompts no escriben medidas a mano', () => {
  const medidas = /\b\d{2,4}\s*(mm|cm)\b|\b\d{3,4}\s*[×x]\s*\d{3,4}\b|\d+\s*(\/\d+)?"/g
  for (const archivo of promptFiles()) {
    const sinEjemplos = quitarBloquesDeCodigo(leer(archivo)) // the JSON example in sistema is allowed
    expect({ archivo, encontradas: sinEjemplos.match(medidas) ?? [] }).toEqual({ archivo, encontradas: [] })
  }
})
```

### 5.4 Qué decide Knotty y qué el experto

| Decisión | Antes | Después |
|---|---|---|
| Qué mueble es | Regex + LLM | LLM elige `kind` de un enum; respaldo con `recognize` |
| Medidas sin datos | LLM «típicas» | `inferDimensions` (el LLM sólo las comenta) |
| Construcción por omisión | Prosa en el prompt | `kind.defaults.template` |
| Espesor de repisas | LLM o 18 mm fijo | `thicknessFor` por claro y carga |
| Unión y herraje | `completeJoints` con ids fijos | `jointFor` según herramienta + rol de herraje del catálogo |
| Soluciones a hallazgos | 6 claves | Toda clave registrada; las `expert` van a la bandeja |

---

## 6. Restricciones tipadas, invariantes y propiedades

### 6.1 Invariantes de datos (pruebas de ejemplo, corren siempre)

- Todo JSON de `knowledge/data` pasa su esquema (lo garantiza `KB` al cargar; la prueba sólo importa el registro).
- `min ≤ typical ≤ max` en cada rango (lo impone `MmRange`).
- Integridad referencial: cada `kind.templates` existe en el índice de plantillas; cada `presets[].template` existe y sus `params` pasan el esquema de esa plantilla; cada `fixes` de una comprobación está registrada; cada `metric` existe; cada `role` de herraje tiene al menos un artículo en `public/catalogo/catalogo.json`; cada `defaults.material` está en el catálogo.
- Los alias no chocan: ningún alias de un tipo es igual al de otro, y `recognize` resuelve los casos de `typology.test.ts:20-30`.
- Cada `SourceRef.file` existe y su `anchor` es el slug de un encabezado de ese archivo (la prueba lee `docs/`; en pruebas `node:fs` está permitido).
- Cada clave de alternativa que emite una regla sobre los fixtures (`librero`, `buro`, `alacena`) tiene un `FixDef`.
- Un `legacyId` por cada id español que hoy se guarda (roles, uniones): la migración `formato: 2` no pierde nada.

### 6.2 Propiedades de las plantillas (fast-check)

Se agrega `fast-check` como dependencia **de desarrollo**. El test de arquitectura sólo revisa archivos que no son prueba (`arquitectura.test.ts:13`), así que el dominio sigue sin dependencias en ejecución.

```ts
// src/domain/modules/templates.property.test.ts
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { KB } from '../knowledge/registry'
import { catalogoPrueba } from '../fixtures/catalogo.test-util'
import { cabinetTemplate } from './cabinet'
import { rebuildFromPlan } from './rebuild'
import { describePlanChanges } from './planChanges'

/** Plans inside the kind's ranges: the only ones the ficha lets a person make. */
const cabinetPlan = (kindId: string) => {
  const k = KB.kinds.find((x) => x.id === kindId)!
  const len = (r: { min: number; max: number }) => fc.integer({ min: r.min, max: r.max })
  const cell = fc.record({
    height: fc.integer({ min: 1, max: 10 }),
    content: fc.constantFrom('open', 'drawer', 'door', 'closed'),
    shelves: fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }),
    doors: fc.option(fc.integer({ min: 1, max: 2 }), { nil: null }),
  })
  return fc.record({
    name: fc.constant(k.id),
    dimensions: fc.record({ width: len(k.dimensions.width), height: len(k.dimensions.height), depth: len(k.dimensions.depth) }),
    material: fc.constantFrom('T15', 'T18'),
    base: fc.constantFrom('kick', 'floor'),
    wallMounted: fc.boolean(),
    construction: fc.record({
      doors: fc.constantFrom('overlay', 'inset'),
      drawerFronts: fc.constantFrom('inset', 'overlay'),
      top: fc.constantFrom('between', 'over'),
      back: fc.constantFrom('nailed', 'none'),
      shelves: fc.constantFrom('movable', 'fixed'),
    }),
    columns: fc.array(fc.record({ width: fc.integer({ min: 1, max: 5 }), cells: fc.array(cell, { minLength: 1, maxLength: 4 }) }), { minLength: 1, maxLength: 3 }),
  })
}

describe.each(KB.kinds.filter((k) => k.templates[0] === 'cabinet').map((k) => k.id))('plantilla gabinete: %s', (kindId) => {
  it('todo plan válido construye un diseño sin errores bloqueantes', () => {
    fc.assert(
      fc.property(cabinetPlan(kindId), (plan) => {
        if (cabinetTemplate.constraints(plan, KB, catalogoPrueba).length) return // the ficha would not allow it
        const { design } = cabinetTemplate.build(plan, catalogoPrueba, KB)
        expect(analizar(design, catalogoPrueba).errores).toEqual([])
        expect(design.dimensiones).toEqual({ ancho: plan.dimensions.width, alto: plan.dimensions.height, fondo: plan.dimensions.depth })
      }),
      { numRuns: 200 },
    )
  })

  it('reconstruir sin extras es construir', () => {
    fc.assert(fc.property(cabinetPlan(kindId), (plan) => {
      expect(rebuildFromPlan(plan, [], catalogoPrueba).design).toEqual(cabinetTemplate.build(plan, catalogoPrueba, KB).design)
    }))
  })

  it('un plan sin cambios no describe cambios', () => {
    fc.assert(fc.property(cabinetPlan(kindId), (plan) => expect(describePlanChanges(plan, plan)).toEqual([])))
  })
})
```

Otras propiedades que valen el costo:

- **Prehechos:** para cada prehecho, variar sólo sus parámetros `exposed` dentro de los rangos del tipo nunca produce errores bloqueantes ni críticos de las reglas que el prehecho declara resueltas (por ejemplo, una zapatera de más de 900 mm con `wallMounted: true` no emite vuelco).
- **Soluciones efectivas:** para todo diseño generado con un hallazgo, cada `Fix` que `fixesFor` devuelve quita ese hallazgo o baja su severidad, y no agrega críticos nuevos (`criticosNuevos` vacío).
- **`thicknessFor` monótona:** a más claro o más carga, el espesor elegido nunca baja.
- **`inferDimensions` dentro del rango:** para cualquier entrada, el resultado cae dentro del `MmRange` del tipo y respeta exactamente las medidas que la persona dio.

Si una propiedad encuentra un contraejemplo, fast-check imprime la semilla y el plan mínimo: ese plan entra como fixture de ejemplo.

---

## 7. Versionado, trazabilidad y calibración

### 7.1 Qué pasa con lo guardado cuando cambia el conocimiento

| Guardado | Depende del conocimiento | Política |
|---|---|---|
| `Version.diseno` (snapshot) | No | Nunca cambia solo. Un umbral nuevo no mueve una pieza |
| Hallazgos y avisos | Sí (se recalculan) | Se recalculan con el conocimiento vigente: si una regla mejora, la persona se entera |
| `accepted` (D37) | Sí | Se guarda `{ key, rule: 'R1_FLECHA@2', datos, knowledge }`. Si la regla cambió de versión **y** la severidad empeoró, el aviso reaparece con «La revisión cambió desde que lo aceptaste»; si no, sigue aceptado |
| `Version.plan` | Sí (plantilla) | Se guarda `template: 'cabinet@1'`. Reconstruir usa `migrate` de la plantilla; si el resultado difiere del snapshot, se muestra como **cambio con origen «Knotty: plantilla actualizada»** y diferencias (D35), nunca en silencio |
| `Dictamen.firma` | Sí | La firma (`casosDeUso.ts:68`) incluye `KNOWLEDGE_VERSION` y el hash de la calibración: un dictamen hecho con otros umbrales queda vencido |
| Bitácora y exportación de «Entrañas de la madera» | Sí | Cada renglón y el JSON exportado llevan la versión del conocimiento, junto al commit |

Cada versión nueva del diseño guarda `knowledge: KNOWLEDGE_VERSION`. Entra con la migración `formato: 2` de D33 (paso 7), junto con `kind`.

`data/meta.json` lleva un registro corto de cambios del conocimiento (`{ version, date, changes: [{ id: 'R1_FLECHA', from: 1, to: 2, why }] }`), que alimenta el mensaje de «la revisión cambió».

### 7.2 Trazabilidad

Cada regla, rango, comprobación, unión y material lleva `sources` (§3.3) con archivo, encabezado y firmeza. Tres usos:

- **Pruebas:** la fuente existe (§6.1).
- **Interfaz:** el aviso puede decir «Regla de taller» o «Tabla del fabricante» y enlazar al documento; la firmeza ordena qué se calibra primero.
- **Revisión de PR:** un cambio de umbral sin cambio en `docs/investigacion/` es sospechoso a simple vista.

### 7.3 Calibración (supuestos editables)

Sólo los parámetros marcados como calibrables, con límites:

```ts
// src/domain/knowledge/overrides.ts
import { z } from 'zod'

export const Calibratable = z.object({
  path: z.string().describe('"materials.pinePlywood.modulus.parallel"'),
  label: z.string().describe('"Rigidez del triplay (veta a lo largo)"'),
  unit: z.enum(['MPa', 'mm', 'kg/m²', '×']),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
})

/** What the person changed on this device; applied over KB, clamped to the declared limits. Same pattern as AjustesCatalogo. */
export const KnowledgeOverrides = z.record(z.string(), z.number())
export type KnowledgeOverrides = z.infer<typeof KnowledgeOverrides>

export function withOverrides(kb: KnowledgeBase, overrides: KnowledgeOverrides, calibratable: z.infer<typeof Calibratable>[]): KnowledgeBase { /* deep set, clamped */ }
```

Se guardan por el mismo camino que los ajustes del catálogo (un puerto, `localStorage` en el adaptador) y se editan en Ajustes, sección «Supuestos del taller». Esto resuelve la pregunta abierta de calibrar E con una prueba casera: la persona carga una repisa, mide cuánto se pandea y la app despeja E con la misma fórmula de `flecha.ts`.

---

## 8. Ejemplo de extremo a extremo: zapatera

Hoy la zapatera existe sólo como regex (`typology.ts:18`), una comprobación de fondo (`:203`) y una palabra en la lista del prompt `esqueleto`. Así queda con la propuesta. *Nota de auditoría:* los rangos se cotejaron con `04-tipologias-y-medidas.md` §2.6 (fondo 300–380, hueco 150–200) y el umbral de anclaje se bajó de 900 a **686 mm**, el canónico para todo mueble de guardado (`05-reglas-estructurales.md` §6).

**1. Vocabulario** — `data/vocabulary/kinds.json`:

```json
{
  "id": "shoeRack", "category": "kind", "label": "Zapatera", "plural": "Zapateras",
  "aliases": ["zapatero", "mueble para zapatos", "organizador de zapatos", "mueble de entrada"],
  "legacyIds": [], "definition": "Mueble bajo o medio con repisas para guardar zapatos.",
  "sources": [{ "file": "docs/investigacion/04-tipologias-y-medidas.md", "anchor": "26-zapateras", "strength": "shopRule", "note": null }]
}
```

**2. Tipo con rangos** — `data/kinds/shoe-rack.json`:

```json
{
  "id": "shoeRack",
  "family": "cabinet",
  "dimensions": {
    "width":  { "min": 500, "typical": 800, "max": 1200 },
    "height": { "min": 400, "typical": 900, "max": 1300 },
    "depth":  { "min": 300, "typical": 330, "max": 380 }
  },
  "templates": ["cabinet"],
  "presets": ["shoeRack.open4", "shoeRack.doors2"],
  "defaults": {
    "material": "T15",
    "load": "light",
    "wallMountedAbove": 686,
    "template": { "base": "kick", "construction": { "doors": "overlay", "drawerFronts": "inset", "top": "over", "back": "nailed", "shelves": "fixed" } }
  },
  "checks": [
    {
      "id": "shoeRack.depth", "metric": "depth", "min": 300, "max": null, "when": null,
      "severity": "recomendacion",
      "message": "Con {value} mm de fondo, los zapatos de adulto sobresalen; una zapatera lleva {min} mm o más.",
      "fixes": ["mas-fondo"],
      "sources": [{ "file": "docs/investigacion/04-tipologias-y-medidas.md", "anchor": "26-zapateras", "strength": "shopRule", "note": "Talla 30 cm de largo" }]
    },
    {
      "id": "shoeRack.clearance", "metric": "shelfClearance", "min": 150, "max": null, "when": null,
      "severity": "recomendacion",
      "message": "Entre dos repisas quedan {value} mm: un tenis no entra; deja al menos {min} mm.",
      "fixes": ["redistribuir-repisas", "quitar-repisa"],
      "sources": [{ "file": "docs/investigacion/04-tipologias-y-medidas.md", "anchor": "26-zapateras", "strength": "shopRule", "note": null }]
    },
    {
      "id": "shoeRack.anchor", "metric": "height", "min": null, "max": 686, "when": { "wallMounted": false, "minHeight": null },
      "severity": "critico",
      "message": "Una zapatera de {value} mm sin anclar se va de frente si un niño se sube a las repisas.",
      "fixes": ["anclar-muro"],
      "sources": [{ "file": "docs/investigacion/05-reglas-estructurales.md", "anchor": "6-vuelco-y-anclaje-r4-y-r10", "strength": "standard", "note": "ASTM F2057-23 aplica desde 686 mm" }]
    }
  ],
  "hints": ["Repisas fijas cada 150–200 mm; botas, un hueco de 350 mm o más.", "Si lleva asiento encima, la cubierta va a 420–480 mm y con carga pesada."],
  "sources": [{ "file": "docs/investigacion/04-tipologias-y-medidas.md", "anchor": "26-zapateras", "strength": "shopRule", "note": null }]
}
```

(Los rangos dentro de `hints` también deberían generarse; se dejan como texto para no complicar el ejemplo.)

**3. Métrica nueva** — `estructura/metrics.ts`:

```ts
/** The smallest vertical gap between two horizontal pieces inside the same open column: what fits between shelves. */
export const shelfClearance: Metric = {
  id: 'shelfClearance',
  label: 'espacio entre repisas',
  measure: ({ diseno, geo }) => {
    const shelves = diseno.piezas
      .filter((p) => p.normal === 'y' && !p.grupo && geo.cajas.has(p.id))
      .map((p) => ({ id: p.id, box: geo.cajas.get(p.id)! }))
    let best: { value: number; pieces: string[] } | null = null
    for (const a of shelves)
      for (const b of shelves) {
        const overlapX = Math.min(a.box.x1, b.box.x1) - Math.max(a.box.x0, b.box.x0)
        const gap = b.box.y0 - a.box.y1
        if (overlapX > 100 && gap > 0 && (!best || gap < best.value)) best = { value: Math.round(gap), pieces: [a.id, b.id] }
      }
    return best
  },
}
```

**4. Prehechos** — `data/presets.json`:

```json
[
  {
    "id": "shoeRack.open4", "template": "cabinet@1", "kind": "shoeRack", "label": "Zapatera abierta de 4 niveles",
    "params": {
      "name": "Zapatera", "dimensions": { "width": 800, "height": 900, "depth": 330 }, "material": "T15",
      "base": "kick", "wallMounted": true,
      "construction": { "doors": "overlay", "drawerFronts": "inset", "top": "over", "back": "nailed", "shelves": "fixed" },
      "columns": [{ "width": 1, "cells": [{ "height": 1, "content": "open", "shelves": 3, "doors": null }] }]
    },
    "exposed": ["dimensions.width", "dimensions.height", "dimensions.depth", "columns.0.cells.0.shelves", "construction.back"]
  },
  {
    "id": "shoeRack.doors2", "template": "cabinet@1", "kind": "shoeRack", "label": "Zapatera con dos puertas",
    "params": {
      "name": "Zapatera con puertas", "dimensions": { "width": 900, "height": 1000, "depth": 340 }, "material": "T15",
      "base": "kick", "wallMounted": true,
      "construction": { "doors": "overlay", "drawerFronts": "inset", "top": "over", "back": "nailed", "shelves": "fixed" },
      "columns": [{ "width": 1, "cells": [{ "height": 1, "content": "door", "shelves": 4, "doors": 2 }] }]
    },
    "exposed": ["dimensions.width", "dimensions.height", "columns.0.cells.0.shelves", "wallMounted"]
  }
]
```

**5. Solución nueva** — `fixes/library/redistribute-shelves.ts`:

```ts
/** Fewer shelves in the column so every gap reaches the minimum: plan patch when there is a ficha, otherwise remove the tightest shelf. */
export const redistributeShelvesFix = defineFix({
  key: 'redistribuir-repisas',
  speed: 'instant',
  build: ({ design, plan, finding, kb }) => {
    const min = Number(finding.datos.min)
    if (plan) {
      const p = plan as CabinetPlan
      const inner = p.dimensions.height - 70 // kick height from templates/cabinet.json in the real code
      const fits = Math.max(0, Math.floor(inner / (min + 15)) - 1)
      return { kind: 'plan', patch: () => ({ ...p, columns: p.columns.map((c) => ({ ...c, cells: c.cells.map((cell) => (cell.content === 'open' ? { ...cell, shelves: Math.min(cell.shelves ?? 0, fits) } : cell)) })) }) }
    }
    const [, upper] = finding.piezas
    return upper && design.piezas.some((x) => x.id === upper) ? { kind: 'operations', operations: [{ op: 'eliminarPieza', id: upper }] } : null
  },
})
```

Y una línea en `fixes/library/index.ts`. `mas-fondo` y `anclar-muro` ya existen y se reutilizan.

**6. Registro** — una línea en `registry.ts` (`import shoeRack from './data/kinds/shoe-rack.json'`) y el id en `kinds: [...]`.

**7. Prompt** — nada que editar: `{{tipologias}}` ahora incluye

```
- Zapatera (zapatero, mueble para zapatos, organizador de zapatos, mueble de entrada): gabinete; ancho 50–120 cm, alto 40–130 cm, fondo 30–38 cm; típico 800 × 900 × 330 mm. Repisas fijas cada 150–200 mm; …
```

y el enum de `RespuestaPlan.kind` incluye `"shoeRack"`.

**8. Qué ve la persona** — escribe «una zapatera para la entrada, sin medidas». `recognize` detecta `shoeRack` antes del LLM; `inferDimensions` propone 800 × 900 × 330 y lo dice; la silueta aparece al instante con el prehecho `shoeRack.open4` (paso 0 de la fase 8). El esqueleto confirma o ajusta. La ficha muestra sólo los campos `exposed`. Como mide más de 686 mm, el prehecho viene anclado; si la persona quita el anclaje, aparece el aviso «Uso del mueble: anclaje» con «Anclarla al muro» como solución instantánea, con vista previa, o «Aceptar así» (D37), y se puede aceptar sin aceptar también el del fondo.

**9. Pruebas** — las invariantes de §6.1 cubren referencias y fuentes; la propiedad de §6.2 se ejecuta sola para `shoeRack` porque su plantilla es `cabinet`; y un ejemplo fijo: una zapatera de 250 mm de fondo emite `shoeRack.depth`, `mas-fondo` la lleva a 300 y el hallazgo desaparece.

Archivos tocados: 3 JSON, 1 métrica, 1 solución, 2 líneas de índice. Ni `typology.ts`, ni `casosDeUso.ts`, ni los prompts.

---

## 9. Encaje con lo que ya existe

- **Operaciones tipadas (D3):** no cambian. Las soluciones producen operaciones o parches de ficha; los nombres de las operaciones migran en D33 paso 6 con una versión nueva de prompts, y el vocabulario (`category: 'operation'`) da sus etiquetas.
- **`agregarCajon` (D23):** sus holguras (`cajon.ts:9-12`) pasan a `data/templates/drawer.json` con fuente; el alto mínimo del hueco se calcula desde ahí y el prompt lo recibe generado (se acaba la diferencia 92 contra 100 mm). Es una «plantilla de componente»: misma forma que `Template`, pero se inserta en un hueco.
- **`cabinet`, `planChanges`, `rebuild` (fase 8):** `cabinet` se vuelve la plantilla `cabinet@1`; `planChanges` y `PlanSheet` se generan de `FieldSpec`; `rebuild` gana `migrate` por versión.
- **Avisos con estado (D37):** los títulos salen de `Rule.title` y de las comprobaciones, no de `TITLES` en aplicación; cada comprobación de tipo es aceptable por separado; `accepted` guarda la versión de la regla.
- **Bandeja (D34, fase 9 entrega 3):** `FixDef.speed === 'expert'` es exactamente lo que va a la bandeja, con el texto de la alternativa como pedido.
- **Ficha por tipo de mueble (fase 9, pendiente 6):** un tipo apunta a su plantilla y a sus prehechos; la ficha se dibuja desde los campos expuestos. «Qué pasa con la ficha cuando el diseño ya se salió del plan» sigue igual (`currentPlan().diverged`).
- **Dictamen (D30):** el prompt recibe los rangos del tipo actual en vez de su lista de ejemplos, y la firma incluye la versión del conocimiento.
- **Migración a inglés (D33):** el vocabulario es la tabla de traducción. Cada `Term` tiene id en inglés, `label` en español y `legacyIds` con el id que hoy se guarda: la migración a `formato: 2` es genérica (`legacy → id` por categoría) en lugar de un `switch` por enum. Lo que se mueve a `knowledge/` nace en inglés; `supuestos.ts` (español) se migra al moverse a `rules.json`.

---

## 10. Plan de adopción

Cada entrega es un PR, pasa `npm run typecheck` y `npm test`, y deja la app igual o mejor. Las que cambian prompts piden una corrida manual de `npm run comparar` (cuesta tokens).

| # | Entrega | Cambia lo guardado | Encaje |
|---|---|---|---|
| K0 | `knowledge/` con `units`, `source`, `version`, `registry` vacío, prueba de subcapa y de fuentes. Sin cambios de comportamiento | No | — |
| K1 | **Vocabulario**: roles, uniones y tipos en JSON; `recognize` sustituye a `detectKind` (misma tabla de casos de `typology.test.ts`); `FieldSpec` de `cabinet` genera `PlanSheet` y `planChanges` | No | Fase 9 entrega 4 (acomodo) toca `PlanSheet` |
| K2 | **Parámetros de reglas**: `SUPUESTOS` → `rules.json` con fuentes; `defineRule` y `title` (fuera `TITLES` de `notices.ts`); roles con atributos | No | D33 paso 4 (`domain/estructura` a inglés) en el mismo PR o en el siguiente |
| K3 | **Soluciones**: `FixDef` con `speed`, `FixKey` tipado, prueba de cobertura; soluciones nuevas `mas-fondo`, `dos-puertas`, `mas-bisagras`, `trasera-6`, `fondo-6`, `tornillo-mas-largo`; las `expert` a la bandeja | No | Fase 9 entrega 3 (bandeja) |
| K4 | **Tipos con rangos**: `typology.ts` → `kinds/*.json` + métricas + `kindChecksRule`; un código por comprobación; `NOT_CABINETS` sale de `family` | Claves de `accepted` de R10 cambian: migrar las viejas o dejarlas vencer | — |
| K5 | **Prompts generados**: marcadores, prueba contra medidas escritas a mano, `kb@` en el id del prompt, `kind` como enum en el esqueleto | No (sólo la bitácora) | Validar con `comparar` |
| K6 | **Uniones y herrajes**: `JointSpec`; `role` y `tradeName` en el catálogo; `completeJoints` sin ids fijos; fuera `pulgadas()`; `tools` en requisitos y `jointFor` | Requisitos ganan `tools` (opcional, `default(null)`) | D33 paso 5 (materiales) |
| K7 | **Plantillas y prehechos**: `defineTemplate`, `cabinet@1`, `presets.json`, `fast-check` y propiedades | `Version.plan` gana `template` (default `cabinet@1`) | Fase 8 entrega 4 cerrada |
| K8 | **Decisiones**: `inferDimensions`, `thicknessFor`, `defaultPlan`; silueta instantánea y medidas sin LLM | No | Fase 8 paso 0; D26 |
| K9 | **Versionado y calibración**: `kind` y `knowledge` en `formato: 2`; `accepted` con versión de regla; `KnowledgeOverrides` y «Supuestos del taller» en Ajustes; firma del dictamen | Sí: `formato: 2` | D33 paso 7 |
| K10 | **Cama** como segunda plantilla sobre el registro | No | Fase 9 entrega 6 |
| K11 | **Acabados**: `Finish` con parámetros visuales; `texturas.ts` los lee; pasos de armado con tiempos de secado | No | Cuando llegue el doc de acabados |

**Riesgos**

- **Indirección de más.** Tres saltos (JSON → registro → regla) para leer un umbral. Mitigación: los datos se leen con funciones con nombre (`ruleParams('R1_FLECHA')`), y K0–K2 se juzgan por si la siguiente entrega fue más fácil; si no, se para ahí.
- **Datos de investigación sin verificar.** Un rango mal copiado apaga o dispara avisos. Mitigación: `strength` en cada fuente, los valores `assumption` nunca generan críticos, y cada cambio de datos va con una prueba de ejemplo.
- **Cambios de comportamiento del LLM** al regenerar prompts (orden, redacción). Mitigación: K5 aislada, orden estable, `comparar` antes y después.
- **Caché de prompts.** Si la sección generada depende del diseño, el prefijo cacheable cambia. Mitigación: lo general (`{{tipologias}}`) va en el sistema; lo del tipo actual (`{{tipo_actual}}`) va en el contexto variable.
- **Tamaño del prompt.** Diez tipos × una línea es barato; las comprobaciones completas no. Sólo `hints` y rangos van al esqueleto; las comprobaciones sólo del tipo actual.
- **Migraciones de formato.** K4 y K9 tocan lo guardado. Mitigación: `default()` en Zod para lo nuevo y una sola migración `formato: 2` coordinada con D33.
- **Tipos marcados con fricción.** `Mm` en todo el modelo sería caro. Se limita a la frontera del conocimiento.
- **El enum de tipos en el esquema estricto** crece con cada tipo. Con decenas no es problema; con cientos, se pasaría a texto validado contra el registro.

---

## 11. Alternativas consideradas

| Alternativa | Qué ofrece | Por qué no (o no todavía) |
|---|---|---|
| **Motor de reglas genérico** (json-rules-engine, Drools) | Reglas como hechos + condiciones, encadenamiento | Las reglas de Knotty son cuentas sobre geometría (claro libre, grafo de contactos, fórmula de flecha), no condiciones sobre hechos planos: el motor sólo envolvería `if`. Además el dominio sólo puede importar `zod` (`arquitectura.test.ts:26`) y Drools no es JavaScript |
| **JSON Logic** para las condiciones | Reglas serializables y compartibles | Sirve para `alto > 900 && !anclado`, que ya cubre `KindCheck` (métrica + rango + `when`) con tipos y sin intérprete. No expresa geometría; perdería tipos y mensajes de error claros. Se reconsidera sólo si alguien que no programa necesita escribir condiciones compuestas |
| **Un DSL propio** (como el lenguaje de UCS de Cabinet Vision) | Expresividad para quien diseña plantillas | Costo de parser, errores, editor y documentación para un equipo de una persona. TypeScript con `defineTemplate` ya es un DSL tipado con editor |
| **Solver de restricciones** (Cassowary/kiwi.js, programación con restricciones) | Resolver distribuciones con desigualdades («repisas cada 150–200 mm, que sumen el alto») | El resolvedor de cotas por referencias (D2) es determinista, explicable y ya propaga cambios. Lo que se necesita hoy (repartir repisas, inferir medidas) tiene solución cerrada. Queda como opción para plantillas con muchas medidas entrelazadas (cocinas en L), y como adaptador, no en el dominio |
| **Todo en TypeScript** (`as const satisfies`) | Tipos literales gratis, comentarios | Se cuela lógica en los datos y no se puede generar o comprobar con un script contra la investigación. Se usa TS sólo para lo que es comportamiento |
| **Conocimiento en `public/` cargado por fetch** (como el catálogo) | Cambiar datos sin desplegar | Hace asíncrono todo el dominio y las pruebas, y los datos cambian junto con el código que los usa. Sólo lo que depende de la tienda se queda en `public/` |
| **Dejar el conocimiento en los prompts** (que el LLM sepa) | Cero trabajo | Es lo que produjo las desviaciones de §1.2, y contradice D3 y D34: el LLM propone, el dominio decide |

---

## 12. Decisiones para el autor

1. **Formato de los datos:** ¿JSON validado con Zod e importado de forma estática (recomendado) u objetos TypeScript?
2. **Dónde viven:** ¿empaquetados en `domain/knowledge` (recomendado) o en `public/` con fetch como el catálogo?
3. **`kind` en el diseño:** ¿guardarlo en `Diseno` con `formato: 2` (recomendado, junto con D33 paso 7) o sólo en el plan?
4. **`fast-check`** como dependencia de desarrollo para las propiedades de plantillas.
5. **Alcance de los tipos marcados:** sólo la frontera del conocimiento (recomendado) o también el modelo del mueble.
6. **Política al cambiar una regla:** ¿reabrir lo aceptado sólo si empeora la severidad (recomendado) o siempre que cambie la versión?
7. **Calibración visible:** ¿«Supuestos del taller» en Ajustes para todos, o sólo con «Entrañas de la madera» activada?
8. **Herramienta como dato estructurado** (`tools: ToolId[]` en requisitos) para elegir uniones sin preguntar.
9. **Qué tan estricta es la prueba contra medidas en los prompts** (¿se permiten ejemplos fuera de bloques de código?).
10. **Orden frente a D33:** ¿cada entrega del conocimiento migra a inglés lo que toca (recomendado), o primero se mueve y luego se renombra?
11. **Códigos de regla:** ¿un código por comprobación de tipo (`R10_USO:shoeRack.depth`) aunque cambie la clave de lo ya aceptado?

---

## Fuentes

- Cabinet Vision, *User Created Standards* (parámetros de sistema y personalizados, condiciones por método de construcción): https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/System_Level/Ribbonbar/Utilities_Tab/Tools_Group/User_Created_Standards/UCS.UCS.xhtml y https://en.wikibooks.org/wiki/Cabinet_Vision:_The_Last_Mile/User_Created_Standards
- Cabinet Vision, *JavaScript UCS*: https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2024_HELP/page/Tips_Tricks_FAQs/UCS/JavaScript_User_Created_Standards/JavaScript.UCS.xhtml
- Mozaik, métodos de construcción y bibliotecas paramétricas: https://www.mozaiksoftware.com/mozaik-products/mozaik-manufacturing y https://www.phillanton.com/blogs/mozaik-guides/how-to-build-cabinets-your-own-way-in-mozaik
- Mozaik, buenas prácticas para archivos paramétricos: https://www.thedadobase.com/blogs/the-rabbet-hole/best-practices-for-creating-your-own-parametric-files-in-mozaik-software
- PolyBoard, bibliotecas paramétricas de material y herrajes, métodos de fabricación: https://wooddesigner.org/polyboard-software-tools/ y https://www.boole.eu/polyboard.php
- OpenCutList (materiales con atributos y clasificación por tipo): https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension y https://docs.opencutlist.org/
- JSON Logic: https://jsonlogic.com/
- json-rules-engine: https://github.com/CacheControl/json-rules-engine
- Drools: https://www.drools.org/
- kiwi.js (Cassowary en TypeScript): https://github.com/IjzerenHein/kiwi.js
- fast-check: https://fast-check.dev/ y https://github.com/dubzzz/fast-check
- Zod, tipos marcados (`.brand()`): https://zod.dev/api
