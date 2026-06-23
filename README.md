# Xiaomi Theme Packer

Xiaomi Theme Packer 是一个用于小米 / MIUI / HyperOS 主题工程的 Windows 桌面打包工具，基于 Electron、React、TypeScript 和 Vite 构建。

## 下载

最新版本：`v0.1.2`

- [下载 Windows 安装包](https://github.com/Xavier-nai/XiaomiThemesPacker/releases/latest)
- 当前安装包文件名：`Xiaomi-Theme-Packer-0.1.2.exe`

## 主要功能

- 将主题工程目录打包为 `.mtz` 文件
- 解包已有 `.mtz` 文件到本地目录
- 通过 ADB 将主题部署到手机
- 查看运行日志，支持筛选、导出、清空和自动滚动
- 支持浅色、深色和跟随系统主题
- 提供窗口状态记忆、更新检查和安装包发布文件支持

## 技术栈

- Electron
- React
- TypeScript
- Vite
- electron-builder
- fflate

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 打包 Windows 安装包

```bash
npm run dist:win
```

默认打包输出目录为 `release/`。项目本地可能保留额外的发布目录，例如 `release-optimized-20260623-final/`，这些目录不提交到 Git。

## 项目结构

```text
electron/          Electron 主进程、预加载脚本和主题引擎
src/               React 渲染进程界面
build/             应用图标和打包资源
scripts/           打包后处理脚本
third_party/       第三方工具或运行依赖
```

## 说明

- 本项目主要面向 Windows 桌面环境。
- 使用部署功能前，需要本机可用 ADB，并连接已开启调试的 Android / 小米设备。
- 生成的 `.mtz` 文件兼容性取决于主题工程内容和目标系统版本。

## License

MIT
