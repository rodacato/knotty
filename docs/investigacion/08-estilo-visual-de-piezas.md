# 08 — Estilo visual de las piezas: cantos, perfiles y acabados

> Investigación, no decisión. Nada de esto está implementado. Las cifras de rendimiento de productos vienen de fichas técnicas y tiendas de México [15–20]; los colores en hexadecimal son **aproximados** y sirven solo para dibujar, no para igualar una tinta o una pintura real.

## Resumen

- **Recomendación**: no cambiar la geometría. Seguir con el `boxGeometry` unitario escalado (12 triángulos por pieza) y mover la apariencia a **un solo material de triplay por pieza** (`PlywoodMaterial`: `MeshStandardMaterial` con `onBeforeCompile`) que haga tres cosas en el fragment shader:
  1. **Textura sólida**: el color sale de la posición del fragmento *en mm dentro de la pieza*, no de UV. Las capas del triplay son planos perpendiculares al espesor, así que cualquier superficie (cara, canto, chaflán, redondeo) muestra las capas correctas sin mapear UV.
  2. **Bisel falso por distancia a la arista** (SDF): en una franja de *r* mm junto a las aristas con perfil se dobla la normal y se "rebaja" la posición donde se muestrea la madera, de modo que se ven la luz del redondeo y las capas que expone.
  3. **Acabado**: tinta, pintura, aceite, lavado o laminado se aplican sobre el color de la madera con parámetros por pieza; el barniz y el brillo se resuelven con `roughness` y, solo en vista «renderizado», con `clearcoat` de `MeshPhysicalMaterial`.
- De paso se baja de **6 a 1 llamada de dibujo** por pieza (hoy cada pieza tiene 6 materiales, uno por cara).
- Un radio de 3–6 mm mide **1–2 px** en la vista normal de un celular; la silueta redonda no se nota, la luz sobre el redondeo sí. La geometría real (con redondeo solo en las aristas marcadas) queda para acercamientos y exportación, y gracias a la textura sólida no necesitaría trabajo de UV.
- En el dominio entran `EdgeProfile` + `EdgeBanding` por canto y `Finish` por mueble (exterior/interior) con excepciones por grupo o pieza; dos operaciones nuevas, `setEdgeProfile` y `setFinish`, ambas del carril **instantáneo** (D34). El despiece sigue viendo prismas; solo el canto macizo cambia la medida de corte.

---

## 1. Cómo se dibuja hoy

Lo que importa de `src/ui/escena/` para esta investigación:

| Archivo | Lo relevante |
|---|---|
| `Pieza.tsx` | Un `<boxGeometry />` **unitario** escalado con `scale` animado por `@react-spring/three` (la pieza nueva "cae" y crece de 0.92 a 1). Seis `meshStandardMaterial` (uno por cara, en el orden +x, −x, +y, −y, +z, −z), cada uno con su textura clonada, `roughness 0.78`, `metalness 0`. Opacidad y emisivo (pulso ámbar) se escriben a mano en `useFrame`. `Edges` de drei con `threshold 15` dibuja las aristas en grafito o ámbar. |
| `texturas.ts` | Cinco texturas de lienzo 512 × 512 generadas en el navegador (`veta-u`, `veta-v`, `capas-u`, `capas-v`, `boceto`) en dos tonos (`triplay`, `trasera`). Las capas son 7 franjas en el triplay y 3 en la trasera. |
| `Escena.tsx` | `frameloop="demand"`, sombras con luz direccional (mapa de 1024 en táctil, 2048 en escritorio), `Environment` con tres `Lightformer`, `ContactShadows`, `Grid` infinito y `N8AO` a media resolución **solo si `calidad`**, que en celular arranca en `false`: hoy el celular no tiene oclusión ambiental. |
| `preferencias.ts` | `useOscuro`, `useMovimientoReducido`, `useTactil`. |
| `Saliente.tsx`, `Aserrin.tsx`, `Cotas.tsx` | Efectos y cotas; no dependen del material de la pieza. |

Del esquema (`src/domain/diseno/esquema.ts`):

- `cantos: ('frente' | 'atras' | 'izq' | 'der' | 'arriba' | 'abajo')[]` son **caras de la caja** (en ejes del mueble: `frente` = z1, `der` = x1, `arriba` = y1…) que llevan cubrecanto. `compra.ts` suma su largo para los metros de cubrecanto. **El 3D hoy los ignora**: un canto con cubrecanto se sigue viendo con capas.
- `veta: 'largo' | 'ancho' | 'libre'`, `normal` (eje del espesor), `material` (T12, T15, T18, TR3, TR6), `rol`, `grupo`.
- El catálogo solo tiene `cubrecanto-19` (chapa de pino 19 mm, por metro) y una `jaladera` genérica.

Costo actual aproximado por pieza: 6 llamadas de dibujo en la pasada principal + 6 en la de sombra + 1 de `Edges` ≈ **13**. Un librero de 15 piezas ronda 200 llamadas; una alacena con cajones (40 piezas), más de 500. En un celular de gama media eso ya es lo que más pesa, más que los triángulos.

---

## 2. Perfiles de canto en muebles de triplay

### 2.1 Lo que existe en el taller

| Perfil | Cómo se hace | En triplay de pino | Nota de estilo |
|---|---|---|---|
| **Recto** (vivo) | Tal cual sale de la sierra | Deja ver las capas y los huecos del alma | Lo más común en DIY |
| **Matado / lijado** (≈ r1) | Lija grano 120 sobre la arista | Siempre; quita astillas | "Recto" bien hecho; debería ser el valor por omisión |
| **Redondeo r3** | Router con broca de redondeo con balero, o lija | Atraviesa la chapa exterior (≈ 1–1.5 mm) y muestra una línea de la capa cruzada | Suave, moderno |
| **Redondeo r6** | Router | En 18 mm muestra 2–3 capas en el redondeo | Muebles infantiles, cubiertas |
| **Chaflán 45° (3 o 6 mm)** | Router con broca de chaflán, cepillo o lija en bloque | Muestra franjas rectas de capas | Look nórdico / industrial |
| **Medio bocel** (r = espesor/2) | Router con dos pasadas de redondeo o broca de medio bocel | Capas como "ondas" en todo el canto | Solo con canto macizo o triplay tipo báltico; en pino se ven huecos |
| **Con cubrecanto de chapa** (0.5 mm, pre‑engomado) | Plancha y cúter | Tapa las capas; se lija la arista (r ≈ 0.5–1) | No admite router: se rompe |
| **Con cubrecanto de PVC** (0.45–2 mm) | Plancha o enchapadora | Cubre; el de 2 mm acepta redondeo r2 | Típico en melamina |
| **Canto macizo** (tira de pino 6–10 mm pegada) | Pegamento y clavo sin cabeza o tarugo; luego se perfila | Permite cualquier perfil (r6, medio bocel) | El más "de ebanista"; suma material y tiempo |
| **Canto expuesto con capas lijadas** | Lijado fino + aceite o barniz | Resalta el rayado; en pino las capas son irregulares y con huecos | Tendencia "plywood" (báltico); en pino de tienda conviene advertirlo |

Consecuencias para el modelo:

- El **perfil** (forma) y el **recubrimiento** (cubrecanto) son dos datos distintos. Hoy `cantos` mezcla "tiene cubrecanto" con nada más.
- El perfil vive en las **aristas** que el canto comparte con las dos caras grandes. Las cuatro aristas a lo largo del espesor (las esquinas vistas en planta) casi siempre quedan vivas; una esquina redondeada en planta (cubierta con r25) es otra cosa y se deja fuera por ahora.
- Nada de esto cambia la **caja** de la pieza: el tablero se corta rectangular y después se perfila. El despiece y el acomodo siguen trabajando con prismas (D10). La única excepción es el **canto macizo**: la medida terminada incluye la tira, así que el tablero se corta más chico (§6.3).

### 2.2 Reglas que salen de ahí (candidatas a R9)

- Perfil router (`round3`, `round6`, `chamfer*`, `bullnose`) + cubrecanto de chapa → **incompatible**: se perfila antes y no se puede enchapar después, o se enchapa y no se puede perfilar. Ofrecer "canto macizo" o "sin cubrecanto".
- `bullnose` exige espesor ≥ 2r y en triplay de pino se recomienda con canto macizo (detalle).
- Redondeo mayor que el espesor de la pieza entre 2 → error de dato.
- Perfil en un canto que toca otra pieza (el canto trasero de una repisa contra la trasera) → aviso "no se va a ver"; el motor de contacto (`validacion/contacto.ts`) ya sabe qué caras tocan.

---

## 3. Técnicas para redondear en 3D, evaluadas

Distancia de referencia: vista 3/4 de un librero de 900 × 1800 × 300 mm en celular. La cámara de `Escena.tsx` queda a ≈ 4 m con `fov 35`, lo que abarca ≈ 2.5 m de alto en ≈ 660 px de lienzo (440 px CSS × dpr 1.5): **≈ 0.26 px/mm**. Un r6 mide 1.6 px y un r3, 0.8 px. Al acercarse a 0.5 m son ≈ 2.1 px/mm (un r6 mide 13 px).

| Opción | Triángulos por pieza | Aristas elegibles | UV / capas | Compatible con la caja unitaria escalada | Veredicto |
|---|---|---|---|---|---|
| `boxGeometry` actual | 12 | — | Por cara | Sí | Base |
| `RoundedBox` de drei [1] | ≈ 700 (forma con 4 arcos × `smoothness` extruida con `bevelSegments × 2` anillos) | Todas, mismo radio | `ExtrudeGeometry` con 2 grupos (tapas y costados) [2]; los materiales por cara no llegan [3]; las capas no quedan bien | **No**: el radio se deforma con `scale` no uniforme; hay que reconstruir por tamaño | Descartado |
| `RoundedBoxGeometry` de three [4] | 300 con `segments = 2` ((2·2+1)² · 2 · 6), 588 con 3 | Todas, mismo radio (el radio también redondea las esquinas en planta) | Hereda los 6 grupos de `BoxGeometry`; UV repartida en arcos | No (mismo problema de escala) | Útil para jaladeras o patas, no para tableros |
| `ExtrudeGeometry` propia con `bevelEnabled` [2] | 100–400 | Todas las del contorno extruido, mismo bisel | `WorldUVGenerator`; hay que escribir un `UVGenerator` | No | Solo si el perfil es uniforme |
| **Geometría propia por arista** (perfil 2D extruido a lo largo de cada arista marcada, ingletes en las esquinas) | 12 + ≈ 2·s por arista perfilada + esquinas ≈ **40–120** (s = 4 segmentos) | **Solo las marcadas**, radio por arista | Innecesaria con textura sólida (§4) | No: se construye a tamaño real; la animación de `scale` pasa a ser una razón (1 → 1) | Buena para acercamiento y exportación |
| Vertex shader "cheap round‑edged box" [5] | Los de una caja subdividida | Todas | Deforma vértices | Sí, si recibe el tamaño | Silueta redonda barata, pero todas las aristas iguales |
| **Bisel falso en fragment shader** (SDF) [6][7][8] | **12** | Solo las marcadas, radio por arista | Textura sólida: automática | **Sí** (lee la escala de `modelMatrix`) | **Recomendado** |
| Normales suavizadas (`toCreasedNormals`) [9] | Igual que la geometría | — | — | — | Solo complementa geometría redondeada; en una caja de 8 vértices "infla" la pieza |

### 3.1 Por qué el bisel falso

- La silueta redonda de un r3 no se distingue a la distancia normal; lo que el ojo lee es **la línea de luz** sobre la arista y **las capas que el perfil destapa**. Las dos cosas son de sombreado, no de geometría.
- Mantiene todo lo que hoy funciona: caja unitaria, resorte en `scale`, selección por *raycast*, `Edges`, sombras, despiece.
- Permite **exagerar a propósito** (licencia de maqueta): la franja nunca baja de 1.5 px (`max(r, fwidth(...) * 1.5)`), así un r3 se lee incluso lejos. Es coherente con "maqueta sobre el banco de trabajo".
- Limitaciones honestas: la silueta sigue siendo recta, en ángulos rasantes el truco se nota, y la sombra proyectada es de caja. Para un acercamiento de "renderizado" puede sustituirse por la geometría por arista sin cambiar el material (§4.4).

### 3.2 Textura sólida: por qué resuelve las UV

Hoy cada cara elige entre `veta-u/v` y `capas-u/v` y ajusta `repeat`. Con un redondeo o un chaflán no hay "cara" a la que asignarle una textura. Si el color se calcula con la posición en mm dentro del tablero:

- `depth = p[normal] + espesor/2` indica en qué **capa** está el punto: `ply = floor(depth / (espesor / nCapas))`.
- Las capas alternan dirección: pares con la veta de la pieza, nones cruzadas. Se muestrea la misma textura de veta con `(p[veta], p[transversal])` o al revés.
- En la cara grande sale la capa exterior con veta; en el canto salen las capas (como hoy); en un chaflán salen franjas proporcionales al ángulo; en un redondeo, franjas que se abren. Es exactamente lo que pasa en la madera.
- La línea de pegamento entre capas se oscurece con `fract(depth / grosorCapa)`, y la veta de testa (cuando la cara mira en la dirección de la veta de esa capa) se oscurece un 15–20 %.

### 3.3 Costo en celular

| | Hoy | Con `PlywoodMaterial` |
|---|---|---|
| Triángulos por pieza | 12 | 12 |
| Llamadas de dibujo (principal + sombra + aristas) | ≈ 13 | ≈ 3 |
| Programas de shader | 1 (estándar) | 1 (misma clave de caché para todas las piezas) |
| Costo por píxel | `MeshStandardMaterial` + 1 textura | + 2–4 muestras de textura, ≈ 40 instrucciones de bisel; menor que activar `clearcoat` |
| Texturas | 5 lienzos 512² compartidos | 1–2 lienzos (veta y boceto); las capas se calculan |

El siguiente paso de rendimiento (opcional) sería `InstancedMesh` con atributos por instancia (tamaño, ejes, perfiles, acabado): una llamada para todo el mueble. Choca con los resortes y opacidades por pieza, así que no es prioridad.

---

## 4. Prototipo (ilustrativo, no está en el repo)

### 4.1 Contrato entre dominio y shader

```ts
// ui/escena/plywood/uniforms.ts — only ui/ knows these numbers.
import type { Canto } from '../../../domain/diseno/esquema'

/** Box side index as the shader sees it: axis * 2 + (positive ? 0 : 1). */
export const SIDE_INDEX: Record<Canto, number> = { der: 0, izq: 1, arriba: 2, abajo: 3, frente: 4, atras: 5 }
export const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const

/** x = kind (0 square, 1 round, 2 chamfer), y = size in mm, z = banding (0 none, 1 veneer, 2 pvc, 3 solid wood). */
export type SideUniform = [kind: number, sizeMm: number, banding: number, unused: number]
```

### 4.2 Material con `onBeforeCompile`

Sigue la forma de `Pieza.tsx`: un material por pieza, opacidad y emisivo escritos en `useFrame`. Los nombres de los *chunks* (`begin_vertex`, `map_fragment`, `normal_fragment_begin`) son los de three r186; si cambian, el material deja de compilar, por eso conviene una prueba de humo (§8).

```ts
// ui/escena/plywood/plywoodMaterial.ts
import { MeshStandardMaterial, Vector4, type Texture } from 'three'

export interface PlywoodParams {
  grain: Texture          // the existing 'veta-u' canvas texture (sRGB, RepeatWrapping)
  normalAxis: 0 | 1 | 2   // thickness axis
  grainAxis: 0 | 1 | 2    // resolved like texturasDeCaras does today
  plies: number           // 7 for T12–T18, 3 for TR3/TR6
  sides: Vector4[]        // 6 entries, SIDE_INDEX order
  finish: FinishUniforms  // see 4.3
}

export function createPlywoodMaterial(p: PlywoodParams) {
  const m = new MeshStandardMaterial({ roughness: 0.78, metalness: 0, transparent: true, emissive: '#d98a2b' })
  const uniforms = {
    uGrain: { value: p.grain },
    uNormalAxis: { value: p.normalAxis },
    uGrainAxis: { value: p.grainAxis },
    uPlies: { value: p.plies },
    uSides: { value: p.sides },
    uFinishColor: { value: p.finish.color },
    uFinishKind: { value: p.finish.kind },
    uFinishAmount: { value: 1 },   // animated 0 → 1 when a finish changes (4.5)
  }
  m.userData.uniforms = uniforms
  m.customProgramCacheKey = () => 'plywood-v1'
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPosMm; varying vec3 vHalfMm; varying vec3 vObjNormal;
        varying vec3 vAxis0; varying vec3 vAxis1; varying vec3 vAxis2;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // The mesh is a unit box scaled to the piece: recover the size from the model matrix,
        // so the spring animation on scale keeps working without extra uniforms.
        vec3 sizeM = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
        vPosMm = position * sizeM * 1000.0;
        vHalfMm = sizeM * 500.0;
        vObjNormal = normal;
        vAxis0 = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
        vAxis1 = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
        vAxis2 = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));`)

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uGrain; uniform int uNormalAxis; uniform int uGrainAxis; uniform float uPlies;
        uniform vec4 uSides[6]; uniform vec3 uFinishColor; uniform int uFinishKind; uniform float uFinishAmount;
        varying vec3 vPosMm; varying vec3 vHalfMm; varying vec3 vObjNormal;
        varying vec3 vAxis0; varying vec3 vAxis1; varying vec3 vAxis2;
        ${PLYWOOD_GLSL}
        ${FINISH_GLSL}`)
      .replace('#include <map_fragment>', `
        vec3 bentObj; vec3 samplePos;
        edgeProfile(vPosMm, vObjNormal, bentObj, samplePos);
        diffuseColor.rgb *= applyFinish(plywoodAlbedo(samplePos, bentObj), samplePos);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        // Object-space bent normal to view space, using the three box axes.
        normal = normalize(bentObj.x * vAxis0 + bentObj.y * vAxis1 + bentObj.z * vAxis2);
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif`)
  }
  return m
}
```

Nota: en `meshphysical.glsl` (el que usa también `MeshStandardMaterial`) `map_fragment` va antes que `normal_fragment_begin`, por eso `bentObj` se calcula en el primero y se reusa en el segundo. Con `three-custom-shader-material` [10] el mismo código queda sin `replace` frágiles (`csm_DiffuseColor`, `csm_FragNormal`), a cambio de una dependencia.

```glsl
// PLYWOOD_GLSL — solid plywood texture and fake edge profile. Units: mm, object space, centered.
float axisOf(vec3 v, int a) { return a == 0 ? v.x : (a == 1 ? v.y : v.z); }
vec3 axisVec(int a) { return a == 0 ? vec3(1.0, 0.0, 0.0) : (a == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0)); }

vec3 plywoodAlbedo(vec3 p, vec3 n) {
  int na = uNormalAxis; int ga = uGrainAxis; int ca = 3 - na - ga;
  float thick = 2.0 * axisOf(vHalfMm, na);
  float plyT = thick / uPlies;
  float depth = axisOf(p, na) + 0.5 * thick;
  float ply = clamp(floor(depth / plyT), 0.0, uPlies - 1.0);
  bool crossed = mod(ply, 2.0) > 0.5;                       // plies alternate direction
  int along = crossed ? ca : ga;                            // grain direction of this ply
  vec2 uv = vec2(axisOf(p, along), axisOf(p, crossed ? ga : ca)) / 450.0 + ply * 0.137;
  vec3 wood = texture2D(uGrain, uv).rgb;                    // sRGB texture: decoded by the GPU
  if (crossed) wood *= vec3(1.03, 1.0, 0.95);               // inner plies are a bit paler/warmer
  float endGrain = abs(axisOf(n, along));                   // looking along the fibres → end grain
  wood *= mix(1.0, 0.8, endGrain);
  float f = fract(depth / plyT);
  float glue = smoothstep(0.0, 0.06, f) * smoothstep(0.0, 0.06, 1.0 - f);
  return wood * mix(0.7, 1.0, glue);
}

// Bends the normal and pushes the sampling point inside the board near profiled arrises.
// Big faces look at the four sides; side faces look at their own profile against both big faces.
void bend(vec3 p, int sideAxis, float sideSign, vec4 prof, inout vec3 nrm, inout vec3 q) {
  if (prof.x < 0.5) return;                                  // square
  float d = axisOf(vHalfMm, sideAxis) - sideSign * axisOf(p, sideAxis); // mm to the adjacent plane
  float fw = fwidth(axisOf(p, sideAxis));
  float r = max(prof.y, fw * 1.5);                           // never thinner than 1.5 px: maquette licence
  float x = clamp(1.0 - d / r, 0.0, 1.0);                    // 0 at the tangent line, 1 at the arris
  if (x <= 0.0) return;
  float ang = prof.x < 1.5 ? x * 0.7854 : 0.7854 * smoothstep(0.0, fw / r, x); // round vs chamfer (45°)
  vec3 toSide = axisVec(sideAxis) * sideSign;
  nrm = normalize(cos(ang) * nrm + sin(ang) * toSide);
  float removed = prof.x < 1.5 ? r * (1.0 - sqrt(max(0.0, 1.0 - x * x))) : x * r; // material cut away
  q -= vObjNormal * removed;                                 // sample the plies the cut exposes
}

void edgeProfile(vec3 p, vec3 n0, out vec3 nrm, out vec3 q) {
  nrm = n0; q = p;
  int na = uNormalAxis;
  int fa = abs(n0.x) > 0.5 ? 0 : (abs(n0.y) > 0.5 ? 1 : 2);  // axis of this face
  float fs = axisOf(n0, fa) > 0.0 ? 1.0 : -1.0;
  if (fa == na) {
    for (int a = 0; a < 3; a++) {
      if (a == na) continue;
      bend(p, a,  1.0, uSides[a * 2],     nrm, q);
      bend(p, a, -1.0, uSides[a * 2 + 1], nrm, q);
    }
  } else {
    vec4 own = uSides[fa * 2 + (fs > 0.0 ? 0 : 1)];          // the profile belongs to this side
    bend(p, na,  1.0, own, nrm, q);
    bend(p, na, -1.0, own, nrm, q);
  }
}
```

Dos simplificaciones deliberadas: cada cara dibuja la mitad del arco (0–45° y 45–90°), que se unen en la arista con la misma normal; y el punto de muestreo se hunde a lo largo de la normal de la cara (no sobre el arco), suficiente para que aparezcan las capas correctas. Con `banding > 0` la función `plywoodAlbedo` se sustituye en esa cara por la veta a lo largo del canto (chapa), un color liso (PVC) o una tira de pino con veta longitudinal (canto macizo).

### 4.3 Acabado sobre la veta

```glsl
// FINISH_GLSL — kinds: 0 natural, 1 oil, 2 varnish, 3 stain, 4 paint, 5 whitewash, 6 laminate.
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 applyFinish(vec3 wood, vec3 p) {
  float l = luma(wood);
  vec3 outc = wood;
  if (uFinishKind == 1) outc = wood * vec3(0.93, 0.82, 0.66) * 1.05;                     // oil: amber, deeper grain
  else if (uFinishKind == 2) outc = wood * mix(vec3(1.0), uFinishColor, 0.6);             // varnish: tint (ambering or none)
  else if (uFinishKind == 3) outc = uFinishColor * (0.45 + 1.4 * l);                      // stain: colour, grain survives
  else if (uFinishKind == 4) outc = uFinishColor * (0.97 + 0.06 * (l - 0.45) / 0.45);     // paint: grain only hinted
  else if (uFinishKind == 5) outc = mix(wood, uFinishColor, 0.55 - 0.25 * (l - 0.5));      // whitewash: white sits in soft grain
  else if (uFinishKind == 6) outc = uFinishColor;                                         // laminate: flat
  return mix(wood, outc, uFinishAmount);
}
```

La tinta multiplica por la luminancia de la madera en lugar de multiplicar el color: así una tinta ébano no se vuelve negro plano y la veta sigue visible, como en la realidad. En el canto (veta de testa) la tinta se absorbe más: aplicar `uFinishAmount` × 1.3 de oscurecimiento cuando `endGrain` es alto.

Parámetros del material (en `ui/`, no en el dominio):

```ts
// ui/escena/plywood/finishLook.ts
import type { FinishKind, Sheen } from '../../../domain/finish/finish'

export const SHEEN_LOOK: Record<Sheen, { roughness: number; clearcoat: number; clearcoatRoughness: number }> = {
  matte:      { roughness: 0.82, clearcoat: 0,    clearcoatRoughness: 0.6 },
  satin:      { roughness: 0.6,  clearcoat: 0.35, clearcoatRoughness: 0.45 },
  semigloss:  { roughness: 0.45, clearcoat: 0.6,  clearcoatRoughness: 0.25 },
  gloss:      { roughness: 0.35, clearcoat: 1,    clearcoatRoughness: 0.06 },
}

export const KIND_INDEX: Record<FinishKind, number> = { natural: 0, oil: 1, varnish: 2, stain: 3, paint: 4, whitewash: 5, laminate: 6 }

/** Taller view and phones use MeshStandardMaterial and fake the coat with roughness only. */
export const roughnessOnly = (s: Sheen) => ({ matte: 0.82, satin: 0.55, semigloss: 0.4, gloss: 0.22 })[s]
```

`clearcoat` de `MeshPhysicalMaterial` [11] es la forma correcta de un barniz (una capa lisa encima de una madera mate), pero cuesta más por píxel y conviene reservarlo para la vista «renderizado». `sheen` es para telas: no aporta en madera. `specularIntensity` bajo (0.3–0.5) ayuda a que la madera cruda no brille como plástico. Un barniz a base de solvente amarillea (tinte ámbar `#F3DDB2` con 0.6), uno base agua casi no (`#FFFFFF`).

### 4.4 Geometría real por arista (para después)

Si algún día se quiere la silueta: se construye el tablero a tamaño real con un perfil 2D (rectángulo del espesor con las esquinas redondeadas o cortadas según los dos perfiles del canto) extruido a lo largo de cada canto y unido en las esquinas con inglete. El mismo `PlywoodMaterial` sirve si el tamaño llega por uniforme (`uHalfMm`) en vez de salir de `modelMatrix`. El caso más común, una repisa con solo el frente perfilado, cabe en una `ExtrudeGeometry` [2] sin bisel:

```ts
// Shelf with only the front edge profiled: profile in the (z, y) plane extruded along x.
import { ExtrudeGeometry, Shape } from 'three'

export function shelfWithFrontRound(widthMm: number, depthMm: number, thickMm: number, rMm: number) {
  const s = new Shape()
  s.moveTo(0, 0)
  s.lineTo(depthMm - rMm, 0)
  s.absarc(depthMm - rMm, rMm, rMm, -Math.PI / 2, 0, false)
  s.lineTo(depthMm, thickMm - rMm)
  s.absarc(depthMm - rMm, thickMm - rMm, rMm, 0, Math.PI / 2, false)
  s.lineTo(0, thickMm)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: widthMm, bevelEnabled: false, curveSegments: 4 })
  g.rotateY(-Math.PI / 2).center().scale(0.001, 0.001, 0.001) // ≈ 60 triangles; UVs are irrelevant with solid texturing
  return g
}
```

### 4.5 Acabado que "se pinta" al cambiar

`uFinishAmount` no se anima de golpe: una franja avanza de abajo hacia arriba con un poco de ruido, como una brocha, siguiendo el mismo orden en cascada que ya usa `Escena.tsx` para el "boceto → madera" (retraso por `y0`). Con movimiento reducido, cambio inmediato.

```glsl
float wipe = smoothstep(uFinishAmount - 0.06, uFinishAmount + 0.06,
                        1.0 - (p.y / (2.0 * vHalfMm.y) + 0.5) + 0.04 * sin(p.x * 0.05));
return mix(wood, outc, 1.0 - wipe);
```

---

## 5. Acabados como dato

### 5.1 Catálogo de acabados reales en México

| Tipo | Productos de referencia | Rendimiento de ficha | Manos típicas | Notas |
|---|---|---|---|---|
| Tinta al aceite | Sayer Lack ManchaSayer (Nogal, Nogal Americano, Caoba Inglés, Caoba Clásico, Chocolate…) [15][16] | 10–12 m²/L [15] | 1–2 | Se limpia con trapo; en pino se mancha disparejo: pedir sellador o acondicionador antes |
| Tinte + barniz en uno | Minwax PolyShades (Home Depot MX) [17] | según ficha | 2 | Cómodo, menos control del color |
| Barniz poliuretano interior | Polyform 3000 (brillante, semimate, mate) [18] | 8 m²/L teórico [18] | 2–3 sobre sellador | Solvente: amarillea un poco |
| Barniz exterior | Polyform 11000 (con catalizador; hay versión base agua) [19] | según ficha | 2–3 | Para cocina, baño o exterior |
| Productos base agua | Comex (barniz, sellador, esmalte base agua) [20] | — | — | Menos olor, secado rápido, casi no amarillea |
| Esmalte para madera | Comex Acqua 100 Total (brillante, semimate, mate) [21] | 6–8 m²/L [21] | 2 sobre primario | Pintura de color |
| Cubrecanto | Chapa de pino o madera natural pre‑engomada 16–19 mm, PVC/melamina (Home Depot MX) [22] | por metro | — | Hoy solo está `cubrecanto-19` |

Para calcular litros: área × manos ÷ (rendimiento × 0.8). *Nota de auditoría: antes decía 0.75; se unificó con `03-acabados.md` §17.1 en 0.8.* El factor cubre la merma práctica frente al rendimiento "teórico" de ficha; debe ser editable como los precios (D22).

### 5.2 Paletas aproximadas

Tintas sobre pino (color "a saturación", el que usa `uFinishColor`; el nombre es el genérico que la gente dice en tienda):

| Id | Nombre | Hex aprox. |
|---|---|---|
| `natural` | Natural (sin tinta) | `#DCB680` |
| `honey` | Miel | `#C98E4A` |
| `light-oak` | Roble claro | `#B07A45` |
| `cedar` | Cedro rojo | `#9A5836` |
| `walnut` | Nogal | `#6B4A2E` |
| `chocolate` | Chocolate / nogal oscuro | `#4A3021` |
| `english-mahogany` | Caoba inglés | `#6E2E1F` |
| `mahogany` | Caoba rojiza | `#7E3B26` |
| `ebony` | Ébano | `#2A1E17` |
| `weathered-grey` | Gris envejecido | `#8C8479` |
| `whitewash` | Blanco lavado (pickled) | `#EDE6DA` |

Pinturas comunes en muebles (nombres genéricos, **no** códigos Comex ni Berel; si la persona da un código de marca, se guarda como texto y el hex sigue siendo aproximado):

| Id | Nombre | Hex aprox. |
|---|---|---|
| `oyster-white` | Blanco ostión | `#EFE9DC` |
| `pure-white` | Blanco puro | `#F7F6F2` |
| `matte-black` | Negro | `#242424` |
| `oxford-grey` | Gris Oxford | `#4A4E52` |
| `sage` | Verde salvia | `#9CAF88` |
| `olive` | Verde olivo | `#6B6B3A` |
| `navy` | Azul marino | `#1F3A5F` |
| `petrol` | Azul petróleo | `#2F5D62` |
| `terracotta` | Terracota | `#B5562F` |
| `mustard` | Mostaza | `#D4A017` |
| `mexican-pink` | Rosa mexicano | `#E4007C` |

### 5.3 Por mueble, por grupo, por pieza; interior y exterior

- **Por mueble** es lo normal: un acabado exterior y uno interior (a menudo el mismo, o interior "solo sellador").
- **Por grupo** cubre el caso bicolor más pedido: carcasa blanca y frentes (puertas, cajones) en nogal. Los grupos ya existen (`puerta-1`, `cajon-2`); falta un selector por rol (`fronts` = `puerta` + `frente-cajon`).
- **Por pieza** queda como excepción (una cubierta de otro color).
- **Exterior/interior se calcula**, no se guarda: una cara es exterior si queda en un plano de `mueble.*` (lateral por fuera, techo arriba) o si es el frente de una puerta o cajón; lo demás es interior. La trasera por dentro es interior y por fuera "no se ve". Como la pieza sigue teniendo 6 caras, cada cara recibe su acabado en el shader con un `uFaceZone[6]`.

### 5.4 Tipos del dominio

Identificadores en inglés, textos para la persona en español (D33). Van en un módulo nuevo `src/domain/finish/`, y los perfiles, junto al esquema de la pieza.

```ts
// src/domain/diseno/edges.ts (new module, English from day one)
// Audit note: enum literals in camelCase like every other id (10-auditoria.md §3); replaces EdgeTreatment in 01 §14.4.
import { z } from 'zod'
import { Canto } from './esquema'

export const EdgeProfile = z
  .enum(['square', 'eased', 'round3', 'round6', 'chamfer3', 'chamfer6', 'bullnose'])
  .describe('Forma del canto: square = recto, eased = matado con lija, roundN = redondeo de N mm, chamferN = chaflán de N mm, bullnose = medio bocel')
export type EdgeProfile = z.infer<typeof EdgeProfile>

export const EdgeBanding = z
  .enum(['none', 'veneer', 'pvc', 'melamine', 'solidWood'])
  .describe('Recubrimiento del canto: none = capas a la vista, veneer = cubrecanto de chapa, pvc = cubrecanto de PVC, melamine = cubrecanto de melamina, solidWood = canto macizo')
export type EdgeBanding = z.infer<typeof EdgeBanding>

export const EdgeSpec = z.object({ side: Canto, profile: EdgeProfile, banding: EdgeBanding })
export type EdgeSpec = z.infer<typeof EdgeSpec>

/** Millimetres removed by each profile; bullnose depends on thickness. */
export const PROFILE_SIZE_MM: Record<EdgeProfile, number | 'half-thickness'> = {
  square: 0, eased: 1, 'round3': 3, 'round6': 6, 'chamfer3': 3, 'chamfer6': 6, bullnose: 'half-thickness',
}
export const BANDING_THICKNESS_MM: Record<EdgeBanding, number> = { none: 0, veneer: 0.5, pvc: 2, melamine: 1, solidWood: 8 }
```

```ts
// src/domain/finish/finish.ts
import { z } from 'zod'

export const FinishKind = z.enum(['natural', 'oil', 'varnish', 'stain', 'paint', 'whitewash', 'laminate'])
export type FinishKind = z.infer<typeof FinishKind>
export const Sheen = z.enum(['matte', 'satin', 'semigloss', 'gloss']).describe('mate, satinado, semimate/semibrillante, brillante')
export type Sheen = z.infer<typeof Sheen>

export const Finish = z.object({
  preset: z.string().describe('Id del acabado en el catálogo, por ejemplo "stain-walnut" o "paint-oyster-white"'),
  sheen: Sheen,
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().describe('Solo pintura o tinta a la medida; si es null, el color del catálogo'),
  brandCode: z.string().nullable().describe('Código de color de la marca si la persona lo dio, por ejemplo de Comex'),
})
export type Finish = z.infer<typeof Finish>

export const FinishTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('furniture'), zone: z.enum(['exterior', 'interior', 'all']) }),
  z.object({ kind: z.literal('fronts') }).describe('Puertas y frentes de cajón'),
  z.object({ kind: z.literal('group'), group: z.string() }),
  z.object({ kind: z.literal('pieces'), ids: z.array(z.string()).min(1) }),
])

export const FinishPlan = z.object({
  exterior: Finish,
  interior: Finish.nullable().describe('null = igual que el exterior'),
  overrides: z.array(z.object({ target: FinishTarget, finish: Finish })),
})
export type FinishPlan = z.infer<typeof FinishPlan>

/** Catalog entry, loaded like the materials catalog (public/catalogo/acabados.json). */
export const FinishPreset = z.object({
  id: z.string(),
  name: z.string().describe('Texto para la persona: "Tinta nogal"'),
  kind: FinishKind,
  color: z.string(),                         // approximate hex, drawing only
  sheens: z.array(Sheen),
  coverageM2PerL: z.number().positive(),     // per coat, from the data sheet
  coats: z.number().int().positive(),
  needsSealer: z.boolean(),
  recoatHours: z.number().nonnegative(),
  pricePerL: z.number().nullable(),          // estimated, editable (D22)
  packs: z.array(z.number()).describe('Presentaciones en litros: 0.25, 1, 4, 19'),
})
```

Encaje en el diseño:

- `Pieza.edges: EdgeSpec[]` con `.default([])` (en la salida estricta, `nullable`). **Transición sin romper**: mientras `cantos` exista, `cantos: ['frente']` equivale a `edges: [{ side: 'frente', profile: 'eased', banding: 'veneer' }]`; cuando el módulo `diseno` migre a inglés (D33) se reemplaza `cantos` por `edges` con migración de formato para lo guardado.
- `Diseno.finish: FinishPlan | null` (null = natural sin acabado, como hoy).

### 5.5 Qué queda en `ui/`

Los parámetros de render (`roughness`, `clearcoat`, índices de shader, colores de modo oscuro), la animación, el nivel de calidad y las texturas. El dominio no sabe de `MeshPhysicalMaterial`; solo sabe qué acabado es, cuánto cuesta y cuánto tarda.

---

## 6. Chat, operaciones y costo

### 6.1 Cómo lo pide la persona

- "Redondea el frente de las repisas" → `setEdgeProfile { ids: [repisas], sides: ['frente'], profile: 'round3', banding: null }` (null = no tocar el recubrimiento).
- "Que no se vean las capas" → `banding: 'veneer'` en los cantos visibles.
- "Quiero los cantos con capas a la vista, estilo nórdico" → `banding: 'none'`, `profile: 'eased'` y la sugerencia de aceite.
- "Píntalo de blanco y las puertas en nogal" → dos `setFinish`: `furniture/all` con `paint-oyster-white` y `fronts` con `stain-walnut`.
- "Barniz mate, es para la cocina" → el experto aporta el criterio (poliuretano de exterior, no aceite) y la app lo aplica.

Ambas son del carril **instantáneo** (D34): la ficha de la pieza tiene selectores de perfil y acabado que llaman a la misma operación sin experto. El experto solo interviene para recomendar.

```ts
// Additions to Operacion (English names, D33). Nullable fields for strict LLM output.
z.object({
  op: z.literal('setEdgeProfile'),
  ids: z.array(PiezaId).min(1),
  sides: z.union([z.array(Canto).min(1), z.literal('visible')]).describe('"visible" = los cantos que no tocan otra pieza'),
  profile: EdgeProfile.nullable(),
  banding: EdgeBanding.nullable(),
}),
z.object({ op: z.literal('setFinish'), target: FinishTarget, finish: Finish }),
```

`sides: 'visible'` se resuelve en el dominio con el grafo de contacto, así el LLM no tiene que saber qué canto toca a qué.

### 6.2 Materiales y costo

- **Cubrecanto**: `metrosDeCubrecanto` separa por tipo (chapa, PVC) y por ancho: 19 mm para T18, 16 mm para T15 y T12 (Home Depot MX vende de 16 mm [22]).
- **Canto macizo**: metros de tira de pino (p. ej. 19 × 8 mm) + pegamento; y **el corte del tablero se reduce** en `BANDING_THICKNESS_MM` por cada canto macizo (y opcionalmente los 2 mm del PVC). Es el único cambio en el despiece; la caja terminada no cambia.
- **Acabado**: área por zona (sumando caras según §5.3, cantos incluidos) → litros por producto → presentaciones (0.25 / 1 / 4 L) → costo. Sellador aparte si `needsSealer`. Lija por pliegos (grano 120 y 220) y brocha o rodillo como consumibles.
- **Ejemplo**: librero 900 × 1800 × 300 mm con 5 repisas. Área a barnizar por las dos caras más cantos al frente ≈ 6 m². Tres manos de Polyform 3000 a 8 m²/L con factor 0.8: 6 × 3 ÷ 6.4 ≈ **2.8 L** → una presentación de 4 L (o tres de 1 L), más ≈ 0.75 L de sellador.
- **Tiempo**: el acabado domina el calendario: lijado ≈ 10–15 min/m², cada mano ≈ 5 min/m² más el tiempo de repintado de la ficha (`recoatHours`). Tres manos con 4 h entre manos → "cuenta un fin de semana". Se muestra como estimación, igual que los precios.
- **Herramienta**: un perfil `round*` o `bullnose` implica router con broca de balero; un `chamfer*` se puede hacer con cepillo o lija. Vale un aviso "necesitas router (o pídelo en la maderería)".

---

## 7. Otros detalles que suben la calidad

| Idea | Cómo | Costo | Prioridad |
|---|---|---|---|
| **Cubrecanto visible ya** | En `texturasDeCaras`, la cara de un canto en `pieza.cantos` usa veta a lo largo en lugar de capas | Cero | **Alta** (el dato ya existe) |
| **Jaladeras** | Nuevo dato en puertas y frentes (`pull: { model: 'bar' \| 'knob' \| 'recessed' \| 'leather', centersMm: 96 \| 128 \| 160, position }`). Barra: 3 cilindros de 12 segmentos (≈ 150 triángulos); botón: `LatheGeometry`; uñero: franja oscura en shader. Metal: `metalness 1`, `roughness 0.35`, negro mate o latón `#B08D57` | Bajo | Alta: es lo primero que se ve de un frente |
| **Patas** | `pata-niveladora` del catálogo (cilindro negro), cónica de madera (`LatheGeometry` con `PlywoodMaterial` de veta sin capas), metálica tipo horquilla (`TubeGeometry`). Son herrajes, no piezas: no entran al despiece | Bajo | Media |
| **Bisagras** | Solo en vista de armado: disco de 35 mm y placa. Ayuda a entender cómo se arma | Bajo | Baja |
| **AO barata para celular** | Hoy el celular no tiene AO. En el shader, oscurecer 25–40 mm junto a las aristas interiores de las caras que tocan otra pieza (el grafo de contacto dice cuáles), con la misma distancia a arista del bisel | Casi cero | Alta |
| **Contornos en shader** | Línea de lápiz con `fwidth` en los bordes de cada cara (≈ 1 px, grafito o ámbar); se omite o suaviza en aristas redondeadas. Sustituye a `Edges` en celular: −1 llamada por pieza | Bajo | Media |
| **Selección con `Outlines`** de drei [12] | Casco invertido para el contorno ámbar grueso de la pieza elegida | Bajo | Baja (lo de hoy funciona) |
| **Sombras de "renderizado"** | `AccumulativeShadows` + `RandomizedLight` [13] con `frameloop="demand"`: se acumulan mientras la cámara está quieta | Alto en GPU, pero solo al detenerse | Vista renderizado |
| **Vista «renderizado» vs «taller»** | Taller = hoy (aristas, cuadrícula, cotas, estándar). Renderizado = acabados completos, `clearcoat`, sin aristas ni cotas, AO de N8AO [14] a resolución completa, sombras acumuladas, piso de madera tenue. En celular se activa solo con la cámara quieta | Medio | Media |
| **Modo oscuro** | El material no cambia (es físico), cambia la luz: agregar un `Lightformer` de contraluz para que un mueble ébano o negro no se pierda en el fondo; aristas en `#CBBFAE` en lugar de grafito `#2B2825`, que hoy casi no se ve | Cero | Alta |
| **Entrada del acabado** | Barrido de brocha de abajo arriba (§4.5), en cascada por pieza | Bajo | Media |

---

## 8. Plan por entregas

| # | Entrega | Capa | Riesgos |
|---|---|---|---|
| E0 | **Cubrecanto visible** (veta en los cantos marcados) y aristas claras en modo oscuro | ui | Ninguno relevante |
| E1 | **`PlywoodMaterial`** con textura sólida: mismo aspecto que hoy, 1 material por pieza (≈ 13 → 3 llamadas). El boceto se queda con su textura | ui | `onBeforeCompile` depende de nombres de *chunks* de three: prueba de humo que compile el material (Vitest con `three` en Node no compila GLSL; basta verificar que los `replace` encontraron su cadena) y revisión en Safari iOS. Opacidad, emisivo y fantasma deben seguir igual. La transparencia con un solo material cambia el orden de dibujo: verificar la vista de armado con piezas atenuadas |
| E2 | **Perfiles de canto**: `EdgeSpec` (aditivo), `setEdgeProfile`, selector en la ficha, bisel falso en shader, reglas R9, cubrecanto por tipo y ancho, canto macizo en el despiece | domain + ui | Migración del formato guardado; que el LLM no confunda perfil con recubrimiento (describirlos bien en el esquema); explicar que la silueta no cambia |
| E3 | **Acabados**: `FinishPlan`, `acabados.json`, `setFinish`, zonas exterior/interior, render de tinta/pintura/aceite/lavado/laminado, litros y costo en la lista de compra, barrido animado | domain + ui | Expectativa de color: el hex no es la tinta real (pino absorbe disparejo): aviso "haz una prueba en un retazo". Rendimientos de ficha optimistas: merma editable |
| E4 | **Jaladeras y patas** como herrajes con posición | domain + ui | Más datos que el experto debe llenar: darles valores por omisión por rol |
| E5 | **Vista «renderizado»**: `MeshPhysicalMaterial` con `clearcoat`, sombras acumuladas, AO completa, contornos en shader y AO de contacto para celular | ui | Costo por píxel en celular: solo con la cámara quieta y detrás de `PerformanceMonitor` |
| E6 | (Opcional) **Geometría real por arista** para acercamiento y exportación | ui | La animación de `scale` pasa a ser razón; geometrías por tamaño (memoizar por tamaño + perfiles) |

Orden sugerido: E0 → E1 → E3 → E2 → E4 → E5. Los acabados cambian más la percepción del mueble que un r3; los perfiles son más finos y dependen de E1.

---

## Fuentes

1. drei — RoundedBox: https://drei.docs.pmnd.rs/shapes/rounded-box (código revisado en `node_modules/@react-three/drei/core/RoundedBox.js`: `ExtrudeGeometry` + `toCreasedNormals`).
2. three.js — ExtrudeGeometry: https://threejs.org/docs/pages/ExtrudeGeometry.html
3. pmndrs/drei #180, Multiple materials with RoundedBox: https://github.com/pmndrs/drei/issues/180
4. three.js — RoundedBoxGeometry (addons): https://threejs.org/docs/pages/RoundedBoxGeometry.html
5. three.js forum — Cheap round-edged box (vertex shader): https://discourse.threejs.org/t/cheap-round-edged-box-vertex-shader/8066
6. Íñigo Quílez — Distance functions (SDF de caja redondeada): https://iquilezles.org/articles/distfunctions/
7. Blender Manual — Bevel node (bisel en sombreado, sin geometría): https://docs.blender.org/manual/en/latest/render/shader_nodes/input/bevel.html
8. Codrops — Infinite Liquid Glass Grid with Three.js, WebGPU and TSL (bordes redondeados y bisel falsos por SDF en el material): https://tympanus.net/codrops/2026/09/08/building-an-infinite-liquid-glass-grid-with-three-js-webgpu-and-tsl/
9. three.js — BufferGeometryUtils (`toCreasedNormals`): https://threejs.org/docs/pages/module-BufferGeometryUtils.html
10. THREE-CustomShaderMaterial: https://github.com/FarazzShaikh/THREE-CustomShaderMaterial
11. three.js — MeshPhysicalMaterial: https://threejs.org/docs/pages/MeshPhysicalMaterial.html (y `Material.onBeforeCompile`: https://threejs.org/docs/pages/Material.html)
12. drei — Outlines: https://drei.docs.pmnd.rs/abstractions/outlines (y Edges: https://drei.docs.pmnd.rs/abstractions/edges)
13. drei — AccumulativeShadows: https://drei.docs.pmnd.rs/staging/accumulative-shadows
14. N8AO: https://github.com/N8python/n8ao
15. Sayer Lack ManchaSayer (rendimiento, colores): https://www.homedepot.com.mx/p/sayer-lack-tinta-al-aceite-sayer-para-madera-chocolate-1-l-ts-6129-492785
16. Sayer Lack, Caoba Inglés en Home Depot MX: https://www.homedepot.com.mx/p/sayer-lack-tinta-al-aceite-sayer-para-madera-caoba-ingles-1-l-ts-6117-225841
17. Minwax PolyShades en Home Depot MX: https://pro.homedepot.com.mx/pro/pinturas/acabados-para-superficies/tintas-acabados-para-superficies/tinte-satinado-para-madera-de-nuez-549057
18. Polyform Barniz 3000 Brillante, carta técnica: https://repositoriomdm.blob.core.windows.net/b2c/CartasTecnicas/Maderas/19A0260301.pdf
19. Comex — Polyform Barniz 11000: https://www.comex.com.mx/polyform-para-decks-y-muebles/polyform-barniz-11000
20. Comex — 4 productos base agua para acabados de madera: https://www.comex.com.mx/tutoriales-oficios/4-productos-base-agua-para-acabados-de-madera
21. Comex — Acqua 100 Total: https://www.comex.com.mx/esmaltes/acqua-100-total-1-litro
22. Home Depot MX — cubrecanto de madera pre‑engomado 16 mm: https://pro.homedepot.com.mx/pro/materiales-de-construccion/melamina/cubrecanto-de-madera-16-mm-838882 (también https://www.homedepot.com.mx/p/canplast-cubrecanto-pre-engomado-de-madera-1500-x-16-cm-pino-838882)
23. react-three-fiber — ejemplos de pmndrs: https://r3f.docs.pmnd.rs/getting-started/examples
