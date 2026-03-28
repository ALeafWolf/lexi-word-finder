export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface WordResult {
  word: string
  path: Array<[row: number, col: number]>
}

export interface ScanResult {
  grid: string[][]
  words: WordResult[]
  elapsedMs: number
  captureMs: number
  ocrMs: number
  solveMs: number
}
