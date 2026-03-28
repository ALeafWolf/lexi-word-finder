import type { BoundingBox, ScanResult, WordResult } from '../shared/types'

export interface LexiApi {
  // Region selection (selector window)
  confirmRegionSelect: (region: BoundingBox) => void
  cancelRegionSelect: () => void

  // Main window
  startRegionSelect: () => Promise<void>
  onRegionSelected: (callback: (region: BoundingBox) => void) => () => void

  // Scan
  triggerScan: () => Promise<void>
  getGridSize: () => Promise<{ rows: number; cols: number }>
  setGridSize: (rows: number, cols: number) => Promise<void>
  onScanResult: (callback: (result: ScanResult) => void) => () => void
  onScanError: (callback: (error: string) => void) => () => void

  // Main window toolbar controls
  closeMainWindow: () => void
  setMainAlwaysOnTop: (enabled: boolean) => Promise<boolean>
  getMainAlwaysOnTop: () => Promise<boolean>

  // Dictionary selection
  listDictionaries: () => Promise<{ items: string[]; current: string }>
  setDictionary: (name: string) => Promise<void>

  // Grid editing
  solveGrid: (grid: string[][]) => Promise<{ words: WordResult[]; solveMs: number }>
}

declare global {
  interface Window {
    api: LexiApi
  }
}
