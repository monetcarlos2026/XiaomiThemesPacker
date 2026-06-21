import type { LogEntry, PreviewDocument, ProgressPayload, ThemeMode } from "./types";
import type { XiaomiThemePackerApi } from "../electron/preload";

export function installDevApi() {
  if (window.xiaomiThemePacker) return;

  let mode: ThemeMode = "system";
  const previewDocument: PreviewDocument = {
    generatedAt: Date.now(),
    activeMode: "lockscreen",
    source: { kind: "folder", path: "E:\\Themes\\NewTheme_v1", label: "NewTheme_v1" },
    logs: [
      { id: "dev-preview-1", time: "12:00:00.000", level: "INFO", scope: "parse", message: "Parsed dev preview manifest." },
      { id: "dev-preview-2", time: "12:00:00.010", level: "DEBUG", scope: "expression", message: "#screen_height-430 = 1970" }
    ],
    surfaces: {
      lockscreen: {
        mode: "lockscreen",
        title: "锁屏",
        manifestPath: "lockscreen/advance/manifest.xml",
        available: true,
        rootTag: "Lockscreen",
        width: 1080,
        height: 2400,
        background: "#111827",
        nodes: [
          { id: "dev-time", type: "datetime", tag: "DateTime", x: 96, y: 260, width: 520, height: 120, alpha: 1, text: "12:00", color: "#ffffff", size: 88 },
          { id: "dev-text", type: "text", tag: "Text", x: 96, y: 1970, width: 760, height: 80, alpha: 1, text: "#screen_height-430", color: "#dbeafe", size: 42 }
        ]
      },
      home: {
        mode: "home",
        title: "桌面",
        available: false,
        width: 1080,
        height: 2400,
        background: "#20242b",
        nodes: [{ id: "home-placeholder", type: "placeholder", tag: "Placeholder", x: 120, y: 980, width: 840, height: 220, alpha: 1, text: "桌面 manifest not found." }]
      },
      aod: {
        mode: "aod",
        title: "AOD",
        available: false,
        width: 1080,
        height: 2400,
        background: "#000000",
        nodes: [{ id: "aod-placeholder", type: "placeholder", tag: "Placeholder", x: 120, y: 980, width: 840, height: 220, alpha: 1, text: "AOD manifest not found." }]
      }
    }
  };
  const api: XiaomiThemePackerApi = {
    window: {
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      close: async () => undefined
    },
    settings: {
      getTheme: async () => ({ mode }),
      setTheme: async (nextMode) => {
        mode = nextMode;
        return { mode };
      }
    },
    dialog: {
      selectFolder: async () => ({ canceled: false, path: "E:\\Themes\\NewTheme_v1" }),
      selectMtz: async () => ({ canceled: false, path: "E:\\Themes\\ModernDark.mtz" })
    },
    device: {
      getStatus: async () => ({ connected: false })
    },
    operations: {
      pack: async () => ({ ok: true, message: "导出完成。", path: "E:\\Themes\\ModernDark.mtz" }),
      unpack: async () => ({ ok: true, message: "解包完成。", path: "E:\\Themes\\ModernDark" }),
      deploy: async () => ({ ok: true, message: "已推送到手机。", path: "/sdcard/Download/ModernDark.mtz" }),
      exportLogs: async () => ({ ok: true, message: "日志已导出。" }),
      cleanupCache: async () => ({ ok: true, message: "缓存已清理。" }),
      restartAdb: async () => ({ ok: true, message: "ADB 已重启。" }),
      copyPackage: async () => ({ ok: true, message: "包名已复制。", data: "com.miui.home" }),
      convertMaml: async (xml: string) => ({ ok: true, message: "转换完成。", data: `<Lockscreen version="1" frameRate="30" screenWidth="1080">\n${xml}\n</Lockscreen>` }),
      openPath: async () => undefined
    },
    preview: {
      loadFolder: async () => ({ ok: true, message: "主题目录已加载。", path: "E:\\Themes\\NewTheme_v1", document: previewDocument }),
      loadMtz: async () => ({ ok: true, message: "MTZ 已加载。", path: "E:\\Themes\\ModernDark.mtz", document: { ...previewDocument, source: { kind: "mtz", path: "E:\\Themes\\ModernDark.mtz", label: "ModernDark.mtz" } } }),
      refresh: async () => ({ ok: true, message: "预览已刷新。", document: { ...previewDocument, generatedAt: Date.now() } }),
      exportScreenshot: async () => ({ ok: true, message: "截图已导出。", path: "E:\\Themes\\preview.png" }),
      watchStart: async () => ({ ok: true, message: "预览监听已启动。" }),
      watchStop: async () => ({ ok: true, message: "预览监听已停止。" })
    },
    updates: {
      check: async () => ({
        currentVersion: "0.1.0",
        latestVersion: "0.1.1",
        available: true,
        message: "New version 0.1.1 is available.",
        releaseUrl: "https://example.com/xiaomi-theme-packer/latest",
        downloadUrl: "https://example.com/xiaomi-theme-packer/Xiaomi-Theme-Packer-0.1.1.exe"
      }),
      openDownload: async () => undefined,
      downloadAndInstall: async () => ({ ok: true, message: "Update downloaded. Installer started." })
    },
    events: {
      onLog: (_callback: (entry: LogEntry) => void) => () => undefined,
      onProgress: (_callback: (payload: ProgressPayload) => void) => () => undefined,
      onPreviewChanged: (_callback: (document: PreviewDocument) => void) => () => undefined,
      onUpdateProgress: () => () => undefined
    }
  };

  window.xiaomiThemePacker = api;
}
