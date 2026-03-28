import { useCallback, useMemo, useState } from 'react'
import type { ScanResult, WordResult } from '../types'

export interface UseScanResultsReturn {
  result: ScanResult | null
  editableGrid: string[][]
  editedCells: Set<string>
  hoveredWord: WordResult | null
  highlightedCells: Set<string> | null
  setHoveredWord: (word: WordResult | null) => void
  applyScanResult: (next: ScanResult) => void
  applySolvedWords: (words: WordResult[]) => void
  editCell: (row: number, col: number, value: string) => Promise<void>
}

function sortWords(words: WordResult[]): WordResult[] {
  return [...words].sort((a, b) => {
    const lenDiff = b.word.length - a.word.length
    return lenDiff !== 0 ? lenDiff : a.word.localeCompare(b.word)
  })
}

export function useScanResults(): UseScanResultsReturn {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [editableGrid, setEditableGrid] = useState<string[][]>([])
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set())
  const [hoveredWord, setHoveredWord] = useState<WordResult | null>(null)

  const applyScanResult = useCallback((next: ScanResult) => {
    setResult({ ...next, words: sortWords(next.words) })
    setEditableGrid(next.grid.map((row) => [...row]))
    setEditedCells(new Set())
    setHoveredWord(null)
  }, [])

  const applySolvedWords = useCallback((words: WordResult[]) => {
    setResult((prev) => (prev ? { ...prev, words: sortWords(words) } : prev))
  }, [])

  const editCell = useCallback(
    async (row: number, col: number, value: string) => {
      let nextGrid: string[][] = []
      setEditableGrid((prev) => {
        nextGrid = prev.map((r) => [...r])
        nextGrid[row][col] = value
        return nextGrid
      })
      setEditedCells((prev) => new Set(prev).add(`${row},${col}`))
      const { words } = await window.api.solveGrid(nextGrid)
      applySolvedWords(words)
    },
    [applySolvedWords]
  )

  const highlightedCells = useMemo(() => {
    return hoveredWord ? new Set(hoveredWord.path.map(([r, c]) => `${r},${c}`)) : null
  }, [hoveredWord])

  return {
    result,
    editableGrid,
    editedCells,
    hoveredWord,
    highlightedCells,
    setHoveredWord,
    applyScanResult,
    applySolvedWords,
    editCell
  }
}
