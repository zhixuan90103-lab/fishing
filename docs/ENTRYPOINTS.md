# 入口与调用链

## 1. 命令

| 命令 | 结果 |
|------|------|
| `npm run dev` | http://127.0.0.1:5190/ |
| `npm run build` | `tsc` 检查 + `dist/`（相对路径） |
| `npm run cap:sync` | build + cap sync ios |
| `npm run ios:bootstrap` | add ios + 拷插件 + 改 storyboard **和 SceneDelegate** + pbx + sync |
| `npm run ios` | sync + open Xcode |

## 2. Web 启动链

```
index.html
  → style.css
  → main.ts
       → applyNativeClass / safeArea
       → startShore(#stage)
            → WebGPURenderer（Three canvas 隐藏）
            → #shore-view 接最终画面
            → 天空 HDRI、沙滩石头、三层 FFT 海面、后期
            → 岸边鱼群（docs/FISH-SCHOOL.md）
            → 设置面板（雾 / 水 / 镜头；震动测试移入面板）
       → mountDevicePreview → computeStageLayout → applyStageTransform
       → watchStageLayout
       → haptics 按钮（DOM 在 index.html，场景启动后位于设置内）
```

`createRenderer` 仍在，岸边路径不调用它。没有 `navigator.gpu` 时 `main.ts` 走 `showFatal`。

## 3. DOM

```
#shell
  #viewport
    #app
      #stage
        canvas
        #ui-root
#device-switcher / #device-label   (web only)
```

## 4. iOS

震动插件 **不会**随 `cap:sync` 自动注册。第一次 / 改插件必须 `ios:bootstrap`。步骤见 [HAPTICS.md §0](./HAPTICS.md)。

```
ios:bootstrap
  → 拷 plugins/native-haptics → ios/App/App
  → Main.storyboard customClass = BridgeViewController
  → SceneDelegate.rootViewController = BridgeViewController()   ← Capacitor 8 必改
Xcode Run 真机
  → SceneDelegate 创建 BridgeViewController
  → capacitorDidLoad → registerPluginInstance(AdvancedHapticsPlugin)
  → load App/public (= dist)
  → 同上 Web 链
  → HUD「点我震动」→ haptics.impact('medium')
```

HUD 状态行有 `plugin: true/false`。`false` = 仍在默认 `CAPBridgeViewController`，插件未进 JS `PluginHeaders`。

## 5. 改配置找谁

| 要改 | 文件 |
|------|------|
| base / 端口 | `vite.config.ts` |
| appId / appName | `capacitor.config.ts`（现为 `com.wangzhixuan.fishing` / Fishing） |
| 设计分辨率 | `design.ts` + `style.css` |
| 岸边与设置 | `src/shore/startShore.js` |
| 岸边鱼群 | [FISH-SCHOOL.md](./FISH-SCHOOL.md)，入口 `src/fish/school.js`。`flock.js` 一帧流程，`shoal.js` 整群，`behaviors.js` 状态和习性，`swim.js` 游动，`dorade.js` 模型 |
| 鱼竿和渔轮 | [ROD.md](./ROD.md)，`src/shore/rod.js`，`src/shore/reel.js` |
| 水面着色与雾 | `src/shore/minamo/ocean/waterMaterial.js` |
| 浪谱与浪高 | `src/shore/minamo/ocean/spectrum.js`、`ocean.js` 的 `waveScale` |
| 震动原生 | `plugins/native-haptics/*.swift` + bootstrap |
| 启动 HUD | `index.html` + `main.ts` |
| 音效（规划） | [AUDIO.md](./AUDIO.md) |
| 震动接线 | [HAPTICS.md](./HAPTICS.md) |
