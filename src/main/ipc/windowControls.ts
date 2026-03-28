import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc/channels'
import { parseBoolean } from './validators'

interface WindowControlDeps {
  getMainWindow: () => BrowserWindow | null
}

export function registerWindowControlIpc({ getMainWindow }: WindowControlDeps): void {
  ipcMain.on(IPC_CHANNELS.mainClose, () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.close()
  })

  ipcMain.handle(IPC_CHANNELS.mainSetAlwaysOnTop, (_event, payload: unknown) => {
    const enabled = parseBoolean(payload)
    if (enabled === null) {
      throw new Error('Invalid payload for main:setAlwaysOnTop')
    }
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(enabled)
    }
    return enabled
  })

  ipcMain.handle(IPC_CHANNELS.mainGetAlwaysOnTop, () => {
    const win = getMainWindow()
    return win && !win.isDestroyed() ? win.isAlwaysOnTop() : false
  })
}
