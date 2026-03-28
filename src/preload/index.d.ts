import type { BoundingBox, ScanResult } from '../shared/types'

export interface LexiApi {
  // Region selection (selector window)
  confirmRegionSelect: (region: BoundingBox) => void
  cancelRegionSelect: () => void

  // Main window
  startRegionSelect: () => Promise<void>
  onRegionSelected: (callback: (region: BoundingBox) => void) => () => void

  // Scan
  triggerScan: () => Promise<void>
  setGridSize: (rows: number, cols: number) => Promise<void>
  onScanResult: (callback: (result: ScanResult) => void) => () => void
  onScanError: (callback: (error: string) => void) => () => void

  // Results overlay
  closeResultsOverlay: () => void
  setClickThrough: (enabled: boolean) => void
  rescanFromOverlay: () => Promise<void>

  // Dictionary selection
  listDictionaries: () => Promise<{ items: string[]; current: string }>
  setDictionary: (name: string) => Promise<void>
}

declare global {
  interface Window {
    api: LexiApi
  }
}
