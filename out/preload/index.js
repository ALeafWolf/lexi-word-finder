"use strict";
const electron = require("electron");
const api = {
  // --- Region selection (used by selector window) ---
  confirmRegionSelect: (region) => electron.ipcRenderer.send("region:confirm", region),
  cancelRegionSelect: () => electron.ipcRenderer.send("region:cancel"),
  // --- Main window actions ---
  startRegionSelect: () => electron.ipcRenderer.invoke("region:start"),
  onRegionSelected: (callback) => {
    const handler = (_event, region) => callback(region);
    electron.ipcRenderer.on("region:selected", handler);
    return () => electron.ipcRenderer.removeListener("region:selected", handler);
  },
  // --- Scan trigger ---
  triggerScan: () => electron.ipcRenderer.invoke("scan:trigger"),
  setGridSize: (rows, cols) => electron.ipcRenderer.invoke("settings:setGridSize", rows, cols),
  onScanResult: (callback) => {
    const handler = (_event, result) => callback(result);
    electron.ipcRenderer.on("scan:result", handler);
    return () => electron.ipcRenderer.removeListener("scan:result", handler);
  },
  onScanError: (callback) => {
    const handler = (_event, error) => callback(error);
    electron.ipcRenderer.on("scan:error", handler);
    return () => electron.ipcRenderer.removeListener("scan:error", handler);
  },
  // --- Results overlay controls ---
  closeResultsOverlay: () => electron.ipcRenderer.send("results:close"),
  setClickThrough: (enabled) => electron.ipcRenderer.send("results:clickthrough", enabled),
  rescanFromOverlay: () => electron.ipcRenderer.invoke("scan:trigger"),
  // --- Dictionary selection ---
  listDictionaries: () => electron.ipcRenderer.invoke("dictionary:list"),
  setDictionary: (name) => electron.ipcRenderer.invoke("dictionary:set", name)
};
electron.contextBridge.exposeInMainWorld("api", api);
