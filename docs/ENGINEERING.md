# Engineering — Fishing

配套：[AGENTS.md](../AGENTS.md) · [CONVENTIONS.md](./CONVENTIONS.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) · [FISH-SCHOOL.md](./FISH-SCHOOL.md) · [ROD.md](./ROD.md) · [PHONE-LOOK.md](./PHONE-LOOK.md) · [LINE.md](./LINE.md) · [LURE.md](./LURE.md) · [SPLASH.md](./SPLASH.md) · [NET.md](./NET.md) · [PLAY.md](./PLAY.md) · [AUDIO.md](./AUDIO.md) · [HAPTICS.md](./HAPTICS.md) · [MERGE.md](./MERGE.md)

壳的底座叫 portrait-webgpu-base，`package.json` 的 `name` 还是这个名字。App 的包名以 `capacitor.config.ts` 为准。

## 1. 定位

竖屏 WebGPU 钓鱼壳：能 dev、能 build、能真机、能震动，桌面预览接近手机/Pad。岸边水面、鱼群、鱼竿、鱼线、饵、水花、抄网和手机瞄准已经接上，都是物料。玩法以 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) 为准，写在 `src/play/`：一竿能走到头（甩出、落水、长按收线，鱼游来咬上，带着线冲，耗到没力收到身边，提出水面落进抄网），鱼分小、大两档，冲的时候硬顶可能断线，每条鱼都直接咬死是替身，咬口的种类、抬杆和跑离还没写，见 [PLAY.md](./PLAY.md)。

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
│   │   ├── startShore.js   # 岸边启动、每帧的顺序、摆镜头。只创建、接线和每帧调用
│   │   ├── finger.js       # 手指：画面上按没按着、拖了多远，桌面的空格键
│   │   ├── tunePanel.js    # 设置面板的 DOM
│   │   ├── notice.js       # 画面上一句会淡掉的话：线断了
│   │   ├── rod.js          # 鱼竿：模型、骨骼，串起下面三层
│   │   ├── rodHold.js      # 握：竿在镜头前的位置和滞后，加上手机的瞄准，吃力的手怎么让、怎么颤
│   │   ├── phoneLook.js    # 手机瞄准：把姿态读成三个角。不依赖 Three
│   │   ├── aim.js          # 手机瞄准：镜头追什么，剩下的给竿。不依赖 Three
│   │   ├── rodBeam.js      # 梁：沿竿的软硬和轻重，启动时解一次。不依赖 Three
│   │   ├── rodFlex.js      # 弯：每帧的惯性和回弹。不依赖 Three
│   │   ├── line.js         # 鱼线：画线，把竿尖系在远端上
│   │   ├── lineCurve.js    # 鱼线的形状：直线或悬链线。不依赖 Three
│   │   ├── lure.js         # 饵的模型
│   │   ├── lureMove.js     # 饵怎么动：固定、挂、飞、拖，鼻尖朝哪。不依赖 Three
│   │   ├── splash.js       # 水花：画水冠、水珠和圈
│   │   ├── splashBurst.js  # 水花随时间的形状。不依赖 Three
│   │   ├── net.js          # 抄网的模型
│   │   ├── reel.js         # 渔轮，四个可动部件，wind 按收的线长转
│   │   └── minamo/         # 水面与场景，MIT
│   ├── play/               # 玩法。唯一写钓鱼规则的地方，都不依赖 Three
│   │   ├── fishing.js      # 接线：饵这一半，和整竿走到哪一段
│   │   ├── catch.js        # 接线：鱼这一半，游来、咬上、遛、提、进网
│   │   ├── swing.js        # 甩多用力，抛多远
│   │   ├── retrieve.js     # 空竿按住时线收多快
│   │   ├── lineOut.js      # 竿尖外放出多长的线，线上的余线
│   │   ├── visit.js        # 鱼怎么游到饵跟前，多近算碰钩
│   │   ├── fishKind.js     # 每个品种、每档体型的鱼是什么样：一张表
│   │   ├── fight.js        # 钩住的鱼用多大力，气力，往哪游
│   │   ├── haul.js         # 挂着鱼时线收多快，出线点，线出多少
│   │   ├── snap.js         # 顶着出线的鱼按住叠多少力，线断不断
│   │   ├── thump.js        # 鱼甩头把线顿多重
│   │   ├── strain.js       # 握竿的手多吃力
│   │   ├── reelClick.js    # 渔轮在手里什么时候咔一下
│   │   ├── tipWeight.js    # 提出水面的鱼在竿尖上算多重
│   │   ├── kick.js         # 挂着的鱼这一刻甩多用力
│   │   └── scoop.js        # 抄网的圈走到哪，鱼怎么落进网
│   ├── fish/
│   │   ├── school.js       # 岸边入口：40 条真鱼 + 动画
│   │   ├── flock.js        # 一帧的流程，不依赖 Three
│   │   ├── hung.js         # 出了水的鱼：嘴在哪，怎么挂、怎么甩。不依赖 Three
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
- 落水的水花是放在海面上方的几何体，不算改水面，见 [SPLASH.md](./SPLASH.md)。它半透明，所以不在主场景里，在水面之后单独画的 `onWater` 场景里；半透明的东西放进主场景会在水面上留洞。还没做、也不算改水面：气泡、咬口涟漪。
- 岸边鱼群已接上，规范在 [FISH-SCHOOL.md](./FISH-SCHOOL.md)。游动在 `src/fish/` 下分层，不写进水面着色器。玩法通过 `take` / `giveBack` 取鱼和放回，用 `mouth` 读鱼嘴的位置，规则不写进鱼群。
- 鱼竿、渔轮和鱼线是代码建模，见 [ROD.md](./ROD.md) 和 [LINE.md](./LINE.md)。竿挂在镜头上，线加在场景根上。每帧先 `shoreSchool.update`，再 `fishing.update`、`applyPhone`、`rod.update`、`line.update`、`fishing.follow`。饵和玩法见 [LURE.md](./LURE.md) 和 [PLAY.md](./PLAY.md)。

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
玩法现在在哪几处震：钩住、甩头的顿、出线和收线的咔咔、线断和线被带光、到身边、出水、落网、网里每甩一阵、网出画面。表在 [PLAY.md](./PLAY.md) 第 11 节，咔咔的节奏在 `src/play/reelClick.js`，甩头的在 `src/play/thump.js`。

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
| 2026-11-18 | 甩出去以后镜头转过去看着饵，直到它被提出水面，不再停在按下时的朝向（手抬高时那是天）。竿仍然指着手机指的方向。玩法只报出要看的点 `fishing.watch`，`lockLook` 拿掉；`aim.step` 多收一个要看的方向 |
| 2026-11-18 | 镜头改成只转向落点一次、停在那里，不再跟着饵先仰后俯，收线时也不动。增加落水的水花：水冠、水珠和圈，放在海面上方，不动海面；大小按 10 克的饵定，远处的画得稍大 |
| 2026-11-18 | 水花缩到 10 克的饵该有的大小，并改成半透明。为此加了一个在水面之后画的场景 `onWater`，落在水面上的半透明物都放这里 |
| 2026-11-18 | 抛投距离重新分配：角速度范围从 90 到 420 拉宽到 120 到 750°/秒，曲线前缓后陡，最近 4 米，轻甩和重甩的落点分得开。镜头看完落点交还给手机时缓缓起步，约一秒转回去，不再一下甩过去 |
| 2026-11-18 | 整理：`aim.js` 里镜头的三种追法各成一段，加 `directionTo`；指针和空格键从 `startShore.js` 挪进 `finger.js`，设置面板挪进 `tunePanel.js`。只整理结构，瞄准和玩法的录数逐数相同，页面里拖动、按键、面板各验过一遍 |
| 2026-11-18 | 规范整理：代码分成物料、玩法、输入和界面、接线四种；会动的东西加四条通则（换状态只换目标、数量不在一帧归零、给定点不给动点、贴着别的东西要取当帧位置）；加画的顺序和大小、调手感的读数、先填的数、桌面替身的规矩；验证加页面里走一遍的办法。AGENTS 的硬性约定收短，加第 15 条 |
| 2026-11-18 | 规范整理：加"什么时候归玩法、成什么样归物料"、替身要标、随机数从外面给；会动的东西加六条（硬的按位置追、隔一帧互相读的不要互相顶、任意方向不用朝向角、叠在姿态上的量不跳、按量不按时间、看不见才能一步挪）；加"让人感觉得到"一节；验证加多跑种子、页面跑不稳要说、整理前先留一份；文档加按现状重写、试过不行的留一句、节号动了全工程搜。ROD、LINE、SPLASH、PHONE-LOOK 里过时的"以后"改成现状 |
| 2026-11-18 | 整理：`fishing.js` 只留饵这一半和整竿走到哪一段，鱼这一半挪进 `catch.js`；咔咔、鱼压竿多重、鱼甩多用力各成一个只算数的文件（`reelClick.js`、`tipWeight.js`、`kick.js`）；出了水的鱼怎么摆从 `flock.js` 挪进 `hung.js`。PLAY.md 按文件重写，FISH-SCHOOL.md 把出了水的鱼单列一节。只整理结构：五种按法、十条鱼，玩法对物料的每一次调用和每条鱼每帧的位置姿态，前后 1941 万个数逐个相同 |
| 2026-11-18 | 抄网改成鱼落进去：网停在鱼下面，鱼脱钩落进网兜，圈被砸得一沉再弹回，网兜坠长、晃动，网把鱼端起来再带出画面；饵留在线上。挂着的鱼多了整条身子的左右荡，`hang` 多收一个"甩多用力"：出水时和落网时猛甩，在网里一阵一阵地甩。出水时溅一次水花 |
| 2026-11-18 | 钓上来的鱼不再掉回水里：增加抄网（`src/shore/net.js`，路径 `src/play/scoop.js`，文档 NET.md），从左边进来兜住鱼、带出画面，这一竿结束，剩下的线自己收完。鱼群的 `drop` 换成 `keep`：看不见的鱼在画面外交还给鱼群。鱼嘴的位置按模型重新量：在中线下面 0.073 个体长，之前放在中线上，线连到了额头 |
| 2026-11-18 | 饵按自重下沉（0.35 米/秒，到约 2.4 米停住），被拉着时顺着线上来、不浅过 0.4 米；需求第 5、7 节同步改。挂在线上和掉落的鱼改用鼻尖和背两个向量记方向，不再在鱼头过竖直时翻面，入水时背朝上。遛鱼把冲和歇拉开：冲是猛地加速、带着线左右急窜、往下扎，起冲时翻水花；歇是几乎不动；歇有时被掐短 |
| 2026-11-18 | 遛鱼加出线和气力：鱼有力时冲的力高于出线点（4.5 牛），线被带出去，按着也收不动；冲和被收都耗气力，耗尽以后才收得到身边。出线和收线按线长打震动。到身边以后鱼咬着饵挂在线上被提出水面，重量压在竿尖上，举一会儿掉回水里。鱼群加 `hang`、`drop` 和 `hung`、`dropped` 两个状态；`rod.setTipLoad` 改重量时不再让竿重新落位。没被取走的鱼和没有鱼的一竿，前后逐数相同 |
| 2026-11-18 | 一竿走到头的最窄一版：饵落水几秒后，离它最近的一条鱼游过来，嘴碰到饵就钩住（每条都咬死，替身）；鱼冲一阵歇一阵，竿被线拉弯；按住是顶着鱼收线，越接近出线点越慢；收到身边算钓到，鱼放回鱼群（替身，不是离水）。新文件 `src/play/visit.js`、`fight.js`、`haul.js`。鱼群加 `mouth`，被取走的鱼多三个目标 `aim.slow`、`aim.rise`、`aim.top`；鱼群改到每帧最前面更新。没被取走的鱼和没有鱼的一竿，前后逐数相同 |
| 2026-11-17 | 弹出转动权限框的 `MotionPromptProxy` 补进真源 `plugins/native-haptics/BridgeViewController.swift`，之前只在 `ios/` 的副本里 |
| 2026-11-18 | 遛鱼的手感和角力。鱼分小、大两档，每档的力气、气力、甩头、多重写在 `src/play/fishKind.js` 一张表里，体型是鱼群给的（各占一半）；小鱼带不出线，收到身边就离水。竿调硬五倍（`TIP_STIFFNESS` 1.86 → 9.3），歇和冲的弯度才分得开；压竿的重量跟着改成每条鱼自己的。冲的时候鱼甩头，线上一顿一顿，竿尖点头、手里震（`thump.js`）；握竿的手被带出去、发颤（`strain.js` → `rod.setStrain` → `rodHold.js`）；一冲停下力先松掉七成，线拉得比鱼的力大时鱼被刹住、头被带过来，张力在 0.1 到 0.2 秒里掉下来、竿松成浅弯（原来 0.4 到 0.7 秒）。冲的时候按住是硬顶：渔轮多扛最多 4 牛，线出得慢，过了断开点 11.5 牛线会磨断（`snap.js`）；线断或线被带光以后是空线，饵不画，没有鱼来，收完才结束，线断时出一句"线断了"（`notice.js`）。需求第 11 节同步改 |
