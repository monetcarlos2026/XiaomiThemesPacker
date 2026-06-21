# Xiaomi Theme Packer

Windows 桌面端主题打包工具，技术栈为 `Electron + React + TypeScript + Vite`。

## 项目目标

- 管理 Xiaomi 主题工程目录与 MTZ 文件
- 提供打包、解包、日志、更多设置三个页面
- 通过 Electron 实现原生窗口控制和系统能力调用
- 保持界面与设计稿一致，并支持窗口缩放与状态记忆

## 当前已实现结构

### 页面

- `打包`
  - 主题文件打包
  - 解包
- `日志`
  - 实时日志
  - 搜索
  - 导出日志
  - 清空日志
- `更多`
  - 主题模式切换
  - 清理主题缓存
  - 重启 ADB
  - 复制当前界面包名
  - 转换为 MAML 代码

### 窗口

- 无边框窗口
- 默认尺寸 `1440 x 900`
- 最小尺寸 `800 x 500`
- 支持拖动、最小化、关闭、最大化切换
- 记忆窗口位置和尺寸

## 技术栈

- Electron
- React 18
- TypeScript
- Vite
- `electron-window-state`
- `react-window`
- `fflate`

## 目录

- `src/`：前端 UI、状态、样式、图标、开发环境适配
- `electron/`：主进程、预加载脚本、IPC 类型
- `dist/`：前端构建产物
- `dist-electron/`：Electron 构建产物

## 主要模块

### `src/App.tsx`

主界面和页面路由，负责：

- 左侧导航
- 打包页、日志页、更多页切换
- 日志流与进度流展示
- 主题模式切换
- 设备状态展示

### `electron/main.ts`

主进程，负责：

- 创建窗口
- 保存窗口状态
- 调用文件选择器
- 调用 ADB
- 执行打包 / 解包 / 部署 / 清理 / 重启 / 复制包名 / MAML 转换
- 向渲染进程推送日志和进度

### `electron/preload.ts`

通过 `contextBridge` 暴露安全 IPC API。

### `src/devApi.ts`

开发模式下的 API 兜底实现，避免渲染层在无 Electron 宿主时直接报错。

## 运行脚本

```bash
npm install
npm run dev
npm run build
npm run dist
```

## 功能边界

当前实现聚焦于主题工具的核心工作流，不额外扩展设计稿外功能。

- 打包：选择主题工程目录，导出 MTZ
- 解包：选择 MTZ 并解压
- 日志：实时收集并展示操作日志
- 更多：主题模式、缓存清理、ADB 重启、包名复制、MAML 转换

## 已验证状态

- `npm run build` 通过
- `npm run dev` 可启动
- 最小 Electron 窗口验证通过
- 项目主窗口已成功创建并完成渲染截图

## 备注

- 开发模式下保留了少量诊断日志，方便确认窗口是否真实加载
- 当前设备名显示依赖 ADB 返回结果
