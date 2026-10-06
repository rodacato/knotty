import { describe, expect, it } from 'vitest'
import { designBlocker, EMPTY_SPACE, parseCm, spaceError, spaceFromMm, spaceIsValid, spaceToMm } from './form'

const ready = {
  description: 'Librero de 5 repisas',
  photos: 0,
  reading: false,
  space: EMPTY_SPACE,
}

describe('parseCm', () => {
  it('reads plain and comma decimals', () => {
    expect(parseCm('90')).toBe(90)
    expect(parseCm(' 92,5 ')).toBe(92.5)
  })
  it('gives null for empty or text', () => {
    expect(parseCm('')).toBeNull()
    expect(parseCm('mucho')).toBeNull()
  })
})

describe('space', () => {
  it('converts cm to whole mm, only the sides filled', () => {
    expect(spaceToMm({ width: '90', depth: '', height: '92,5' })).toEqual({
      width: 900,
      height: 925,
    })
    expect(spaceToMm(EMPTY_SPACE)).toBeNull()
  })
  it('round-trips through the draft', () => {
    expect(spaceFromMm(spaceToMm({ width: '92.5', depth: '40', height: '' }))).toEqual({ width: '92.5', depth: '40', height: '' })
    expect(spaceFromMm(null)).toEqual(EMPTY_SPACE)
  })
  it('accepts empty sides and values inside the range', () => {
    expect(spaceError('width', '')).toBeNull()
    expect(spaceError('width', '20')).toBeNull()
    expect(spaceError('height', '240')).toBeNull()
  })
  it('rejects text and values out of range, in cm', () => {
    expect(spaceError('width', '19')).toBe('Entre 20 y 240 cm')
    expect(spaceError('depth', '241')).toBe('Entre 15 y 240 cm')
    expect(spaceError('height', 'abc')).toBe('Entre 10 y 240 cm')
    expect(spaceError('width', '-5')).not.toBeNull()
    expect(spaceIsValid({ width: '90', depth: '4000', height: '' })).toBe(false)
  })
})

describe('designBlocker', () => {
  it('asks for a description or a photo when there is neither', () => {
    expect(designBlocker({ ...ready, description: '' })).toBe('Describe tu mueble o agrega una foto')
    expect(designBlocker({ ...ready, description: '  corto  ' })).toBe('Describe tu mueble o agrega una foto')
  })
  it('opens with 15 characters of description', () => {
    expect(designBlocker({ ...ready, description: 'a'.repeat(14) })).not.toBeNull()
    expect(designBlocker({ ...ready, description: 'a'.repeat(15) })).toBeNull()
  })
  it('opens with a photo and no description', () => {
    expect(designBlocker({ ...ready, description: '', photos: 1 })).toBeNull()
  })
  it('blocks on a bad space or photos still being prepared', () => {
    expect(designBlocker({ ...ready, space: { ...EMPTY_SPACE, width: '5' } })).toBe('Revisa el espacio disponible')
    expect(designBlocker({ ...ready, photos: 1, reading: true })).toBe('Preparando tus fotos…')
  })
})
