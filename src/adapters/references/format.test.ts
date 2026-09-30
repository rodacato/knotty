import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatFicha } from './format'

const DIR = import.meta.dirname
const FILES = readdirSync(DIR).filter((n) => n.endsWith('.json'))

describe('formatFicha', () => {
  it.each(FILES)('%s is written the way probe writes it', (name) => {
    const text = readFileSync(`${DIR}/${name}`, 'utf8')
    expect(formatFicha(JSON.parse(text))).toBe(text)
  })

  it('orders the keys, keeps a cell on one line and writes an empty list as []', () => {
    const text = formatFicha({ expect: { findings: [], sheets: { T18: 3 } }, code: 'GN-XXX-01', plan: { columns: [{ width: 1, cells: [{ height: 1, content: 'open' }] }] }, format: 1 })
    expect(text).toBe(
      [
        '{',
        '  "format": 1,',
        '  "code": "GN-XXX-01",',
        '  "plan": {',
        '    "columns": [',
        '      {',
        '        "width": 1,',
        '        "cells": [',
        '          { "height": 1, "content": "open" }',
        '        ]',
        '      }',
        '    ]',
        '  },',
        '  "expect": {',
        '    "findings": [],',
        '    "sheets": { "T18": 3 }',
        '  }',
        '}',
        '',
      ].join('\n'),
    )
  })
})
