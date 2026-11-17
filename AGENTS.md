# AGENTS.md — Fishing

> 打开本仓库时的第一入口。  
> 壳来自 niantu 的适配和 three-webgpu-cap-shell 的打包。玩法规则以 `docs/FISHING-REQUIREMENTS.md` 为准。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 的竖屏钓鱼。设计空间 **390×844**。当前启动的是岸边水面，不是钓鱼状态机。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.ts` |
| 岸边场景 | `src/shore/startShore.js` |
| 岸边鱼群 | `docs/FISH-SCHOOL.md`，入口 `src/fish/school.js`，分层见文档第 1 节 |
| 鱼竿和渔轮 | `docs/ROD.md`，`src/shore/rod.js`，`src/shore/reel.js` |
| 水面（Minamo，MIT） | `src/shore/minamo/` |
| 岸边资源（CC0） | `public/assets/`，路径前缀 `./assets/` |
| 设计舞台 | `src/adapt/design.ts` |
| 设备预览 | `src/adapt/devicePreview.ts` |
| Safe Area | `src/adapt/safeArea.ts` + `src/style.css` |
| 失败提示 | `src/create-renderer.ts` 的 `showFatal` |
| 震动 JS | `src/utils/haptics.ts` |
| 震动 Swift 真源 | `plugins/native-haptics/*` |
| 包名 | `capacitor.config.ts`：`com.wangzhixuan.fishing` |
| 这一竿的规则 | `docs/FISHING-REQUIREMENTS.md` |

岸边不用 `createRenderer()`。`startShore` 自己建 `WebGPURenderer`，Three 的 canvas 隐藏，最终画面画到 `#shore-view`。

## DOM（勿拆）

```
#shell > #viewport > #app > #stage
  canvas          ← Three 画布，岸边路径里 display:none
  #shore-view     ← 岸边最终画面
  #ui-root        ← 状态、设置、震动测试
#device-switcher  ← 仅桌面预览
```

## 硬性约定

1. **`vite` `base: './'`** — Capacitor 禁止绝对 `/assets/`。
2. **`webDir: dist`** 与 Vite `outDir` 一致。
3. **`ios.contentInset: never`** — Safe Area 只走 CSS。
4. **布局坐标 390×844**。岸边画布按设计尺寸 × min(dpr, 2) × renderScale，不要 `setSize(innerWidth, innerHeight)`。
5. **UI 只挂 `#ui-root`**。设置按钮和面板由 `startShore` 插进去。震动测试 DOM 在 `index.html`，启动后移进设置面板。
6. **Pad 只改外层视口**，不改 `DESIGN_*`。
7. **改 Swift 改 `plugins/native-haptics/`** 再 `ios:bootstrap`。Capacitor 8 的 `SceneDelegate` 必须是 `BridgeViewController`。
8. **无 WebGPU 则明确失败**，不静默 WebGL。Minamo 同样拒绝非 WebGPU。
9. **水面外观已定，先不要改。** 不要换掉三层 256² FFT，也不要再调浪高、雾、粗糙、曝光、太阳和反射压暗。落点和咬口的局部涟漪以后另加，不借机重做整片海。数值见 `docs/ENGINEERING.md` 第 6 节。
10. **包名保持 `com.wangzhixuan.fishing`**。模板 id `com.wangzhixuan.pwgbase.hapticstest` 会覆盖别的已装 App。

## 命令

```bash
npm install
npm run dev           # http://127.0.0.1:5190/  端口被占就换端口
npm run build
npm run cap:sync      # 只改网页
npm run ios:bootstrap # 首次 / 改 Swift
npm run ios           # sync 并打开 Xcode
```

真机：Xcode 选已连接的 iPhone，Run。开发签名团队是工程里已有的 `DEVELOPMENT_TEAM`。

## 还没做

- 钓鱼状态机、手机即鱼竿、咬口和拔河。规则在需求文档，不要在场景里另写一套。上钩的鱼从鱼群里取，接口见 `docs/FISH-SCHOOL.md` 第 6 节。
- 鱼线，以及竿按受力方向弯。见 `docs/ROD.md`。
- 落水水花、气泡、咬口涟漪。
- 音效。按 `docs/AUDIO.md`，禁止热路径 `new Audio()`。
- Android。
