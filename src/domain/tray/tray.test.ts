import { describe, expect, it } from 'vitest'
import { marcarRespondida, type Mensaje } from '../sesion/estado'
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
    const message = (id: string): Mensaje => ({ id, autor: 'experto', texto: '', fecha: '', preguntas: [{ texto: '¿?', opciones: ['a', 'b'] }], respondida: false, version: null, propuesta: null, error: false, fotosPedidas: [], miniatura: null, respuestas: [], sugerencias: [] })
    const chat = marcarRespondida([message('m1'), message('m2')], 'm1#p0;m2#p0')
    expect(chat.map((m) => m.respondida)).toEqual([true, true])
  })
})
