import { describe, it, expect, beforeAll } from 'vitest'
import { Trie } from './trie'
import { solve } from './solver'

const WORDS = [
  'TAP', 'TAPE', 'TAPS', 'APE', 'APES', 'PEAR', 'REAP', 'RAPE',
  'ORE', 'ORES', 'REND', 'SEND', 'HONE', 'HORN', 'HOP', 'HERO',
  'HEN', 'END', 'DEN', 'LUMP', 'MULE', 'PUN', 'SUN', 'NODE',
  'NOD', 'PEA', 'PEN', 'PER', 'NOR', 'EAT', 'EAR', 'ERA',
  'THE', 'THEN', 'ROPE', 'ROPES', 'OPEN', 'OPERON',
  // extra words for path tests
  'THIS', 'SHOP', 'THRO', 'THOSE', 'HOPE', 'HOPES',
]

let trie: Trie

beforeAll(() => {
  trie = Trie.fromWords(WORDS)
})

describe('Trie', () => {
  it('finds existing words', () => {
    expect(trie.hasWord('TAP')).toBe(true)
    expect(trie.hasWord('TAPE')).toBe(true)
  })

  it('does not find non-existent words', () => {
    expect(trie.hasWord('ZZZZZ')).toBe(false)
    expect(trie.hasWord('XY')).toBe(false)
  })

  it('correctly identifies prefixes', () => {
    expect(trie.hasPrefix('TA')).toBe(true)
    expect(trie.hasPrefix('TAP')).toBe(true)
    expect(trie.hasPrefix('ZQX')).toBe(false)
  })

  it('short single-char strings are not words', () => {
    expect(trie.hasWord('T')).toBe(false)
    expect(trie.hasWord('TA')).toBe(false)
  })
})

describe('solve', () => {
  // Classic Boggle-style 4x4 grid
  const grid4x4: string[][] = [
    ['T', 'A', 'P', 'E'],
    ['I', 'H', 'O', 'R'],
    ['S', 'E', 'N', 'D'],
    ['L', 'U', 'M', 'P']
  ]

  it('finds TAP in the 4x4 grid', () => {
    const results = solve(grid4x4, trie)
    const words = results.map((r) => r.word)
    expect(words).toContain('TAP')
  })

  it('finds TAPE in the 4x4 grid', () => {
    const results = solve(grid4x4, trie)
    const words = results.map((r) => r.word)
    expect(words).toContain('TAPE')
  })

  it('finds HOP in the 4x4 grid', () => {
    const results = solve(grid4x4, trie)
    const words = results.map((r) => r.word)
    expect(words).toContain('HOP')
  })

  it('finds END in the 4x4 grid', () => {
    const results = solve(grid4x4, trie)
    const words = results.map((r) => r.word)
    expect(words).toContain('END')
  })

  it('finds SEND in the 4x4 grid', () => {
    const results = solve(grid4x4, trie)
    const words = results.map((r) => r.word)
    expect(words).toContain('SEND')
  })

  it('finds LUMP in the 4x4 grid', () => {
    const results = solve(grid4x4, trie)
    const words = results.map((r) => r.word)
    expect(words).toContain('LUMP')
  })

  it('does not include words requiring tile reuse', () => {
    // "TAPS" would need T(0,0)->A(0,1)->P(0,2)->S(2,0); S is not adjacent to P
    // So TAPS may or may not be found — the key thing is cells are not reused
    const results = solve(grid4x4, trie)
    for (const r of results) {
      const posSet = new Set(r.path.map(([row, col]) => `${row},${col}`))
      expect(posSet.size).toBe(r.path.length) // no duplicate cells
    }
  })

  it('returns results sorted by length descending', () => {
    const results = solve(grid4x4, trie)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].word.length).toBeGreaterThanOrEqual(results[i + 1].word.length)
    }
  })

  it('returns only words of minimum length 3', () => {
    const results = solve(grid4x4, trie)
    for (const r of results) {
      expect(r.word.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('each result path matches the word length', () => {
    const results = solve(grid4x4, trie)
    for (const r of results) {
      // path length should equal word length (each cell = one letter normally)
      expect(r.path.length).toBe(r.word.length)
    }
  })

  it('completes a 4x4 solve in under 500ms', () => {
    const start = Date.now()
    solve(grid4x4, trie)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500)
  })

  it('handles a 1x1 grid with no words', () => {
    const results = solve([['A']], trie)
    expect(results).toHaveLength(0)
  })

  it('handles QU tiles as a two-letter unit', () => {
    const quGrid: string[][] = [
      ['QU', 'I', 'T'],
      ['A',  'L', 'E'],
      ['K',  'Y', 'S']
    ]
    // The solver should handle "QU" as a single cell with two chars
    // As long as it doesn't crash — actual word matches depend on the trie
    expect(() => solve(quGrid, trie)).not.toThrow()
  })
})
