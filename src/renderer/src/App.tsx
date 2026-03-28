import React, { useCallback, useEffect, useState } from 'react'
import type { BoundingBox } from './types'
import './App.css'

const MIN_GRID = 2
const MAX_GRID = 15

function clampGridDim(n: number): number {
  return Math.min(MAX_GRID, Math.max(MIN_GRID, Math.floor(n)))
}

function App(): React.JSX.Element {
  const [region, setRegion] = useState<BoundingBox | null>(null)
  const [status, setStatus] = useState<'idle' | 'selecting' | 'scanning' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [gridRows, setGridRows] = useState(4)
  const [gridCols, setGridCols] = useState(4)
  const [dictionaries, setDictionaries] = useState<string[]>([])
  const [selectedDict, setSelectedDict] = useState<string>('wordlist')

  useEffect(() => {
    window.api.listDictionaries().then(({ items, current }) => {
      setDictionaries(items)
      setSelectedDict(current)
    })
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
    const unsubResult = window.api.onScanResult(() => {
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
  }, [])

  const handleSelectRegion = useCallback(async () => {
    setStatus('selecting')
    await window.api.startRegionSelect()
  }, [])

  const handleScan = useCallback(async () => {
    setStatus('scanning')
    setErrorMsg(null)
    await window.api.triggerScan()
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
    <div className="app">
      <div className="panel">
        <h1 className="title">Lexi Word Finder</h1>
        <p className="subtitle">
          Select the game grid region, then press Scan or Ctrl+Shift+S.
        </p>

        {/* Grid size selector */}
        <div className="grid-size-row">
          <span className="label">Grid size:</span>
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
            ×
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

        {/* Dictionary selector */}
        {dictionaries.length > 1 && (
          <div className="grid-size-row">
            <span className="label">Dictionary:</span>
            <select
              className="dict-select"
              value={selectedDict}
              onChange={(e) => handleDictChange(e.target.value)}
            >
              {dictionaries.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleSelectRegion}
            disabled={status === 'selecting' || status === 'scanning'}
          >
            {status === 'selecting' ? 'Selecting…' : 'Select Region'}
          </button>

          <button
            className="btn btn-accent"
            onClick={handleScan}
            disabled={!region || status === 'scanning' || status === 'selecting'}
          >
            {status === 'scanning' ? 'Scanning…' : 'Scan Grid'}
          </button>
        </div>

        {region && (
          <div className="region-info">
            <span className="region-label">Region:</span>
            <code>
              {region.width}×{region.height} at ({region.x}, {region.y})
            </code>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div className="error-banner">{errorMsg}</div>
        )}

        {!region && (
          <div className="hint">No region selected yet — click "Select Region" to begin.</div>
        )}
      </div>
    </div>
  )
}

export default App
