import { contextBridge, ipcRenderer } from 'electron'
import type { BoundingBox, ScanResult, WordResult } from '../shared/types'
import { IPC_CHANNELS } from '../shared/ipc/channels'

const api = {
  // --- Region selection (used by selector window) ---
  confirmRegionSelect: (region: BoundingBox) =>
    ipcRenderer.send(IPC_CHANNELS.regionConfirm, region),

  cancelRegionSelect: () => ipcRenderer.send(IPC_CHANNELS.regionCancel),

  // --- Main window actions ---
  startRegionSelect: () => ipcRenderer.invoke(IPC_CHANNELS.regionStart),

  onRegionSelected: (callback: (region: BoundingBox) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, region: BoundingBox) => callback(region)
    ipcRenderer.on(IPC_CHANNELS.regionSelected, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.regionSelected, handler)
  },

  // --- Scan trigger ---
  triggerScan: () => ipcRenderer.invoke(IPC_CHANNELS.scanTrigger),
  getGridSize: (): Promise<{ rows: number; cols: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.settingsGetGridSize),
  setGridSize: (rows: number, cols: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.settingsSetGridSize, rows, cols),

  onScanResult: (callback: (result: ScanResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: ScanResult) => callback(result)
    ipcRenderer.on(IPC_CHANNELS.scanResult, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.scanResult, handler)
  },

  onScanError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on(IPC_CHANNELS.scanError, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.scanError, handler)
  },

  // --- Main window toolbar controls ---
  closeMainWindow: () => ipcRenderer.send(IPC_CHANNELS.mainClose),
  setMainAlwaysOnTop: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.mainSetAlwaysOnTop, enabled),
  getMainAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.mainGetAlwaysOnTop),

  // --- Dictionary selection ---
  listDictionaries: (): Promise<{ items: string[]; current: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.dictionaryList),
  setDictionary: (name: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.dictionarySet, name),

  // --- Grid editing ---
  solveGrid: (grid: string[][]): Promise<{ words: WordResult[]; solveMs: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.gridSolve, grid)
}

contextBridge.exposeInMainWorld('api', api)
