import type { LexiApi } from '../../preload/index'

declare global {
  interface Window {
    api: LexiApi
  }
}
