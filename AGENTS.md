# AGENTS.md — Fishing

> 打开本仓库时的第一入口。  
> 壳来自 niantu 的适配和 three-webgpu-cap-shell 的打包。玩法规则以 `docs/FISHING-REQUIREMENTS.md` 为准。  
> 做内容时的规矩在 `docs/CONVENTIONS.md`。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 的竖屏钓鱼。设计空间 **390×844**。当前启动的是岸边：水面、鱼群、第一人称鱼竿、鱼线、饵、水花和抄网，这些是物料。手机就是鱼竿。玩法能把一竿走到头：甩出去、落水、长按收线，鱼从鱼群里游来咬上，冲的时候把线带出去，耗到没力以后收到身边，咬着饵甩着被提出水面，落进抄网，网带着它出画面，这一竿结束。鱼分小、大两档，力气跟体型走；冲的时候竿深弯、点头、手发颤，一歇这些一起停，玩家靠这个知道能收了；冲的时候按住是硬顶，顶久了线可能断，断了要收回空线。每条鱼都直接咬死，这是替身。咬口的种类、抬杆、跑离还没做。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.ts` |
| 岸边场景 | `src/shore/startShore.js` |
| 岸边鱼群 | `docs/FISH-SCHOOL.md`，入口 `src/fish/school.js`，分层见文档第 1 节。出了水的鱼怎么摆在 `src/fish/hung.js` |
| 鱼竿和渔轮 | `docs/ROD.md`，入口 `src/shore/rod.js`，分层见文档第 1 节。吃力的手是 `src/shore/rodHand.js`，渔轮是 `src/shore/reel.js` |
| 不用手机能跑的检查 | `checks/`：`rig.mjs` 在 Node 里搭一整竿，`check.mjs` 是常驻的检查，`record.mjs` 给只整理结构的改动做前后对比。见 `docs/CONVENTIONS.md` 第 7 节 |
| 手机瞄准和镜头 | `docs/PHONE-LOOK.md`，读姿态 `src/shore/phoneLook.js`，镜头追什么、剩下的给竿 `src/shore/aim.js`，逆着线的力手欠多少 `src/shore/handLag.js`，接线在 `src/shore/startShore.js` 的 `applyPhone` |
| 手指、设置面板和提示 | `src/shore/finger.js`（按没按着、拖了多远，桌面用空格键），`src/shore/tunePanel.js`（滑条、镜头回正、这一竿的读数），`src/shore/notice.js`（画面上一句会淡掉的话，只用来说线断了） |
| 鱼线 | `docs/LINE.md`，`src/shore/line.js`，形状在 `src/shore/lineCurve.js` |
| 饵 | `docs/LURE.md`，模型 `src/shore/lure.js`，怎么动 `src/shore/lureMove.js`，朝哪 `src/shore/lurePose.js` |
| 抄网 | `docs/NET.md`，模型 `src/shore/net.js`，走的路 `src/play/scoop.js` |
| 水花和水纹 | `docs/SPLASH.md`。落水的水花：画 `src/shore/splash.js`，形状 `src/shore/splashBurst.js`。贴着水面划过去的纹（线入水的那一点、近水面的鱼）：画 `src/shore/wake.js`，多快多强 `src/shore/wakeTrack.js`，没有人打开它，只看那个点走多快。都放在海面上方，不动海面 |
| 玩法 | `docs/PLAY.md`。接线的两个：`src/play/fishing.js`（饵这一半和整竿走到哪）、`src/play/catch.js`（鱼这一半）。其余只算数，一个文件回答一个问题：`swing`、`retrieve`、`lineOut`、`looseLine`、`fishKind`、`visit`、`fight`、`course`、`haul`、`snap`、`thump`、`strain`、`reelClick`、`tipWeight`、`kick`、`scoop`，表在文档第 1 节。每条鱼不一样的数（力气、气力、甩头、多重）只写在 `fishKind.js` 的表里 |
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
| 因果链（设计，还没重构） | `docs/CHAIN.md`。力和运动从手经竿、轮、线到线头上的东西怎么传，现在差在哪，分几段改 |
| 鱼怎么跑（设计，还没改） | `docs/FISH-RUN.md`。鱼往哪跑是它自己的事，我们只能牵制；线拉住时沿弧滑；牵制有回报；看得出它往哪去 |
| 记下、还没改的手感 | `docs/NOTED.md`。2026-11-19 对过、还没改的那几条 |
| 《荒野大镖客 2》和 GTA 6 的钓鱼 | `docs/ROCKSTAR-FISHING.md`。检索材料，不是规格 |
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
11. **物料里不写玩法。** 水面、鱼群、鱼竿、鱼线、饵、水花、抄网不含抛投、咬口和拔河。规则只写在 `src/play/`，只通过物料留的口子动物料；口子的表在 `docs/CONVENTIONS.md` 第 1 节。物料只报数，这个数意味着什么由玩法判断；什么时候、多用力归玩法，成什么样归物料。镜头不由玩法直接动，玩法只报出要看的点 `fishing.watch`。
12. **鱼不横移，动作连续。** 行为只写目标朝向、速度、深度，由 `src/fish/swim.js` 游过去。不要直接改鱼的位置。唯一的例外是出了水、挂在线上的鱼，走鱼群的 `hang` 和 `keep`，见 `docs/FISH-SCHOOL.md` 第 7 节。
13. **竿和线：只用位置去追，帧率不改变结果。** 不对镜头的输入求加速度，不设撞上去的上限，竿不拉长。想让竿受力，改线的远端或线长，不要直接往竿尖加力。出了水、挂在线上的重量就是线头上的一个重物，由线带着（`line.carry`），经过线压到竿尖；握竿的手多吃力走 `rod.setStrain`。见 `docs/ROD.md` 第 2、3 节。
14. **手机瞄准只读姿态。** 同一个手机姿态永远是同一个瞄准。不从加速度积分位移，不逐帧累加偏移。镜头在追什么可以换（手机、不动、玩法指的点），换的只是目标，不切换算法。线在拉的时候握竿的手可以欠着手机一段，那是手的状态：有上限，力没了就清掉，手不转就不欠。见 `docs/PHONE-LOOK.md` 第 2、4 节。
15. **`startShore.js` 只创建、接线、定每帧的顺序。** 规则进 `src/play/`，物料进各自的文件，输入进 `finger.js`，面板进 `tunePanel.js`。
16. **改了 `src/` 就跑 `npm run check`，只整理结构还要 `npm run record` 前后逐行相同。** 出了新的错，修的同时在 `checks/check.mjs` 加一项。它们判断不了手感和观感，那要真机。见 `docs/CONVENTIONS.md` 第 7 节。

第 11 到 16 条以及坐标、资源、验证、文档的规矩，展开写在 `docs/CONVENTIONS.md`。

## 命令

```bash
npm install
npm run dev           # http://127.0.0.1:5190/  端口被占就换端口
npm run build
npm run check         # 不用手机能跑的检查，改了 src/ 就跑。可以带一个词只跑名字里有它的
npm run record        # 录数。只整理结构时前后各跑一遍，逐行相同才算没改行为
npm run cap:sync      # 只改网页
npm run ios:bootstrap # 首次 / 改 Swift
npm run ios           # sync 并打开 Xcode
```

真机：Xcode 选已连接的 iPhone，Run。开发签名团队是工程里已有的 `DEVELOPMENT_TEAM`。

## 还没做

- 咬口的种类和抬杆、跑离和惊吓、饥饿和喜好。现在每条鱼都直接咬死，是替身，见 `docs/PLAY.md` 第 13、14 节。接着在 `src/play/` 往下写，规则在需求文档，不要在场景里另写一套。
- 竿抬多高改变传到线上的力、鱼起跳和压竿防跳。参考材料在 `docs/LURE-FIGHT-RESEARCH.md`，都还不是规则。线把鱼拉向竿尖、鱼划弧掉头已经做了，见 `docs/PLAY.md` 第 8 节。
- 两处量出来但还没定的：小鱼在按着收线时冲和歇在竿上分不开；最大的鱼一直硬顶两成左右断线。见 `docs/PLAY.md` 第 12、14 节。
- 真机确认。手机瞄准的方向、甩竿的力度和落点、收线的快慢、镜头转向落点和交还的快慢、水花的大小、鱼冲的力度、出线和遛鱼的快慢、出线和收线时手里的咔咔、甩头的顿、握竿的手让多远颤多大、竿的侧倾、竿在冲和歇之间差多少、硬顶多久会断、镜头留竿的窗口多大、松着手抖竿时饵的反应、饵下沉时的样子、提鱼出水和抄网的样子，都只在 Node 和桌面页面里验过，没有在真机上确认。数字是起点，见 `docs/PHONE-LOOK.md` 和 `docs/PLAY.md` 第 13 节。设置面板的"这一竿"一行显示甩竿时竿尖的速度、鱼的体型、线的张力、鱼的力、手指叠的力和手多吃力。
- 抛投的快慢是松手时竿尖的速度，照实；往哪抛、抛多高是手指按下那一刻镜头看的方向，不是竿尖出手的方向，往左右甩不会抛偏。线挡不开合：松手算线挡开着、按住算关上，只在规则里，模型上看不出来。
- 饵的重量不压竿，落水以后水面上读不出饵在哪，远处的饵只有几个像素。见 `docs/LURE.md` 第 6 节。
- 竿的软硬已经按鱼的力定过一次（`docs/ROD.md` 第 4 节的转角表）。出线点、断开点或者鱼的力再改时，要回来对这张表。竿放得低、鱼又远时，再大的力也只多弯一点。
- 气泡、咬口涟漪、水面上真正的涟漪。落水的水花已有，同时只能放一次；线切水和鱼近水面的水纹已有，没在真机上看过，见 `docs/SPLASH.md` 第 6、8 节。
- 音效。按 `docs/AUDIO.md`，禁止热路径 `new Audio()`。震动已经有几处（钩住、甩头的顿、出线和收线的咔咔、线断、到身边、出水、落网），表在 `docs/PLAY.md` 第 11 节，轻重都没在真机上试过。
- 鱼出水、入网时水面和网的细节：水花同时只能放一次，网兜是整体拉长的，没有拿网的手。见 `docs/SPLASH.md` 第 6 节和 `docs/NET.md` 第 6 节。
- Android。
