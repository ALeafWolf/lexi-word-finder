import type { BoundingBox } from '../index'

const MIN_GRID = 2
const MAX_GRID = 15
const MAX_CELL_TEXT = 2

function isInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

export function parseGridSize(rows: unknown, cols: unknown): { rows: number; cols: number } | null {
  if (!isInteger(rows) || !isInteger(cols)) return null
  if (rows < MIN_GRID || rows > MAX_GRID || cols < MIN_GRID || cols > MAX_GRID) return null
  return { rows, cols }
}

export function parseBoundingBox(payload: unknown): BoundingBox | null {
  if (typeof payload !== 'object' || payload === null) return null
  const maybe = payload as Partial<BoundingBox>
  if (
    !isInteger(maybe.x) ||
    !isInteger(maybe.y) ||
    !isInteger(maybe.width) ||
    !isInteger(maybe.height)
  ) {
    return null
  }
  if (maybe.width <= 0 || maybe.height <= 0) return null
  return { x: maybe.x, y: maybe.y, width: maybe.width, height: maybe.height }
}

export function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

export function parseEditableGrid(payload: unknown): string[][] | null {
  if (!Array.isArray(payload) || payload.length < MIN_GRID || payload.length > MAX_GRID) return null
  const rows = payload
  const firstRow = rows[0]
  if (!Array.isArray(firstRow) || firstRow.length < MIN_GRID || firstRow.length > MAX_GRID) return null
  const cols = firstRow.length

  const normalized: string[][] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== cols) return null
    const outRow: string[] = []
    for (const cell of row) {
      if (typeof cell !== 'string') return null
      const clean = cell.trim().toUpperCase()
      if (clean.length === 0 || clean.length > MAX_CELL_TEXT) return null
      outRow.push(clean)
    }
    normalized.push(outRow)
  }
  return normalized
}
