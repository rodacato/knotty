import { describe, expect, it } from 'vitest'
import { missingEvidence } from './evidence.mjs'

const prompt = 'src/adapters/llm/prompts/reconstruction.v16.md'

describe('a pull request that changes a prompt', () => {
  it('passes when it cites the compare run that measured it', () => {
    expect(missingEvidence([prompt], 'Base 20261116-135035132-ad202431, candidate 20261116-135446691-5512141b.')).toBeNull()
  })

  it('passes when it says why no run was needed', () => {
    expect(missingEvidence([prompt], 'Typo only.\n\nNo compare run: the text the model reads did not change.')).toBeNull()
  })

  it('fails when it says neither, and names the prompts', () => {
    expect(missingEvidence([prompt, 'src/ui/App.tsx'], 'Better prompt.')).toMatch(/changes src\/adapters\/llm\/prompts\/reconstruction\.v16\.md\. Cite/)
    expect(missingEvidence([prompt], null)).not.toBeNull()
    expect(missingEvidence([prompt], 'No compare run:')).not.toBeNull()
  })

  it('asks nothing of one that changes no prompt', () => {
    expect(missingEvidence(['src/adapters/llm/anthropic.ts', 'docs/compare.md'], '')).toBeNull()
  })
})
