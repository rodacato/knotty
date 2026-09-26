# Cómo contribuir a Knotty

Esta guía dice cómo correr la app, dónde va cada cosa y, sobre todo, cómo comprobar que un cambio funciona antes de abrir un PR. Las decisiones y el estado del proyecto viven en [docs/PROPUESTA.md](docs/PROPUESTA.md).

## Para empezar

Hace falta Node 24.

```bash
npm install
npm run dev        # http://localhost:5173
```

Sin llave de API la app usa el experto **Simulado**, que entiende unos cuantos pedidos y arma tres ejemplos (librero, buró, alacena). Para un experto real, abre el engrane y elige Claude, OpenAI o SheLLM; la llave se queda en el navegador.

Para `npm run compare` (el banco contra expertos reales), copia `.env.example` a `.env` y llena lo que vayas a usar. `.env` no se sube a git.

## Cómo está organizado

Arquitectura hexagonal; el mapa completo está en la sección 2 de la propuesta.

- `src/domain/`: el mueble, sus reglas y todo lo que decide. TypeScript puro y determinista: sin React, sin navegador, sin LLM. Seis grupos por intención: `materials/` (catálogo, despiece, compra), `design/` (el mueble, su geometría y `validation/`), `checks/` (reglas estructurales, tipologías, revisión antes de comprar, `analysis.ts`), `furniture/` (las fichas en `modules/`, ejemplos en `fixtures/`, lectura de fotos), `editing/` (operaciones, reparaciones, soluciones, cambios, pedidos) y `session/` (lo guardado, historial, bitácora de intentos y bandeja).
- `src/application/`: casos de uso (diseñar, ajustar, revisar antes de comprar), el contexto que se le manda al experto y el banco de pruebas.
- `src/ports/` y `src/adapters/`: la frontera con el mundo (proveedores de LLM, localStorage, catálogo, fotos). Los prompts están en `src/adapters/llm/prompts/`.
- `src/ui/`: React y la escena 3D.
- `public/catalog/catalog.json`: triplay, herrajes y parámetros de corte; se edita sin tocar código.

`src/architecture.test.ts` falla si una capa importa lo que no debe, o si un grupo del dominio importa uno que no tiene permitido (la lista está en la prueba).

## Idiomas

- **En inglés:** el código (nombres, archivos, carpetas, comentarios), los datos que se guardan, los ids y los prompts.
- **En español de México:** todo lo que lee la persona: la interfaz, los mensajes, los nombres de piezas y muebles, y lo que escribe el experto (los prompts se lo piden así). Palabras de taller: «triplay», «entrepaño», «zoclo», «jaladera».
- **Medidas en milímetros**; a la persona se le muestran también en centímetros cuando ayuda.
- Commits, PRs y documentación, en español.

## Cómo verificar un cambio

### 1. Siempre

Lo mismo que corre el CI en cada PR; si pasa en tu máquina, pasa ahí:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

### 2. En el navegador, sin costo

Con `npm run dev` y el experto Simulado:

1. **Diseñar:** «Nuevo diseño», escribe «Un librero con repisas para libros» y diséñalo. Sale el mueble en 3D con veta de pino.
2. **Ajustar:** en el chat, «Hazlo de 90 cm de ancho». Sale una propuesta con un aviso crítico: «Ver propuesta» / «Ver el actual» alterna el 3D, y en los avisos (la campana) cada solución tiene «Ver» y «Aplicar».
3. **Pestañas:** en Mueble aparecen las piezas con medidas; en Materiales, «Revisar y ver materiales» da el dictamen y la lista de compra.
4. **Recargar:** el diseño sigue ahí.

Si tocaste la interfaz, pruébala también en celular (el modo responsivo del navegador basta) y en modo oscuro.

### 3. El banco sin experto (gratis, segundos)

Abre la app con `?debug` al final de la dirección (o el código Konami, o `Ctrl+Shift+D`) y entra a **Banco**; en «Sin experto: los módulos de Knotty», **Revisar**. Arma todas las variantes de cada módulo (cama, mesa, zapatera, gabinete; unas 180) y las revisa con las reglas: una variante inválida o con avisos es un error de Knotty.

### 4. El banco con experto real (cuesta tokens)

```bash
npm run compare                                  # todos los casos
KNOTTY_CASES=bookcase,plant-stand npm run compare
KNOTTY_REPEAT=3 KNOTTY_LABEL="mi cambio" npm run compare
```

`KNOTTY_MODELS` elige el experto (`shellm:claude`, `anthropic:claude-sonnet-5`, `openai:gpt-5`); si le falta la llave o la dirección, se detiene antes de correr nada. Cada caso es una prueba: sale ✓ o ×, con lo que no cuadró, en cuanto termina (`KNOTTY_PARALLEL` casos a la vez, 2 por omisión). Al arrancar avisa si tu checkout no es `origin/main` (commits de más o de menos, cambios sin commit): mide el código que tienes, no el de `main`.

El reporte (`.md` y `.json`) queda en `scripts/compare/results/`, fuera de git, y se reescribe al terminar cada caso: si cortas la corrida, lo hecho se queda. Trae tiempo, intentos, camino (ficha o pieza por pieza), medidas razonables, estructura, críticos, veredicto, tokens y una sección **Contra la base**: cada caso contra el mismo caso en `scripts/compare/baseline.json`, la única corrida que vive en git. La corrida varía, así que repite un caso antes de concluir.

```bash
KNOTTY_SAVE_BASELINE=1 KNOTTY_REPEAT=2 KNOTTY_LABEL="prompts@N" npm run compare   # fija esta corrida como base
KNOTTY_BASELINE=scripts/compare/results/<corrida>.json npm run compare            # contra otra corrida
KNOTTY_BASELINE=none npm run compare                                               # sin base
```

### Qué correr según lo que tocaste

| Si tocaste… | Además de lo de siempre |
|---|---|
| La interfaz o la escena 3D | Recorrido en el navegador (2) |
| Reglas, módulos (fichas), uniones, geometría o reparaciones | Banco sin experto (3) y recorrido (2) |
| Prompts, esquemas que ve el experto o el contexto que se le manda | Banco con experto (4), comparado con el anterior |
| Algo que se guarda (sesión, preferencias, llaves, ajustes del catálogo) | Ver «Cambios que tocan lo guardado» |
| El catálogo | Banco sin experto (3) y la pestaña Materiales (2) |

## Cambios que piden cuidado

### Lo que se guarda en el navegador

Los diseños de la persona viven en `localStorage` y tienen que seguir abriendo después de tu cambio.

- La sesión tiene formato (`format` en `src/domain/session/state.ts`). Si cambias un campo o un valor guardado, sube el formato y agrega su migración en `src/domain/session/migrate.ts`, con prueba. Hay una sesión real de la primera versión en `state-v1.fixture.json` que se migra en las pruebas.
- Preferencias y ajustes del catálogo leen su forma anterior en su adaptador (`configuration.ts`, `catalog/json.ts`).
- Antes de subir, abre la app con un diseño guardado por la versión anterior y comprueba que abre igual.

### Llaves de API

Nunca se guardan en claro en `localStorage`: viven en memoria, en la pestaña o cifradas con frase. Las pruebas de `configuration.test.ts` comprueban que la llave no aparezca en lo guardado; si tocas preferencias, deben seguir pasando. No pegues llaves en issues, PRs ni en la bitácora exportada (se exporta sin ellas).

### Prompts

- Cada prompt lleva `id: nombre@versión` en su encabezado, y el archivo se llama igual (`system.v9.md`). Si cambias el contenido, sube la versión en los dos: cada diseño guarda qué prompt lo produjo.
- Los números del oficio (medidas mínimas, hoja útil, colchones, tornillos) no se escriben a mano en un prompt: van como `{{nombre}}` y salen del código en `src/adapters/llm/common/promptValues.ts`. Una prueba falla si uno aparece escrito a mano.
- Corre el banco con experto antes y después (4).
- La base (`scripts/compare/baseline.json`) se actualiza a propósito, en el PR que cambia lo que ve el experto y con una corrida completa, y el paso de la propuesta dice sus cifras. Los reportes viejos de `scripts/compare/results/` que ya están en git son historial: no se reescriben, ni con un reemplazo global; los nuevos no se suben.

### Textos para la persona

En español de México, claros y breves, como en un taller. Los identificadores que aparezcan en un mensaje (una medida, un ángulo de foto) llevan su etiqueta en español: `DIMENSION_LABEL`, `angleLabel`.

## Cuando algo falla

- **Bitácora de depuración** («Entrañas de la madera»): con `?debug`, el código Konami o `Ctrl+Shift+D`. Registra cada llamada al experto, cada error y cada acción; «Exportar» baja un JSON con el commit, el experto (sin llaves), el diseño y los eventos. Adjúntalo a un issue.
- **«Ver qué pasó»** en un diseño que falló muestra cada intento del experto, sus errores y lo que Knotty reparó.
- **Banco:** «Abrir en el estudio» lleva el resultado de un caso al estudio para revisarlo.

## Commits y PRs

- Commits chicos y frecuentes, con mensaje en español que diga qué cambia.
- Agrega los archivos por nombre; nunca `.env`.
- El PR dice qué cambia, por qué y **cómo lo verificaste** (qué niveles de arriba corriste y con qué resultado).
- El CI corre `lint` (oxlint), `typecheck`, `test` y `build`; un PR con el CI en rojo no se mergea. Al mergear a `main`, la app se publica sola en GitHub Pages.
- El workflow **Security** corre en cada PR, en `main` y cada lunes: CodeQL (análisis de código; los hallazgos quedan en la pestaña Security), dependency review (falla si el PR agrega una dependencia con una vulnerabilidad alta o crítica) y gitleaks (secretos en los commits). Dependabot propone cada semana las actualizaciones de npm y de las actions, y abre un PR solo cuando hay una vulnerabilidad.
