import { expect, it } from 'vitest'
import { wordsIn } from './words'

const names = (texts: string[]) => wordsIn(texts).map((t) => t.name)

it('explains the trade words a page uses, in any case and number, and no other', () => {
  expect(names(['Faldón del frente, Faldón de atrás', 'cubrecanto: un largo'])).toEqual(['Faldón', 'Cubrecanto'])
  expect(names(['Pon los faldones.', 'Arma la caja (costados, contrafrente y trasera).'])).toEqual(['Faldón', 'Contrafrente'])
  expect(names(['Lateral izquierdo', 'Repisa 1'])).toEqual([])
})

it('does not find a word inside another: «canto» is not in «cubrecanto»', () => {
  expect(names(['cubrecanto: un largo'])).not.toContain('Canto')
  expect(names(['el canto del tablero'])).toEqual(['Canto'])
})
