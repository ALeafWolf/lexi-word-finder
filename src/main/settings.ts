import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { BoundingBox } from '../shared/types'

export interface AppSettings {
  lastRegion: BoundingBox | null
  gridRows: number
  gridCols: number
  dictionary: string
}

const DEFAULT_SETTINGS: AppSettings = {
  lastRegion: null,
  gridRows: 4,
  gridCols: 4,
  dictionary: 'wordlist'
}

function getSettingsPath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const raw = readFileSync(getSettingsPath(), 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[settings] Failed to save:', err)
  }
}
