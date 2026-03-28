import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { Trie } from './trie'

const trieCache = new Map<string, Trie>()

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
 * Return the stems (filenames without .txt) of all word-list files in resources/.
 */
export function listDictionaries(): string[] {
  try {
    const dir = getResourcesPath()
    return readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => f.slice(0, -4))
      .sort()
  } catch {
    return ['wordlist']
  }
}

/**
 * Load and cache the word list for the given dictionary name (filename stem).
 * Falls back to 'wordlist' if the named file cannot be read.
 */
export function getDictionary(name = 'wordlist'): Trie {
  const cached = trieCache.get(name)
  if (cached) return cached

  const filePath = join(getResourcesPath(), `${name}.txt`)

  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch {
    console.warn(`[dictionary] Could not load "${name}.txt", using built-in fallback`)
    content = FALLBACK_WORDS.join('\n')
  }

  const words = content
    .split(/\r?\n/)
    .flatMap((line) => line.trim().split(/\s+/))
    .map((w) => w.toUpperCase())
    .filter((w) => w.length >= 3 && /^[A-Z]+$/.test(w))

  console.log(`[dictionary] Loaded ${words.length} words from "${name}.txt" into Trie`)
  const trie = Trie.fromWords(words)
  trieCache.set(name, trie)
  return trie
}

/** Remove a specific dictionary from the cache (e.g. after the user switches). */
export function clearDictionaryCache(name?: string): void {
  if (name) {
    trieCache.delete(name)
  } else {
    trieCache.clear()
  }
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
