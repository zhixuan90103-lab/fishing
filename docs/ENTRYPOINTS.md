# 入口与调用链

## 1. 命令

| 命令 | 结果 |
|------|------|
| `npm run dev` | http://127.0.0.1:5190/ 是游戏，`/fish.html` 单看一条鱼 |
| `npm run build` | `tsc` 检查（只严格查 `.ts`）+ `dist/`（相对路径） |
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
            → 岸边鱼群 createShoreSchool（docs/FISH-SCHOOL.md）
            → 鱼竿 createSpinningRod，挂在镜头上（docs/ROD.md）
            → 鱼线 createFishingLine(rod)，加在场景根上（docs/LINE.md）
            → 每帧：applyPhone → rod.update → line.update → shoreSchool.update → 海面 → 场景 → 水 → 后期
            → 设置面板（镜头回正；雾 / 水 / 鱼 / 鱼竿 / 鱼线 / 镜头；震动测试移入面板）
       → mountDevicePreview → computeStageLayout → applyStageTransform
       → watchStageLayout
       → haptics 按钮（DOM 在 index.html，场景启动后位于设置内）
```

鱼群一帧（`shoreSchool.update`）：

```
school.js update
  → flock.step
       → shoal：整群的快慢、深度、朝向
       → 量每条鱼的拥挤
       → 对每条鱼：状态（或被取走后的 brain）→ 习性 → 归队 → swimFish
  → 尾巴动画 mixer.update → 脊柱波 poseSpine
```

手机瞄准一帧（`applyPhone`，在 `rod.update` 之前）：

```
startShore.js applyPhone
  → phone.advance：三个角平滑
  → aim.step(phone.look(), 按住或锁住, dt)
       → 瞄准 = 基准 + 转过的角度
       → 没按住：镜头追瞄准；否则镜头不动
       → 竿 = 瞄准 − 镜头
  → placeLook 按 aim.viewYaw / viewPitch 摆镜头
  → rod.setAim(aim.rodPitch, aim.rodYaw, aim.rodRoll)
```

竿和线一帧（`rod.update` 再 `line.update`，顺序不能换）：

```
rod.js update
  → rodHold.carry：读镜头朝向 → 平滑 → 滞后 → 加上手机的瞄准 → 摆好根节点，报出握把在世界里的位置
  → rodFlex.step：细步长里推进各阶振动，其间按系着的线算竿尖受的拉力
  → 把骨骼摆到 rodFlex 给的曲线上
line.js update
  → rod.linePath：导线轮和各导环现在在哪
  → lineCurve.hangLine：竿尖到远端的形状，得出余线
  → rod.setTipTether：把远端和线长交给竿，下一帧用
```

单看一条鱼是另一个入口：`fish.html` → `src/fish/preview.js`，不经过 `main.ts`。

`createRenderer` 仍在，岸边路径不调用它。没有 `navigator.gpu` 时 `main.ts` 走 `showFatal`。

## 3. DOM

```
#shell
  #viewport
    #app
      #stage
        canvas          Three 画布，岸边路径里隐藏
        #shore-view     岸边最终画面
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
                     → webView.uiDelegate = MotionPromptProxy（转动权限弹框）
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
| 岸边、每帧的顺序、设置面板 | `src/shore/startShore.js` |
| 岸边鱼群 | [FISH-SCHOOL.md](./FISH-SCHOOL.md)，入口 `src/fish/school.js`。`flock.js` 一帧流程，`shoal.js` 整群，`behaviors.js` 状态和习性，`swim.js` 游动，`dorade.js` 模型 |
| 鱼竿：模型和骨骼 | [ROD.md](./ROD.md)，`src/shore/rod.js` |
| 鱼竿：在画面里的位置、跟镜头的滞后 | `src/shore/rodHold.js` |
| 手机瞄准：三个角怎么读、方向、平滑 | [PHONE-LOOK.md](./PHONE-LOOK.md)，`src/shore/phoneLook.js` |
| 手机瞄准：灵敏度、镜头跟得多紧、镜头和竿怎么分 | `src/shore/aim.js` |
| 手机瞄准：什么算按住、回正、摆镜头 | `src/shore/startShore.js` 的 `applyPhone`、`recenter`、`placeLook` |
| 转动权限的弹框 | `plugins/native-haptics/BridgeViewController.swift` + bootstrap |
| 鱼竿：软硬和调性 | `src/shore/rodBeam.js` |
| 鱼竿：甩动、回弹 | `src/shore/rodFlex.js` |
| 渔轮 | [ROD.md](./ROD.md) 第 7 节，`src/shore/reel.js` |
| 鱼线：形状 | [LINE.md](./LINE.md)，`src/shore/lineCurve.js` |
| 鱼线：外观、软硬、接到竿上 | `src/shore/line.js` |
| 线在竿上走哪些点 | `src/shore/rod.js` 的 `linePath` 和导环表 |
| 水面着色与雾 | `src/shore/minamo/ocean/waterMaterial.js` |
| 浪谱与浪高 | `src/shore/minamo/ocean/spectrum.js`、`ocean.js` 的 `waveScale` |
| 鱼的摆幅和骨骼 | `src/fish/dorade.js` 的 `SPINE` 表 |
| 渔轮的形状和尺寸 | `src/shore/reel.js` 顶部常量和各部件的轮廓表 |
| 震动原生 | `plugins/native-haptics/*.swift` + bootstrap |
| 启动 HUD | `index.html` + `main.ts` |
| 音效（规划） | [AUDIO.md](./AUDIO.md) |
| 震动接线 | [HAPTICS.md](./HAPTICS.md) |
| 规范 | [CONVENTIONS.md](./CONVENTIONS.md) |
