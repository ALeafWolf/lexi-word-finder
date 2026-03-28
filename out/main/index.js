"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const tesseract_js = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");
let workerInstance = null;
async function initOcrWorker() {
  if (workerInstance) return;
  const cachePath = path.join(electron.app.getPath("userData"), "tessdata");
  workerInstance = await tesseract_js.createWorker("eng", tesseract_js.OEM.LSTM_ONLY, {
    cachePath,
    logger: (m) => {
      if (m.status === "recognizing text") return;
      console.log(`[ocr] ${m.status} ${Math.round((m.progress ?? 0) * 100)}%`);
    }
  });
  await workerInstance.setParameters({
    // Uppercase letters only — no digits or punctuation
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    // SINGLE_WORD is more robust than SINGLE_CHAR for real-world game tile images
    tessedit_pageseg_mode: tesseract_js.PSM.SINGLE_WORD
  });
  console.log("[ocr] Tesseract worker ready");
}
async function terminateOcrWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}
async function preprocessCell(cellBuffer) {
  return sharp(cellBuffer).resize(200, 200, { fit: "contain", background: { r: 255, g: 255, b: 255 }, kernel: "lanczos3" }).greyscale().normalise().threshold(128).extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 255, g: 255, b: 255 } }).png().toBuffer();
}
async function splitIntoCells(pngBuffer, rows, cols, borderTrimPct = 0.08) {
  const meta = await sharp(pngBuffer).metadata();
  const imgW = meta.width;
  const imgH = meta.height;
  const cellW = Math.floor(imgW / cols);
  const cellH = Math.floor(imgH / rows);
  const trimX = Math.floor(cellW * borderTrimPct);
  const trimY = Math.floor(cellH * borderTrimPct);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const left = c * cellW + trimX;
      const top = r * cellH + trimY;
      const width = cellW - 2 * trimX;
      const height = cellH - 2 * trimY;
      const cellBuf = await sharp(pngBuffer).extract({ left, top, width, height }).png().toBuffer();
      row.push(cellBuf);
    }
    cells.push(row);
  }
  return cells;
}
function normalizeChar(raw) {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
  const corrections = {
    "0": "O",
    "1": "I",
    "L": "L"
    // already correct
  };
  if (cleaned.length === 0) return "?";
  if (cleaned === "QU" || cleaned === "Q") return "QU";
  const first = cleaned[0];
  return corrections[first] ?? first;
}
async function recognizeGrid(pngBuffer, rows = 4, cols = 4) {
  if (!workerInstance) {
    throw new Error("OCR worker not initialized. Call initOcrWorker() at startup.");
  }
  const cells = await splitIntoCells(pngBuffer, rows, cols);
  const rawCells = [];
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const rawRow = [];
    const gridRow = [];
    for (let c = 0; c < cols; c++) {
      const preprocessed = await preprocessCell(cells[r][c]);
      const {
        data: { text }
      } = await workerInstance.recognize(preprocessed);
      const raw = text.trim();
      const normalized = normalizeChar(raw);
      rawRow.push(raw);
      gridRow.push(normalized);
    }
    rawCells.push(rawRow);
    grid.push(gridRow);
  }
  console.log("[ocr] Recognized grid:", grid);
  return { grid, rawCells };
}
async function captureRegion(region) {
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { scaleFactor } = primaryDisplay;
  const { width: screenW, height: screenH } = primaryDisplay.size;
  const sources = await electron.desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(screenW * scaleFactor),
      height: Math.round(screenH * scaleFactor)
    }
  });
  const primarySource = sources[0];
  if (!primarySource) {
    throw new Error("No screen source found for capture");
  }
  const fullImage = primarySource.thumbnail;
  const cropRect = {
    x: Math.round(region.x * scaleFactor),
    y: Math.round(region.y * scaleFactor),
    width: Math.round(region.width * scaleFactor),
    height: Math.round(region.height * scaleFactor)
  };
  const cropped = fullImage.crop(cropRect);
  const logicalSize = { width: region.width, height: region.height };
  const resized = electron.nativeImage.createFromBuffer(
    cropped.resize(logicalSize).toPNG()
  );
  const pngBuffer = resized.toPNG();
  console.log(`[capture] Captured ${region.width}x${region.height} region (${pngBuffer.length} bytes)`);
  return pngBuffer;
}
async function savePngToDisk(buffer, filepath) {
  const { writeFile } = await import("fs/promises");
  await writeFile(filepath, buffer);
  console.log(`[capture] Saved PNG to ${filepath}`);
}
class Trie {
  root = { children: {}, isEnd: false };
  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) {
        node.children[ch] = { children: {}, isEnd: false };
      }
      node = node.children[ch];
    }
    node.isEnd = true;
  }
  /**
   * Returns the TrieNode at the end of the given prefix, or null if the
   * prefix does not exist. Used by the solver to walk the trie incrementally.
   */
  getNode(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch]) return null;
      node = node.children[ch];
    }
    return node;
  }
  hasPrefix(prefix) {
    return this.getNode(prefix) !== null;
  }
  hasWord(word) {
    const node = this.getNode(word);
    return node !== null && node.isEnd;
  }
  /** Build a Trie from an array of words (already uppercased). */
  static fromWords(words) {
    const trie = new Trie();
    for (const word of words) {
      trie.insert(word);
    }
    return trie;
  }
}
const trieCache = /* @__PURE__ */ new Map();
function getResourcesPath() {
  if (typeof process !== "undefined" && process.resourcesPath) {
    try {
      const { app } = require("electron");
      return app.isPackaged ? process.resourcesPath : path.join(process.cwd(), "resources");
    } catch {
    }
  }
  return path.join(process.cwd(), "resources");
}
function listDictionaries() {
  try {
    const dir = getResourcesPath();
    return fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4)).sort();
  } catch {
    return ["wordlist"];
  }
}
function getDictionary(name = "wordlist") {
  const cached = trieCache.get(name);
  if (cached) return cached;
  const filePath = path.join(getResourcesPath(), `${name}.txt`);
  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    console.warn(`[dictionary] Could not load "${name}.txt", using built-in fallback`);
    content = FALLBACK_WORDS.join("\n");
  }
  const words = content.split(/\r?\n/).flatMap((line) => line.trim().split(/\s+/)).map((w) => w.toUpperCase()).filter((w) => w.length >= 3 && /^[A-Z]+$/.test(w));
  console.log(`[dictionary] Loaded ${words.length} words from "${name}.txt" into Trie`);
  const trie = Trie.fromWords(words);
  trieCache.set(name, trie);
  return trie;
}
const FALLBACK_WORDS = [
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "had",
  "his",
  "him",
  "has",
  "how",
  "man",
  "old",
  "tap",
  "tape",
  "taps",
  "ape",
  "apes",
  "pear",
  "reap",
  "rape",
  "raped",
  "ore",
  "ores",
  "rend",
  "rends",
  "send",
  "sends",
  "hone",
  "horn",
  "horde",
  "hop",
  "hops",
  "hero",
  "heroes",
  "hen",
  "hens",
  "end",
  "ends",
  "den",
  "lump",
  "lumps",
  "mule",
  "pun",
  "puns",
  "mud",
  "pum",
  "sum",
  "sun",
  "nun",
  "pea",
  "peas",
  "pen",
  "pens",
  "per",
  "nor",
  "node",
  "nod",
  "nods",
  "ship",
  "tip",
  "tips",
  "top",
  "tops",
  "pot",
  "pots",
  "pie",
  "pie",
  "eat",
  "eats",
  "ear",
  "ears",
  "era",
  "eras",
  "err",
  "errs"
];
const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
];
function solve(grid, trie, minLength = 3) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const found = /* @__PURE__ */ new Map();
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  function dfs(r, c, currentWord, currentPath, trieNode) {
    const cellValue = grid[r][c];
    const newWord = currentWord + cellValue;
    let node = trieNode;
    for (const ch of cellValue) {
      const next = node.children[ch];
      if (!next) return;
      node = next;
    }
    if (newWord.length >= minLength && node.isEnd) {
      if (!found.has(newWord)) {
        found.set(newWord, { word: newWord, path: [...currentPath, [r, c]] });
      }
    }
    visited[r][c] = true;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, newWord, [...currentPath, [r, c]], node);
      }
    }
    visited[r][c] = false;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dfs(r, c, "", [], trie.root);
    }
  }
  return Array.from(found.values()).sort((a, b) => {
    if (b.word.length !== a.word.length) return b.word.length - a.word.length;
    return a.word.localeCompare(b.word);
  });
}
async function scanAndSolve(region, gridRows2 = 4, gridCols2 = 4, debugSave = false, dictionary = "wordlist") {
  const total = Date.now();
  const t0 = Date.now();
  const pngBuffer = await captureRegion(region);
  const captureMs = Date.now() - t0;
  if (debugSave) {
    const debugPath = path.join(electron.app.getPath("temp"), "lexi-capture-debug.png");
    await savePngToDisk(pngBuffer, debugPath);
  }
  const t1 = Date.now();
  const { grid } = await recognizeGrid(pngBuffer, gridRows2, gridCols2);
  const ocrMs = Date.now() - t1;
  const t2 = Date.now();
  const trie = getDictionary(dictionary);
  const words = solve(grid, trie);
  const solveMs = Date.now() - t2;
  const elapsedMs = Date.now() - total;
  console.log(
    `[pipeline] Done in ${elapsedMs}ms (capture: ${captureMs}ms, ocr: ${ocrMs}ms, solve: ${solveMs}ms). Found ${words.length} words`
  );
  return { grid, words, elapsedMs, captureMs, ocrMs, solveMs };
}
const DEFAULT_SETTINGS = {
  lastRegion: null,
  gridRows: 4,
  gridCols: 4,
  dictionary: "wordlist"
};
function getSettingsPath() {
  const dir = electron.app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "settings.json");
}
function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.warn("[settings] Failed to save:", err);
  }
}
function createTrayIcon() {
  const size = 16;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const isInner = x >= 5 && x <= 10 && y >= 5 && y <= 10;
      if (isInner) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        data[i] = 124;
        data[i + 1] = 106;
        data[i + 2] = 247;
        data[i + 3] = 255;
      }
    }
  }
  return electron.nativeImage.createFromBuffer(data, { width: size, height: size });
}
function createTray(onScan, onSelectRegion, onShowMain) {
  const icon = createTrayIcon();
  const tray = new electron.Tray(icon);
  tray.setToolTip("Lexi Word Finder");
  const updateMenu = () => {
    const menu = electron.Menu.buildFromTemplate([
      {
        label: "Lexi Word Finder",
        enabled: false
      },
      { type: "separator" },
      {
        label: "Show Window",
        click: onShowMain
      },
      {
        label: "Select Region",
        click: onSelectRegion
      },
      {
        label: "Scan Now (Ctrl+Shift+S)",
        click: onScan
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => electron.app.quit()
      }
    ]);
    tray.setContextMenu(menu);
  };
  updateMenu();
  tray.on("click", onShowMain);
  return tray;
}
let mainWindow = null;
let selectorWindow = null;
let resultsWindow = null;
let savedRegion = null;
let gridRows = 4;
let gridCols = 4;
let currentDictionary = "wordlist";
function createMainWindow() {
  const win = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  win.on("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return win;
}
function createSelectorWindow() {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  const win = new electron.BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  win.setIgnoreMouseEvents(false);
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/selector.html`);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/selector.html"));
  }
  return win;
}
function createResultsWindow() {
  const win = new electron.BrowserWindow({
    width: 264,
    height: 600,
    x: 20,
    y: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/results.html`);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/results.html"));
  }
  win.on("closed", () => {
    resultsWindow = null;
  });
  return win;
}
function registerIpc() {
  electron.ipcMain.handle("region:start", () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.focus();
      return;
    }
    selectorWindow = createSelectorWindow();
  });
  electron.ipcMain.on("region:confirm", (_event, region) => {
    savedRegion = region;
    saveSettings({ lastRegion: region, gridRows, gridCols, dictionary: currentDictionary });
    console.log("[main] Region selected:", region);
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.close();
      selectorWindow = null;
    }
    mainWindow?.webContents.send("region:selected", region);
  });
  electron.ipcMain.on("region:cancel", () => {
    if (selectorWindow && !selectorWindow.isDestroyed()) {
      selectorWindow.close();
      selectorWindow = null;
    }
  });
  electron.ipcMain.handle("scan:trigger", async () => {
    if (!savedRegion) {
      broadcastScanError("No region selected. Please select a region first.");
      return;
    }
    try {
      const result = await scanAndSolve(savedRegion, gridRows, gridCols, true, currentDictionary);
      broadcastScanResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[main] Scan failed:", err);
      broadcastScanError(`Scan failed: ${msg}`);
    }
  });
  electron.ipcMain.handle("settings:setGridSize", (_event, rows, cols) => {
    gridRows = rows;
    gridCols = cols;
    saveSettings({ lastRegion: savedRegion, gridRows, gridCols, dictionary: currentDictionary });
  });
  electron.ipcMain.handle("dictionary:list", () => {
    return { items: listDictionaries(), current: currentDictionary };
  });
  electron.ipcMain.handle("dictionary:set", (_event, name) => {
    currentDictionary = name;
    saveSettings({ lastRegion: savedRegion, gridRows, gridCols, dictionary: currentDictionary });
  });
  electron.ipcMain.on("results:close", () => {
    if (resultsWindow && !resultsWindow.isDestroyed()) {
      resultsWindow.close();
      resultsWindow = null;
    }
  });
  electron.ipcMain.on("results:clickthrough", (_event, enabled) => {
    if (resultsWindow && !resultsWindow.isDestroyed()) {
      resultsWindow.setIgnoreMouseEvents(enabled, { forward: true });
    }
  });
}
function broadcastScanResult(result) {
  mainWindow?.webContents.send("scan:result", result);
  if (!resultsWindow || resultsWindow.isDestroyed()) {
    resultsWindow = createResultsWindow();
    resultsWindow.webContents.once("did-finish-load", () => {
      resultsWindow?.webContents.send("scan:result", result);
    });
  } else {
    resultsWindow.webContents.send("scan:result", result);
    resultsWindow.show();
    resultsWindow.focus();
  }
}
function broadcastScanError(msg) {
  mainWindow?.webContents.send("scan:error", msg);
  resultsWindow?.webContents.send("scan:error", msg);
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.lexi-word-finder");
  const settings = loadSettings();
  savedRegion = settings.lastRegion;
  gridRows = settings.gridRows;
  gridCols = settings.gridCols;
  currentDictionary = settings.dictionary;
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  registerIpc();
  mainWindow = createMainWindow();
  if (savedRegion) {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send("region:selected", savedRegion);
    });
  }
  createTray(
    // onScan
    () => {
      if (!savedRegion) return;
      scanAndSolve(savedRegion, gridRows, gridCols, false, currentDictionary).then(broadcastScanResult).catch((err) => broadcastScanError(err instanceof Error ? err.message : String(err)));
    },
    // onSelectRegion
    () => {
      if (!selectorWindow || selectorWindow.isDestroyed()) {
        selectorWindow = createSelectorWindow();
      } else {
        selectorWindow.focus();
      }
    },
    // onShowMain
    () => {
      mainWindow?.show();
      mainWindow?.focus();
    }
  );
  initOcrWorker().catch(
    (err) => console.error("[main] Failed to init OCR worker:", err)
  );
  electron.globalShortcut.register("CommandOrControl+Shift+S", () => {
    if (!savedRegion) {
      broadcastScanError("No region selected. Please select a region first.");
      return;
    }
    scanAndSolve(savedRegion, gridRows, gridCols, true, currentDictionary).then(broadcastScanResult).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      broadcastScanError(`Scan failed: ${msg}`);
    });
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  electron.globalShortcut.unregisterAll();
  terminateOcrWorker().finally(() => {
    if (process.platform !== "darwin") electron.app.quit();
  });
});
