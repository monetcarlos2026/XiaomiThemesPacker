import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { DeviceStatus } from "../../types";

export interface AdbContext {
  resourcesPath: string;
  appPath: string;
  cwd: string;
}

export interface AdbResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function findAdb(context: AdbContext) {
  const candidates = [
    path.join(context.resourcesPath, "third_party", "adb", "adb.exe"),
    path.resolve(context.appPath, "third_party", "adb", "adb.exe"),
    path.resolve(context.cwd, "third_party", "adb", "adb.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe"),
    path.join(process.env.ANDROID_HOME || "", "platform-tools", "adb.exe"),
    "adb"
  ];
  return (
    candidates.find((candidate) => {
      if (candidate === "adb") return true;
      if (candidate.includes(`${path.sep}app.asar${path.sep}`)) return false;
      return fs.existsSync(candidate);
    }) || "adb"
  );
}

export function runAdb(context: AdbContext, args: string[], timeoutMs = 30000): Promise<AdbResult> {
  return new Promise((resolve) => {
    const child = spawn(findAdb(context), args, {
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

async function getReadableDeviceModel(context: AdbContext, fallback = "") {
  const properties = [
    "ro.product.marketname",
    "ro.product.vendor.marketname",
    "ro.product.model",
    "ro.product.vendor.model",
    "ro.product.odm.model"
  ];

  for (const property of properties) {
    const result = await runAdb(context, ["shell", "getprop", property], 10000);
    const value = result.stdout.trim();
    if (result.code === 0 && value && value !== "unknown") return value;
  }

  return fallback || undefined;
}

export async function getDeviceStatus(context: AdbContext): Promise<DeviceStatus> {
  const devices = await runAdb(context, ["devices", "-l"], 10000);
  if (devices.code !== 0) return { connected: false };

  const modelFromList = parseAdbDeviceModel(devices.stdout);
  const hasConnectedDevice = devices.stdout
    .split(/\r?\n/)
    .slice(1)
    .some((line) => /\bdevice\b/.test(line) && !/\bunauthorized\b|\boffline\b/.test(line));
  if (!hasConnectedDevice) return { connected: false };

  return { connected: true, model: await getReadableDeviceModel(context, modelFromList) };
}

export function startTrackDevices(context: AdbContext, onChange: () => void) {
  try {
    const child = spawn(findAdb(context), ["track-devices"], { windowsHide: true });
    child.stdout.on("data", onChange);
    child.on("exit", onChange);
    child.on("error", onChange);
    return child;
  } catch {
    return null;
  }
}
