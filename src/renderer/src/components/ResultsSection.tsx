import React, { useState } from 'react'
import type { ScanResult, WordResult } from '../types'

interface ResultsSectionProps {
  result: ScanResult | null
  editableGrid: string[][]
  editedCells: Set<string>
  highlightedCells: Set<string> | null
  onHoverWord: (word: WordResult | null) => void
  onEditCell: (row: number, col: number, value: string) => Promise<void>
}

export function ResultsSection({
  result,
  editableGrid,
  editedCells,
  highlightedCells,
  onHoverWord,
  onEditCell
}: ResultsSectionProps): React.JSX.Element {
  return (
    <section className="section results-section">
      <h2 className="section-title">Results</h2>
      {!result ? (
        <div className="empty">No results yet. Click Scan Grid or press Ctrl+Shift+S.</div>
      ) : (
        <>
          <GridDisplay
            editableGrid={editableGrid}
            editedCells={editedCells}
            highlightedCells={highlightedCells}
            onCellEdit={onEditCell}
          />
          <div className="stats">
            <span>{result.words.length} words</span>
            <span className="sep">·</span>
            <span>{result.elapsedMs}ms</span>
          </div>
          <WordList words={result.words} onHover={onHoverWord} />
        </>
      )}
    </section>
  )
}

interface GridDisplayProps {
  editableGrid: string[][]
  editedCells: Set<string>
  highlightedCells: Set<string> | null
  onCellEdit: (r: number, c: number, value: string) => Promise<void>
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

  const startEdit = (r: number, c: number, letter: string): void => {
    setEditingKey(`${r},${c}`)
    setDraftValue(letter === '?' ? '' : letter)
  }

  const commitEdit = async (r: number, c: number): Promise<void> => {
    const trimmed = draftValue.trim().toUpperCase()
    if (trimmed.length > 0) {
      await onCellEdit(r, c, trimmed)
    }
    setEditingKey(null)
  }

  return (
    <div className="grid-display" style={{ gridTemplateColumns: `repeat(${cols}, 36px)` }}>
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
              title={hasOcrError ? 'OCR could not read this cell. Click to fix.' : 'Click to edit'}
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
                  onBlur={() => void commitEdit(r, c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault()
                      void commitEdit(r, c)
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
  if (words.length === 0) {
    return <div className="no-words">No words found. Check OCR accuracy.</div>
  }

  let currentLength = -1

  return (
    <div className="word-list">
      {words.map((wr, i) => {
        const showSeparator = wr.word.length !== currentLength
        currentLength = wr.word.length
        return (
          <React.Fragment key={`${wr.word}-${i}`}>
            {showSeparator && <div className="length-separator">{wr.word.length} letters</div>}
            <div className="word-item" onMouseEnter={() => onHover(wr)} onMouseLeave={() => onHover(null)}>
              {wr.word}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
