import { contextBridge, ipcRenderer } from 'electron'
import type { BoundingBox, ScanResult, WordResult } from '../shared/types'

const api = {
  // --- Region selection (used by selector window) ---
  confirmRegionSelect: (region: BoundingBox) =>
    ipcRenderer.send('region:confirm', region),

  cancelRegionSelect: () => ipcRenderer.send('region:cancel'),

  // --- Main window actions ---
  startRegionSelect: () => ipcRenderer.invoke('region:start'),

  onRegionSelected: (callback: (region: BoundingBox) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, region: BoundingBox) => callback(region)
    ipcRenderer.on('region:selected', handler)
    return () => ipcRenderer.removeListener('region:selected', handler)
  },

  // --- Scan trigger ---
  triggerScan: () => ipcRenderer.invoke('scan:trigger'),
  setGridSize: (rows: number, cols: number) =>
    ipcRenderer.invoke('settings:setGridSize', rows, cols),

  onScanResult: (callback: (result: ScanResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: ScanResult) => callback(result)
    ipcRenderer.on('scan:result', handler)
    return () => ipcRenderer.removeListener('scan:result', handler)
  },

  onScanError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('scan:error', handler)
    return () => ipcRenderer.removeListener('scan:error', handler)
  },

  // --- Results overlay controls ---
  closeResultsOverlay: () => ipcRenderer.send('results:close'),
  setClickThrough: (enabled: boolean) => ipcRenderer.send('results:clickthrough', enabled),
  rescanFromOverlay: () => ipcRenderer.invoke('scan:trigger'),

  // --- Dictionary selection ---
  listDictionaries: (): Promise<{ items: string[]; current: string }> =>
    ipcRenderer.invoke('dictionary:list'),
  setDictionary: (name: string): Promise<void> => ipcRenderer.invoke('dictionary:set', name),

  // --- Grid editing ---
  solveGrid: (grid: string[][]): Promise<{ words: WordResult[]; solveMs: number }> =>
    ipcRenderer.invoke('grid:solve', grid)
}

contextBridge.exposeInMainWorld('api', api)
