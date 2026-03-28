import { join } from 'path'
import { app } from 'electron'
import { captureRegion, savePngToDisk, BoundingBox } from './capture'
import { recognizeGrid } from './ocr'
import { getDictionary } from './solver/dictionary'
import { solve, SolverResult } from './solver/solver'

export interface ScanResult {
  grid: string[][]
  words: SolverResult[]
  elapsedMs: number
  captureMs: number
  ocrMs: number
  solveMs: number
}

/**
 * Full scan pipeline: capture → OCR → solve.
 * Returns structured results ready for the overlay UI.
 */
export async function scanAndSolve(
  region: BoundingBox,
  gridRows = 4,
  gridCols = 4,
  debugSave = false,
  dictionary = 'wordlist'
): Promise<ScanResult> {
  const total = Date.now()

  // 1. Capture
  const t0 = Date.now()
  const pngBuffer = await captureRegion(region)
  const captureMs = Date.now() - t0

  if (debugSave) {
    const debugPath = join(app.getPath('temp'), 'lexi-capture-debug.png')
    await savePngToDisk(pngBuffer, debugPath)
  }

  // 2. OCR
  const t1 = Date.now()
  const { grid } = await recognizeGrid(pngBuffer, gridRows, gridCols)
  const ocrMs = Date.now() - t1

  // 3. Solve
  const t2 = Date.now()
  const trie = getDictionary(dictionary)
  const words = solve(grid, trie)
  const solveMs = Date.now() - t2

  const elapsedMs = Date.now() - total

  console.log(
    `[pipeline] Done in ${elapsedMs}ms ` +
      `(capture: ${captureMs}ms, ocr: ${ocrMs}ms, solve: ${solveMs}ms). ` +
      `Found ${words.length} words`
  )

  return { grid, words, elapsedMs, captureMs, ocrMs, solveMs }
}
