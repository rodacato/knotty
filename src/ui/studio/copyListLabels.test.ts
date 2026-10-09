import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { beforeLeaving, copyLabel, lineNumbers } from './copyListLabels'

describe('copying the list for the lumberyard', () => {
  it('names the action until the list is on the clipboard, and goes back to it when the copy fails', () => {
    expect(copyLabel('idle')).toBe('Copiar lista para la maderería')
    expect(copyLabel('copied')).toBe('Lista copiada')
    expect(copyLabel('failed')).toBe('Copiar lista para la maderería')
  })

  it('asks to measure the drawer boards only of a furniture that has a drawer', () => {
    expect(beforeLeaving(true)).toEqual(['Empalma las piezas gemelas: deben quedar parejas.', 'Mide la más larga y las del cajón; si alguna se va más de 1 mm, dilo antes de pagar.', 'Revisa que cada pieza traiga su número.'])
    expect(beforeLeaving(false)[1]).toBe('Mide la más larga; si alguna se va más de 1 mm, dilo antes de pagar.')
    expect(beforeLeaving(false).join(' ')).not.toMatch(/cajón/)
  })

  it('gives every piece the number of its line, the one the message says', () => {
    const geo = analyze(exampleBookcase, testCatalog).geo!
    const blocks = counterLines(exampleBookcase, geo, estimatePurchase(exampleBookcase, geo, testCatalog))
    const numbers = lineNumbers(blocks)
    expect([...numbers.keys()].sort()).toEqual(exampleBookcase.pieces.map((p) => p.id).sort())
    expect(numbers.get('side-left')).toBe(numbers.get('side-right'))
    expect(numbers.get('back')).toBe(blocks.at(-1)!.lines.at(-1)!.number)
    expect(numbers.get('back')).not.toBe(numbers.get('side-left'))
  })
})
