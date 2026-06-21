import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { CheckIcon, CleanIcon, CodeIcon, CopyIcon, DocIcon, DownloadIcon, EyeIcon, FolderIcon, GearIcon, RestartIcon, SearchIcon, TrashIcon } from "./icons";
import { useResizeObserver, useSmoothCorners } from "./hooks";
import type { DeviceStatus, LogEntry, LogLevel, OperationResult, PageId, PreviewDocument, PreviewLoadResult, PreviewLog, PreviewMode, PreviewSurface, RenderedNode, ThemeMode, UpdateInfo } from "./types";

const locale = typeof navigator !== "undefined" ? (navigator.languages?.[0] || navigator.language || "en") : "en";
const isChineseLocale = /^zh/i.test(locale);

const ui = isChineseLocale
  ? {
      lastUpdatedPrefix: "\u6700\u540e\u66f4\u65b0\uff1a",
      windowClose: "\u5173\u95ed",
      windowMinimize: "\u6700\u5c0f\u5316",
      windowMaximize: "\u6700\u5927\u5316",
      sidebarPack: "\u6253\u5305",
      sidebarPreview: "\u9884\u89c8",
      sidebarLogs: "\u65e5\u5fd7",
      sidebarMore: "\u66f4\u591a",
      devicePrefix: "\u8bbe\u5907",
      deviceConnected: "\u5df2\u8fde\u63a5",
      deviceDisconnected: "\u672a\u8fde\u63a5",
      packPageTitle: "\u6253\u5305\u5217\u8868",
      themePackageTitle: "\u4e3b\u9898\u6587\u4ef6\u6253\u5305",
      unpackTitle: "\u89e3\u5305",
      select: "\u9009\u62e9",
      exportMtz: "\u5bfc\u51fa MTZ",
      applyToPhone: "\u5e94\u7528\u5230\u624b\u673a",
      packProgress: "\u6253\u5305\u8fdb\u5ea6",
      unpackProgress: "\u89e3\u5305\u8fdb\u5ea6",
      logsPageTitle: "\u8fd0\u884c\u65e5\u5fd7",
      previewPageTitle: "\u4e3b\u9898\u9884\u89c8",
      selectThemeDir: "\u9009\u62e9\u4e3b\u9898\u76ee\u5f55",
      openMtz: "\u6253\u5f00 MTZ",
      refresh: "\u5237\u65b0",
      openDirectory: "\u6253\u5f00\u76ee\u5f55",
      exportScreenshot: "\u5bfc\u51fa\u622a\u56fe",
      lockscreen: "\u9501\u5c4f",
      home: "\u684c\u9762",
      aod: "AOD",
      previewLogs: "\u9884\u89c8\u65e5\u5fd7",
      noPreview: "\u8bf7\u9009\u62e9\u4e3b\u9898\u76ee\u5f55\u6216 MTZ \u6587\u4ef6",
      monitoring: "\u76d1\u63a7\u4e2d",
      exportLogs: "\u5bfc\u51fa",
      clearLogs: "\u6e05\u7a7a",
      autoScroll: "\u81ea\u52a8\u6eda\u52a8",
      timestamp: "\u65f6\u95f4\u6233",
      filterLogs: "\u7b5b\u9009\u65e5\u5fd7...",
      lines: "\u884c\u6570",
      memory: "\u5185\u5b58",
      connected: "\u5df2\u8fde\u63a5",
      moreThemeModeTitle: "\u4e3b\u9898\u6a21\u5f0f",
      appearanceTitle: "\u5916\u89c2",
      appearanceDesc: "\u5728\u8ddf\u968f\u7cfb\u7edf\u3001\u6d45\u8272\u548c\u6df1\u8272\u4e4b\u95f4\u5207\u6362\u3002",
      system: "\u8ddf\u968f\u7cfb\u7edf",
      light: "\u6d45\u8272",
      dark: "\u6df1\u8272",
      deviceToolsTitle: "\u8bbe\u5907\u5de5\u5177",
      cleanCacheTitle: "\u6e05\u7406\u4e3b\u9898\u7f13\u5b58",
      cleanCacheDesc: "\u5220\u9664\u4e34\u65f6\u4e3b\u9898\u7f13\u5b58\u6587\u4ef6\u3002",
      cleanCacheButton: "\u6e05\u7406",
      restartAdbTitle: "\u91cd\u542f ADB",
      restartAdbDesc: "\u91cd\u542f Android Debug Bridge \u670d\u52a1\u3002",
      restartAdbButton: "\u91cd\u542f",
      currentPackageTitle: "\u5f53\u524d\u5305\u540d",
      copyPackageTitle: "\u590d\u5236\u5f53\u524d\u5305\u540d",
      copyPackageDesc: "\u590d\u5236\u5df2\u8fde\u63a5\u8bbe\u5907\u4e0a\u7684\u5f53\u524d\u524d\u53f0\u5e94\u7528\u5305\u540d\u3002",
      convertMamlTitle: "\u8f6c\u6362\u4e3a MAML",
      convertMamlDesc: "\u628a\u8f93\u5165\u6587\u672c\u8f6c\u6362\u4e3a MAML \u4ee3\u7801\u3002",
      xmlPlaceholder: "XML",
      convertButton: "\u8f6c\u6362",
      mamlPlaceholder: "MAML \u8f93\u51fa",
      updateChecking: "\u68c0\u67e5\u66f4\u65b0\u4e2d...",
      updateAvailable: "\u53d1\u73b0\u65b0\u7248\u672c",
      updateLatest: "\u5df2\u662f\u6700\u65b0\u7248\u672c",
      updateDownload: "\u4e0b\u8f7d",
      updateDownloading: "\u4e0b\u8f7d\u66f4\u65b0\u4e2d",
      updateInstalling: "\u542f\u52a8\u5b89\u88c5\u5668\u4e2d...",
      updateDownloadFailed: "\u4e0b\u8f7d\u5931\u8d25",
      updateCheck: "\u68c0\u67e5",
      seed: {
        init: "\u6b63\u5728\u521d\u59cb\u5316\u4e3b\u9898\u6253\u5305\u5f15\u64ce...",
        structure: "\u6b63\u5728\u68c0\u67e5\u9879\u76ee\u7ed3\u6784\uff1a/Users/studio/Desktop/NewTheme_v1",
        integrity: "\u8d44\u6e90\u5b8c\u6574\u6027\u6821\u9a8c\u901a\u8fc7\uff08\u5df2\u68c0\u67e5 248 \u4e2a\u6587\u4ef6\uff09",
        compile: "\u6b63\u5728\u7f16\u8bd1 HyperOS \u76ee\u6807\u8d44\u6e90...",
        warn: "\u8b66\u544a\uff1adescription.xml \u4e2d\u7f3a\u5c11 lockscreen_weather \u952e\uff0c\u5df2\u4f7f\u7528\u9ed8\u8ba4\u503c\u3002",
        packSystem: "\u6b63\u5728\u6253\u5305\u6a21\u5757\uff1acom.android.systemui",
        packHome: "\u6b63\u5728\u6253\u5305\u6a21\u5757\uff1acom.miui.home",
        checksum: "\u6b63\u5728\u751f\u6210\u6821\u9a8c\u548c\uff1a8f2a6c9e01b3d...",
        complete: "\u4e3b\u9898\u6784\u5efa\u5b8c\u6210\u3002\u8f93\u51fa\u5df2\u4fdd\u5b58\u5230\uff1abuild/themes/ModernDark.mtz",
        finish: "\u6253\u5305\u8017\u65f6 4.113 \u79d2\u3002"
      }
    }
  : {
      lastUpdatedPrefix: "Last updated: ",
      windowClose: "Close",
      windowMinimize: "Minimize",
      windowMaximize: "Maximize",
      sidebarPack: "Pack",
      sidebarPreview: "Preview",
      sidebarLogs: "Logs",
      sidebarMore: "More",
      devicePrefix: "Device",
      deviceConnected: "Connected",
      deviceDisconnected: "Disconnected",
      packPageTitle: "Pack List",
      themePackageTitle: "Theme Package",
      unpackTitle: "Unpack",
      select: "Select",
      exportMtz: "Export MTZ",
      applyToPhone: "Apply to Phone",
      packProgress: "Pack Progress",
      unpackProgress: "Unpack Progress",
      logsPageTitle: "Runtime Logs",
      previewPageTitle: "Theme Preview",
      selectThemeDir: "Select Theme Folder",
      openMtz: "Open MTZ",
      refresh: "Refresh",
      openDirectory: "Open Folder",
      exportScreenshot: "Export Screenshot",
      lockscreen: "Lockscreen",
      home: "Home",
      aod: "AOD",
      previewLogs: "Preview Logs",
      noPreview: "Select a theme folder or MTZ file",
      monitoring: "MONITORING",
      exportLogs: "Export",
      clearLogs: "Clear",
      autoScroll: "Auto-scroll",
      timestamp: "Timestamp",
      filterLogs: "Filter logs...",
      lines: "Lines",
      memory: "Memory",
      connected: "Connected",
      moreThemeModeTitle: "Theme Mode",
      appearanceTitle: "Appearance",
      appearanceDesc: "Switch between system, light, and dark modes.",
      system: "System",
      light: "Light",
      dark: "Dark",
      deviceToolsTitle: "Device Tools",
      cleanCacheTitle: "Clean Theme Cache",
      cleanCacheDesc: "Remove temporary theme cache files.",
      cleanCacheButton: "Clean",
      restartAdbTitle: "Restart ADB",
      restartAdbDesc: "Restart the Android Debug Bridge service.",
      restartAdbButton: "Restart",
      currentPackageTitle: "Current Package",
      copyPackageTitle: "Copy Current Package",
      copyPackageDesc: "Copy the foreground package name from the connected device.",
      convertMamlTitle: "Convert to MAML",
      convertMamlDesc: "Convert source text into MAML code.",
      xmlPlaceholder: "XML",
      convertButton: "Convert",
      mamlPlaceholder: "MAML output",
      updateChecking: "Checking updates...",
      updateAvailable: "Update available",
      updateLatest: "You're up to date",
      updateDownload: "Download",
      updateDownloading: "Downloading update",
      updateInstalling: "Starting installer...",
      updateDownloadFailed: "Download failed",
      updateCheck: "Check",
      seed: {
        init: "Initializing Theme Packer engine...",
        structure: "Checking project structure: /Users/studio/Desktop/NewTheme_v1",
        integrity: "Validating resource integrity: PASSED (248 files checked)",
        compile: "Compiling assets for HyperOS target...",
        warn: "Warning: Missing lockscreen_weather key in description.xml. Using default.",
        packSystem: "Packing module: com.android.systemui",
        packHome: "Packing module: com.miui.home",
        checksum: "Generating checksum: 8f2a6c9e01b3d...",
        complete: "Theme build complete. Output saved to: build/themes/ModernDark.mtz",
        finish: "Packing finished in 4.113s."
      }
    };
const seedLogs: LogEntry[] = [
  createLog("INFO", ui.seed.init),
  createLog("INFO", ui.seed.structure),
  createLog("SUCCESS", ui.seed.integrity),
  createLog("INFO", ui.seed.compile),
  createLog("WARN", ui.seed.warn),
  createLog("INFO", ui.seed.packSystem),
  createLog("INFO", ui.seed.packHome),
  createLog("DEBUG", ui.seed.checksum),
  createLog("SUCCESS", ui.seed.complete),
  createLog("INFO", ui.seed.finish)
];

function createLog(level: LogLevel, message: string): LogEntry {
  const now = new Date();
  return {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    time: now.toLocaleTimeString("en-GB", { hour12: false }) + `.${String(now.getMilliseconds()).padStart(3, "0")}`,
    level,
    message
  };
}

function formatLastUpdated(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${ui.lastUpdatedPrefix}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function resolveThemeMode(mode: ThemeMode) {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeDataset(mode: ThemeMode) {
  document.documentElement.dataset.themePreference = mode;
  document.documentElement.dataset.themeMode = resolveThemeMode(mode);
}

function getWindowCornerSmoothing(page: PageId) {
  return page === "pack" ? 0.5699999928474426 : 0.6000000238418579;
}

export function App() {
  const [page, setPage] = useState<PageId>("pack");
  const [logs, setLogs] = useState<LogEntry[]>(seedLogs);
  const [packProgress, setPackProgress] = useState(0);
  const [unpackProgress, setUnpackProgress] = useState(0);
  const [selectedThemeDir, setSelectedThemeDir] = useState("");
  const [selectedMtz, setSelectedMtz] = useState("");
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("lockscreen");
  const [lastExportedMtz, setLastExportedMtz] = useState("");
  const [packUpdatedAt, setPackUpdatedAt] = useState(() => formatLastUpdated());
  const [unpackUpdatedAt, setUnpackUpdatedAt] = useState(() => formatLastUpdated());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({ connected: false });
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const { ref: appRef, rect } = useResizeObserver<HTMLDivElement>();
  useSmoothCorners();

  const checkUpdates = useCallback(async () => {
    setUpdateInfo((current) => ({
      currentVersion: current?.currentVersion || "",
      latestVersion: current?.latestVersion,
      available: Boolean(current?.available),
      checking: true,
      downloading: false,
      downloadProgress: undefined,
      message: ui.updateChecking,
      releaseUrl: current?.releaseUrl,
      downloadUrl: current?.downloadUrl,
      notes: current?.notes,
      publishedAt: current?.publishedAt
    }));
    const result = await window.xiaomiThemePacker.updates.check();
    setUpdateInfo(result);
  }, []);

  useEffect(() => {
    window.xiaomiThemePacker.settings.getTheme().then((value) => {
      setThemeMode(value.mode);
      applyThemeDataset(value.mode);
    });
    window.xiaomiThemePacker.device.getStatus().then((status) => setDeviceStatus(status as DeviceStatus));
    checkUpdates();
    const offLog = window.xiaomiThemePacker.events.onLog((entry) => setLogs((items) => [...items, entry]));
    const offProgress = window.xiaomiThemePacker.events.onProgress((payload) => {
      if (payload.operation === "pack" || payload.operation === "deploy") setPackProgress(payload.percent);
      if (payload.operation === "unpack") setUnpackProgress(payload.percent);
    });
    const offPreview = window.xiaomiThemePacker.events.onPreviewChanged((document) => {
      setPreviewDocument(document);
      pushPreviewLogs(document.logs, setLogs);
    });
    const offUpdateProgress = window.xiaomiThemePacker.events.onUpdateProgress((payload) => {
      setUpdateInfo((current) => {
        if (!current) return current;
        return {
          ...current,
          downloading: payload.percent < 100,
          downloadProgress: payload.percent,
          message: payload.message
        };
      });
    });
    return () => {
      offLog();
      offProgress();
      offPreview();
      offUpdateProgress();
    };
  }, [checkUpdates]);

  useEffect(() => {
    document.documentElement.style.setProperty("--window-width", `${rect.width}px`);
    document.documentElement.style.setProperty("--window-height", `${rect.height}px`);
  }, [rect]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (themeMode === "system") applyThemeDataset("system");
    };
    updateSystemTheme();
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [themeMode]);

  const pushLocalLog = useCallback((level: LogLevel, message: string) => {
    setLogs((items) => [...items, createLog(level, message)]);
  }, []);

  return (
    <div ref={appRef} className={`app-window page-${page}`} data-smooth-corner="26" data-figma-corner-radius="26" data-figma-corner-smoothing={getWindowCornerSmoothing(page)} data-figma-corner-style="smooth">
      <Sidebar page={page} onNavigate={setPage} deviceStatus={deviceStatus} updateInfo={updateInfo} onCheckUpdate={checkUpdates} onUpdateInfoChange={setUpdateInfo} />
      <main className="main-region">
        {page === "pack" && (
          <PackPage
            selectedThemeDir={selectedThemeDir}
            selectedMtz={selectedMtz}
            lastExportedMtz={lastExportedMtz}
            packUpdatedAt={packUpdatedAt}
            unpackUpdatedAt={unpackUpdatedAt}
            packProgress={packProgress}
            unpackProgress={unpackProgress}
            onThemeDirChange={setSelectedThemeDir}
            onMtzChange={setSelectedMtz}
            onLastExportedMtzChange={setLastExportedMtz}
            onPackUpdatedAtChange={setPackUpdatedAt}
            onUnpackUpdatedAtChange={setUnpackUpdatedAt}
            onLocalLog={pushLocalLog}
          />
        )}
        {page === "preview" && <PreviewPage document={previewDocument} mode={previewMode} setMode={setPreviewMode} setDocument={setPreviewDocument} onPreviewLogs={(items) => pushPreviewLogs(items, setLogs)} onLocalLog={pushLocalLog} />}
        {page === "logs" && <LogsPage logs={logs} setLogs={setLogs} />}
        {page === "more" && <MorePage themeMode={themeMode} setThemeMode={setThemeMode} onLocalLog={pushLocalLog} />}
      </main>
    </div>
  );
}

function WindowDots() {
  return (
    <div className="window-dots" data-drag-region="false">
      <button className="dot red" data-smooth-corner="circle" aria-label={ui.windowClose} onClick={() => window.xiaomiThemePacker.window.close()} />
      <button className="dot yellow" data-smooth-corner="circle" aria-label={ui.windowMinimize} onClick={() => window.xiaomiThemePacker.window.minimize()} />
      <button className="dot green" data-smooth-corner="circle" aria-label={ui.windowMaximize} onClick={() => window.xiaomiThemePacker.window.toggleMaximize()} />
    </div>
  );
}

function Sidebar({ page, onNavigate, deviceStatus, updateInfo, onCheckUpdate, onUpdateInfoChange }: { page: PageId; onNavigate: (page: PageId) => void; deviceStatus: DeviceStatus; updateInfo: UpdateInfo | null; onCheckUpdate: () => void; onUpdateInfoChange: React.Dispatch<React.SetStateAction<UpdateInfo | null>> }) {
  const items = [
    { id: "pack" as const, label: ui.sidebarPack, icon: FolderIcon },
    { id: "preview" as const, label: ui.sidebarPreview, icon: EyeIcon },
    { id: "logs" as const, label: ui.sidebarLogs, icon: DocIcon },
    { id: "more" as const, label: ui.sidebarMore, icon: GearIcon }
  ];
  const deviceLabel = `${ui.devicePrefix}: ${deviceStatus.connected ? deviceStatus.model || ui.deviceConnected : ui.deviceDisconnected}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-shadow" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" aria-hidden="true" />
      <div className="sidebar-panel" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" aria-hidden="true" />
      <WindowDots />
      <nav className="nav-list">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}>
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <UpdateCard info={updateInfo} onCheckUpdate={onCheckUpdate} onUpdateInfoChange={onUpdateInfoChange} />
      <div className="device-label">{deviceLabel}</div>
    </aside>
  );
}

function UpdateCard({ info, onCheckUpdate, onUpdateInfoChange }: { info: UpdateInfo | null; onCheckUpdate: () => void; onUpdateInfoChange: React.Dispatch<React.SetStateAction<UpdateInfo | null>> }) {
  if (!info?.checking && !info?.available) return null;

  const targetUrl = info.downloadUrl || info.releaseUrl;
  const installUpdate = async () => {
    if (!targetUrl) return;
    onUpdateInfoChange((current) => current ? { ...current, downloading: true, downloadProgress: 0, message: ui.updateDownloading } : current);
    const latestVersion = info.latestVersion;
    const result = (await window.xiaomiThemePacker.updates.downloadAndInstall(targetUrl, latestVersion)) as OperationResult;
    if (!result.ok) {
      onUpdateInfoChange((current) => current ? { ...current, downloading: false, message: result.message || ui.updateDownloadFailed } : current);
      return;
    }
    onUpdateInfoChange((current) => current ? { ...current, downloading: false, downloadProgress: 100, message: ui.updateInstalling } : current);
  };
  const progress = Math.max(0, Math.min(100, Math.round(info.downloadProgress || 0)));
  const subtitle = info.downloading
    ? `${progress}%`
    : info.available && info.latestVersion
      ? `v${info.latestVersion}`
      : info.message || ui.updateChecking;

  return (
    <div className={`update-card ${info.available ? "available" : "checking"} ${info.downloading ? "downloading" : ""}`} data-smooth-corner="10" data-figma-corner-radius="10" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
      <div className="update-copy">
        <strong>{info.downloading ? ui.updateDownloading : info.available ? ui.updateAvailable : ui.updateChecking}</strong>
        <span>{subtitle}</span>
      </div>
      {info.downloading && (
        <div className="update-progress" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill">
          <span data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill" style={{ width: `${progress}%` }} />
        </div>
      )}
      {info.available ? (
        <button className="update-action" data-smooth-corner="7" data-figma-corner-radius="7" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={targetUrl ? installUpdate : onCheckUpdate} disabled={info.downloading}>
          {targetUrl ? ui.updateDownload : ui.updateCheck}
        </button>
      ) : null}
    </div>
  );
}

interface PackPageProps {
  selectedThemeDir: string;
  selectedMtz: string;
  lastExportedMtz: string;
  packUpdatedAt: string;
  unpackUpdatedAt: string;
  packProgress: number;
  unpackProgress: number;
  onThemeDirChange: (value: string) => void;
  onMtzChange: (value: string) => void;
  onLastExportedMtzChange: (value: string) => void;
  onPackUpdatedAtChange: (value: string) => void;
  onUnpackUpdatedAtChange: (value: string) => void;
  onLocalLog: (level: LogLevel, message: string) => void;
}

function pushPreviewLogs(items: PreviewLog[], setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>) {
  if (items.length === 0) return;
  setLogs((logs) => [
    ...logs,
    ...items
      .filter((item) => item.level !== "DEBUG")
      .slice(-24)
      .map((item) => ({
        id: `preview-${item.id}`,
        time: item.time,
        level: item.level,
        message: `[preview:${item.scope}] ${item.message}`
      }))
  ]);
}

function PreviewPage({ document, mode, setMode, setDocument, onPreviewLogs, onLocalLog }: { document: PreviewDocument | null; mode: PreviewMode; setMode: (mode: PreviewMode) => void; setDocument: (document: PreviewDocument | null) => void; onPreviewLogs: (items: PreviewLog[]) => void; onLocalLog: (level: LogLevel, message: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const surface = document?.surfaces[mode];
  const previewLogs = document?.logs || [];

  const applyDocument = (result: PreviewLoadResult) => {
    if (result.document) {
      setDocument(result.document);
      onPreviewLogs(result.document.logs);
      onLocalLog(result.ok ? "SUCCESS" : "WARN", result.message);
    } else if (!result.ok) {
      onLocalLog("WARN", result.message);
    }
  };

  const selectFolder = async () => {
    applyDocument((await window.xiaomiThemePacker.preview.loadFolder()) as PreviewLoadResult);
  };

  const openMtz = async () => {
    applyDocument((await window.xiaomiThemePacker.preview.loadMtz()) as PreviewLoadResult);
  };

  const refresh = async () => {
    applyDocument((await window.xiaomiThemePacker.preview.refresh(mode)) as PreviewLoadResult);
  };

  const openDirectory = async () => {
    if (document?.source?.kind === "folder") await window.xiaomiThemePacker.operations.openPath(document.source.path);
  };

  const exportScreenshot = async () => {
    if (!svgRef.current || !surface) return;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svgRef.current);
    const canvas = window.document.createElement("canvas");
    canvas.width = surface.width;
    canvas.height = surface.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    image.onload = async () => {
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      try {
        await window.xiaomiThemePacker.preview.exportScreenshot(canvas.toDataURL("image/png"));
      } catch (error) {
        onLocalLog("ERROR", error instanceof Error ? error.message : String(error));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      onLocalLog("ERROR", "Preview screenshot render failed.");
    };
    image.src = url;
  };

  return (
    <section className="page preview-page">
      <header className="preview-header drag-bar">
        <div className="preview-title">
          <h1>{ui.previewPageTitle}</h1>
          <span title={document?.source?.path}>{document?.source?.label || ui.noPreview}</span>
        </div>
        <div className="preview-actions">
          <button className="soft-button" onClick={selectFolder}><FolderIcon />{ui.selectThemeDir}</button>
          <button className="soft-button" onClick={openMtz}><DocIcon />{ui.openMtz}</button>
          <button className="soft-button" onClick={refresh}>{ui.refresh}</button>
          <button className="soft-button" onClick={openDirectory} disabled={document?.source?.kind !== "folder"}>{ui.openDirectory}</button>
          <button className="primary-button" onClick={exportScreenshot} disabled={!surface}>{ui.exportScreenshot}</button>
        </div>
      </header>
      <div className="preview-content">
        <div className="phone-stage">
          <div className="phone-frame">
            <div className="phone-speaker" />
            {surface ? <PreviewCanvas refValue={svgRef} surface={surface} /> : <div className="preview-empty">{ui.noPreview}</div>}
          </div>
          <div className="preview-mode-bar segmented">
            <button className={mode === "lockscreen" ? "selected" : ""} onClick={() => setMode("lockscreen")}>{ui.lockscreen}</button>
            <button className={mode === "home" ? "selected" : ""} onClick={() => setMode("home")}>{ui.home}</button>
            <button className={mode === "aod" ? "selected" : ""} onClick={() => setMode("aod")}>{ui.aod}</button>
          </div>
        </div>
        <aside className="preview-log-panel">
          <div className="preview-log-head">
            <h2>{ui.previewLogs}</h2>
            <span>{previewLogs.length}</span>
          </div>
          <div className="preview-log-list">
            {previewLogs.slice(-80).map((item) => (
              <div key={item.id} className={`preview-log-item level-${item.level.toLowerCase()}`}>
                <span>{item.time}</span>
                <strong>[{item.scope}]</strong>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PreviewCanvas({ surface, refValue }: { surface: PreviewSurface; refValue: React.RefObject<SVGSVGElement> }) {
  return (
    <svg ref={refValue} className="preview-canvas" viewBox={`0 0 ${surface.width} ${surface.height}`} role="img" aria-label={surface.title}>
      <rect width={surface.width} height={surface.height} fill={surface.background} />
      {surface.nodes.map((node) => <PreviewNode key={node.id} node={node} />)}
    </svg>
  );
}

function PreviewNode({ node }: { node: RenderedNode }) {
  const transform = `translate(${node.x} ${node.y}) rotate(${node.rotation || 0})`;
  if (node.type === "group") {
    return (
      <g opacity={node.alpha} transform={transform}>
        {(node.children || []).map((child) => <PreviewNode key={child.id} node={child} />)}
      </g>
    );
  }
  if (node.type === "image" && node.src) {
    return <image href={node.src} x={node.x} y={node.y} width={node.width} height={node.height} opacity={node.alpha} preserveAspectRatio="xMidYMid slice" transform={`rotate(${node.rotation || 0} ${node.x} ${node.y})`} />;
  }
  if (node.type === "text" || node.type === "datetime") {
    return (
      <text x={node.x} y={node.y + (node.size || 36)} fill={node.color || "#fff"} fontSize={node.size || 36} opacity={node.alpha} textAnchor={node.align === "center" ? "middle" : node.align === "right" ? "end" : "start"} fontFamily="Microsoft YaHei UI, PingFang SC, sans-serif">
        {node.text}
      </text>
    );
  }
  if (node.type === "shape") {
    return <rect x={node.x} y={node.y} width={node.width} height={node.height} fill={node.fill || "rgba(255,255,255,0.16)"} stroke={node.stroke || "rgba(255,255,255,0.32)"} opacity={node.alpha} />;
  }
  return (
    <g opacity={node.alpha}>
      <rect x={node.x} y={node.y} width={node.width} height={node.height} fill="rgba(0,122,255,0.16)" stroke="rgba(96,165,250,0.9)" strokeDasharray="18 12" />
      <text x={node.x + 28} y={node.y + Math.min(72, node.height / 2)} fill="#bfdbfe" fontSize="32" fontFamily="Microsoft YaHei UI, sans-serif">{node.text || node.tag}</text>
    </g>
  );
}

function PackPage(props: PackPageProps) {
  const selectThemeDir = async () => {
    const result = await window.xiaomiThemePacker.dialog.selectFolder();
    if (!result.canceled && result.path) {
      props.onThemeDirChange(result.path);
      props.onPackUpdatedAtChange(formatLastUpdated());
      props.onLocalLog("INFO", `Theme directory selected: ${result.path}`);
    }
  };

  const selectMtz = async () => {
    const result = await window.xiaomiThemePacker.dialog.selectMtz();
    if (!result.canceled && result.path) {
      props.onMtzChange(result.path);
      props.onUnpackUpdatedAtChange(formatLastUpdated());
      props.onLocalLog("INFO", `MTZ selected: ${result.path}`);
    }
  };

  const exportMtz = async () => {
    const result = (await window.xiaomiThemePacker.operations.pack(props.selectedThemeDir)) as OperationResult;
    if (result.ok && result.path) {
      props.onLastExportedMtzChange(result.path);
      props.onPackUpdatedAtChange(formatLastUpdated());
    }
  };

  const deploy = async () => {
    const result = (await window.xiaomiThemePacker.operations.deploy(props.lastExportedMtz)) as OperationResult;
    if (result.ok) props.onPackUpdatedAtChange(formatLastUpdated());
  };

  const unpack = async () => {
    const result = (await window.xiaomiThemePacker.operations.unpack(props.selectedMtz)) as OperationResult;
    if (result.ok) props.onUnpackUpdatedAtChange(formatLastUpdated());
  };

  return (
    <section className="page pack-page">
      <header className="top-bar drag-bar">
        <h1>{ui.packPageTitle}</h1>
      </header>
      <div className="pack-content">
        <PackCard
          title={ui.themePackageTitle}
          date={props.packUpdatedAt}
          pathValue={props.selectedThemeDir}
          pathPlaceholder=""
          selectLabel={ui.select}
          onSelect={selectThemeDir}
          actions={[
            { label: ui.exportMtz, onClick: exportMtz },
            { label: ui.applyToPhone, onClick: deploy }
          ]}
          progressLabel={ui.packProgress}
          progress={props.packProgress}
          progressTone="blue"
        />
        <PackCard
          title={ui.unpackTitle}
          date={props.unpackUpdatedAt}
          pathValue={props.selectedMtz}
          pathPlaceholder=""
          selectLabel={ui.select}
          onSelect={selectMtz}
          actions={[{ label: ui.unpackTitle, onClick: unpack }]}
          progressLabel={ui.unpackProgress}
          progress={props.unpackProgress}
          progressTone="yellow"
          compact
        />
      </div>
    </section>
  );
}

interface PackCardProps {
  title: string;
  date: string;
  pathValue: string;
  pathPlaceholder: string;
  selectLabel: string;
  onSelect: () => void;
  actions: Array<{ label: string; onClick: () => void }>;
  progressLabel: string;
  progress: number;
  progressTone: "blue" | "yellow";
  compact?: boolean;
}

function PackCard({ title, date, pathValue, pathPlaceholder, selectLabel, onSelect, actions, progressLabel, progress, progressTone, compact }: PackCardProps) {
  return (
    <article className={`pack-card ${compact ? "compact" : ""}`} data-smooth-corner="16" data-figma-corner-radius="16" data-figma-corner-smoothing="0" data-figma-corner-style="rounded">
      <div className="pack-card-head">
        <div className="pack-title-area">
          <h2>{title}</h2>
          <p>{date}</p>
          <div className="path-row">
            <div className="path-display" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" title={pathValue || pathPlaceholder}>{pathValue || pathPlaceholder}</div>
            <button className="small-select" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={onSelect}>{selectLabel}</button>
          </div>
        </div>
        <div className="card-actions">
          {actions.map((action) => (
            <button key={action.label} className="primary-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth" onClick={action.onClick}>{action.label}</button>
          ))}
        </div>
      </div>
      <ProgressBar label={progressLabel} percent={progress} tone={progressTone} />
    </article>
  );
}

function ProgressBar({ label, percent, tone }: { label: string; percent: number; tone: "blue" | "yellow" }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="progress-block">
      <div className="progress-meta">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="progress-track" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill">
        <div className={`progress-fill ${tone}`} data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function LogsPage({ logs, setLogs }: { logs: LogEntry[]; setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [timestamp, setTimestamp] = useState(true);
  const { ref, rect } = useResizeObserver<HTMLDivElement>();
  const listRef = useRef<VariableSizeList>(null);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((entry) => `${entry.time} ${entry.level} ${entry.message}`.toLowerCase().includes(needle));
  }, [logs, query]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true);
  }, [autoScroll, filteredLogs.length, rect.width, timestamp]);

  useEffect(() => {
    if (autoScroll && filteredLogs.length > 0 && logs.length !== seedLogs.length) {
      listRef.current?.scrollToItem(filteredLogs.length - 1, "end");
    }
  }, [autoScroll, filteredLogs.length, logs.length]);

  const exportLogs = async () => {
    await window.xiaomiThemePacker.operations.exportLogs(logs);
  };

  const getItemSize = (index: number) => {
    const entry = filteredLogs[index];
    if (!entry) return 28;
    const listWidth = Math.max(220, rect.width || 720);
    const fixedWidth = (timestamp ? 98 : 0) + 58 + 40;
    const messageWidth = Math.max(96, listWidth - fixedWidth);
    const charsPerLine = Math.max(12, Math.floor(messageWidth / 7.2));
    const lines = Math.max(1, Math.ceil(entry.message.length / charsPerLine));
    return Math.ceil(lines * 19.5 + 10);
  };

  const Row = ({ index, style }: ListChildComponentProps) => {
    const entry = filteredLogs[index];
    return (
      <div className="log-row" style={style}>
        <div className={`log-line level-${entry.level.toLowerCase()}`} data-smooth-corner="4">
          {timestamp && <span className="log-time">{entry.time}</span>}
          <span className="log-level">[{entry.level}]</span>
          <span className="log-message">{entry.message}</span>
        </div>
      </div>
    );
  };

  return (
    <section className="page logs-page">
      <div className="log-shell" data-smooth-corner="18" data-figma-corner-radius="18" data-figma-corner-smoothing="0" data-figma-corner-style="rounded">
        <header className="log-header drag-bar">
          <div className="log-title-group">
            <h1>{ui.logsPageTitle}</h1>
            <div className="monitor-pill" data-smooth-corner="pill" data-figma-corner-radius="9999" data-figma-corner-smoothing="0" data-figma-corner-style="pill"><span data-smooth-corner="circle" />{ui.monitoring}</div>
          </div>
          <div className="log-buttons">
            <button className="soft-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" onClick={exportLogs}><DownloadIcon />{ui.exportLogs}</button>
            <button className="soft-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" onClick={() => setLogs([])}><TrashIcon />{ui.clearLogs}</button>
          </div>
        </header>
        <div className="log-toolbar">
          <div className="check-row">
            <button type="button" className="check-option" aria-pressed={autoScroll} onClick={() => setAutoScroll((value) => !value)}>
              <span className="check-button" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0" data-figma-corner-style="rounded">{autoScroll && <CheckIcon />}</span>
              <span>{ui.autoScroll}</span>
            </button>
            <button type="button" className="check-option" aria-pressed={timestamp} onClick={() => setTimestamp((value) => !value)}>
              <span className="check-button" data-smooth-corner="4" data-figma-corner-radius="4" data-figma-corner-smoothing="0" data-figma-corner-style="rounded">{timestamp && <CheckIcon />}</span>
              <span>{ui.timestamp}</span>
            </button>
          </div>
          <div className="search-box" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded">
            <SearchIcon />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui.filterLogs} />
          </div>
        </div>
        <div ref={ref} className="log-content">
          <VariableSizeList
            ref={listRef}
            height={Math.max(120, rect.height)}
            width="100%"
            itemCount={filteredLogs.length}
            itemSize={getItemSize}
            overscanCount={8}
          >
            {Row}
          </VariableSizeList>
        </div>
        <footer className="log-footer">
          <div><span>{ui.lines}: {logs.length}</span><span>{ui.memory}: {getMemoryLabel()}</span></div>
          <div className="connected-dot"><span data-smooth-corner="circle" />{ui.connected}</div>
        </footer>
      </div>
    </section>
  );
}

function getMemoryLabel() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  if (!memory?.usedJSHeapSize) return "142MB";
  return `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`;
}

function MorePage({ themeMode, setThemeMode, onLocalLog }: { themeMode: ThemeMode; setThemeMode: (mode: ThemeMode) => void; onLocalLog: (level: LogLevel, message: string) => void }) {
  const [converterOpen, setConverterOpen] = useState(false);
  const [xmlInput, setXmlInput] = useState("");
  const [mamlOutput, setMamlOutput] = useState("");

  const changeTheme = async (mode: ThemeMode) => {
    const result = await window.xiaomiThemePacker.settings.setTheme(mode);
    setThemeMode(result.mode);
    applyThemeDataset(result.mode);
  };

  const runConvert = async () => {
    const result = (await window.xiaomiThemePacker.operations.convertMaml(xmlInput)) as OperationResult;
    if (result.ok) {
      setMamlOutput(result.data || "");
      onLocalLog("SUCCESS", isChineseLocale ? "XML \\u5df2\\u8f6c\\u6362\\u4e3a MAML \\u4ee3\\u7801\\u3002" : "XML converted to MAML code.");
    }
  };

  return (
    <section className="page more-page">
      <div className="settings-content">
        <SettingsSection title={ui.moreThemeModeTitle}>
      <div className="settings-card single-row" data-smooth-corner="12" data-figma-corner-radius="12" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <div className="setting-copy">
              <strong>{ui.appearanceTitle}</strong>
              <span>{ui.appearanceDesc}</span>
            </div>
            <div className="segmented" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded">
              <button data-smooth-corner="6" data-figma-corner-radius="6" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" className={themeMode === "system" ? "selected" : ""} onClick={() => changeTheme("system")}>{ui.system}</button>
              <button data-smooth-corner="6" data-figma-corner-radius="6" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" className={themeMode === "light" ? "selected" : ""} onClick={() => changeTheme("light")}>{ui.light}</button>
              <button data-smooth-corner="6" data-figma-corner-radius="6" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" className={themeMode === "dark" ? "selected" : ""} onClick={() => changeTheme("dark")}>{ui.dark}</button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title={ui.deviceToolsTitle}>
          <div className="settings-card stacked" data-smooth-corner="12" data-figma-corner-radius="12" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <SettingRow
              icon={<CleanIcon />}
              tone="blue"
              title={ui.cleanCacheTitle}
              description={ui.cleanCacheDesc}
              button={<button className="primary-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" onClick={() => window.xiaomiThemePacker.operations.cleanupCache()}>{ui.cleanCacheButton}</button>}
            />
            <SettingRow
              icon={<RestartIcon />}
              title={ui.restartAdbTitle}
              description={ui.restartAdbDesc}
              button={<button className="neutral-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" onClick={() => window.xiaomiThemePacker.operations.restartAdb()}>{ui.restartAdbButton}</button>}
            />
          </div>
        </SettingsSection>

        <SettingsSection title={ui.currentPackageTitle}>
          <div className="settings-card stacked" data-smooth-corner="12" data-figma-corner-radius="12" data-figma-corner-smoothing="0.6000000238418579" data-figma-corner-style="smooth">
            <SettingRow
              icon={<CopyIcon />}
              title={ui.copyPackageTitle}
              description={ui.copyPackageDesc}
              button={<button className="icon-button" data-smooth-corner="0" data-figma-corner-radius="0" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" aria-label={ui.copyPackageTitle} onClick={() => window.xiaomiThemePacker.operations.copyPackage()}><CopyIcon /></button>}
            />
            <SettingRow
              icon={<CodeIcon />}
              title={ui.convertMamlTitle}
              description={ui.convertMamlDesc}
              button={<button className="icon-button" data-smooth-corner="0" data-figma-corner-radius="0" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" aria-label={ui.convertMamlTitle} onClick={() => setConverterOpen((value) => !value)}><CodeIcon /></button>}
            />
            {converterOpen && (
              <div className="converter-panel">
                <textarea data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" value={xmlInput} onChange={(event) => setXmlInput(event.target.value)} placeholder={ui.xmlPlaceholder} spellCheck={false} />
                <div className="converter-actions">
                  <button className="primary-button" data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" onClick={runConvert}>{ui.convertButton}</button>
                </div>
                <textarea data-smooth-corner="8" data-figma-corner-radius="8" data-figma-corner-smoothing="0" data-figma-corner-style="rounded" value={mamlOutput} onChange={(event) => setMamlOutput(event.target.value)} placeholder={ui.mamlPlaceholder} spellCheck={false} />
              </div>
            )}
          </div>
        </SettingsSection>
      </div>
    </section>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function SettingRow({ icon, title, description, button, tone }: { icon: React.ReactNode; title: string; description: string; button: React.ReactNode; tone?: "blue" }) {
  return (
    <div className="setting-row">
      <div className="setting-left">
        <div className={`setting-icon ${tone === "blue" ? "blue" : ""}`} data-smooth-corner="8">{icon}</div>
        <div className="setting-copy">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      <div className="setting-button">{button}</div>
    </div>
  );
}
