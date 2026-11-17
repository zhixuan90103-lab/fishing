# Engineering — Fishing

配套：[AGENTS.md](../AGENTS.md) · [CONVENTIONS.md](./CONVENTIONS.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) · [FISH-SCHOOL.md](./FISH-SCHOOL.md) · [ROD.md](./ROD.md) · [AUDIO.md](./AUDIO.md) · [HAPTICS.md](./HAPTICS.md) · [MERGE.md](./MERGE.md)

壳的底座叫 portrait-webgpu-base，`package.json` 的 `name` 还是这个名字。App 的包名以 `capacitor.config.ts` 为准。

## 1. 定位

竖屏 WebGPU 钓鱼壳：能 dev、能 build、能真机、能震动，桌面预览接近手机/Pad。岸边水面、鱼群、鱼竿已经接上，都是物料。钓鱼状态机以 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) 为准，还没写。

## 2. 目录

```
Fishing/
├── AGENTS.md
├── README.md
├── docs/
├── index.html              # 游戏
├── fish.html               # 单看一条鱼
├── vite.config.ts          # base: './' · port 5190 · 两个入口页
├── capacitor.config.ts     # contentInset never · scrollEnabled false
├── src/
│   ├── main.ts             # 安全区、舞台、startShore、震动 HUD
│   ├── shore/
│   │   ├── startShore.js   # 岸边启动、设置面板、镜头。只创建和每帧调用
│   │   ├── rod.js          # 鱼竿，代码建模
│   │   ├── reel.js         # 渔轮，四个可动部件
│   │   └── minamo/         # 水面与场景，MIT
│   ├── fish/
│   │   ├── school.js       # 岸边入口：40 条真鱼 + 动画
│   │   ├── flock.js        # 一帧的流程，不依赖 Three
│   │   ├── shoal.js        # 整群的朝向、深度、节奏
│   │   ├── behaviors.js    # 状态、习性、归队
│   │   ├── swim.js         # 怎么游过去
│   │   ├── dorade.js       # 模型、对象池、脊柱姿态
│   │   └── preview.js      # fish.html 用
│   ├── create-renderer.ts  # showFatal；岸边不走 createRenderer
│   ├── style.css
│   ├── adapt/
│   │   ├── design.ts       # 390×844 · layout · clientToDesign
│   │   ├── devicePreview.ts
│   │   └── safeArea.ts
│   └── utils/haptics.ts
├── public/assets/          # HDRI、沙滩、石头、鲷鱼。cap sync 时拷进 iOS
├── plugins/native-haptics/ # Swift 真源
└── scripts/bootstrap-ios.mjs
```

## 3. 配置表

### Vite

| 项 | 值 | 原因 |
|----|-----|------|
| `base` | `'./'` | Capacitor 相对路径 |
| `outDir` | `dist` | = webDir |
| `port` | `5190` | 固定端口 |
| `target` | `es2022` | WebGPU |

### Capacitor

| 项 | 值 |
|----|-----|
| `appId` | `com.wangzhixuan.fishing`。不要用模板 `…hapticstest` |
| `appName` | `Fishing` |
| `webDir` | `dist` |
| `ios.contentInset` | `never` |
| `ios.scrollEnabled` | `false` |
| `ios.backgroundColor` | `#0b1020` |

### 设计尺寸

| 常量 | 值 |
|------|-----|
| DESIGN_WIDTH / HEIGHT | 390 / 844 |
| DESIGN_SAFE top/bottom | 59 / 34（桌面模拟） |
| Phone 预览 | 390×844 |
| Pad 预览 | 768×1024（外层视口） |

改设计尺寸时同步：`design.ts`、`style.css` 中 `#stage` 宽高、`index.html` 若有硬编码。

## 4. 适配算法

```
scale = min(viewW/390, viewH/844)   // contain
offset = 居中
#stage transform: translate(offset) scale(scale)
renderer.setSize(390, 844)          // 始终设计分辨率
```

触控：`clientToDesign`；letterbox 外忽略。

## 5. Safe Area

| 环境 | 行为 |
|------|------|
| 桌面 | JS 写入 `--safe-*` = DESIGN_SAFE |
| 原生 | 去掉 inline，CSS `env(safe-area-inset-*)` |
| UI | `#ui-root` padding = safe + ui-pad |

3D 可全出血；可点 UI 只在 `#ui-root`。

## 6. WebGPU 与水面

水面外观已定。下面的数是启动默认值，写在 `src/shore/startShore.js`。设置面板只用于当次试看，不要把试出来的另一组再写回去，除非明确要求改默认。

| 项 | 值 |
|----|-----|
| 雾色 | `#bdd7ea` |
| 雾起始 / 结束 | 0 / 180 |
| 风速 / 涌浪 / 翻卷 | 0.8 / 0 / 0.02 |
| 白沫 | 0.12 |
| 粗糙 / 透光 / 折射 | 0.2 / 0.22 / 1.32 |
| 曝光 / 太阳 / 泛光 | 0.61 / 0.37 / 0.012，自动曝光关 |
| 浪高 `waveScale` | 0.22（不在滑条上。低风速的 JONSWAP 是短碎浪，靠它压平） |
| 镜头 | `(0, 1.7, 2)`，yaw 100°，pitch −10° |

- Three **0.186.1**（`@types/three` 0.187.0）。0.186.1 的类型包没有发布。
- 岸边：`startShore` 建 `WebGPURenderer`。无 `navigator.gpu` 或后端不是 WebGPU → `showFatal`。
- 最终像素在 `#shore-view`。分辨率是设计尺寸 × min(dpr, 2) × `renderScale`。阴影贴图 2048。
- 海浪是三层 256² FFT（约 250 m / 37 m / 7.3 m）。改风速、涌浪、翻卷会 `ocean.rebuildSpectrum()`。
- 雾只混在水面着色器里，按视线仰角和距离。反射先往深水色拉一档（天空占 0.8），薄雾里雾色占 0.55。天空 HDRI 保持清晰。
- 陆地在 +z，海在 −z。拖画面改 yaw/pitch，并写回设置滑条。这还不是「手机就是鱼竿」。
- 资源在 `public/assets/`。代码许可在 `src/shore/minamo/LICENSE`（代码 MIT，Poly Haven 资源 CC0）。鲷鱼模型是 CC BY，见 [CONVENTIONS.md](./CONVENTIONS.md) 第 5 节。
- 禁止 `setSize(innerWidth, innerHeight)` 跟窗走。
- 还没做、也不算改水面：落水水花、气泡、咬口涟漪。
- 岸边鱼群已接上，规范在 [FISH-SCHOOL.md](./FISH-SCHOOL.md)。游动在 `src/fish/` 下分层，不写进水面着色器。钓鱼状态机通过 `take` / `giveBack` 取鱼和放回，规则不写进鱼群。
- 鱼竿和渔轮是代码建模，见 [ROD.md](./ROD.md)。  

## 7. Haptics

接线规范：[HAPTICS.md](./HAPTICS.md)

真源：`plugins/native-haptics/`  
JS：`src/utils/haptics.ts`（`registerPlugin('AdvancedHaptics')`）  
注册链路（Capacitor 8 真机已验通）：

```
SceneDelegate.rootViewController = BridgeViewController()
  → capacitorDidLoad
  → registerPluginInstance(AdvancedHapticsPlugin)
```

`ios:bootstrap` 会拷 Swift、改 storyboard、**改 SceneDelegate**、补 pbx。只 `cap:sync` 不够。

只改 storyboard **不够**：Capacitor 8 用 SceneDelegate 直接 `CAPBridgeViewController()`，会绕过 storyboard，HUD 出现 `plugin: false`，按钮无震。

Swift **没有** `prepare`；引擎在 `load()` 启动。UIKit 反馈在主线程触发。验收用 HUD **点我震动**（`impact`）和状态行 `plugin: true`。  
业务节奏（具名事件、cooldown、开关）写在游戏层，不要改插件除非新增原生方法。

## 7b. Audio（尚未实现）

本仓库无播放代码。接入规范见 [AUDIO.md](./AUDIO.md)：

- Loading **预解码**；热路径禁止 `new Audio()` / decode / 读盘
- `AudioBatcher`：**每帧最多一次** Capacitor 桥
- iOS 生产走 `AVAudioEngine` + PCM 缓存 + PlayerNode 池；**禁止**静默 WebAudio
- Catalog 管 cooldown / priority / maxVoices；忙帧再砍每帧条数

## 8. iOS 工作流

```bash
# 首次
npm install && npm run ios:bootstrap && npm run cap:open

# 日常
npm run cap:sync
```

## 9. 已知坑

1. **不要**把 `base` 改回 `'/'`  
2. **不要** `contentInset: automatic`（双重 inset）  
3. Pad 预览禁止横向拉满 390 UI  
4. pbxproj 优先 bootstrap，少手改  
5. `dist` / `ios/.../public` 是产物  
6. 真机安装前改 `capacitor.config.ts` 的 `appId`，避免覆盖别的 App  
7. 震动没接上：先看 [HAPTICS.md §0](./HAPTICS.md)。常见断点是 SceneDelegate 仍是默认 VC，不是 storyboard 没改。不要只 `cap:sync`，不要用 `prepare()` 当验收  

## 10. 变更

| 日期 | 说明 |
|------|------|
| 2026-08-03 | 初版：合并 niantu + shell 为 portrait-webgpu-base |
| 2026-08-14 | 增加 AUDIO.md：音效不卡帧方案 |
| 2026-08-14 | 增加 HAPTICS.md：震动一次接对 |
| 2026-08-31 | 真机震动验通。根因：Capacitor 8 `SceneDelegate` 绕过 storyboard。bootstrap 现会改 SceneDelegate；HUD 用「点我震动」+ `plugin` 标志验收 |
| 2026-11-16 | 岸边水面定稿。40 条鲷鱼的鱼群。第一人称纺车竿 |
| 2026-11-17 | 渔轮按真实纺车轮重做，独立成 `reel.js`，四个部件可单独驱动 |
| 2026-11-17 | 鱼的身体加脊柱行波、转弯弯身和侧倾；每条鱼有自己的游走和窜；整群节奏随机 |
| 2026-11-17 | 鱼不再横移：让开、归队、绕石头只改朝向和速度 |
| 2026-11-17 | 鱼群拆成 `shoal` / `behaviors` / `swim` / `flock` / `school` 五层，加 `take` / `giveBack` 给玩法取鱼 |
| 2026-11-17 | 增加 CONVENTIONS.md 和 ROD.md，FISH-SCHOOL.md 改写成设计文档 |
