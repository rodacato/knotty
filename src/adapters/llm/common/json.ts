import { invalidJSON } from './expert'

// How a model's text becomes JSON when no strict format holds it: shared by every provider that can fall back to the schema in the prompt.

/** The top-level JSON objects in the text, respecting braces inside strings. */
function topLevelObjects(text: string): string[] {
  const objects: string[] = []
  let depthValue = 0
  let start = -1
  let chained = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (chained) {
      if (c === '\\') i++
      else if (c === '"') chained = false
    } else if (c === '"') chained = depthValue > 0
    else if (c === '{' && depthValue++ === 0) start = i
    else if (c === '}' && depthValue > 0 && --depthValue === 0) objects.push(text.slice(start, i + 1))
  }
  return objects
}

const ESCAPES: Record<string, string> = { '\n': '\\n', '\t': '\\t', '\r': '\\r' }

/** Escapes raw newlines and tabs inside strings: JSON forbids them, but some models write them. */
function escapeControls(json: string) {
  let output = ''
  let chained = false
  for (let i = 0; i < json.length; i++) {
    const c = json[i]
    if (chained && c === '\\') {
      output += c + (json[++i] ?? '')
      continue
    }
    if (c === '"') chained = !chained
    output += chained && ESCAPES[c] ? ESCAPES[c] : c
  }
  return output
}

/** An object with a single key whose value is the JSON written as text: the model wrapped it once too often. */
function unwrap(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const values = Object.values(value)
  if (values.length !== 1 || typeof values[0] !== 'string') return value
  try {
    const inner = JSON.parse(values[0])
    return inner && typeof inner === 'object' ? inner : value
  } catch {
    return value
  }
}

/** Skips code fences, other text and a stray closing brace, keeping the last readable attempt; unreadable text goes back to be corrected. */
export function extractJSON(text: string) {
  const candidates = topLevelObjects(text)
  if (!text.includes('{')) throw invalidJSON(text, 'The answer has no JSON object')
  for (const candidate of candidates.reverse()) {
    for (const version of [candidate, escapeControls(candidate)]) {
      try {
        return unwrap(JSON.parse(version))
      } catch {
        // A broken attempt: try it fixed, then the previous one.
      }
    }
  }
  throw invalidJSON(text)
}
