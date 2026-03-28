import { createWorker, PSM, OEM } from 'tesseract.js'
import sharp from 'sharp'
import { app } from 'electron'
import { join } from 'path'

export interface OcrResult {
  grid: string[][]
  rawCells: string[][]
}

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null

/**
 * Pre-initialize the tesseract worker at app startup to avoid cold-start
 * delays when the first scan is triggered.
 */
export async function initOcrWorker(): Promise<void> {
  if (workerInstance) return

  const cachePath = join(app.getPath('userData'), 'tessdata')

  workerInstance = await createWorker('eng', OEM.LSTM_ONLY, {
    cachePath,
    logger: (m) => {
      if (m.status === 'recognizing text') return // too noisy
      console.log(`[ocr] ${m.status} ${Math.round((m.progress ?? 0) * 100)}%`)
    }
  })

  await workerInstance.setParameters({
    // Uppercase letters only — no digits or punctuation
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    // SINGLE_WORD is more robust than SINGLE_CHAR for real-world game tile images
    tessedit_pageseg_mode: PSM.SINGLE_WORD
  })

  console.log('[ocr] Tesseract worker ready')
}

/**
 * Terminate the worker on app quit.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
  }
}

/**
 * Pre-process a cell image buffer for better OCR accuracy:
 * - Upscale to 200x200 (Tesseract LSTM needs ~150px+ to detect characters reliably)
 * - Convert to greyscale
 * - Stretch contrast
 * - Binarize with a threshold
 * - Add padding so the letter isn't clipped
 */
async function preprocessCell(cellBuffer: Buffer): Promise<Buffer> {
  return sharp(cellBuffer)
    .resize(200, 200, { fit: 'contain', background: { r: 255, g: 255, b: 255 }, kernel: 'lanczos3' })
    .greyscale()
    .normalise()
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer()
}

/**
 * Split an image buffer into a rows x cols grid of cell buffers.
 * Trims a small border from each side of the cell to reduce noise.
 */
async function splitIntoCells(
  pngBuffer: Buffer,
  rows: number,
  cols: number,
  borderTrimPct = 0.08
): Promise<Buffer[][]> {
  const meta = await sharp(pngBuffer).metadata()
  const imgW = meta.width!
  const imgH = meta.height!

  const cellW = Math.floor(imgW / cols)
  const cellH = Math.floor(imgH / rows)

  const trimX = Math.floor(cellW * borderTrimPct)
  const trimY = Math.floor(cellH * borderTrimPct)

  const cells: Buffer[][] = []

  for (let r = 0; r < rows; r++) {
    const row: Buffer[] = []
    for (let c = 0; c < cols; c++) {
      const left = c * cellW + trimX
      const top = r * cellH + trimY
      const width = cellW - 2 * trimX
      const height = cellH - 2 * trimY

      const cellBuf = await sharp(pngBuffer)
        .extract({ left, top, width, height })
        .png()
        .toBuffer()

      row.push(cellBuf)
    }
    cells.push(row)
  }

  return cells
}

/**
 * Normalize common OCR misreads.
 * Returns uppercase normalized letter, or '?' if unrecognizable.
 */
function normalizeChar(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z]/g, '')
  const corrections: Record<string, string> = {
    '0': 'O',
    '1': 'I',
    'L': 'L' // already correct
  }

  if (cleaned.length === 0) return '?'

  // Handle "QU" as a single tile
  if (cleaned === 'QU' || cleaned === 'Q') return 'QU'

  const first = cleaned[0]
  return corrections[first] ?? first
}

/**
 * Run OCR on a captured region PNG buffer.
 * Returns the recognized grid as a 2D array of uppercase letters.
 *
 * @param pngBuffer  PNG buffer from captureRegion()
 * @param rows       Number of grid rows (default 4)
 * @param cols       Number of grid columns (default 4)
 */
export async function recognizeGrid(
  pngBuffer: Buffer,
  rows = 4,
  cols = 4
): Promise<OcrResult> {
  if (!workerInstance) {
    throw new Error('OCR worker not initialized. Call initOcrWorker() at startup.')
  }

  const cells = await splitIntoCells(pngBuffer, rows, cols)
  const rawCells: string[][] = []
  const grid: string[][] = []

  for (let r = 0; r < rows; r++) {
    const rawRow: string[] = []
    const gridRow: string[] = []

    for (let c = 0; c < cols; c++) {
      const preprocessed = await preprocessCell(cells[r][c])
      const {
        data: { text }
      } = await workerInstance.recognize(preprocessed)

      const raw = text.trim()
      const normalized = normalizeChar(raw)

      rawRow.push(raw)
      gridRow.push(normalized)
    }

    rawCells.push(rawRow)
    grid.push(gridRow)
  }

  console.log('[ocr] Recognized grid:', grid)
  return { grid, rawCells }
}
