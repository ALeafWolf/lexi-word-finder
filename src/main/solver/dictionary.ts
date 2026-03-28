import { readFileSync } from 'fs'
import { join } from 'path'
import { Trie } from './trie'

let cachedTrie: Trie | null = null

function getResourcesPath(): string {
  // In Electron main process (packaged)
  if (typeof process !== 'undefined' && process.resourcesPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron') as typeof import('electron')
      return app.isPackaged ? process.resourcesPath : join(process.cwd(), 'resources')
    } catch {
      // Not in Electron (e.g. tests) — fall through
    }
  }
  return join(process.cwd(), 'resources')
}

/**
 * Load and cache the word list into a Trie.
 * The word list file should be at resources/wordlist.txt (one word per line).
 * Words are uppercased and filtered to 3+ characters.
 */
export function getDictionary(): Trie {
  if (cachedTrie) return cachedTrie

  const wordlistPath = join(getResourcesPath(), 'wordlist.txt')

  let content: string
  try {
    content = readFileSync(wordlistPath, 'utf-8')
  } catch {
    console.warn(`[dictionary] Could not load wordlist from ${wordlistPath}, using built-in fallback`)
    content = FALLBACK_WORDS.join('\n')
  }

  const words = content
    .split(/\r?\n/)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length >= 3 && /^[A-Z]+$/.test(w))

  console.log(`[dictionary] Loaded ${words.length} words into Trie`)
  cachedTrie = Trie.fromWords(words)
  return cachedTrie
}

/** Small fallback so the solver works without the word list file during development. */
const FALLBACK_WORDS = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'had', 'his', 'him', 'has', 'how', 'man', 'old',
  'tap', 'tape', 'taps', 'ape', 'apes', 'pear', 'reap', 'rape', 'raped',
  'ore', 'ores', 'rend', 'rends', 'send', 'sends', 'hone', 'horn', 'horde',
  'hop', 'hops', 'hero', 'heroes', 'hen', 'hens', 'end', 'ends', 'den',
  'lump', 'lumps', 'mule', 'pun', 'puns', 'mud', 'pum', 'sum', 'sun', 'nun',
  'pea', 'peas', 'pen', 'pens', 'per', 'nor', 'node', 'nod', 'nods',
  'ship', 'tip', 'tips', 'top', 'tops', 'pot', 'pots', 'pie', 'pie',
  'eat', 'eats', 'ear', 'ears', 'era', 'eras', 'err', 'errs'
]
