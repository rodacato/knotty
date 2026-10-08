# Autonomía

Cuánto de lo que una persona pide en el chat entiende Knotty sola, sin experto. `npm run autonomy` pasa un corpus de pedidos por el intérprete (`parseIntent`, en `src/domain/furniture/intent/`) y dice cuáles leyó. Sin `--ask` no llama a nadie y no cuesta tokens.

## Qué dice de cada pedido

| Resultado | Qué pasó | Qué es |
|---|---|---|
| `read` | Leyó el campo y el valor que el pedido quería | Lo que Knotty ya hace sola |
| `unread` | No leyó nada, y lo habría podido resolver | El pendiente: hoy ese pedido se va al experto |
| `misread` | Leyó otra cosa | Un error: aplicaría un cambio que nadie pidió. El comando sale con `1` y `npm test` falla |
| `left` | Era del experto y se lo dejó | Lo correcto para un pedido vago, abierto o que el plan no puede decir |

Un pedido con dos cambios cuenta en la fila `several`: leer solo uno es `misread`, porque el otro se pierde.

## El corpus

Vive en `scripts/autonomy/corpus/`, un archivo por módulo. Cada pedido se dice sobre una variante del banco del módulo (`on`) y lleva lo que significa: `set(campo, valor)`, `both(...)` para dos cambios, `asks(tema)` para una pregunta que los números del diseño contestan, o `'expert'`.

Se escribe desde lo que la persona quiso decir, no desde lo que el intérprete lee hoy. Un pedido que todavía no entiende va en el corpus igual: quitarlo para que el número suba es engañarse. Tampoco se cambia una frase para que pase.

## Cómo se usa

1. Corre `npm run autonomy` (o `npm run autonomy -- table`) y mira la lista `unread`.
2. Elige un grupo de pedidos que se parezcan y enséñale al intérprete a leerlos, con su caso en `intent.test.ts`.
3. Vuelve a correrlo: el número sube y `misread` sigue en cero.

Si una regla nueva lee de más, el corpus lo dice: un pedido `'expert'` que deja de quedar `left` es `misread`. Por eso los pedidos del experto importan tanto como los otros.

## Preguntarle al experto por lo que falta

`KNOTTY_MODELS=<proveedor:modelo> npm run autonomy -- --ask [módulo]` manda cada pedido `unread` al experto y dice si el plan que dejó es el que el pedido significa (`as meant`), otro (`otherwise`, con las diferencias) o ninguno (`no change`). Sin `KNOTTY_MODELS` en la línea toma el del `.env`, como el compare. Es una llamada por pedido y cuesta tokens: solo a mano.

Los `as meant` son los candidatos a regla: el experto los resolvió con un cambio que el formulario ya sabe hacer. No pregunta por preguntas, por pedidos del experto ni por cambios que el formulario no pone por su llave.

## Qué no mide

- Al experto en general: `--ask` solo mira si resolvió un pedido como se quería. Calificarlo es [el compare](compare.md).
- Que el cambio leído deje un mueble válido: eso lo juzgan el constructor y las comprobaciones cuando el pedido se aplica.
- Cómo habla la gente de verdad. El corpus es chico y está escrito a mano; el número dice qué tanto cubre estas frases, no una proporción del uso real.
