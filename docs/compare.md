# Guía del compare

Cómo medir si un cambio mejoró o empeoró lo que el experto hace. El detalle de cada comando y de los archivos que deja una corrida está en [CONTRIBUTING.md](../CONTRIBUTING.md) (§4 y §5); esta guía explica para qué sirve cada modo, cómo leer el resultado, cuánto cuesta y qué errores evitar.

## Qué es, en una frase

Un conjunto de trabajos (un caso por intento) que se corre contra un experto real, se califica con reglas deterministas, se guarda con su identidad y se compara contra otra corrida. **No hay juez LLM**: lo que el calificador no puede decidir lo dice (`unknown`) y lo manda a una persona.

## Qué mide y qué no

| Mide | No mide |
|---|---|
| Que el diseño sea válido, razonable y viable | Que un consejo sea correcto, honesto o seguro (eso es la suite difícil, y aun así lo revisa una persona) |
| Que la estructura salga como se pidió (puertas, cajones, repisas) | La calidad de la redacción o el tono |
| Que cada paso de un escenario deje el estado esperado | Que el montaje real aguante: una geometría válida no prueba resistencia ni fabricabilidad |
| Tokens y tiempo por trabajo | Qué experto es «mejor» en general: cada corrida mide un experto, un commit y unos prompts |

La corrida en vivo **no es determinista**. El adaptador de Claude de SheLLM ignora la temperatura, así que el mismo caso da resultados distintos. Lo determinista son las entradas, la calificación y el replay.

## Los modos

| Quiero… | Comando | ¿Cuesta tokens? |
|---|---|---|
| Ver que los módulos de Knotty no tengan variantes inválidas | Banco en la app (`?debug` → Banco → Revisar) | No |
| Probar el cableado del compare, sin experto | `KNOTTY_MODELS=simulated:x npm run compare` | No |
| Medir un cambio contra el experto real | `npm run compare` | Sí |
| Repetir una corrida guardada y ver si el calificador reproduce los veredictos | `npm run compare:replay -- --last` | No |
| Ver qué cambia con un calificador nuevo, sin volver a llamar al experto | `npm run compare:replay -- <corrida> --regrade` | No |
| Terminar una corrida cortada o reintentar lo que falló por el proveedor | `npm run compare:resume -- --last [--retry-infra]` | Solo lo pendiente |
| Preguntas difíciles de carpintería, con revisión humana | `npm run compare:hard` | Sí |
| Saber cuántos trabajos aguanta tu servidor a la vez | `npm run compare:concurrency -- 2,4` | Sí, doble |
| Fijar una corrida como base de comparación | `npm run compare:promote -- --last [--accept]` | No |

`--list` en `compare:hard` imprime ids, riesgo y conteos sin conexión y sin una palabra de las preguntas.

### El banco (`npm run compare`)

16 casos fijos en `src/application/bench/cases.ts` (el librero y tres variantes —libros pesados, solo taladro y caladora, ensancharlo—, cama, cama con cajones, buró, gabinete de pared, escritorio, zapatera, mueble de TV, trinchador, mesa de centro y maceta; la lista vive en el archivo). Cada caso es un escenario: un pedido y, a veces, ajustes en turnos siguientes, calificado paso a paso sobre el estado real que dejó. `KNOTTY_REPEAT` fija los intentos por caso; el trabajo es caso × intento.

### La suite difícil (`npm run compare:hard`)

16 preguntas con una sesión nueva cada una; las 11 críticas llevan un segundo turno donde la persona presiona para que se apruebe. Sus datos son privados y se leen de `private/hard-suite/` (o de `KNOTTY_HARD_DIR`). Un fallo bloqueante (consejo peligroso, capacidad o fuente inventada, un cambio no representable presentado como aplicado, un crítico ignorado) **bloquea** la corrida: ningún promedio lo compensa. Lo crítico, lo de soporte parcial y lo que no se pudo decidir va a `review-queue.md`, y mientras algo esté en la cola la corrida sale con `2`.

## Cómo leer un resultado

Cada trabajo se clasifica en una de cuatro cosas:

| Clase | Significa |
|---|---|
| `pass` | Todo salió como se pidió |
| `known-failure` | Falla que se declaró a propósito en `knownFailures.ts`, con causa y evidencia. Sigue apareciendo como «sigue fallando» |
| `infrastructure` | El proveedor falló (tiempo límite, 429, red). Queda fuera de las tasas |
| `regression` | Cualquier otro fallo |

### Contra la base

Con una base compatible, la comparación es por caso y por requisito. Dos corridas se comparan solo si coinciden en calificador, catálogo, corpus y experto; que los **prompts** cambien no lo impide, porque es justo lo que se mide, y el reporte lo lista en «lo que varía».

Para no confundir ruido con efecto, el reporte hace dos cosas:

1. **Casos de control.** Un caso cuyos prompts son idénticos en las dos corridas no pudo ser afectado por el cambio. Cuántos de ellos cambiaron es el ruido real de esa comparación; una diferencia en un caso afectado que no lo supere es variación.
2. **Regla estadística.** Una regresión solo se declara si la prueba exacta de Fisher da p < 0.05. Con 3 intentos por lado, 0/3 contra 3/3 da p = 0.1 y **no** alcanza; hacen falta al menos 4 por lado. Los casos que cambiaron de tasa sin llegar ahí salen como «sin poder distinguirlos de la variación».

Consecuencia práctica: con pocas repeticiones el compare casi nunca dice «regresión» por sí solo. No quiere decir que no haya diferencia, sino que la muestra no alcanza. Para un caso dudoso, repítelo (`KNOTTY_CASES=<caso> KNOTTY_REPEAT=6`) en vez de repetir todo.

Promover una base es más estricto que comparar: cualquier fallo de más la rechaza.

### Códigos de salida

`0` pasa, o solo hay fallas conocidas · `1` regresión, o un fallo bloqueante en la suite difícil · `2` corrida incompleta, errores de infraestructura o elementos en la cola de revisión · `3` argumentos inválidos.

## Cuánto cuesta

Lo único que se cobra son los tokens del experto, y las llamadas **no** se hacen contra el simulado ni en el replay. Cifras medidas con `shellm:claude` el 2026-10-02 y 03:

| Corrida | Trabajos | A la vez | Tiempo total | Por trabajo |
|---|---|---|---|---|
| Banco, 13 casos × 3 | 39 | 2 | 11 min | 29–32 s, ~11–12.5 mil tokens de entrada, ~3 mil de salida (medias de otra corrida de 26 trabajos) |
| Banco, 13 casos × 3 | 39 | 4 | 7 min | igual |
| Banco, 16 casos × 3 | 48 | 4 | 12.5 min | 57 s, 18.3 mil de entrada, 5.3 mil de salida |
| Seis repeticiones de 4 casos de librero | 24 | 4 | 18 min | los casos largos dominan |
| Suite difícil, 16 preguntas (11 críticas × 3, 5 × 1) | 34 | 4 | 6–7 min | 39–42 s por trabajo, 65 llamadas de ~20–22 s. La suite **no registra tokens**: solo tiempos |

Para estimar el gasto de una corrida con un proveedor que cobra por token: **trabajos × tokens por trabajo**. Una corrida del banco de 48 trabajos son unos 880 mil tokens de entrada y 250 mil de salida. Multiplícalos por el precio vigente de tu proveedor, que cambia y no se copia aquí. Con SheLLM no se paga por token sino que se gasta la cuota de tu plan.

Reglas para gastar menos:

- `KNOTTY_CASES` corre solo lo que tocaste. El banco completo no es la comparación por omisión.
- El replay y el `--regrade` son gratis: cambiar el calificador no obliga a volver a llamar al experto.
- Una comparación antes/después duplica el costo. Si la base ya existe y es compatible, no la corras otra vez.
- No subas las repeticiones a ciegas. Aumentan costo y tiempo sin separar el efecto del ruido si la regla de arriba no los distingue.

## Cómo medir un cambio de prompts, paso a paso

1. Fija la **base**: un commit de `main` (o una corrida guardada y compatible). Córrela desde un worktree si estás en tu rama.
2. Corre el **candidato** con la misma configuración (experto, casos, repeticiones).
3. Mantén el árbol **limpio** mientras corre. Un árbol sucio sin hash no se puede reproducir ni promover.
4. Lee primero «Contra la base»: qué varía, cuántos casos de control cambiaron, qué regresiones pasan la regla estadística y cuáles quedaron como dudosas.
5. Si hay dudosas, repite solo esas.
6. Mira la `review-queue.md` si corriste la suite difícil: el banco no juzga si un consejo es correcto.
7. Si el cambio queda, `compare:promote` (simulacro) y luego `--accept`; esa base se sube en el mismo PR.

## Trampas conocidas

- **La carga de la máquina cuenta.** Una corrida con la máquina saturada (carga de 42 en 12 núcleos) hizo fallar pruebas por tiempo límite. Mide con la máquina en calma.
- **El banco no lee el consejo.** Una guía puede mejorar el consejo y dejar todos los números del banco iguales. Medirla pide la suite difícil.
- **Los casos de otra versión no se comparan.** Si cambias un caso, queda «incompatible» hasta tener una base nueva.
- **Un caso intermitente no es una regresión.** Reténtalo con más repeticiones antes de declarar nada.
- **Las llaves nunca van en la corrida.** El manifiesto rechaza lo que parezca una credencial, y no se leen ni se copian.
- **Los datos privados no se suben.** La carpeta de la suite difícil y sus respuestas están fuera de git; `review-queue.md`, las respuestas y las grabaciones son lo único que lleva texto.
