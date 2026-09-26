// Every way out a rule can offer, and who can carry it out: Knotty builds it by itself ('build', see fixes.ts) or only the expert can ('expert').
// A key a rule offers must be declared here; a 'build' key must have its builder in fixes.ts, or neither compiles.

export const ALTERNATIVES = {
  // Knotty builds these.
  'thicker-board': 'build',
  'center-divider': 'build',
  'center-support': 'build',
  'anchor-to-wall': 'build',
  'hanging-rail': 'build',
  'rigid-apron': 'build',
  'slide-support': 'build',
  'matching-hinge': 'build',
  'matching-slide': 'build',
  // Only the expert can.
  deeper: 'expert',
  'more-hinges': 'expert',
  'two-doors': 'expert',
  kick: 'expert',
  'grain-lengthwise': 'expert',
  'back-6mm': 'expert',
  'back-in-rabbet': 'expert',
  'change-joint': 'expert',
  'shallower-groove': 'expert',
  'shorter-screw': 'expert',
  'longer-screw': 'expert',
  'short-pocket-screw': 'expert',
  'one-screw': 'expert',
  dowel: 'expert',
  'fit-box': 'expert',
  'bottom-6mm': 'expert',
  'front-clearance': 'expert',
  'raise-drawer': 'expert',
  'mattress-size': 'expert',
  legroom: 'expert',
} as const satisfies Record<string, 'build' | 'expert'>

export type AlternativeKey = keyof typeof ALTERNATIVES
/** The keys Knotty builds by itself. */
export type BuildKey = { [K in AlternativeKey]: (typeof ALTERNATIVES)[K] extends 'build' ? K : never }[AlternativeKey]

export const isAlternativeKey = (key: string): key is AlternativeKey => Object.hasOwn(ALTERNATIVES, key)
export const isBuildKey = (key: string): key is BuildKey => isAlternativeKey(key) && ALTERNATIVES[key] === 'build'
