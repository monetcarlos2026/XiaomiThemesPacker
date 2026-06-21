export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS" | "DEBUG";
export type PreviewMode = "lockscreen" | "home" | "aod";
export type PreviewSourceKind = "folder" | "mtz";

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
}

export interface ProgressPayload {
  operation: "pack" | "unpack" | "deploy" | "cleanup" | "adb" | "copy-package" | "maml" | "preview";
  percent: number;
}

export interface PackRequest {
  sourceDir: string;
}

export interface UnpackRequest {
  mtzPath: string;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  path?: string;
  data?: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  available: boolean;
  checking?: boolean;
  downloading?: boolean;
  downloadProgress?: number;
  message: string;
  releaseUrl?: string;
  downloadUrl?: string;
  notes?: string;
  publishedAt?: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total?: number;
  message: string;
}

export interface PreviewSource {
  kind: PreviewSourceKind;
  path: string;
  label: string;
}

export interface PreviewLog {
  id: string;
  time: string;
  level: LogLevel;
  scope: "parse" | "resource" | "expression" | "render" | "watch";
  message: string;
}

export interface RenderedNode {
  id: string;
  type: "group" | "image" | "text" | "datetime" | "shape" | "placeholder";
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  rotation?: number;
  text?: string;
  color?: string;
  size?: number;
  align?: string;
  src?: string;
  fill?: string;
  stroke?: string;
  children?: RenderedNode[];
}

export interface PreviewSurface {
  mode: PreviewMode;
  title: string;
  manifestPath?: string;
  available: boolean;
  rootTag?: string;
  width: number;
  height: number;
  background: string;
  nodes: RenderedNode[];
}

export interface PreviewDocument {
  source?: PreviewSource;
  generatedAt: number;
  activeMode: PreviewMode;
  surfaces: Record<PreviewMode, PreviewSurface>;
  logs: PreviewLog[];
}

export interface PreviewLoadResult extends OperationResult {
  document?: PreviewDocument;
}

export interface DeviceStatus {
  connected: boolean;
  model?: string;
}

export interface ThemePreference {
  mode: "system" | "light" | "dark";
}

export interface SelectPathResult {
  canceled: boolean;
  path?: string;
}
