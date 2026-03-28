import { app, BrowserWindow, shell, ipcMain, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initOcrWorker, terminateOcrWorker } from './ocr'
import { scanAndSolve } from './pipeline'
import { loadSettings, saveSettings } from './settings'
import { listDictionaries, getDictionary } from './solver/dictionary'
import { solve } from './solver/solver'
import { createTray } from './tray'
import type { Tray } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import { parseBoundingBox, parseEditableGrid, parseGridSize } from './ipc/validators'
import { registerWindowControlIpc } from './ipc/windowControls'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

let mainWindow: BrowserWindow | null = null
let selectorWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let savedRegion: BoundingBox | null = null
let gridRows = 4
let gridCols = 4
let currentDictionary = 'wordlist'

// ─── Window factories ────────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createSelectorWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Allow click-through except on the drag area (managed by CSS WebkitAppRegion)
  win.setIgnoreMouseEvents(false)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/selector.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/selector.html'))
  }

  return win
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

function registerIpc(): void {
  // Main window asks to open the selector overlay
  ipcMain.handle(IPC_CHANNELS.regionStart, () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.focus()
      return
    }
    selectorWindow = createSelectorWindow()
  })

  // Selector window sends confirmed bounding box
  ipcMain.on(IPC_CHANNELS.regionConfirm, (_event, payload: unknown) => {
    const region = parseBoundingBox(payload)
    if (!region) {
      console.warn('[main] Ignoring invalid region payload.')
      return
    }
    savedRegion = region
    saveSettings({ lastRegion: region, gridRows, gridCols, dictionary: currentDictionary })
    console.log('[main] Region selected:', region)

    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.close()
      selectorWindow = null
    }

    // Notify the main window
    mainWindow?.webContents.send(IPC_CHANNELS.regionSelected, region)
  })

  // Selector window was cancelled
  ipcMain.on(IPC_CHANNELS.regionCancel, () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.close()
      selectorWindow = null
    }
  })

  // Full scan pipeline: capture → OCR → solve
  ipcMain.handle(IPC_CHANNELS.scanTrigger, async () => {
    if (!savedRegion) {
      broadcastScanError('No region selected. Please select a region first.')
      return
    }
    try {
      const result = await scanAndSolve(savedRegion, gridRows, gridCols, true, currentDictionary)
      broadcastScanResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[main] Scan failed:', err)
      broadcastScanError(`Scan failed: ${msg}`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsGetGridSize, () => ({ rows: gridRows, cols: gridCols }))

  ipcMain.handle(IPC_CHANNELS.settingsSetGridSize, (_event, rows: unknown, cols: unknown) => {
    const parsed = parseGridSize(rows, cols)
    if (!parsed) {
      throw new Error('Invalid grid size payload')
    }
    gridRows = parsed.rows
    gridCols = parsed.cols
    saveSettings({ lastRegion: savedRegion, gridRows, gridCols, dictionary: currentDictionary })
  })

  ipcMain.handle(IPC_CHANNELS.dictionaryList, () => {
    return { items: listDictionaries(), current: currentDictionary }
  })

  ipcMain.handle(IPC_CHANNELS.dictionarySet, (_event, name: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid dictionary payload')
    const items = listDictionaries()
    if (!items.includes(name)) throw new Error('Unknown dictionary')
    currentDictionary = name
    saveSettings({ lastRegion: savedRegion, gridRows, gridCols, dictionary: currentDictionary })
  })

  // Re-solve with a user-edited grid (no capture or OCR)
  ipcMain.handle(IPC_CHANNELS.gridSolve, (_event, payload: unknown) => {
    const grid = parseEditableGrid(payload)
    if (!grid) throw new Error('Invalid grid payload')
    const trie = getDictionary(currentDictionary)
    const t0 = Date.now()
    const words = solve(grid, trie)
    return { words, solveMs: Date.now() - t0 }
  })
}

// ─── Broadcast helpers ───────────────────────────────────────────────────────

function broadcastScanResult(result: unknown): void {
  mainWindow?.webContents.send(IPC_CHANNELS.scanResult, result)
}

function broadcastScanError(msg: string): void {
  mainWindow?.webContents.send(IPC_CHANNELS.scanError, msg)
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lexi-word-finder')

  // Load persisted settings
  const settings = loadSettings()
  savedRegion = settings.lastRegion
  gridRows = settings.gridRows
  gridCols = settings.gridCols
  currentDictionary = settings.dictionary

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  registerWindowControlIpc({ getMainWindow: () => mainWindow })

  mainWindow = createMainWindow()

  // Send saved region to UI after it loads
  if (savedRegion) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.regionSelected, savedRegion)
    })
  }

  // System tray
  appTray = createTray(
    // onScan
    () => {
      if (!savedRegion) return
      scanAndSolve(savedRegion, gridRows, gridCols, false, currentDictionary)
        .then(broadcastScanResult)
        .catch((err) => broadcastScanError(err instanceof Error ? err.message : String(err)))
    },
    // onSelectRegion
    () => {
      if (!selectorWindow || selectorWindow.isDestroyed()) {
        selectorWindow = createSelectorWindow()
      } else {
        selectorWindow.focus()
      }
    },
    // onShowMain
    () => {
      mainWindow?.show()
      mainWindow?.focus()
    }
  )

  // Pre-load OCR worker in background so it's ready when the user scans
  initOcrWorker().catch((err) =>
    console.error('[main] Failed to init OCR worker:', err)
  )

  // Global shortcut Ctrl+Shift+S triggers the full scan pipeline
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (!savedRegion) {
      broadcastScanError('No region selected. Please select a region first.')
      return
    }
    scanAndSolve(savedRegion, gridRows, gridCols, true, currentDictionary)
      .then(broadcastScanResult)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        broadcastScanError(`Scan failed: ${msg}`)
      })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  terminateOcrWorker().finally(() => {
    if (process.platform !== 'darwin') app.quit()
  })
})
