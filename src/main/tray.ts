import { Tray, Menu, nativeImage, app } from 'electron'

/**
 * Create a simple tray icon using a programmatic 16x16 PNG.
 * The icon is a purple square — replace with an actual .ico file for production.
 */
function createTrayIcon(): Electron.NativeImage {
  // 16x16 RGBA image: purple (#7c6af7) square with white inner dot
  const size = 16
  const data = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const isInner = x >= 5 && x <= 10 && y >= 5 && y <= 10
      if (isInner) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255
      } else {
        data[i] = 124; data[i + 1] = 106; data[i + 2] = 247; data[i + 3] = 255
      }
    }
  }

  return nativeImage.createFromBuffer(data, { width: size, height: size })
}

export function createTray(
  onScan: () => void,
  onSelectRegion: () => void,
  onShowMain: () => void
): Tray {
  const icon = createTrayIcon()
  const tray = new Tray(icon)
  tray.setToolTip('Lexi Word Finder')

  const updateMenu = (): void => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Lexi Word Finder',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: onShowMain
      },
      {
        label: 'Select Region',
        click: onSelectRegion
      },
      {
        label: 'Scan Now (Ctrl+Shift+S)',
        click: onScan
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ])
    tray.setContextMenu(menu)
  }

  updateMenu()

  tray.on('click', onShowMain)

  return tray
}
