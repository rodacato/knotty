import { describe, expect, it } from 'vitest'
import { markAnswered, type Message } from '../session/state'
import { answerItem, suggestionItem, toggleInTray, trayRequest } from './tray'

describe('the tray', () => {
  it('keeps one item per origin: another answer replaces it, the same one takes it out', () => {
    let tray = toggleInTray([], answerItem('m1', 0, '¿Cuánto peso?', 'Poco'))
    tray = toggleInTray(tray, answerItem('m1', 0, '¿Cuánto peso?', 'Mucho'))
    expect(tray.map((i) => i.label)).toEqual(['Mucho'])
    expect(toggleInTray(tray, answerItem('m1', 0, '¿Cuánto peso?', 'Mucho'))).toEqual([])
  })

  it('goes as one numbered request with what was typed, and names every question it answers', () => {
    const tray = [answerItem('m1', 0, '¿Cuánto peso?', 'Mucho'), answerItem('m2', 1, '¿Puertas?', 'Sin puertas'), suggestionItem('Refuerza la base')]
    expect(trayRequest(tray, 'y que sea de 90 cm')).toEqual({
      text: 'Te mando todo junto:\n1. ¿Cuánto peso? Mucho\n2. ¿Puertas? Sin puertas\n3. Refuerza la base\n4. y que sea de 90 cm',
      answers: 'm1#p0;m2#p1',
    })
    expect(trayRequest([suggestionItem('Refuerza la base')])).toEqual({ text: 'Refuerza la base', answers: null })
  })

  it('marks the questions of several messages answered at once', () => {
    const message = (id: string): Message => ({ id, author: 'expert', text: '', date: '', questions: [{ text: '¿?', options: ['a', 'b'] }], answered: false, version: null, proposal: null, error: false, requestedPhotos: [], thumbnail: null, answers: [], suggestions: [] })
    const chat = markAnswered([message('m1'), message('m2')], 'm1#p0;m2#p0')
    expect(chat.map((m) => m.answered)).toEqual([true, true])
  })
})
