import React, { useCallback, useEffect, useState } from 'react'
import type { BoundingBox, ScanResult } from './types'
import './App.css'

function App(): React.JSX.Element {
  const [region, setRegion] = useState<BoundingBox | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'selecting' | 'scanning' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [gridSize, setGridSizeState] = useState<4 | 5>(4)
  const [dictionaries, setDictionaries] = useState<string[]>([])
  const [selectedDict, setSelectedDict] = useState<string>('wordlist')

  useEffect(() => {
    window.api.listDictionaries().then(({ items, current }) => {
      setDictionaries(items)
      setSelectedDict(current)
    })
  }, [])

  useEffect(() => {
    const unsub = window.api.onRegionSelected((r) => {
      setRegion(r)
      setStatus('idle')
    })
    const unsubResult = window.api.onScanResult((r) => {
      setResult(r)
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

  const handleGridSizeChange = useCallback(
    async (size: 4 | 5) => {
      setGridSizeState(size)
      await window.api.setGridSize(size, size)
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
          {([4, 5] as const).map((n) => (
            <button
              key={n}
              className={`size-btn${gridSize === n ? ' active' : ''}`}
              onClick={() => handleGridSizeChange(n)}
            >
              {n}×{n}
            </button>
          ))}
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

        {/* Inline results summary (main window) */}
        {result && (
          <div className="results-summary">
            <div className="results-header">
              <span>{result.words.length} words found</span>
              <span className="dim">{result.elapsedMs}ms</span>
            </div>
            <div
              className="grid-preview"
              style={{ gridTemplateColumns: `repeat(${result.grid[0]?.length ?? 4}, 1fr)` }}
            >
              {result.grid.map((row, r) =>
                row.map((letter, c) => (
                  <div key={`${r},${c}`} className="preview-cell">
                    {letter}
                  </div>
                ))
              )}
            </div>
            <div className="top-words">
              {result.words.slice(0, 10).map((w, i) => (
                <span key={i} className="word-chip">
                  {w.word}
                </span>
              ))}
              {result.words.length > 10 && (
                <span className="word-chip dim">+{result.words.length - 10} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
