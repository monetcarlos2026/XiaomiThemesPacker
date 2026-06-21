const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function findRcedit() {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
  if (!fs.existsSync(cacheRoot)) return "";

  for (const entry of fs.readdirSync(cacheRoot)) {
    const candidate = path.join(cacheRoot, entry, "rcedit-x64.exe");
    if (fs.existsSync(candidate)) return candidate;
  }

  return "";
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const rceditPath = findRcedit();

  if (!fs.existsSync(exePath)) {
    throw new Error(`Application exe not found: ${exePath}`);
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Icon file not found: ${iconPath}`);
  }
  if (!rceditPath) {
    throw new Error("rcedit-x64.exe not found in electron-builder cache.");
  }

  const result = spawnSync(
    rceditPath,
    [
      exePath,
      "--set-icon",
      iconPath,
      "--set-version-string",
      "FileDescription",
      context.packager.appInfo.productName,
      "--set-version-string",
      "ProductName",
      context.packager.appInfo.productName
    ],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error(`rcedit failed with exit code ${result.status}`);
  }
};
