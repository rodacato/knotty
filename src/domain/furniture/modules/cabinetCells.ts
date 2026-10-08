import type { Box } from '../../design/resolve'
import type { CabinetConstruction, CabinetPlan, CellChoice, PlanCell, PlanColumn } from './cabinet'

// Editing the inside of a cabinet by cutting and joining (UI-68): every operation returns a new plan, and each line it adds or removes is a board.

/** A cell that holds something, reached by column, cell, column, cell… from the plan's columns down. */
export type CellPath = number[]

/** The line after part `index` of a row of columns or of a column's cells; `at` is the path of the split cell or of the column that holds them. */
export interface Line {
  axis: 'columns' | 'cells'
  at: number[]
  index: number
}

export type JoinSide = 'up' | 'down' | 'left' | 'right'

const copy = (plan: CabinetPlan): CabinetPlan => structuredClone(plan)
const rowAt = (plan: CabinetPlan, at: number[]): PlanColumn[] => {
  let columns = plan.columns
  for (let i = 0; i < at.length; i += 2) columns = columns[at[i]].cells[at[i + 1]].columns ?? []
  return columns
}
const columnOf = (plan: CabinetPlan, path: CellPath) => rowAt(plan, path.slice(0, -2))[path[path.length - 2]]

/** The cell at `path`, or null when the path does not reach one that holds something. */
export function cellAt(plan: CabinetPlan, path: CellPath): PlanCell | null {
  if (path.length < 2 || path.length % 2) return null
  const cell = columnOf(plan, path)?.cells[path[path.length - 1]]
  return cell && !cell.columns ? cell : null
}

/** The cell at `path` choosing `key` on its own, or with `undefined` going back to the furniture's; null when the path does not reach a cell. */
export function chooseInCell<K extends CellChoice>(plan: CabinetPlan, path: CellPath, key: K, value: CabinetConstruction[K] | undefined): CabinetPlan | null {
  const next = copy(plan)
  const cell = cellAt(next, path)
  if (!cell) return null
  const own = { ...cell.own, [key]: value }
  if (value === undefined) delete own[key]
  if (Object.keys(own).length) cell.own = own
  else delete cell.own
  // One sliding leaf covers half its opening and leaves the rest open: a cell that goes sliding closes with two, as its door did.
  if (key === 'doors' && value === 'sliding' && cell.content === 'door') cell.doors = 2
  return next
}

/** Every cell that holds something, with its path, left to right and bottom to top. */
export function cellPaths(plan: CabinetPlan): CellPath[] {
  const walk = (columns: PlanColumn[], prefix: number[]): CellPath[] =>
    columns.flatMap((column, i) => column.cells.flatMap((cell, j) => (cell.columns ? walk(cell.columns, [...prefix, i, j]) : [[...prefix, i, j]])))
  return walk(plan.columns, [])
}

/** A part of a split keeps the cell's content; a void becomes open, since only an end of a column can be one. */
const part = (cell: PlanCell, size: number): PlanCell => ({ ...structuredClone(cell), content: cell.content === 'void' ? 'open' : cell.content, height: size })

/** The cell cut into `n` equal parts. A column's only cell splits the column itself into columns; any other cell becomes a split cell. */
export function splitCell(plan: CabinetPlan, path: CellPath, direction: 'columns' | 'rows', n: number): CabinetPlan | null {
  if (n < 2 || !cellAt(plan, path)) return null
  const next = copy(plan)
  const column = columnOf(next, path)
  const k = path[path.length - 1]
  const cell = column.cells[k]
  if (direction === 'rows') column.cells.splice(k, 1, ...Array.from({ length: n }, () => part(cell, cell.height / n)))
  else if (column.cells.length === 1) rowAt(next, path.slice(0, -2)).splice(path[path.length - 2], 1, ...Array.from({ length: n }, () => ({ width: column.width / n, cells: [part(cell, 1)] })))
  else column.cells[k] = { height: cell.height, content: 'open', shelves: null, doors: null, columns: Array.from({ length: n }, () => ({ width: 1, cells: [part(cell, 1)] })) }
  return next
}

/** The sides a cell can be joined on: a neighbour that holds something and came out of the same cut. */
export function joinSides(plan: CabinetPlan, path: CellPath): JoinSide[] {
  if (!cellAt(plan, path)) return []
  const column = columnOf(plan, path)
  const row = rowAt(plan, path.slice(0, -2))
  const [i, k] = [path[path.length - 2], path[path.length - 1]]
  const holds = (cell: PlanCell | undefined) => !!cell && !cell.columns
  const whole = (c: PlanColumn | undefined) => !!c && c.cells.length === 1 && holds(c.cells[0])
  const lone = column.cells.length === 1
  return ([['down', holds(column.cells[k - 1])], ['up', holds(column.cells[k + 1])], ['left', lone && whole(row[i - 1])], ['right', lone && whole(row[i + 1])]] as const).flatMap(([side, ok]) => (ok ? [side] : []))
}

/** The cell takes in its neighbour on `side`, undoing a cut; a split cell left with one column gives way to that column's cells. */
export function joinCells(plan: CabinetPlan, path: CellPath, side: JoinSide): { plan: CabinetPlan; path: CellPath } | null {
  if (!joinSides(plan, path).includes(side)) return null
  const next = copy(plan)
  const column = columnOf(next, path)
  const [i, k] = [path[path.length - 2], path[path.length - 1]]
  if (side === 'up' || side === 'down') {
    const j = side === 'up' ? k + 1 : k - 1
    column.cells[k].height += column.cells[j].height
    column.cells.splice(j, 1)
    return { plan: next, path: [...path.slice(0, -1), Math.min(k, j)] }
  }
  const row = rowAt(next, path.slice(0, -2))
  const j = side === 'right' ? i + 1 : i - 1
  column.width += row[j].width
  row.splice(j, 1)
  const joined = [...path.slice(0, -2), Math.min(i, j), 0]
  const holder = path.slice(0, -2)
  if (!holder.length || row.length > 1) return { plan: next, path: joined }
  const outer = columnOf(next, holder)
  const split = outer.cells[holder[holder.length - 1]]
  const inner = row[0].cells
  const total = inner.reduce((s, c) => s + c.height, 0) || 1
  outer.cells.splice(holder[holder.length - 1], 1, ...inner.map((c) => ({ ...c, height: (split.height * c.height) / total })))
  return { plan: next, path: holder }
}

const sizesOf = (plan: CabinetPlan, line: Line) => (line.axis === 'columns' ? rowAt(plan, line.at).map((c) => c.width) : (rowAt(plan, line.at.slice(0, -1))[line.at[line.at.length - 1]]?.cells.map((c) => c.height) ?? []))

/** Where a line sits, as a share of the row or column it divides, from its left or bottom. */
export function lineShare(plan: CabinetPlan, line: Line): number {
  const sizes = sizesOf(plan, line)
  const total = sizes.reduce((s, v) => s + v, 0) || 1
  return sizes.slice(0, line.index + 1).reduce((s, v) => s + v, 0) / total
}

/** The line moved to `share` of what it divides; only the two parts beside it change, and neither gets smaller than `minShare`. */
export function moveLine(plan: CabinetPlan, line: Line, share: number, minShare = 0.05): CabinetPlan {
  const next = copy(plan)
  const items: { width?: number; height?: number }[] = line.axis === 'columns' ? rowAt(next, line.at) : rowAt(next, line.at.slice(0, -1))[line.at[line.at.length - 1]].cells
  const key = line.axis === 'columns' ? 'width' : 'height'
  const sizes = sizesOf(plan, line)
  const total = sizes.reduce((s, v) => s + v, 0) || 1
  const before = sizes.slice(0, line.index).reduce((s, v) => s + v, 0)
  const pair = sizes[line.index] + sizes[line.index + 1]
  const first = Math.max(minShare * total, Math.min(pair - minShare * total, share * total - before))
  items[line.index][key] = first
  items[line.index + 1][key] = pair - first
  return next
}

export interface CellRect {
  path: CellPath
  x0: number
  x1: number
  y0: number
  y1: number
}
export interface LineRect extends Line {
  /** In mm: x for a line between columns, y for one between cells. */
  position: number
  /** Across the line, where it runs from and to. */
  from: number
  to: number
  /** Along the line's axis, the span it divides: its share of that span is where it sits. */
  start: number
  end: number
}

/** Each cell and line of a built cabinet seen from the front, in mm: the shares `buildCabinet` places its boards by, inside its sides, bottom and top. */
export function cellLayout(plan: CabinetPlan, boxes: Map<string, Box>): { cells: CellRect[]; lines: LineRect[] } | null {
  const [left, right, bottom, top] = ['side-left', 'side-right', 'bottom', 'top'].map((id) => boxes.get(id))
  if (!left || !right || !bottom || !top) return null
  const half = (left.x1 - left.x0) / 2
  const cells: CellRect[] = []
  const lines: LineRect[] = []
  const edges = (sizes: number[]) => {
    const total = sizes.reduce((s, v) => s + v, 0) || 1
    let sum = 0
    return sizes.map((v) => (sum += v / total))
  }
  const row = (columns: PlanColumn[], at: number[], x0: number, x1: number, y0: number, y1: number) => {
    const e = edges(columns.map((c) => c.width))
    columns.forEach((column, i) => {
      if (i < columns.length - 1) lines.push({ axis: 'columns', at, index: i, position: x0 + e[i] * (x1 - x0), from: y0, to: y1, start: x0, end: x1 })
      stack(column.cells, [...at, i], i === 0 ? x0 : x0 + e[i - 1] * (x1 - x0) + half, i === columns.length - 1 ? x1 : x0 + e[i] * (x1 - x0) - half, y0, y1)
    })
  }
  const stack = (stackCells: PlanCell[], at: number[], x0: number, x1: number, y0: number, y1: number) => {
    const e = edges(stackCells.map((c) => c.height))
    stackCells.forEach((cell, j) => {
      if (j < stackCells.length - 1) lines.push({ axis: 'cells', at, index: j, position: y0 + e[j] * (y1 - y0), from: x0, to: x1, start: y0, end: y1 })
      const cy0 = j === 0 ? y0 : y0 + e[j - 1] * (y1 - y0) + half
      const cy1 = j === stackCells.length - 1 ? y1 : y0 + e[j] * (y1 - y0) - half
      if (cell.columns) row(cell.columns, [...at, j], x0, x1, cy0, cy1)
      else cells.push({ path: [...at, j], x0, x1, y0: cy0, y1: cy1 })
    })
  }
  row(plan.columns, [], left.x1, right.x0, bottom.y1, top.y0)
  return { cells, lines }
}
