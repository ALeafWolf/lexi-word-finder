import React, { useCallback, useEffect, useState } from 'react'
import type { BoundingBox } from './types'
import './App.css'
import { ResultsSection } from './components/ResultsSection'
import { useScanResults } from './hooks/useScanResults'

const MIN_GRID = 2
const MAX_GRID = 15

function clampGridDim(n: number): number {
  return Math.min(MAX_GRID, Math.max(MIN_GRID, Math.floor(n)))
}

function App(): React.JSX.Element {
  const [region, setRegion] = useState<BoundingBox | null>(null)
  const [status, setStatus] = useState<'idle' | 'selecting' | 'scanning' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [isPinned, setIsPinned] = useState(false)
  const [gridRows, setGridRows] = useState(4)
  const [gridCols, setGridCols] = useState(4)
  const [dictionaries, setDictionaries] = useState<string[]>([])
  const [selectedDict, setSelectedDict] = useState<string>('wordlist')
  const { result, editableGrid, editedCells, highlightedCells, setHoveredWord, applyScanResult, editCell } =
    useScanResults()

  useEffect(() => {
    window.api.listDictionaries().then(({ items, current }) => {
      setDictionaries(items)
      setSelectedDict(current)
    })
    window.api.getMainAlwaysOnTop().then((value) => setIsPinned(value))
    window.api.getGridSize().then(({ rows, cols }) => {
      setGridRows(rows)
      setGridCols(cols)
    })
  }, [])

  useEffect(() => {
    const unsub = window.api.onRegionSelected((r) => {
      setRegion(r)
      setStatus('idle')
    })
    const unsubResult = window.api.onScanResult((scanResult) => {
      applyScanResult(scanResult)
      setStatus('idle')
      setErrorMsg(null)
    })
    const unsubErr = window.api.onScanError((e) => {
      setErrorMsg(e)
      setStatus('error')
    })
    return () => {
      unsub()
      unsubResult()
      unsubErr()
    }
  }, [applyScanResult])

  const handleSelectRegion = useCallback(async () => {
    setStatus('selecting')
    await window.api.startRegionSelect()
  }, [])

  const handleScan = useCallback(async () => {
    setStatus('scanning')
    setErrorMsg(null)
    await window.api.triggerScan()
  }, [])

  const handleRescan = useCallback(async () => {
    setStatus('scanning')
    setErrorMsg(null)
    await window.api.triggerScan()
  }, [])

  const handlePinToggle = useCallback(async () => {
    const next = !isPinned
    const applied = await window.api.setMainAlwaysOnTop(next)
    setIsPinned(applied)
  }, [isPinned])

  const handleClose = useCallback(() => {
    window.api.closeMainWindow()
  }, [])

  const handleGridRowsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.valueAsNumber
      if (Number.isNaN(v)) return
      const r = clampGridDim(v)
      setGridRows(r)
      setGridCols((c) => {
        void window.api.setGridSize(r, c)
        return c
      })
    },
    []
  )

  const handleGridColsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.valueAsNumber
      if (Number.isNaN(v)) return
      const c = clampGridDim(v)
      setGridCols(c)
      setGridRows((r) => {
        void window.api.setGridSize(r, c)
        return r
      })
    },
    []
  )

  const handleDictChange = useCallback(async (name: string) => {
    setSelectedDict(name)
    await window.api.setDictionary(name)
  }, [])

  return (
    <div className="app-shell">
      <div className="main-panel">
        <header className="top-toolbar">
          <div className="toolbar-actions">
            <button className={`toolbar-btn ${isPinned ? 'active' : ''}`} onClick={handlePinToggle}>
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="toolbar-btn" onClick={() => void handleRescan()} disabled={status === 'scanning'}>
              {status === 'scanning' ? 'Scanning...' : 'Rescan'}
            </button>
            <button className="toolbar-btn close" onClick={handleClose}>
              Close
            </button>
          </div>
        </header>

        <main className="content">
          <h1 className="app-title">Lexi Word Finder</h1>
          <p className="subtitle">Select the game grid region, then press Scan or Ctrl+Shift+S.</p>

          <section className="section">
            <button className="settings-toggle" onClick={() => setSettingsOpen((v) => !v)}>
              {settingsOpen ? 'Hide Settings' : 'Show Settings'}
            </button>
            {settingsOpen && (
              <div className="settings-body">
                <div className="grid-size-row">
                  <span className="label">Dictionary</span>
                  <select
                    className="dict-select"
                    value={selectedDict}
                    onChange={(e) => void handleDictChange(e.target.value)}
                  >
                    {dictionaries.map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid-size-row">
                  <span className="label">Grid Size</span>
                  <input
                    className="grid-num-input"
                    type="number"
                    min={MIN_GRID}
                    max={MAX_GRID}
                    step={1}
                    value={gridRows}
                    onChange={handleGridRowsChange}
                    aria-label="Grid rows"
                  />
                  <span className="grid-sep" aria-hidden>
                    x
                  </span>
                  <input
                    className="grid-num-input"
                    type="number"
                    min={MIN_GRID}
                    max={MAX_GRID}
                    step={1}
                    value={gridCols}
                    onChange={handleGridColsChange}
                    aria-label="Grid columns"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="section action-row">
            <button
              className="btn btn-primary"
              onClick={() => void handleSelectRegion()}
              disabled={status === 'selecting' || status === 'scanning'}
            >
              {status === 'selecting' ? 'Selecting...' : 'Select Region'}
            </button>
            <button
              className="btn btn-accent"
              onClick={() => void handleScan()}
              disabled={!region || status === 'scanning' || status === 'selecting'}
            >
              {status === 'scanning' ? 'Scanning...' : 'Scan Grid'}
            </button>
          </section>

          {region && (
            <div className="region-info">
              <span className="region-label">Region:</span>
              <code>
                {region.width}x{region.height} at ({region.x}, {region.y})
              </code>
            </div>
          )}

          {status === 'error' && errorMsg && <div className="error-banner">{errorMsg}</div>}
          {!region && <div className="hint">No region selected yet. Click Select Region to begin.</div>}

          <ResultsSection
            result={result}
            editableGrid={editableGrid}
            editedCells={editedCells}
            highlightedCells={highlightedCells}
            onHoverWord={setHoveredWord}
            onEditCell={editCell}
          />
        </main>
      </div>
    </div>
  )
}

export default App
