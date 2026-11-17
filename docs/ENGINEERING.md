# Engineering — Fishing

配套：[AGENTS.md](../AGENTS.md) · [CONVENTIONS.md](./CONVENTIONS.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) · [FISH-SCHOOL.md](./FISH-SCHOOL.md) · [ROD.md](./ROD.md) · [LINE.md](./LINE.md) · [AUDIO.md](./AUDIO.md) · [HAPTICS.md](./HAPTICS.md) · [MERGE.md](./MERGE.md)

壳的底座叫 portrait-webgpu-base，`package.json` 的 `name` 还是这个名字。App 的包名以 `capacitor.config.ts` 为准。

## 1. 定位

竖屏 WebGPU 钓鱼壳：能 dev、能 build、能真机、能震动，桌面预览接近手机/Pad。岸边水面、鱼群、鱼竿、鱼线已经接上，都是物料。钓鱼状态机以 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) 为准，还没写。

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
│   │   ├── rod.js          # 鱼竿：模型、骨骼，串起下面三层
│   │   ├── rodHold.js      # 握：竿在镜头前的位置和滞后，加上手机的瞄准
│   │   ├── phoneLook.js    # 手机瞄准：把姿态读成三个角。不依赖 Three
│   │   ├── aim.js          # 手机瞄准：一个方向分给镜头和竿。不依赖 Three
│   │   ├── rodBeam.js      # 梁：沿竿的软硬和轻重，启动时解一次。不依赖 Three
│   │   ├── rodFlex.js      # 弯：每帧的惯性和回弹。不依赖 Three
│   │   ├── line.js         # 鱼线：画线，把竿尖系在远端上
│   │   ├── lineCurve.js    # 鱼线的形状：直线或悬链线。不依赖 Three
│   │   ├── lure.js         # 饵的模型
│   │   ├── lureMove.js     # 饵怎么动：固定、挂、飞、拖，鼻尖朝哪。不依赖 Three
│   │   ├── reel.js         # 渔轮，四个可动部件，wind 按收的线长转
│   │   └── minamo/         # 水面与场景，MIT
│   ├── play/               # 玩法。唯一写钓鱼规则的地方，都不依赖 Three
│   │   ├── fishing.js      # 这一竿走到哪：空杆、飞行、水里
│   │   ├── swing.js        # 甩多用力，抛多远
│   │   ├── retrieve.js     # 空竿按住时线收多快
│   │   └── lineOut.js      # 竿尖外放出多长的线，线上的余线
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
- 陆地在 +z，海在 −z。没有传感器时拖画面改 yaw/pitch，并写回设置滑条。真机上视线和竿由手机姿态决定，设置面板的「镜头回正」把手机此刻的姿态当成默认视线，见 [PHONE-LOOK.md](./PHONE-LOOK.md)。
- 资源在 `public/assets/`。代码许可在 `src/shore/minamo/LICENSE`（代码 MIT，Poly Haven 资源 CC0）。鲷鱼模型是 CC BY，见 [CONVENTIONS.md](./CONVENTIONS.md) 第 5 节。
- 禁止 `setSize(innerWidth, innerHeight)` 跟窗走。
- 还没做、也不算改水面：落水水花、气泡、咬口涟漪。
- 岸边鱼群已接上，规范在 [FISH-SCHOOL.md](./FISH-SCHOOL.md)。游动在 `src/fish/` 下分层，不写进水面着色器。钓鱼状态机通过 `take` / `giveBack` 取鱼和放回，规则不写进鱼群。
- 鱼竿、渔轮和鱼线是代码建模，见 [ROD.md](./ROD.md) 和 [LINE.md](./LINE.md)。竿挂在镜头上，线加在场景根上。每帧先 `fishing.update`，再 `applyPhone`、`rod.update`、`line.update`、`fishing.follow`。饵和玩法见 [LURE.md](./LURE.md) 和 [PLAY.md](./PLAY.md)。

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
| 2026-11-17 | 竿的运动重做并分层：`rodHold`（握，随镜头滞后）/ `rodBeam`（梁）/ `rodFlex`（弯）。竿身按渐细的梁解出三阶振动，力从握把传到竿尖，加竿尖负重和拉力两个口子 |
| 2026-11-17 | 增加鱼线：从渔轮穿过导环到远端，松时悬链线、绷时直线。线绷直后把竿尖系在远端上，竿被线拉弯，张力由线长和两端距离得出。远端和线长先由设置面板给 |
| 2026-11-17 | 修竿被线用力拉时的不自然弯曲：拉力只交给第一阶，竿尖最多转到和线同向，深弯表延到 87° |
| 2026-11-17 | 规范整理：会动的东西的通则、分层和验证办法写进 CONVENTIONS.md，物料设计文档定了统一的写法 |
| 2026-11-17 | 手机瞄准重做：视线和竿从手机姿态直接读，不再从加速度积分平移，也不用死区。同一个姿态永远是同一个画面。镜头和竿合成一条式子，按住只是镜头不追。左右看改成转动手机，上下方向改成顶部倒向自己为抬。加「镜头回正」。PHONE-LOOK.md 改写成设计文档，数字从 ROD.md 挪过去 |
| 2026-11-17 | 手机瞄准分层：镜头和竿怎么分从 `startShore.js` 挪进 `aim.js`，`rod.setAim` 改收三个角。只整理结构，同一段输入下握的结果逐数相同 |
| 2026-11-17 | 增加饵和玩法层。默认线收到头，饵固定在竿尖，不随甩动晃；按住向前甩、途中松手，饵按手机向前倾的角速度飞出 6 到 28 米；落水后长按收线，先慢后匀速；收完回到空杆。规则在 `src/play/`，饵的运动在 `lureMove.js`。线加 `stow`、`setTied` 和 `stiffness`，渔轮加 `wind`。设置面板里替玩法送数的"落点距离""余线"拿掉。桌面用空格键代替手指 |
| 2026-11-17 | 抛投的力度改成量手机向前倾的角速度，不再量竿尖：竿身软，竿尖跟不上手。落水后线上的余线约半秒内自己收掉，不再一帧跳直。设置面板加"这一竿"读数 |
| 2026-11-17 | 玩法分层：线长和余线从 `fishing.js` 挪进 `lineOut.js`，饵的鼻尖朝向和"固定在竿尖"挪进 `lureMove.js`，`fishing.js` 每一段的进入各成一个函数。只整理结构，玩法对物料的每一次调用逐数相同 |
| 2026-11-17 | 弹出转动权限框的 `MotionPromptProxy` 补进真源 `plugins/native-haptics/BridgeViewController.swift`，之前只在 `ios/` 的副本里 |
