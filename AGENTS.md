# AGENTS.md — Fishing

> 打开本仓库时的第一入口。  
> 壳来自 niantu 的适配和 three-webgpu-cap-shell 的打包。玩法规则以 `docs/FISHING-REQUIREMENTS.md` 为准。  
> 做内容时的规矩在 `docs/CONVENTIONS.md`。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 的竖屏钓鱼。设计空间 **390×844**。当前启动的是岸边：水面、鱼群、第一人称鱼竿、鱼线、饵和水花，这些是物料。手机就是鱼竿。玩法做了一竿的前半段：甩出去、落水、长按收线。咬口和拔河还没做。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.ts` |
| 岸边场景 | `src/shore/startShore.js` |
| 岸边鱼群 | `docs/FISH-SCHOOL.md`，入口 `src/fish/school.js`，分层见文档第 1 节 |
| 鱼竿和渔轮 | `docs/ROD.md`，入口 `src/shore/rod.js`，分层见文档第 1 节。渔轮是 `src/shore/reel.js` |
| 手机瞄准和镜头 | `docs/PHONE-LOOK.md`，读姿态 `src/shore/phoneLook.js`，镜头追什么、剩下的给竿 `src/shore/aim.js`，接线在 `src/shore/startShore.js` 的 `applyPhone` |
| 手指和设置面板 | `src/shore/finger.js`（按没按着、拖了多远，桌面用空格键），`src/shore/tunePanel.js`（滑条、镜头回正、这一竿的读数） |
| 鱼线 | `docs/LINE.md`，`src/shore/line.js`，形状在 `src/shore/lineCurve.js` |
| 饵 | `docs/LURE.md`，模型 `src/shore/lure.js`，怎么动 `src/shore/lureMove.js` |
| 水花 | `docs/SPLASH.md`，画 `src/shore/splash.js`，形状 `src/shore/splashBurst.js`。放在海面上方，不动海面 |
| 玩法（抛投、收线） | `docs/PLAY.md`，入口 `src/play/fishing.js`，甩的力度 `src/play/swing.js`，收线速度 `src/play/retrieve.js`，线放出多长 `src/play/lineOut.js` |
| 水面（Minamo，MIT） | `src/shore/minamo/` |
| 资源 | `public/assets/`，路径前缀 `./assets/`。天空、沙滩、石头是 CC0；鲷鱼模型是 CC BY，发布要署名 |
| 单看一条鱼 | `fish.html` → `src/fish/preview.js` |
| 设计舞台 | `src/adapt/design.ts` |
| 设备预览 | `src/adapt/devicePreview.ts` |
| Safe Area | `src/adapt/safeArea.ts` + `src/style.css` |
| 失败提示 | `src/create-renderer.ts` 的 `showFatal` |
| 震动 JS | `src/utils/haptics.ts` |
| 震动 Swift 真源 | `plugins/native-haptics/*` |
| 包名 | `capacitor.config.ts`：`com.wangzhixuan.fishing` |
| 这一竿的规则 | `docs/FISHING-REQUIREMENTS.md` |
| 规范 | `docs/CONVENTIONS.md` |

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
5. **UI 只挂 `#ui-root`**。设置按钮和面板由 `startShore` 调 `tunePanel.js` 插进去。震动测试 DOM 在 `index.html`，启动后移进设置面板。
6. **Pad 只改外层视口**，不改 `DESIGN_*`。
7. **改 Swift 改 `plugins/native-haptics/`** 再 `ios:bootstrap`。Capacitor 8 的 `SceneDelegate` 必须是 `BridgeViewController`。
8. **无 WebGPU 则明确失败**，不静默 WebGL。Minamo 同样拒绝非 WebGPU。
9. **水面外观已定，先不要改。** 不要换掉三层 256² FFT，也不要再调浪高、雾、粗糙、曝光、太阳和反射压暗。数值见 `docs/ENGINEERING.md` 第 6 节。水花、涟漪这类局部的东西放在海面上方另加，不借机重做整片海；其中半透明的放进 `startShore` 的 `onWater` 场景，放进主场景会在水面上留洞。见 `docs/SPLASH.md` 第 2 节。
10. **包名保持 `com.wangzhixuan.fishing`**。模板 id `com.wangzhixuan.pwgbase.hapticstest` 会覆盖别的已装 App。
11. **物料里不写玩法。** 水面、鱼群、鱼竿、鱼线、饵、水花不含抛投、咬口和拔河。规则只写在 `src/play/`，只通过物料留的口子动物料；口子的表在 `docs/CONVENTIONS.md` 第 1 节。物料只报数，这个数意味着什么由玩法判断。镜头不由玩法直接动，玩法只报出要看的点 `fishing.watch`。
12. **鱼不横移，动作连续。** 行为只写目标朝向、速度、深度，由 `src/fish/swim.js` 游过去。不要直接改鱼的位置。
13. **竿和线：只用位置去追，帧率不改变结果。** 不对镜头的输入求加速度，不设撞上去的上限，竿不拉长。想让竿受力，改线的远端或线长，不要直接往竿尖加力。见 `docs/ROD.md` 第 2 节。
14. **手机瞄准只读姿态。** 同一个手机姿态永远是同一个瞄准。不从加速度积分位移，不逐帧累加偏移。镜头在追什么可以换（手机、不动、玩法指的点），换的只是目标，不切换算法。见 `docs/PHONE-LOOK.md` 第 2 节。
15. **`startShore.js` 只创建、接线、定每帧的顺序。** 规则进 `src/play/`，物料进各自的文件，输入进 `finger.js`，面板进 `tunePanel.js`。

第 11 到 15 条以及坐标、资源、验证、文档的规矩，展开写在 `docs/CONVENTIONS.md`。

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

- 咬口、抬杆、拔河、出线、线断、鱼离水。一竿的前半段已经在 `src/play/`，接着往下写，见 `docs/PLAY.md` 第 9 节。规则在需求文档，不要在场景里另写一套。上钩的鱼从鱼群里取，接口见 `docs/FISH-SCHOOL.md` 第 6 节。
- 真机确认。手机瞄准的方向、甩竿的力度和落点、收线的快慢、镜头转向落点和交还的快慢、水花的大小，都只在 Node 和桌面页面里验过，没有在真机上确认。数字是起点，见 `docs/PHONE-LOOK.md` 和 `docs/PLAY.md` 第 8 节。设置面板的"这一竿"一行显示甩竿读到的角速度。
- 抛投只取镜头的朝向，往左右甩不会抛偏。线挡不开合。
- 饵的重量不压竿，落水以后水面上读不出饵在哪，远处的饵只有几个像素。见 `docs/LURE.md` 第 6 节。
- 拔河用的竿的软硬。现在从侧面拉约 7 牛就弯到头，见 `docs/ROD.md` 第 8 节。
- 气泡、咬口涟漪、水面上真正的涟漪。落水的水花已有，同时只能放一次，见 `docs/SPLASH.md` 第 6 节。
- 音效和每一段的震动。音效按 `docs/AUDIO.md`，禁止热路径 `new Audio()`。
- Android。
