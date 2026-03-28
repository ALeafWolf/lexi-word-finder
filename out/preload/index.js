"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  regionStart: "region:start",
  regionConfirm: "region:confirm",
  regionCancel: "region:cancel",
  regionSelected: "region:selected",
  scanTrigger: "scan:trigger",
  scanResult: "scan:result",
  scanError: "scan:error",
  settingsGetGridSize: "settings:getGridSize",
  settingsSetGridSize: "settings:setGridSize",
  dictionaryList: "dictionary:list",
  dictionarySet: "dictionary:set",
  gridSolve: "grid:solve",
  mainClose: "main:close",
  mainSetAlwaysOnTop: "main:setAlwaysOnTop",
  mainGetAlwaysOnTop: "main:getAlwaysOnTop"
};
const api = {
  // --- Region selection (used by selector window) ---
  confirmRegionSelect: (region) => electron.ipcRenderer.send(IPC_CHANNELS.regionConfirm, region),
  cancelRegionSelect: () => electron.ipcRenderer.send(IPC_CHANNELS.regionCancel),
  // --- Main window actions ---
  startRegionSelect: () => electron.ipcRenderer.invoke(IPC_CHANNELS.regionStart),
  onRegionSelected: (callback) => {
    const handler = (_event, region) => callback(region);
    electron.ipcRenderer.on(IPC_CHANNELS.regionSelected, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.regionSelected, handler);
  },
  // --- Scan trigger ---
  triggerScan: () => electron.ipcRenderer.invoke(IPC_CHANNELS.scanTrigger),
  getGridSize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.settingsGetGridSize),
  setGridSize: (rows, cols) => electron.ipcRenderer.invoke(IPC_CHANNELS.settingsSetGridSize, rows, cols),
  onScanResult: (callback) => {
    const handler = (_event, result) => callback(result);
    electron.ipcRenderer.on(IPC_CHANNELS.scanResult, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.scanResult, handler);
  },
  onScanError: (callback) => {
    const handler = (_event, error) => callback(error);
    electron.ipcRenderer.on(IPC_CHANNELS.scanError, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.scanError, handler);
  },
  // --- Main window toolbar controls ---
  closeMainWindow: () => electron.ipcRenderer.send(IPC_CHANNELS.mainClose),
  setMainAlwaysOnTop: (enabled) => electron.ipcRenderer.invoke(IPC_CHANNELS.mainSetAlwaysOnTop, enabled),
  getMainAlwaysOnTop: () => electron.ipcRenderer.invoke(IPC_CHANNELS.mainGetAlwaysOnTop),
  // --- Dictionary selection ---
  listDictionaries: () => electron.ipcRenderer.invoke(IPC_CHANNELS.dictionaryList),
  setDictionary: (name) => electron.ipcRenderer.invoke(IPC_CHANNELS.dictionarySet, name),
  // --- Grid editing ---
  solveGrid: (grid) => electron.ipcRenderer.invoke(IPC_CHANNELS.gridSolve, grid)
};
electron.contextBridge.exposeInMainWorld("api", api);
