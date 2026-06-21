import { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme, clipboard, screen } from "electron";
import windowStateKeeper from "electron-window-state";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { zipSync, unzipSync } from "fflate";
import type { DeviceStatus, LogEntry, LogLevel, OperationResult, PackRequest, PreviewDocument, PreviewLoadResult, PreviewLog, PreviewMode, PreviewSource, PreviewSurface, ProgressPayload, RenderedNode, ThemePreference, UnpackRequest, UpdateInfo, UpdateProgress } from "./types";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 500;
const UPDATE_CHECK_URL =
  process.env.XIAOMI_THEME_PACKER_UPDATE_URL ||
  "https://example.com/xiaomi-theme-packer/latest.json";
const APP_ICON_PATH = isDev
  ? path.join(process.cwd(), "build", "icon.png")
  : path.join(process.resourcesPath, "build", "icon.png");
let mainWindow: BrowserWindow | null = null;
let currentThemeMode: ThemePreference["mode"] = "system";
let normalWindowBounds: { x: number; y: number; width: number; height: number } | null = null;
let manuallyMaximized = false;
let devLogPath = "";
let previewSource: PreviewSource | null = null;
let previewMtzEntries: Record<string, Uint8Array> | null = null;
let previewWatcher: fs.FSWatcher | null = null;
let previewWatchTimer: NodeJS.Timeout | null = null;

const PREVIEW_WIDTH = 1080;
const PREVIEW_HEIGHT = 2400;
const previewManifestCandidates: Record<PreviewMode, string[]> = {
  lockscreen: ["lockscreen/advance/manifest.xml", "lockscreen/manifest.xml"],
  home: ["miwallpaper/manifest.xml", "wallpaper/manifest.xml", "home/manifest.xml", "launcher/manifest.xml"],
  aod: ["aod/manifest.xml", "aod/advance/manifest.xml", "alwayson/manifest.xml"]
};

if (isDev) {
  const runtimeRoot = path.join(process.cwd(), ".runtime");
  const userDataPath = path.join(runtimeRoot, "userData");
  const sessionDataPath = path.join(runtimeRoot, "sessionData");
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(sessionDataPath, { recursive: true });
  app.setPath("userData", userDataPath);
  app.setPath("sessionData", sessionDataPath);
  devLogPath = path.join(runtimeRoot, "main.log");
  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch("disable-features", "NetworkServiceSandbox");
}

app.commandLine.appendSwitch("disable-gpu");

function devLog(message: string) {
  if (!devLogPath) return;
  try {
    fs.appendFileSync(devLogPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // Logging must not prevent the app window from opening.
  }
}

function captureDevWindow(reason: string) {
  if (!devLogPath || !mainWindow || mainWindow.isDestroyed()) return;

  setTimeout(async () => {
    try {
      devLog(`window:capturePage:start reason=${reason}`);
      const image = await mainWindow?.capturePage();
      if (!image) {
        devLog(`window:capturePage:empty reason=${reason}`);
        return;
      }
      const screenshotPath = path.join(path.dirname(devLogPath), `window-${reason}.png`);
      fs.writeFileSync(screenshotPath, image.toPNG());
      devLog(`window:capturePage:ok reason=${reason} path=${screenshotPath} size=${image.getSize().width}x${image.getSize().height}`);
    } catch (error) {
      devLog(`window:capturePage:error reason=${reason} message=${error instanceof Error ? error.message : String(error)}`);
    }
  }, 1000);
}

function userSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): ThemePreference {
  try {
    const text = fs.readFileSync(userSettingsPath(), "utf8");
    const data = JSON.parse(text) as Partial<ThemePreference>;
    if (data.mode === "light" || data.mode === "dark" || data.mode === "system") {
      return { mode: data.mode };
    }
  } catch {
    // Default settings are used when the file does not exist or is invalid.
  }
  return { mode: "system" };
}

function writeSettings(settings: ThemePreference) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(userSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function applyTheme(mode: ThemePreference["mode"]) {
  currentThemeMode = mode;
  nativeTheme.themeSource = mode;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "").split(/[+-]/)[0];
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function readCurrentVersion() {
  return app.getVersion();
}

function isHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function emitUpdateProgress(payload: UpdateProgress) {
  mainWindow?.webContents.send("updates:progress", payload);
}

function getUpdateInstallerPath(version?: string) {
  const suffix = version ? normalizeVersion(version) : Date.now().toString();
  const updateDir = path.join(app.getPath("userData"), "updates");
  fs.mkdirSync(updateDir, { recursive: true });
  return path.join(updateDir, `Xiaomi-Theme-Packer-${suffix}.exe`);
}

async function downloadUpdateInstaller(url: string, version?: string) {
  if (!isHttpUrl(url)) throw new Error("Invalid update download URL.");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}.`);
  }

  const total = Number(response.headers.get("content-length") || 0) || undefined;
  const installerPath = getUpdateInstallerPath(version);
  const tempPath = `${installerPath}.download`;
  const reader = response.body.getReader();
  const output = fs.createWriteStream(tempPath);
  let transferred = 0;

  emitUpdateProgress({ percent: 0, transferred, total, message: "Downloading update..." });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      transferred += value.byteLength;
      output.write(Buffer.from(value));
      const percent = total ? Math.min(99, Math.round((transferred / total) * 100)) : 0;
      emitUpdateProgress({ percent, transferred, total, message: "Downloading update..." });
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      output.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  }

  fs.renameSync(tempPath, installerPath);
  emitUpdateProgress({ percent: 100, transferred, total, message: "Download complete. Starting installer..." });
  return installerPath;
}

async function downloadAndInstallUpdate(url: string, version?: string): Promise<OperationResult> {
  try {
    const installerPath = await downloadUpdateInstaller(url, version);
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });
    child.unref();
    setTimeout(() => app.quit(), 800);
    return { ok: true, message: "Update downloaded. Installer started.", path: installerPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitUpdateProgress({ percent: 0, transferred: 0, message });
    return { ok: false, message };
  }
}

async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = readCurrentVersion();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(UPDATE_CHECK_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      return {
        currentVersion,
        available: false,
        message: `Update check failed: HTTP ${response.status}.`
      };
    }

    const data = (await response.json()) as Partial<UpdateInfo> & { version?: string };
    const latestVersion = String(data.latestVersion || data.version || "").trim();
    if (!latestVersion) {
      return {
        currentVersion,
        available: false,
        message: "Update manifest is missing version."
      };
    }

    const available = compareVersions(latestVersion, currentVersion) > 0;
    return {
      currentVersion,
      latestVersion,
      available,
      message: available ? `New version ${latestVersion} is available.` : "Already on the latest version.",
      releaseUrl: isHttpUrl(data.releaseUrl) ? data.releaseUrl : undefined,
      downloadUrl: isHttpUrl(data.downloadUrl) ? data.downloadUrl : undefined,
      notes: typeof data.notes === "string" ? data.notes : undefined,
      publishedAt: typeof data.publishedAt === "string" ? data.publishedAt : undefined
    };
  } catch (error) {
    return {
      currentVersion,
      available: false,
      message: error instanceof Error ? `Update check failed: ${error.message}` : "Update check failed."
    };
  } finally {
    clearTimeout(timer);
  }
}

function emitLog(level: LogLevel, message: string) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString("en-GB", { hour12: false }) + `.${String(new Date().getMilliseconds()).padStart(3, "0")}`,
    level,
    message
  };
  mainWindow?.webContents.send("log:entry", entry);
}

function emitProgress(payload: ProgressPayload) {
  mainWindow?.webContents.send("operation:progress", payload);
}

function getWindowBounds(state: { x?: number; y?: number; width?: number; height?: number }) {
  const savedBounds = {
    x: state.x ?? 0,
    y: state.y ?? 0,
    width: state.width ?? DEFAULT_WIDTH,
    height: state.height ?? DEFAULT_HEIGHT
  };
  const display = screen.getDisplayMatching(savedBounds);
  const workArea = display.workArea;
  const width = Math.max(MIN_WIDTH, Math.min(savedBounds.width, workArea.width));
  const height = Math.max(MIN_HEIGHT, Math.min(savedBounds.height, workArea.height));
  const hasSavedPosition = typeof state.x === "number" && typeof state.y === "number";
  const x = hasSavedPosition
    ? Math.max(workArea.x, Math.min(savedBounds.x, workArea.x + workArea.width - width))
    : workArea.x + Math.round((workArea.width - width) / 2);
  const y = hasSavedPosition
    ? Math.max(workArea.y, Math.min(savedBounds.y, workArea.y + workArea.height - height))
    : workArea.y + Math.round((workArea.height - height) / 2);

  return { x, y, width, height, maxWidth: workArea.width, maxHeight: workArea.height };
}

function applyWindowSizeLimits(window: BrowserWindow) {
  const bounds = window.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  window.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
  window.setMaximumSize(workArea.width, workArea.height);
}

function createWindow() {
  if (!isDev) {
    const logDir = app.getPath("userData");
    fs.mkdirSync(logDir, { recursive: true });
    devLogPath = path.join(logDir, "main.log");
  }

  devLog("createWindow:start");
  const state = windowStateKeeper({
    defaultWidth: DEFAULT_WIDTH,
    defaultHeight: DEFAULT_HEIGHT
  });
  const bounds = getWindowBounds(state);
  devLog(`createWindow:bounds=${JSON.stringify(bounds)}`);

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    maxWidth: bounds.maxWidth,
    maxHeight: bounds.maxHeight,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    frame: false,
    transparent: isDev,
    backgroundColor: isDev ? "#00000000" : "#F6F7FB",
    icon: APP_ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  devLog("browserWindow:created");
  state.manage(mainWindow);
  applyWindowSizeLimits(mainWindow);

  mainWindow.on("moved", () => {
    if (mainWindow) {
      applyWindowSizeLimits(mainWindow);
    }
  });
  mainWindow.on("move", () => {
    if (mainWindow) {
      applyWindowSizeLimits(mainWindow);
    }
  });
  mainWindow.on("resize", () => {
    if (mainWindow) {
      applyWindowSizeLimits(mainWindow);
    }
  });
  screen.on("display-metrics-changed", () => {
    if (mainWindow) {
      applyWindowSizeLimits(mainWindow);
    }
  });

  mainWindow.once("ready-to-show", () => {
    devLog("window:ready-to-show");
    mainWindow?.show();
    captureDevWindow("ready-to-show");
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      devLog("window:show-fallback");
      mainWindow.show();
    }
  }, 1500);

  mainWindow.on("show", () => devLog("window:show"));
  mainWindow.on("hide", () => devLog("window:hide"));
  mainWindow.webContents.on("did-start-loading", () => devLog("webContents:did-start-loading"));
  mainWindow.webContents.on("did-finish-load", () => {
    devLog("webContents:did-finish-load");
    captureDevWindow("did-finish-load");
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    devLog(`webContents:console level=${level} source=${sourceId}:${line} message=${message}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    devLog(`webContents:did-fail-load code=${errorCode} description=${errorDescription} url=${validatedURL}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    devLog(`webContents:render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });

  if (isDev) {
    devLog(`loadURL:${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    const filePath = path.join(__dirname, "../dist/index.html");
    devLog(`loadFile:${filePath}`);
    mainWindow.loadFile(filePath);
  }

  mainWindow.on("closed", () => {
    devLog("window:closed");
    mainWindow = null;
  });
}

function walkFiles(root: string) {
  const files: string[] = [];
  const ignored = new Set([".git", ".svn", "__pycache__", ".DS_Store", "cache", "temp"]);

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ignored.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

function safeZipName(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function normalizeZipPath(input: string) {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}

function buildMtzBuffer(sourceDir: string, operation: "pack" | "unpack" = "pack") {
  const files = walkFiles(sourceDir);
  const zipped: Record<string, Uint8Array> = {};
  const total = Math.max(files.length, 1);

  files.forEach((filePath, index) => {
    const relative = safeZipName(path.relative(sourceDir, filePath));
    zipped[relative] = new Uint8Array(fs.readFileSync(filePath));
    emitProgress({ operation, percent: Math.min(95, Math.round(((index + 1) / total) * 95)) });
  });

  return zipSync(zipped, { level: 6 });
}

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

interface ThemeResourceProvider {
  source: PreviewSource;
  readText(relativePath: string): string | null;
  readImage(relativePath: string): string | null;
  exists(relativePath: string): boolean;
}

function makePreviewLog(logs: PreviewLog[], level: LogLevel, scope: PreviewLog["scope"], message: string) {
  const now = new Date();
  logs.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: now.toLocaleTimeString("en-GB", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`,
    level,
    scope,
    message
  });
}

function textFromBytes(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function dataUrlFromBytes(bytes: Uint8Array, filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/png";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function createFolderProvider(sourceDir: string): ThemeResourceProvider {
  const source = { kind: "folder" as const, path: sourceDir, label: path.basename(sourceDir) || sourceDir };
  const resolve = (relativePath: string) => path.join(sourceDir, ...normalizeZipPath(relativePath).split("/"));
  return {
    source,
    readText(relativePath) {
      const filePath = resolve(relativePath);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, "utf8");
    },
    readImage(relativePath) {
      const filePath = resolve(relativePath);
      if (!fs.existsSync(filePath)) return null;
      return dataUrlFromBytes(new Uint8Array(fs.readFileSync(filePath)), relativePath);
    },
    exists(relativePath) {
      return fs.existsSync(resolve(relativePath));
    }
  };
}

function createMtzProvider(mtzPath: string, entries: Record<string, Uint8Array>): ThemeResourceProvider {
  const source = { kind: "mtz" as const, path: mtzPath, label: path.basename(mtzPath) };
  const entryMap = new Map(Object.entries(entries).map(([name, bytes]) => [normalizeZipPath(name), bytes]));
  return {
    source,
    readText(relativePath) {
      const bytes = entryMap.get(normalizeZipPath(relativePath));
      return bytes ? textFromBytes(bytes) : null;
    },
    readImage(relativePath) {
      const normalized = normalizeZipPath(relativePath);
      const bytes = entryMap.get(normalized);
      return bytes ? dataUrlFromBytes(bytes, normalized) : null;
    },
    exists(relativePath) {
      return entryMap.has(normalizeZipPath(relativePath));
    }
  };
}

function readCurrentPreviewProvider(): ThemeResourceProvider | null {
  if (!previewSource) return null;
  if (previewSource.kind === "folder") {
    if (!fs.existsSync(previewSource.path)) return null;
    return createFolderProvider(previewSource.path);
  }
  if (!previewMtzEntries) return null;
  return createMtzProvider(previewSource.path, previewMtzEntries);
}

function findManifest(provider: ThemeResourceProvider, mode: PreviewMode) {
  return previewManifestCandidates[mode].find((candidate) => provider.exists(candidate));
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseTag(source: string) {
  const clean = source.trim().replace(/\/$/, "").trim();
  const nameMatch = clean.match(/^([^\s/>]+)/);
  if (!nameMatch) return null;
  const attrs: Record<string, string> = {};
  const attrText = clean.slice(nameMatch[0].length);
  const attrRegex = /([:\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(attrText))) {
    attrs[attrMatch[1]] = decodeXmlEntities(attrMatch[3] ?? attrMatch[4] ?? "");
  }
  return { tag: nameMatch[1], attrs };
}

function parseXmlTree(xml: string) {
  const cleaned = xml.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const root: XmlNode = { tag: "__root__", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const tokenRegex = /<!\[CDATA\[([\s\S]*?)\]\]>|<([^>]+)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(cleaned))) {
    const cdata = match[1];
    const tagContent = match[2];
    const text = match[3];
    if (cdata !== undefined) {
      stack[stack.length - 1].text += cdata;
      continue;
    }
    if (text !== undefined) {
      stack[stack.length - 1].text += decodeXmlEntities(text.trim());
      continue;
    }
    if (!tagContent || tagContent.startsWith("!")) continue;
    if (tagContent.startsWith("/")) {
      const closeName = tagContent.slice(1).trim();
      const node = stack.pop();
      if (!node || node.tag !== closeName) throw new Error(`Mismatched XML close tag: ${closeName}`);
      continue;
    }
    const parsed = parseTag(tagContent);
    if (!parsed) continue;
    const node: XmlNode = { tag: parsed.tag, attrs: parsed.attrs, children: [], text: "" };
    stack[stack.length - 1].children.push(node);
    if (!tagContent.endsWith("/")) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`Unclosed XML tag: ${stack[stack.length - 1].tag}`);
  const documentRoot = root.children[0];
  if (!documentRoot) throw new Error("XML root not found.");
  return documentRoot;
}

function collectVariables(root: XmlNode, logs: PreviewLog[]) {
  const variables: Record<string, number> = {
    screen_width: PREVIEW_WIDTH,
    screen_height: PREVIEW_HEIGHT,
    wallpaper_offset_x: 0,
    battery_level: 80,
    hour24: new Date().getHours(),
    minute: new Date().getMinutes()
  };
  const visit = (node: XmlNode) => {
    if (node.tag === "Variable" || node.tag === "Var") {
      const name = node.attrs.name;
      if (name) {
        const expression = node.attrs.expression || node.attrs.value || node.text || "0";
        variables[name] = evaluateMamlExpression(expression, variables, logs);
      }
    }
    node.children.forEach(visit);
  };
  visit(root);
  return variables;
}

type ExpressionToken =
  | { type: "number"; value: string }
  | { type: "identifier"; value: string }
  | { type: "variable"; value: string }
  | { type: "operator"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma"; value: "," }
  | { type: "eof"; value: "" };

function normalizeMamlComparisonOperators(input: string) {
  return input.replace(/\{/g, "<").replace(/\}/g, ">");
}

function tokenizeExpression(input: string) {
  const tokens: ExpressionToken[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/\d/.test(char) || (char === "." && /\d/.test(input[index + 1] || ""))) {
      const start = index;
      index += 1;
      while (index < input.length && /[\d.]/.test(input[index])) index += 1;
      tokens.push({ type: "number", value: input.slice(start, index) });
      continue;
    }
    if (char === "#") {
      const start = index + 1;
      index += 1;
      while (index < input.length && /[A-Za-z0-9_.]/.test(input[index])) index += 1;
      if (index === start) throw new Error("Variable name expected after #.");
      tokens.push({ type: "variable", value: input.slice(start, index) });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < input.length && /[A-Za-z0-9_]/.test(input[index])) index += 1;
      tokens.push({ type: "identifier", value: input.slice(start, index) });
      continue;
    }
    const pair = input.slice(index, index + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(pair)) {
      tokens.push({ type: "operator", value: pair });
      index += 2;
      continue;
    }
    if (["+", "-", "*", "/", "%", "<", ">", "!"].includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }
    throw new Error(`Unsupported character: ${char}`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function evaluateMamlFunction(name: string, args: number[]) {
  const first = args[0] ?? 0;
  const second = args[1] ?? 0;
  switch (name) {
    case "ifelse":
      return first ? second : args[2] ?? 0;
    case "min":
      return args.length ? Math.min(...args) : 0;
    case "max":
      return args.length ? Math.max(...args) : 0;
    case "abs":
      return Math.abs(first);
    case "int":
      return Math.trunc(first);
    case "floor":
      return Math.floor(first);
    case "ceil":
      return Math.ceil(first);
    case "round":
      return Math.round(first);
    case "ge":
      return first >= second ? 1 : 0;
    case "gt":
      return first > second ? 1 : 0;
    case "le":
      return first <= second ? 1 : 0;
    case "lt":
      return first < second ? 1 : 0;
    case "eq":
      return first === second ? 1 : 0;
    case "ne":
      return first !== second ? 1 : 0;
    default:
      throw new Error(`Unsupported function: ${name}`);
  }
}

function evaluateTokenizedExpression(tokens: ExpressionToken[], variables: Record<string, number>) {
  let index = 0;
  const peek = () => tokens[index] || tokens[tokens.length - 1];
  const consume = () => tokens[index++] || tokens[tokens.length - 1];
  const matchOperator = (...operators: string[]) => {
    const token = peek();
    if (token.type === "operator" && operators.includes(token.value)) {
      consume();
      return token.value;
    }
    return "";
  };
  const lookupVariable = (name: string) => Number(variables[name] ?? variables[name.replace(/\./g, "_")] ?? 0);

  const parsePrimary = (): number => {
    const token = consume();
    if (token.type === "number") {
      const numberValue = Number(token.value);
      if (!Number.isFinite(numberValue)) throw new Error(`Invalid number: ${token.value}`);
      return numberValue;
    }
    if (token.type === "variable") return lookupVariable(token.value);
    if (token.type === "identifier") {
      if (peek().type === "paren" && peek().value === "(") {
        consume();
        const args: number[] = [];
        if (!(peek().type === "paren" && peek().value === ")")) {
          do {
            args.push(parseOr());
            if (peek().type !== "comma") break;
            consume();
          } while (true);
        }
        if (!(peek().type === "paren" && peek().value === ")")) throw new Error(`Missing ) for ${token.value}.`);
        consume();
        return evaluateMamlFunction(token.value, args);
      }
      return lookupVariable(token.value);
    }
    if (token.type === "paren" && token.value === "(") {
      const value = parseOr();
      if (!(peek().type === "paren" && peek().value === ")")) throw new Error("Missing ).");
      consume();
      return value;
    }
    throw new Error(`Unexpected token: ${token.value || token.type}`);
  };

  const parseUnary = (): number => {
    if (matchOperator("+")) return parseUnary();
    if (matchOperator("-")) return -parseUnary();
    if (matchOperator("!")) return parseUnary() ? 0 : 1;
    return parsePrimary();
  };

  const parseMultiplicative = (): number => {
    let value = parseUnary();
    while (true) {
      const operator = matchOperator("*", "/", "%");
      if (!operator) return value;
      const right = parseUnary();
      if (operator === "*") value *= right;
      if (operator === "/") value = right === 0 ? 0 : value / right;
      if (operator === "%") value = right === 0 ? 0 : value % right;
    }
  };

  const parseAdditive = (): number => {
    let value = parseMultiplicative();
    while (true) {
      const operator = matchOperator("+", "-");
      if (!operator) return value;
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
    }
  };

  const parseComparison = (): number => {
    let value = parseAdditive();
    while (true) {
      const operator = matchOperator("<", "<=", ">", ">=");
      if (!operator) return value;
      const right = parseAdditive();
      if (operator === "<") value = value < right ? 1 : 0;
      if (operator === "<=") value = value <= right ? 1 : 0;
      if (operator === ">") value = value > right ? 1 : 0;
      if (operator === ">=") value = value >= right ? 1 : 0;
    }
  };

  const parseEquality = (): number => {
    let value = parseComparison();
    while (true) {
      const operator = matchOperator("==", "!=");
      if (!operator) return value;
      const right = parseComparison();
      value = operator === "==" ? (value === right ? 1 : 0) : value !== right ? 1 : 0;
    }
  };

  const parseAnd = (): number => {
    let value = parseEquality();
    while (matchOperator("&&")) value = value && parseEquality() ? 1 : 0;
    return value;
  };

  const parseOr = (): number => {
    let value = parseAnd();
    while (matchOperator("||")) value = value || parseAnd() ? 1 : 0;
    return value;
  };

  const value = parseOr();
  if (peek().type !== "eof") throw new Error(`Unexpected token: ${peek().value}`);
  return value;
}

function evaluateMamlExpression(rawValue: string | null, variables: Record<string, number>, logs: PreviewLog[]) {
  if (!rawValue) return 0;
  const value = rawValue.trim();
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  try {
    const normalized = normalizeMamlComparisonOperators(value);
    const result = evaluateTokenizedExpression(tokenizeExpression(normalized), variables);
    const numberResult = Number.isFinite(result) ? result : 0;
    makePreviewLog(logs, "DEBUG", "expression", `${value} = ${numberResult}`);
    return numberResult;
  } catch (error) {
    makePreviewLog(logs, "WARN", "expression", `${value}: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

function evaluateAttr(node: XmlNode, name: string, fallback: number, variables: Record<string, number>, logs: PreviewLog[]) {
  const value = node.attrs[name];
  if (value === undefined) return fallback;
  return evaluateMamlExpression(value, variables, logs);
}

function parseColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-f]{8}$/i.test(normalized)) return `#${normalized.slice(3)}`;
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  return fallback;
}

function formatDateTime(format: string | undefined) {
  const now = new Date();
  const pad = (input: number) => String(input).padStart(2, "0");
  if (!format) return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return format
    .replace(/HH/g, pad(now.getHours()))
    .replace(/H/g, String(now.getHours()))
    .replace(/mm/g, pad(now.getMinutes()))
    .replace(/m/g, String(now.getMinutes()))
    .replace(/ss/g, pad(now.getSeconds()))
    .replace(/yyyy/g, String(now.getFullYear()))
    .replace(/MM/g, pad(now.getMonth() + 1))
    .replace(/dd/g, pad(now.getDate()));
}

function splitExpressionList(input: string) {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      const item = input.slice(start, index).trim();
      if (item) items.push(item);
      start = index + 1;
    }
  }
  const last = input.slice(start).trim();
  if (last) items.push(last);
  return items;
}

function formatTextNode(node: XmlNode, variables: Record<string, number>, logs: PreviewLog[]) {
  if (node.attrs.text) return node.attrs.text;
  const format = node.attrs.format;
  if (!format) return node.text || "Text";
  const paras = splitExpressionList(node.attrs.paras || "");
  let index = 0;
  return format.replace(/%[dfs]/g, (placeholder) => {
    const expression = paras[index++];
    if (!expression) return placeholder;
    const value = evaluateMamlExpression(expression, variables, logs);
    if (placeholder.endsWith("d")) return String(Math.trunc(value));
    if (placeholder.endsWith("f")) return String(value);
    return String(value);
  });
}

function resolveImage(provider: ThemeResourceProvider, manifestPath: string, src: string | undefined, logs: PreviewLog[]) {
  if (!src) return "";
  const base = path.posix.dirname(normalizeZipPath(manifestPath));
  const extension = path.posix.extname(src) ? "" : ".png";
  const candidates = [
    normalizeZipPath(path.posix.join(base, src)),
    normalizeZipPath(path.posix.join(base, `${src}${extension}`)),
    normalizeZipPath(src),
    normalizeZipPath(`${src}${extension}`),
    normalizeZipPath(path.posix.join(base, "images", src)),
    normalizeZipPath(path.posix.join(base, "images", `${src}${extension}`)),
    normalizeZipPath(path.posix.join(base, "res", src)),
    normalizeZipPath(path.posix.join(base, "res", `${src}${extension}`)),
    normalizeZipPath(path.posix.join("preview", src))
  ];
  for (const candidate of Array.from(new Set(candidates))) {
    const data = provider.readImage(candidate);
    if (data) {
      makePreviewLog(logs, "INFO", "resource", `Loaded image: ${candidate}`);
      return data;
    }
  }
  makePreviewLog(logs, "WARN", "resource", `Missing image: ${src}`);
  return "";
}

function renderXmlNode(provider: ThemeResourceProvider, manifestPath: string, node: XmlNode, variables: Record<string, number>, logs: PreviewLog[], indexPath: string): RenderedNode | null {
  const tag = node.tag;
  if (["Variable", "Var", "Array", "ContentProviderBinder", "VariableBinder", "Trigger", "Button", "Unlocker", "VariableAnimation", "SourcesAnimation"].includes(tag)) {
    if (!["Variable", "Var", "Array"].includes(tag)) makePreviewLog(logs, "WARN", "render", `${tag} is not interactive in preview v1.`);
    return null;
  }

  const x = evaluateAttr(node, "x", 0, variables, logs);
  const y = evaluateAttr(node, "y", 0, variables, logs);
  const width = evaluateAttr(node, "w", evaluateAttr(node, "width", tag === "Text" || tag === "DateTime" ? 360 : 160, variables, logs), variables, logs);
  const height = evaluateAttr(node, "h", evaluateAttr(node, "height", tag === "Text" || tag === "DateTime" ? 72 : 160, variables, logs), variables, logs);
  const alpha = Math.max(0, Math.min(1, evaluateAttr(node, "alpha", 255, variables, logs) / 255));
  const visibility = evaluateAttr(node, "visibility", 1, variables, logs);
  if (visibility <= 0 || alpha <= 0) return null;
  const rotation = evaluateAttr(node, "rotation", 0, variables, logs);
  const id = `${tag}-${indexPath}-${node.attrs.name || node.attrs.id || ""}`;

  if (tag === "Group") {
    const children = node.children.map((child, index) => renderXmlNode(provider, manifestPath, child, variables, logs, `${indexPath}.${index}`)).filter((child): child is RenderedNode => Boolean(child));
    return { id, type: "group", tag, x, y, width, height, alpha, rotation, children };
  }

  if (tag === "Image") {
    const src = resolveImage(provider, manifestPath, node.attrs.src || node.attrs.srcid || node.attrs.srcExp, logs);
    return { id, type: src ? "image" : "placeholder", tag, x, y, width, height, alpha, rotation, src, text: src ? undefined : "Missing image" };
  }

  if (tag === "Text") {
    return {
      id,
      type: "text",
      tag,
      x,
      y,
      width,
      height,
      alpha,
      rotation,
      text: formatTextNode(node, variables, logs),
      color: parseColor(node.attrs.color, "#ffffff"),
      size: evaluateAttr(node, "size", 36, variables, logs),
      align: node.attrs.align || "left"
    };
  }

  if (tag === "DateTime" || tag === "Time") {
    return {
      id,
      type: "datetime",
      tag,
      x,
      y,
      width,
      height,
      alpha,
      rotation,
      text: formatDateTime(node.attrs.format),
      color: parseColor(node.attrs.color, "#ffffff"),
      size: evaluateAttr(node, "size", 52, variables, logs),
      align: node.attrs.align || "left"
    };
  }

  if (["Rectangle", "Rect", "Circle"].includes(tag)) {
    return {
      id,
      type: "shape",
      tag,
      x,
      y,
      width,
      height,
      alpha,
      rotation,
      fill: parseColor(node.attrs.fillColor || node.attrs.color, "rgba(255,255,255,0.16)"),
      stroke: parseColor(node.attrs.strokeColor, "rgba(255,255,255,0.32)")
    };
  }

  makePreviewLog(logs, "WARN", "render", `Unsupported tag rendered as placeholder: ${tag}`);
  return { id, type: "placeholder", tag, x, y, width, height, alpha: Math.max(0.45, alpha), text: tag };
}

function emptySurface(mode: PreviewMode, title: string, message: string, logs: PreviewLog[]): PreviewSurface {
  makePreviewLog(logs, "WARN", "parse", message);
  return {
    mode,
    title,
    available: false,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    background: mode === "aod" ? "#000000" : "#20242b",
    nodes: [{ id: `${mode}-placeholder`, type: "placeholder", tag: "Placeholder", x: 120, y: 980, width: 840, height: 220, alpha: 1, text: message }]
  };
}

function buildSurface(provider: ThemeResourceProvider, mode: PreviewMode, logs: PreviewLog[]): PreviewSurface {
  const title = mode === "lockscreen" ? "锁屏" : mode === "home" ? "桌面" : "AOD";
  const manifestPath = findManifest(provider, mode);
  if (!manifestPath) return emptySurface(mode, title, `${title} manifest not found.`, logs);

  try {
    const xml = provider.readText(manifestPath);
    if (!xml) return emptySurface(mode, title, `${title} manifest is empty: ${manifestPath}`, logs);
    const root = parseXmlTree(xml);
    makePreviewLog(logs, "INFO", "parse", `Parsed ${title}: ${manifestPath} <${root.tag}>`);
    const variables = collectVariables(root, logs);
    const nodes = root.children.map((child, index) => renderXmlNode(provider, manifestPath, child, variables, logs, `${index}`)).filter((child): child is RenderedNode => Boolean(child));
    return { mode, title, manifestPath, available: true, rootTag: root.tag, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, background: mode === "aod" ? "#000000" : "#111827", nodes };
  } catch (error) {
    return emptySurface(mode, title, `${title} parse failed: ${error instanceof Error ? error.message : String(error)}`, logs);
  }
}

function buildPreviewDocument(provider: ThemeResourceProvider, activeMode: PreviewMode = "lockscreen"): PreviewDocument {
  const logs: PreviewLog[] = [];
  return {
    source: provider.source,
    generatedAt: Date.now(),
    activeMode,
    surfaces: {
      lockscreen: buildSurface(provider, "lockscreen", logs),
      home: buildSurface(provider, "home", logs),
      aod: buildSurface(provider, "aod", logs)
    },
    logs
  };
}

function stopPreviewWatcher() {
  if (previewWatchTimer) {
    clearTimeout(previewWatchTimer);
    previewWatchTimer = null;
  }
  previewWatcher?.close();
  previewWatcher = null;
}

function startPreviewWatcher(sourceDir: string) {
  stopPreviewWatcher();
  if (!fs.existsSync(sourceDir)) return;
  previewWatcher = fs.watch(sourceDir, { recursive: true }, (_eventType, filename) => {
    if (!filename || !/\.(xml|png|jpg|jpeg|webp|gif)$/i.test(filename)) return;
    if (previewWatchTimer) clearTimeout(previewWatchTimer);
    previewWatchTimer = setTimeout(() => {
      const provider = readCurrentPreviewProvider();
      if (!provider) return;
      const document = buildPreviewDocument(provider);
      mainWindow?.webContents.send("preview:changed", document);
      emitLog("INFO", `Preview refreshed: ${filename}`);
    }, 250);
  });
}

function extractZipFile(mtzPath: string, outputDir: string) {
  const bytes = new Uint8Array(fs.readFileSync(mtzPath));
  const entries = unzipSync(bytes);
  const names = Object.keys(entries);
  const total = Math.max(names.length, 1);

  names.forEach((name, index) => {
    const normalized = path.normalize(name);
    if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
      emitLog("WARN", `Skipped unsafe entry: ${name}`);
      return;
    }
    const target = path.join(outputDir, normalized);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entries[name]);
    emitProgress({ operation: "unpack", percent: Math.min(98, Math.round(((index + 1) / total) * 98)) });
  });
}

function findAdb() {
  const candidates = [
    path.join(process.resourcesPath, "third_party", "adb", "adb.exe"),
    path.resolve(app.getAppPath(), "third_party", "adb", "adb.exe"),
    path.resolve(process.cwd(), "third_party", "adb", "adb.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe"),
    path.join(process.env.ANDROID_HOME || "", "platform-tools", "adb.exe"),
    "adb"
  ];
  return candidates.find((candidate) => candidate === "adb" || fs.existsSync(candidate)) || "adb";
}

function runAdb(args: string[], timeoutMs = 30000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(findAdb(), args, {
      windowsHide: true,
      shell: false
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      stderr += "ADB command timed out.";
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function parseAdbDeviceModel(devicesOutput: string) {
  const deviceLine = devicesOutput
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .find((line) => /\bdevice\b/.test(line) && !/\bunauthorized\b|\boffline\b/.test(line));
  if (!deviceLine) return "";
  return deviceLine.match(/\bmodel:([^\s]+)/)?.[1]?.replace(/_/g, " ") || "";
}

async function getReadableDeviceModel(fallback = "") {
  const properties = [
    "ro.product.marketname",
    "ro.product.vendor.marketname",
    "ro.product.model",
    "ro.product.vendor.model",
    "ro.product.odm.model"
  ];

  for (const property of properties) {
    const result = await runAdb(["shell", "getprop", property], 10000);
    const value = result.stdout.trim();
    if (result.code === 0 && value && value !== "unknown") return value;
  }

  return fallback || undefined;
}

async function getDeviceStatus(): Promise<DeviceStatus> {
  const devices = await runAdb(["devices", "-l"], 10000);
  if (devices.code !== 0) return { connected: false };

  const modelFromList = parseAdbDeviceModel(devices.stdout);
  const hasConnectedDevice = devices.stdout
    .split(/\r?\n/)
    .slice(1)
    .some((line) => /\bdevice\b/.test(line) && !/\bunauthorized\b|\boffline\b/.test(line));
  if (!hasConnectedDevice) return { connected: false };

  return { connected: true, model: await getReadableDeviceModel(modelFromList) };
}

function parseCurrentPackage(dumpsys: string) {
  const patterns = [
    /mCurrentFocus=Window\{[^}]*\s+([a-zA-Z0-9_.]+)\/[^\s}]+/m,
    /mFocusedApp=ActivityRecord\{[^}]*\s+([a-zA-Z0-9_.]+)\/[^\s}]+/m,
    /topResumedActivity=.*?\s([a-zA-Z0-9_.]+)\/[^\s}]+/m
  ];
  for (const pattern of patterns) {
    const match = dumpsys.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function convertXmlToMaml(xml: string) {
  const trimmed = xml.trim();
  if (!trimmed) return "";

  const escaped = trimmed
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (/^\s*<(Lockscreen|MiWallpaper|Icon)\b/i.test(escaped)) {
    return escaped;
  }

  return [
    '<Lockscreen version="1" frameRate="30" screenWidth="1080">',
    "  <Var name=\"source_xml\"><![CDATA[",
    escaped,
    "  ]]></Var>",
    '  <Group name="converted_xml" visibility="1">',
    '    <Text x="0" y="0" color="#FFFFFFFF" size="36" text="Converted XML" />',
    "  </Group>",
    "</Lockscreen>"
  ].join("\n");
}

ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize-toggle", () => {
  if (!mainWindow) return;
  const currentBounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(currentBounds);
  const fillsWorkArea =
    Math.abs(currentBounds.x - workArea.x) <= 1 &&
    Math.abs(currentBounds.y - workArea.y) <= 1 &&
    Math.abs(currentBounds.width - workArea.width) <= 1 &&
    Math.abs(currentBounds.height - workArea.height) <= 1;

  if (manuallyMaximized || fillsWorkArea || mainWindow.isMaximized()) {
    if (normalWindowBounds) {
      mainWindow.setBounds(normalWindowBounds);
    } else if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    manuallyMaximized = false;
    return;
  }

  normalWindowBounds = currentBounds;
  mainWindow.setBounds(workArea);
  manuallyMaximized = true;
});
ipcMain.handle("window:close", () => mainWindow?.close());

ipcMain.handle("updates:check", () => checkForUpdates());
ipcMain.handle("updates:open-download", async (_event, url?: string) => {
  if (!isHttpUrl(url)) return false;
  await shell.openExternal(url);
  return true;
});
ipcMain.handle("updates:download-and-install", (_event, url: string, version?: string): Promise<OperationResult> => {
  return downloadAndInstallUpdate(url, version);
});

ipcMain.handle("settings:get-theme", () => ({ mode: currentThemeMode }));
ipcMain.handle("settings:set-theme", (_event, mode: ThemePreference["mode"]) => {
  applyTheme(mode);
  writeSettings({ mode });
  emitLog("INFO", `Theme mode changed: ${mode}`);
  return { mode };
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"]
  });
  return { canceled: result.canceled, path: result.filePaths[0] };
});

ipcMain.handle("dialog:select-mtz", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [{ name: "MTZ Theme", extensions: ["mtz", "zip"] }]
  });
  return { canceled: result.canceled, path: result.filePaths[0] };
});

ipcMain.handle("preview:load-folder", async (): Promise<PreviewLoadResult> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, message: "已取消选择主题目录。" };
  try {
    previewSource = { kind: "folder", path: result.filePaths[0], label: path.basename(result.filePaths[0]) || result.filePaths[0] };
    previewMtzEntries = null;
    const provider = createFolderProvider(previewSource.path);
    const document = buildPreviewDocument(provider);
    startPreviewWatcher(previewSource.path);
    emitLog("SUCCESS", `Preview source loaded: ${previewSource.path}`);
    return { ok: true, message: "主题目录已加载。", path: previewSource.path, document };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("preview:load-mtz", async (): Promise<PreviewLoadResult> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [{ name: "MTZ Theme", extensions: ["mtz", "zip"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, message: "已取消选择 MTZ。" };
  try {
    const mtzPath = result.filePaths[0];
    const bytes = new Uint8Array(fs.readFileSync(mtzPath));
    previewMtzEntries = unzipSync(bytes);
    previewSource = { kind: "mtz", path: mtzPath, label: path.basename(mtzPath) };
    stopPreviewWatcher();
    const provider = createMtzProvider(mtzPath, previewMtzEntries);
    const document = buildPreviewDocument(provider);
    emitLog("SUCCESS", `Preview MTZ loaded in memory: ${mtzPath}`);
    return { ok: true, message: "MTZ 已加载。", path: mtzPath, document };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("preview:refresh", async (_event, mode?: PreviewMode): Promise<PreviewLoadResult> => {
  try {
    const provider = readCurrentPreviewProvider();
    if (!provider) return { ok: false, message: "请先选择主题目录或 MTZ 文件。" };
    const document = buildPreviewDocument(provider, mode || "lockscreen");
    emitLog("INFO", "Preview refreshed manually.");
    return { ok: true, message: "预览已刷新。", document };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("preview:export-screenshot", async (_event, dataUrl: string): Promise<OperationResult> => {
  try {
    const save = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: path.join(app.getPath("desktop"), `xiaomi-theme-preview-${Date.now()}.png`),
      filters: [{ name: "PNG Image", extensions: ["png"] }]
    });
    if (save.canceled || !save.filePath) return { ok: false, message: "已取消导出截图。" };
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(save.filePath, Buffer.from(base64, "base64"));
    emitLog("SUCCESS", `Preview screenshot exported: ${save.filePath}`);
    return { ok: true, message: "截图已导出。", path: save.filePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("preview:watch-start", async (): Promise<OperationResult> => {
  if (!previewSource || previewSource.kind !== "folder") return { ok: false, message: "当前预览源不支持文件监听。" };
  startPreviewWatcher(previewSource.path);
  return { ok: true, message: "预览监听已启动。" };
});

ipcMain.handle("preview:watch-stop", async (): Promise<OperationResult> => {
  stopPreviewWatcher();
  return { ok: true, message: "预览监听已停止。" };
});

ipcMain.handle("device:get-status", () => getDeviceStatus());

ipcMain.handle("operation:pack", async (_event, request: PackRequest): Promise<OperationResult> => {
  try {
    if (!request.sourceDir || !fs.existsSync(request.sourceDir)) {
      return { ok: false, message: "请选择有效的主题工程目录。" };
    }
    const defaultPath = path.join(app.getPath("desktop"), `${path.basename(request.sourceDir)}.mtz`);
    const save = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [{ name: "MTZ Theme", extensions: ["mtz"] }]
    });
    if (save.canceled || !save.filePath) return { ok: false, message: "已取消导出。" };

    emitLog("INFO", `Packing theme directory: ${request.sourceDir}`);
    emitProgress({ operation: "pack", percent: 1 });
    const buffer = buildMtzBuffer(request.sourceDir, "pack");
    fs.writeFileSync(save.filePath, buffer);
    emitProgress({ operation: "pack", percent: 100 });
    emitLog("SUCCESS", `MTZ exported: ${save.filePath}`);
    return { ok: true, message: "导出完成。", path: save.filePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:unpack", async (_event, request: UnpackRequest): Promise<OperationResult> => {
  try {
    if (!request.mtzPath || !fs.existsSync(request.mtzPath)) {
      return { ok: false, message: "请选择有效的 MTZ 文件。" };
    }
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "选择解包目录",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, message: "已取消解包。" };

    const outputDir = path.join(result.filePaths[0], path.basename(request.mtzPath, path.extname(request.mtzPath)));
    fs.mkdirSync(outputDir, { recursive: true });
    emitLog("INFO", `Unpacking MTZ: ${request.mtzPath}`);
    emitProgress({ operation: "unpack", percent: 1 });
    extractZipFile(request.mtzPath, outputDir);
    emitProgress({ operation: "unpack", percent: 100 });
    emitLog("SUCCESS", `MTZ unpacked: ${outputDir}`);
    return { ok: true, message: "解包完成。", path: outputDir };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:deploy", async (_event, mtzPath?: string): Promise<OperationResult> => {
  try {
    let targetPath = mtzPath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openFile"],
        filters: [{ name: "MTZ Theme", extensions: ["mtz"] }]
      });
      if (result.canceled || !result.filePaths[0]) return { ok: false, message: "已取消应用。" };
      targetPath = result.filePaths[0];
    }

    emitLog("INFO", "Checking ADB device connection...");
    const devices = await runAdb(["devices", "-l"]);
    if (devices.code !== 0 || !/\bdevice\b/.test(devices.stdout.split(/\r?\n/).slice(1).join("\n"))) {
      emitLog("ERROR", "No connected ADB device found.");
      return { ok: false, message: "未检测到已连接的 ADB 设备。" };
    }

    emitProgress({ operation: "deploy", percent: 25 });
    const remote = `/sdcard/Download/${path.basename(targetPath)}`;
    emitLog("INFO", `Pushing MTZ to device: ${remote}`);
    const push = await runAdb(["push", targetPath, remote], 120000);
    if (push.code !== 0) {
      emitLog("ERROR", push.stderr || push.stdout);
      return { ok: false, message: push.stderr || "推送失败。" };
    }
    emitProgress({ operation: "deploy", percent: 100 });
    emitLog("SUCCESS", `MTZ pushed to device: ${remote}`);
    return { ok: true, message: "已推送到手机。", path: remote };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:export-logs", async (_event, logs: LogEntry[]): Promise<OperationResult> => {
  const save = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: path.join(app.getPath("desktop"), `xiaomi-theme-packer-${Date.now()}.txt`),
    filters: [{ name: "Text", extensions: ["txt"] }]
  });
  if (save.canceled || !save.filePath) return { ok: false, message: "已取消导出日志。" };
  const text = logs.map((entry) => `${entry.time} [${entry.level}] ${entry.message}`).join(os.EOL);
  fs.writeFileSync(save.filePath, text, "utf8");
  emitLog("SUCCESS", `Logs exported: ${save.filePath}`);
  return { ok: true, message: "日志已导出。", path: save.filePath };
});

ipcMain.handle("operation:cleanup-cache", async (): Promise<OperationResult> => {
  try {
    const roots = [
      path.join(app.getPath("userData"), "cache"),
      path.join(app.getPath("userData"), "temp"),
      path.join(process.cwd(), "cache"),
      path.join(process.cwd(), "temp")
    ];
    for (const root of roots) {
      if (fs.existsSync(root)) {
        fs.rmSync(root, { recursive: true, force: true });
        emitLog("INFO", `Deleted: ${root}`);
      }
    }
    emitLog("SUCCESS", "Theme cache cleaned.");
    return { ok: true, message: "缓存已清理。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("operation:restart-adb", async (): Promise<OperationResult> => {
  emitLog("INFO", "Restarting ADB server...");
  emitProgress({ operation: "adb", percent: 10 });
  const kill = await runAdb(["kill-server"]);
  emitProgress({ operation: "adb", percent: 50 });
  const start = await runAdb(["start-server"]);
  emitProgress({ operation: "adb", percent: 100 });
  if (kill.code !== 0 || start.code !== 0) {
    const message = start.stderr || kill.stderr || "ADB 重启失败。";
    emitLog("ERROR", message);
    return { ok: false, message };
  }
  emitLog("SUCCESS", "ADB server restarted.");
  return { ok: true, message: "ADB 已重启。" };
});

ipcMain.handle("operation:copy-package", async (): Promise<OperationResult> => {
  emitLog("INFO", "Reading current foreground package...");
  const result = await runAdb(["shell", "dumpsys", "window"], 30000);
  if (result.code !== 0) {
    const message = result.stderr || "读取前台应用失败。";
    emitLog("ERROR", message);
    return { ok: false, message };
  }
  const packageName = parseCurrentPackage(result.stdout);
  if (!packageName) {
    emitLog("WARN", "No foreground package found.");
    return { ok: false, message: "未解析到当前界面包名。" };
  }
  clipboard.writeText(packageName);
  emitLog("SUCCESS", `Copied foreground package: ${packageName}`);
  return { ok: true, message: "包名已复制。", data: packageName };
});

ipcMain.handle("operation:convert-maml", (_event, xml: string): OperationResult => {
  try {
    const data = convertXmlToMaml(xml);
    emitLog("SUCCESS", "XML converted to MAML code.");
    return { ok: true, message: "转换完成。", data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("ERROR", message);
    return { ok: false, message };
  }
});

ipcMain.handle("app:open-path", (_event, targetPath: string) => {
  if (targetPath) shell.showItemInFolder(targetPath);
});

app.whenReady().then(() => {
  applyTheme(readSettings().mode);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
