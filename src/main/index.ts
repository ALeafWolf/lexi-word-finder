import { app, BrowserWindow, shell, ipcMain, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initOcrWorker, terminateOcrWorker } from './ocr'
import { scanAndSolve } from './pipeline'
import { loadSettings, saveSettings } from './settings'
import { createTray } from './tray'
import type { Tray } from 'electron'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

let mainWindow: BrowserWindow | null = null
let selectorWindow: BrowserWindow | null = null
let resultsWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let savedRegion: BoundingBox | null = null
let gridRows = 4
let gridCols = 4

// ─── Window factories ────────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
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

function createResultsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 264,
    height: 600,
    x: 20,
    y: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/results.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/results.html'))
  }

  win.on('closed', () => {
    resultsWindow = null
  })

  return win
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

function registerIpc(): void {
  // Main window asks to open the selector overlay
  ipcMain.handle('region:start', () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.focus()
      return
    }
    selectorWindow = createSelectorWindow()
  })

  // Selector window sends confirmed bounding box
  ipcMain.on('region:confirm', (_event, region: BoundingBox) => {
    savedRegion = region
    saveSettings({ lastRegion: region, gridRows, gridCols })
    console.log('[main] Region selected:', region)

    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.close()
      selectorWindow = null
    }

    // Notify the main window
    mainWindow?.webContents.send('region:selected', region)
  })

  // Selector window was cancelled
  ipcMain.on('region:cancel', () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.close()
      selectorWindow = null
    }
  })

  // Full scan pipeline: capture → OCR → solve
  ipcMain.handle('scan:trigger', async () => {
    if (!savedRegion) {
      broadcastScanError('No region selected. Please select a region first.')
      return
    }
    try {
      const result = await scanAndSolve(savedRegion, gridRows, gridCols, true)
      broadcastScanResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[main] Scan failed:', err)
      broadcastScanError(`Scan failed: ${msg}`)
    }
  })

  ipcMain.handle('settings:setGridSize', (_event, rows: number, cols: number) => {
    gridRows = rows
    gridCols = cols
    saveSettings({ lastRegion: savedRegion, gridRows, gridCols })
  })

  // Results overlay controls
  ipcMain.on('results:close', () => {
    if (resultsWindow && !resultsWindow.isDestroyed()) {
      resultsWindow.close()
      resultsWindow = null
    }
  })

  ipcMain.on('results:clickthrough', (_event, enabled: boolean) => {
    if (resultsWindow && !resultsWindow.isDestroyed()) {
      resultsWindow.setIgnoreMouseEvents(enabled, { forward: true })
    }
  })
}

// ─── Broadcast helpers ───────────────────────────────────────────────────────

function broadcastScanResult(result: unknown): void {
  mainWindow?.webContents.send('scan:result', result)

  // Open/update the results overlay
  if (!resultsWindow || resultsWindow.isDestroyed()) {
    resultsWindow = createResultsWindow()
    // Wait for the window to load then send the result
    resultsWindow.webContents.once('did-finish-load', () => {
      resultsWindow?.webContents.send('scan:result', result)
    })
  } else {
    resultsWindow.webContents.send('scan:result', result)
    resultsWindow.show()
    resultsWindow.focus()
  }
}

function broadcastScanError(msg: string): void {
  mainWindow?.webContents.send('scan:error', msg)
  resultsWindow?.webContents.send('scan:error', msg)
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lexi-word-finder')

  // Load persisted settings
  const settings = loadSettings()
  savedRegion = settings.lastRegion
  gridRows = settings.gridRows
  gridCols = settings.gridCols

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()

  mainWindow = createMainWindow()

  // Send saved region to UI after it loads
  if (savedRegion) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('region:selected', savedRegion)
    })
  }

  // System tray
  appTray = createTray(
    // onScan
    () => {
      if (!savedRegion) return
      scanAndSolve(savedRegion, gridRows, gridCols, false)
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
    scanAndSolve(savedRegion, gridRows, gridCols, true)
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
