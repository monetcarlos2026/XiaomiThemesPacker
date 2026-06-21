import type { XiaomiThemePackerApi } from "../electron/preload";

declare global {
  interface Window {
    xiaomiThemePacker: XiaomiThemePackerApi;
  }
}
