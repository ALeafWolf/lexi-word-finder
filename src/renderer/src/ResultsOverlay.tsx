import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { ScanResult, WordResult } from './types'
import './ResultsOverlay.css'

export default function ResultsOverlay(): React.JSX.Element {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [editableGrid, setEditableGrid] = useState<string[][]>([])
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set())
  const [hoveredWord, setHoveredWord] = useState<WordResult | null>(null)
  const [clickThrough, setClickThroughState] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    const unsub = window.api.onScanResult((r) => {
      setResult(r)
      setEditableGrid(r.grid.map((row) => [...row]))
      setEditedCells(new Set())
      setIsScanning(false)
    })
    const unsubErr = window.api.onScanError(() => {
      setIsScanning(false)
    })
    return () => {
      unsub()
      unsubErr()
    }
  }, [])

  const handleCellEdit = useCallback(
    async (r: number, c: number, value: string) => {
      const newGrid = editableGrid.map((row) => [...row])
      newGrid[r][c] = value
      setEditableGrid(newGrid)
      setEditedCells((prev) => new Set(prev).add(`${r},${c}`))
      const { words } = await window.api.solveGrid(newGrid)
      setResult((prev) => (prev ? { ...prev, words } : prev))
    },
    [editableGrid]
  )

  const handleClose = useCallback(() => {
    window.api.closeResultsOverlay()
  }, [])

  const handleClickThrough = useCallback(() => {
    const next = !clickThrough
    setClickThroughState(next)
    window.api.setClickThrough(next)
  }, [clickThrough])

  const handleRescan = useCallback(async () => {
    setIsScanning(true)
    await window.api.rescanFromOverlay()
  }, [])

  const highlightedCells = hoveredWord
    ? new Set(hoveredWord.path.map(([r, c]) => `${r},${c}`))
    : null

  return (
    <div className={`overlay${clickThrough ? ' click-through' : ''}`}>
      <div className="panel">
        {/* Header */}
        <div className="header">
          <span className="header-title">Lexi</span>
          <div className="header-actions">
            <button
              className={`icon-btn${clickThrough ? ' active' : ''}`}
              title={clickThrough ? 'Disable click-through' : 'Enable click-through'}
              onClick={handleClickThrough}
            >
              {clickThrough ? '🔒' : '👆'}
            </button>
            <button
              className="icon-btn"
              title="Rescan"
              onClick={handleRescan}
              disabled={isScanning}
            >
              {isScanning ? '⏳' : '🔄'}
            </button>
            <button className="icon-btn close-btn" title="Close" onClick={handleClose}>
              ✕
            </button>
          </div>
        </div>

        {result ? (
          <>
            {/* Grid display */}
            <GridDisplay
              editableGrid={editableGrid}
              editedCells={editedCells}
              highlightedCells={highlightedCells}
              onCellEdit={handleCellEdit}
            />

            {/* Stats */}
            <div className="stats">
              <span>{result.words.length} words</span>
              <span className="sep">·</span>
              <span>{result.elapsedMs}ms</span>
            </div>

            {/* Word list */}
            <WordList words={result.words} onHover={setHoveredWord} />
          </>
        ) : (
          <div className="empty">
            {isScanning ? 'Scanning…' : 'No results yet. Click Rescan or press Ctrl+Shift+S.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface GridDisplayProps {
  editableGrid: string[][]
  editedCells: Set<string>
  highlightedCells: Set<string> | null
  onCellEdit: (r: number, c: number, value: string) => void
}

function GridDisplay({
  editableGrid,
  editedCells,
  highlightedCells,
  onCellEdit
}: GridDisplayProps): React.JSX.Element {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const cols = editableGrid[0]?.length ?? 4

  const startEdit = (r: number, c: number, letter: string) => {
    setEditingKey(`${r},${c}`)
    setDraftValue(letter === '?' ? '' : letter)
  }

  const commitEdit = (r: number, c: number) => {
    const trimmed = draftValue.trim()
    if (trimmed.length > 0) {
      onCellEdit(r, c, trimmed)
    }
    setEditingKey(null)
  }

  return (
    <div
      className="grid-display"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {editableGrid.map((row, r) =>
        row.map((letter, c) => {
          const key = `${r},${c}`
          const isEditing = editingKey === key
          const isHighlighted = !isEditing && (highlightedCells?.has(key) ?? false)
          const pathArray = highlightedCells ? Array.from(highlightedCells) : []
          const pathIndex = isHighlighted ? pathArray.indexOf(key) : -1
          const hasOcrError = letter === '?'
          const isEdited = editedCells.has(key)

          const classes = [
            'cell',
            isHighlighted ? 'highlighted' : '',
            hasOcrError ? 'ocr-error' : '',
            isEdited ? 'edited' : '',
            isEditing ? 'editing' : ''
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={key}
              className={classes}
              data-index={isHighlighted ? pathIndex + 1 : undefined}
              title={hasOcrError ? 'OCR could not read this cell — click to fix' : 'Click to edit'}
              onClick={() => !isEditing && startEdit(r, c, letter)}
            >
              {isEditing ? (
                <input
                  className="cell-input"
                  value={draftValue}
                  autoFocus
                  maxLength={2}
                  onChange={(e) => setDraftValue(e.target.value.toUpperCase())}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => commitEdit(r, c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault()
                      commitEdit(r, c)
                    } else if (e.key === 'Escape') {
                      setEditingKey(null)
                    }
                  }}
                />
              ) : hasOcrError ? (
                <span className="unknown">?</span>
              ) : (
                letter
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

interface WordListProps {
  words: WordResult[]
  onHover: (word: WordResult | null) => void
}

function WordList({ words, onHover }: WordListProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)

  if (words.length === 0) {
    return <div className="no-words">No words found. Check OCR accuracy.</div>
  }

  let currentLength = -1

  return (
    <div className="word-list" ref={listRef}>
      {words.map((wr, i) => {
        const showSeparator = wr.word.length !== currentLength
        currentLength = wr.word.length
        return (
          <React.Fragment key={`${wr.word}-${i}`}>
            {showSeparator && (
              <div className="length-separator">{wr.word.length} letters</div>
            )}
            <div
              className="word-item"
              onMouseEnter={() => onHover(wr)}
              onMouseLeave={() => onHover(null)}
            >
              {wr.word}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
