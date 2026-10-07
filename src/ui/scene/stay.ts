import type { HardwarePart } from '../../domain/design/hardware'

// A lid's friction stay as the lid turns: two arms of the same length, one from the wall and one from the lid, that meet at an elbow. All in mm, as [y, z].

export type Stay = Extract<HardwarePart, { kind: 'stay' }>
type Point = [number, number]

/** An arm between two points: its middle, and its tilt about x from the vertical. */
export interface Arm {
  middle: Point
  tilt: number
}

const arm = (from: Point, to: Point): Arm => ({ middle: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], tilt: Math.atan2(to[1] - from[1], to[0] - from[0]) })

/** Where the elbow is with the lid turned by `angle` about its pivot, as the scene turns it: about x, so +z goes toward −y. It folds to the side of the wall's end, away from the hinge. */
export function stayElbow(stay: Stay, angle: number): { onLid: Point; elbow: Point } {
  const [py, pz] = stay.pivot
  const [dy, dz] = [stay.onLid[0] - py, stay.onLid[1] - pz]
  const [c, s] = [Math.cos(angle), Math.sin(angle)]
  const onLid: Point = [py + dy * c - dz * s, pz + dy * s + dz * c]
  const [wy, wz] = stay.onWall
  const apart = Math.hypot(onLid[0] - wy, onLid[1] - wz)
  const rise = Math.sqrt(Math.max(0, stay.arm ** 2 - (apart / 2) ** 2))
  const across: Point = apart ? [-(onLid[1] - wz) / apart, (onLid[0] - wy) / apart] : [0, 1]
  const side = Math.sign(across[1]) === Math.sign(wz - pz) ? 1 : -1
  return { onLid, elbow: [(onLid[0] + wy) / 2 + side * rise * across[0], (onLid[1] + wz) / 2 + side * rise * across[1]] }
}

/** The arm on the wall and the one under the lid. */
export function stayArms(stay: Stay, angle: number): [Arm, Arm] {
  const { onLid, elbow } = stayElbow(stay, angle)
  return [arm(stay.onWall, elbow), arm(elbow, onLid)]
}
