import { Trie, TrieNode } from './trie'

export interface SolverResult {
  word: string
  path: Array<[row: number, col: number]>
}

/** All 8 directions: N, NE, E, SE, S, SW, W, NW */
const DIRS: Array<[number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0,  -1],          [0,  1],
  [1,  -1], [1,  0], [1,  1]
]

/**
 * Solve a word-grid puzzle using DFS + Trie pruning.
 *
 * Rules:
 *  - 8-directional adjacency
 *  - No tile reuse within a single word path
 *  - Minimum word length: 3
 *  - "QU" tiles count as a single cell whose value is "QU"
 *
 * Returns unique words sorted by length (desc), then alphabetically.
 */
export function solve(
  grid: string[][],
  trie: Trie,
  minLength = 3
): SolverResult[] {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const found = new Map<string, SolverResult>() // word -> first found path
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false))

  function dfs(
    r: number,
    c: number,
    currentWord: string,
    currentPath: Array<[number, number]>,
    trieNode: TrieNode
  ): void {
    const cellValue = grid[r][c]
    const newWord = currentWord + cellValue

    // Walk the trie for each character in the cell value (handles "QU" -> Q then U)
    let node: TrieNode | null = trieNode
    for (const ch of cellValue) {
      const next = node.children[ch]
      if (!next) return // prefix not in trie, prune
      node = next
    }

    if (newWord.length >= minLength && node.isEnd) {
      if (!found.has(newWord)) {
        found.set(newWord, { word: newWord, path: [...currentPath, [r, c]] })
      }
    }

    // Explore neighbours
    visited[r][c] = true
    for (const [dr, dc] of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, newWord, [...currentPath, [r, c]], node)
      }
    }
    visited[r][c] = false
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dfs(r, c, '', [], trie.root)
    }
  }

  return Array.from(found.values()).sort((a, b) => {
    if (b.word.length !== a.word.length) return b.word.length - a.word.length
    return a.word.localeCompare(b.word)
  })
}
