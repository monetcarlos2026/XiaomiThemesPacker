import { contextBridge, ipcRenderer } from "electron";
import type { LogEntry, PreviewDocument, PreviewMode, ProgressPayload, ThemePreference, UpdateInfo, UpdateProgress } from "./types";

const api = {
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:maximize-toggle"),
    close: () => ipcRenderer.invoke("window:close")
  },
  settings: {
    getTheme: () => ipcRenderer.invoke("settings:get-theme") as Promise<ThemePreference>,
    setTheme: (mode: ThemePreference["mode"]) => ipcRenderer.invoke("settings:set-theme", mode) as Promise<ThemePreference>
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke("dialog:select-folder"),
    selectMtz: () => ipcRenderer.invoke("dialog:select-mtz")
  },
  device: {
    getStatus: () => ipcRenderer.invoke("device:get-status")
  },
  operations: {
    pack: (sourceDir: string) => ipcRenderer.invoke("operation:pack", { sourceDir }),
    unpack: (mtzPath: string) => ipcRenderer.invoke("operation:unpack", { mtzPath }),
    deploy: (mtzPath?: string) => ipcRenderer.invoke("operation:deploy", mtzPath),
    exportLogs: (logs: LogEntry[]) => ipcRenderer.invoke("operation:export-logs", logs),
    cleanupCache: () => ipcRenderer.invoke("operation:cleanup-cache"),
    restartAdb: () => ipcRenderer.invoke("operation:restart-adb"),
    copyPackage: () => ipcRenderer.invoke("operation:copy-package"),
    convertMaml: (xml: string) => ipcRenderer.invoke("operation:convert-maml", xml),
    openPath: (targetPath: string) => ipcRenderer.invoke("app:open-path", targetPath)
  },
  preview: {
    loadFolder: () => ipcRenderer.invoke("preview:load-folder"),
    loadMtz: () => ipcRenderer.invoke("preview:load-mtz"),
    refresh: (mode?: PreviewMode) => ipcRenderer.invoke("preview:refresh", mode),
    exportScreenshot: (dataUrl: string) => ipcRenderer.invoke("preview:export-screenshot", dataUrl),
    watchStart: () => ipcRenderer.invoke("preview:watch-start"),
    watchStop: () => ipcRenderer.invoke("preview:watch-stop")
  },
  updates: {
    check: () => ipcRenderer.invoke("updates:check") as Promise<UpdateInfo>,
    openDownload: (url?: string) => ipcRenderer.invoke("updates:open-download", url),
    downloadAndInstall: (url: string, version?: string) => ipcRenderer.invoke("updates:download-and-install", url, version)
  },
  events: {
    onLog: (callback: (entry: LogEntry) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry);
      ipcRenderer.on("log:entry", listener);
      return () => ipcRenderer.off("log:entry", listener);
    },
    onProgress: (callback: (payload: ProgressPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ProgressPayload) => callback(payload);
      ipcRenderer.on("operation:progress", listener);
      return () => ipcRenderer.off("operation:progress", listener);
    },
    onPreviewChanged: (callback: (document: PreviewDocument) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, document: PreviewDocument) => callback(document);
      ipcRenderer.on("preview:changed", listener);
      return () => ipcRenderer.off("preview:changed", listener);
    },
    onUpdateProgress: (callback: (payload: UpdateProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: UpdateProgress) => callback(payload);
      ipcRenderer.on("updates:progress", listener);
      return () => ipcRenderer.off("updates:progress", listener);
    }
  }
};

contextBridge.exposeInMainWorld("xiaomiThemePacker", api);

export type XiaomiThemePackerApi = typeof api;
