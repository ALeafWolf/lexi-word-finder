/**
 * Trie node for O(prefix-length) prefix lookups during DFS pruning.
 * Uses a plain object map instead of a class per-node to minimize GC pressure.
 */
export interface TrieNode {
  children: Record<string, TrieNode>
  isEnd: boolean
}

export class Trie {
  readonly root: TrieNode = { children: {}, isEnd: false }

  insert(word: string): void {
    let node = this.root
    for (const ch of word) {
      if (!node.children[ch]) {
        node.children[ch] = { children: {}, isEnd: false }
      }
      node = node.children[ch]
    }
    node.isEnd = true
  }

  /**
   * Returns the TrieNode at the end of the given prefix, or null if the
   * prefix does not exist. Used by the solver to walk the trie incrementally.
   */
  getNode(prefix: string): TrieNode | null {
    let node = this.root
    for (const ch of prefix) {
      if (!node.children[ch]) return null
      node = node.children[ch]
    }
    return node
  }

  hasPrefix(prefix: string): boolean {
    return this.getNode(prefix) !== null
  }

  hasWord(word: string): boolean {
    const node = this.getNode(word)
    return node !== null && node.isEnd
  }

  /** Build a Trie from an array of words (already uppercased). */
  static fromWords(words: string[]): Trie {
    const trie = new Trie()
    for (const word of words) {
      trie.insert(word)
    }
    return trie
  }
}
