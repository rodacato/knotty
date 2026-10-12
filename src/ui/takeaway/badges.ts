/** Move crowded badges while keeping their leaders anchored to the visible piece. */
export function badgePositions(points: [number, number][], radius: number, width: number, height: number): [number, number][] {
  const placed: [number, number][] = []
  for (const point of points) {
    let found = point
    for (let ring = 0; ring < 20; ring++) {
      const candidates: [number, number][] = ring === 0 ? [point] : Array.from({ length: ring * 8 }, (_, i) => {
        const angle = i * Math.PI / (ring * 4)
        return [point[0] + Math.cos(angle) * ring * radius * 2.4, point[1] + Math.sin(angle) * ring * radius * 2.4]
      })
      const free = candidates.find(([x, y]) => x >= radius && y >= radius && x <= width - radius && y <= height - radius && placed.every(([u, v]) => Math.hypot(u - x, v - y) >= radius * 2.2))
      if (free) { found = free; break }
    }
    placed.push(found)
  }
  return placed
}
