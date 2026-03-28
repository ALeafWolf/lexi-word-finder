# Lexi Word Finder

`lexi-word-finder` — packaged as **Lexi Word Finder** for installers.

## Main functionality

Lexi Word Finder is a **desktop Electron app** that helps with letter-grid word games (e.g. Bookworm Adventures, Boggle-style boards):

1. **Region selection** — You draw a rectangle over the game grid on screen. The capture area and grid size (rows × columns) are remembered between sessions.
2. **Capture and OCR** — The app screenshots that region, then uses **Tesseract.js** to read letters per cell into a 2D grid. **QU** is treated as a single tile where applicable.
3. **Word search** — A **trie-backed solver** walks the grid in eight directions (no reusing a cell in one word), matches against `resources/wordlist.txt`, and collects valid words (minimum length 3), sorted by length then alphabetically.
4. **Triggers** — Scan from the main window, the **system tray**, or the global shortcut **Ctrl+Shift+S** (Cmd+Shift+S on macOS). Results appear in a small **always-on-top overlay**; you can toggle click-through so it does not block the game.

Debug builds can optionally save the last capture to a temp PNG to verify cropping.

## Tech stack

| Area | Choice |
|------|--------|
| Desktop shell | [Electron](https://www.electronjs.org/) |
| Build / dev | [electron-vite](https://electron-vite.org/), [Vite](https://vitejs.dev/) |
| UI | [React](https://react.dev/) 18 |
| Language | TypeScript |
| Screen capture / image | [sharp](https://sharp.pixelplumbing.com/) |
| OCR | [tesseract.js](https://github.com/naptha/tesseract.js) |
| Tests | [Vitest](https://vitest.dev/) |
| Packaging | [electron-builder](https://www.electron.build/) (Windows NSIS, macOS DMG) |
| Utilities | [@electron-toolkit/utils](https://github.com/alex8088/electron-toolkit) |

**Common commands**

- `npm run dev` — development with hot reload  
- `npm run build` — compile to `out/`  
- `npm test` — run unit tests  
- `npm run package` / `npm run package:win` — production build and installer  

## Walk through project structure

```
lexi-word-finder/
├── electron.vite.config.ts   # Vite + Electron main/preload/renderer entries
├── package.json              # Scripts, electron-builder app metadata
├── resources/                 # Bundled assets (word list, icons); copied to app resources when packaged
│   └── wordlist.txt          # One word per line; drives the dictionary trie
├── src/
│   ├── main/                  # Electron main process (Node)
│   │   ├── index.ts          # App lifecycle, windows, IPC, shortcuts, tray wiring
│   │   ├── capture.ts        # Screen region → image buffer (sharp)
│   │   ├── ocr.ts            # Image → grid of letters (Tesseract worker)
│   │   ├── pipeline.ts       # capture → OCR → solve; timings + optional debug PNG
│   │   ├── settings.ts       # Persisted region + grid dimensions
│   │   ├── tray.ts           # System tray menu and actions
│   │   └── solver/           # Dictionary trie, DFS solver, tests
│   │       ├── dictionary.ts # Loads wordlist.txt (or fallback) into a trie
│   │       ├── trie.ts
│   │       ├── solver.ts
│   │       └── solver.test.ts
│   ├── preload/               # Context-isolated bridge: exposes safe APIs to renderer
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── renderer/              # React front-end; multiple HTML entry points
│   │   ├── index.html         # Main settings / control window
│   │   ├── selector.html      # Full-screen transparent overlay for region drag-select
│   │   ├── results.html       # Floating results overlay
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── RegionSelector.tsx
│   │       ├── ResultsOverlay.tsx
│   │       ├── main.tsx, selector.tsx, results.tsx  # Entry mounts per page
│   │       └── types.ts
│   └── shared/types.ts        # Types shared where useful across layers
└── out/                       # Build output (produced by `npm run build`; not source)
```

The **main** process owns privileged work (screen capture, filesystem, global shortcuts, tray). The **preload** script defines the IPC surface the **renderer** may call. Three renderer bundles correspond to the main window, the region selector overlay, and the results overlay.
