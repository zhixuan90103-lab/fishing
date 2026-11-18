# 入口与调用链

## 1. 命令

| 命令 | 结果 |
|------|------|
| `npm run dev` | http://127.0.0.1:5190/ 是游戏，`/fish.html` 单看一条鱼 |
| `npm run build` | `tsc` 检查（只严格查 `.ts`）+ `dist/`（相对路径） |
| `npm run check` | 不用手机能跑的检查，十几秒。后面带一个词只跑名字里有它的，如 `npm run check camera` |
| `npm run record` | 把二十几竿和握竿的每一帧折成散列打出来。只整理结构时前后各跑一遍，逐行相同才算没改行为 |
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
            → 饵 createLure，加在场景根上（docs/LURE.md）
            → 水花 createSplash，加在水面之后画的场景 onWater 里（docs/SPLASH.md）
            → 抄网 createNet，加在场景根上，平时藏着（docs/NET.md）
            → 玩法 createFishing({ rod, line, lure, splash, school, net, haptics })（docs/PLAY.md），它再创建 createCatch
            → 每帧：shoreSchool.update → fishing.update → applyPhone → rod.update → line.update → splash.update → fishing.follow → 海面 → 场景 → 水 → 水面上的半透明物（onWater）→ 后期
            → 手指 createFinger(#shore-view)
            → 设置面板 mountTunePanel（镜头回正；雾 / 水 / 鱼 / 鱼竿 / 镜头；震动测试移入面板）
            → 提示 mountNotice（线断时说一句"线断了"）
       → mountDevicePreview → computeStageLayout → applyStageTransform
       → watchStageLayout
       → haptics 按钮（DOM 在 index.html，场景启动后位于设置内）
```

鱼群一帧（`shoreSchool.update`，在玩法之前：饵在鱼嘴里时取的是鱼这一帧的位置）：

```
school.js update
  → flock.step
       → shoal：整群的快慢、深度、朝向
       → 量每条鱼的拥挤
       → 对每条鱼：状态（或被取走后的 brain）→ 习性 → 归队 → swimFish
  → 尾巴动画 mixer.update → 脊柱波 poseSpine
```

玩法一帧（`fishing.update` 在鱼群之后、手机和竿之前，`fishing.follow` 在 `line.update` 之后。第一帧的 `line.update` 之后先调一次 `fishing.begin`）：

```
fishing.js update(dt, { finger, sensor, viewYaw, aimPitch })
  → 读上一帧线画出来的竿尖 line.tip
  → ready：swing.step 量瞄准的俯仰往下掉得多快；松手且够快 → 记下落点，lureMove.launch，从这一帧起 watch 是落点
           否则饵留在竿尖：lureMove.hold，line.stow
  → flight：lureMove.fly，按着就停线；lineOut.fly 线长跟着饵；落水 → splash.burst，落点换成真正的位置，lineOut.land，line.setTied(true)，catch.arm
  → water：retrieve.step 得出这一帧收多少线 → rod.reel.wind → lineOut.wind（先退余线）→ lureMove.tow
           靠近竿尖 → lureMove.hang，watch 变空，catch.sendAway；线收完 → ready
           catch.come：到时间 school.take 最近的一条鱼，brain 是 visit.steerToLure；嘴碰到饵 → fight
  → fight：catch.fight
           钩住的那一下 fishKind.fishOf(品种, 这条鱼的体型) 取出它的数
           fight.step 冲和歇、气力（起了一冲就 course.begin 定这一冲往哪边去）→ snap.step 手指叠多少力、线断不断 → thump.step 甩头把线顿多重
           → school.mouth 鱼嘴在哪 → haul.step 按 line.tension 收多少线 → rod.reel.wind → 饵放到鱼嘴上
           haul.slip 过了出线点加叠的力让出多少线 → reelClick.step 咔不咔 → watch 慢慢跟着鱼
           鱼的 brain 是 catch.js 的 fightBrain：fight.bearing 鱼在竿尖的哪边 → course.across 这一冲横着多快 + lead 竿带它多快 → fight.steer 写目标
           没力出线、又到了身边 → landed
           线断了，或者线被带光 → school.giveBack，回到 water，线上是空的：lure.show(false)，没有鱼再来，收完 → ready
  → landed：catch.land
           haul.step 提线 → lureMove.hang → tipWeight 鱼压竿多重 → kick 甩多用力 → school.hang 把鱼挂在饵上
           提到头吊一小会儿 → scoop.begin；scoop.step 圈在哪、鱼落到哪 → net.place
           网出画面 → school.keep，net.hide → water（饵已出水，线自己收完）
  → catch.carry：竿尖上的重量一小步一小步交给 rod.setTipLoad；strain.step 手多吃力 → rod.setStrain
  → line.setEnd / setLength（遛鱼时减去甩头顿的那一点），lureMove.point，lure.place
fishing.js follow()
  → ready：把饵摆到这一帧的 line.end 上，鼻尖朝上
```

手机瞄准一帧（`applyPhone`，在 `rod.update` 之前）：

```
startShore.js applyPhone
  → phone.advance：三个角平滑
  → fishing.watch 有点：算出从眼睛到它的方向
  → aim.step(phone.look() 或"没转过", 按住, dt, 要看的方向)
       → 有要看的方向：turnTo，镜头转向它
       → 否则没按住：followAim，镜头追瞄准
       → 瞄准 = 基准 + 转过的角度
       → 没按住：镜头追瞄准；否则镜头不动
       → 竿 = 瞄准 − 镜头
  → placeLook 按 aim.viewYaw / viewPitch 摆镜头
  → rod.setAim(aim.rodPitch, aim.rodYaw, aim.rodRoll)
```

竿和线一帧（`rod.update` 再 `line.update`，顺序不能换）：

```
rod.js update
  → rodHold.carry：读镜头朝向 → 平滑 → 滞后 → 加上手机的瞄准 → rodHand.step 吃力的手让、颤、侧倾 → 摆好根节点，报出握把在世界里的位置
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
| 岸边、每帧的顺序 | `src/shore/startShore.js` |
| 设置面板的滑条和布局 | `src/shore/tunePanel.js`，样式 `src/style.css` 的 `.tune-*` |
| 什么算手指按着、拖动怎么读 | `src/shore/finger.js` |
| 拖一个像素镜头转多少 | `src/shore/startShore.js` 的 `DRAG_DEG_PER_PIXEL` |
| 岸边鱼群 | [FISH-SCHOOL.md](./FISH-SCHOOL.md)，入口 `src/fish/school.js`。`flock.js` 一帧流程，`shoal.js` 整群，`behaviors.js` 状态和习性，`swim.js` 游动，`dorade.js` 模型 |
| 鱼竿：模型和骨骼 | [ROD.md](./ROD.md)，`src/shore/rod.js` |
| 鱼竿：在画面里的位置、跟镜头的滞后 | `src/shore/rodHold.js` |
| 手机瞄准：三个角怎么读、方向、平滑 | [PHONE-LOOK.md](./PHONE-LOOK.md)，`src/shore/phoneLook.js` |
| 手机瞄准：灵敏度、镜头跟得多紧、镜头和竿怎么分、看饵时转多快 | `src/shore/aim.js` |
| 甩出去以后镜头看着什么 | `src/play/fishing.js` 的 `watch` 和 `spot` |
| 水花的大小、高度、持续多久 | [SPLASH.md](./SPLASH.md)，`src/shore/splashBurst.js` |
| 水花的颜色和透明度 | `src/shore/splash.js` |
| 水面之后再画一层的东西 | `src/shore/startShore.js` 的 `onWater` |
| 多重的落水算多大的水花 | `src/play/fishing.js` 的 `SPLASH_FULL` |
| 手机瞄准：什么算按住、回正、摆镜头 | `src/shore/startShore.js` 的 `applyPhone`、`recenter`、`placeLook` |
| 转动权限的弹框 | `plugins/native-haptics/BridgeViewController.swift` + bootstrap |
| 鱼竿：软硬和调性 | `src/shore/rodBeam.js` |
| 鱼竿：甩动、回弹 | `src/shore/rodFlex.js` |
| 渔轮 | [ROD.md](./ROD.md) 第 7 节，`src/shore/reel.js` |
| 这一竿怎么走、没有鱼时手指是什么意思 | [PLAY.md](./PLAY.md)，`src/play/fishing.js` |
| 抛多远、多用力才算抛 | `src/play/swing.js` |
| 收线的快慢 | `src/play/retrieve.js` |
| 松着手抖竿，饵回来多少、晃多少 | `src/play/twitch.js` |
| 饵收在竿尖时怎么跟着摆、下沉时怎么晃 | `src/shore/lureMove.js` 的 `SWAY_*`、`SINK_DIP`、`SINK_SHIMMY` |
| 鱼多久来、来哪条、多近算到身边、提多高、吊多久叫网、网从哪边来 | `src/play/catch.js` 顶部的常量和 `nearestFish` |
| 鱼游向饵的快慢、多近算碰钩 | `src/play/visit.js` |
| 每一档鱼冲多大力、多耐累、甩头多重、压竿多重；加一种鱼 | `src/play/fishKind.js` 的表 |
| 鱼群里小鱼大鱼各多大、各占多少 | `src/fish/flock.js` 的 `SMALL_SIZE`、`BIG_SIZE`、`BIG_SHARE` |
| 钩住的鱼一冲一歇多久、线出多快、冲停时松多快 | `src/play/fight.js` |
| 一冲往哪边去、偏多少、多久折一次 | `src/play/course.js` |
| 带竿领鱼领多快、什么鱼领得动 | `src/play/lead.js` |
| 不用手机能跑的检查、整理前后的录数对比 | `checks/check.mjs`、`checks/record.mjs`，共用 `checks/rig.mjs`。`npm run check`、`npm run record` |
| 冲的时候按住能叠多少力、线多容易断 | `src/play/snap.js` |
| 鱼甩头的疏密和轻重 | `src/play/thump.js` |
| 握竿的手多早显出吃力 | `src/play/strain.js` |
| 吃力的手让多远、颤多大、侧倾多少 | `src/shore/rodHand.js` 的 `GIVE_REACH`、`GIVE_TURN`、`SHAKE`、`LEAN_MOST` |
| 线断时说的那句话、什么时候说 | `src/shore/startShore.js` 的 `LINE_BROKE`；怎么显示在 `src/shore/notice.js` |
| 挂着鱼时收多快、出线点、线怎么出 | `src/play/haul.js` |
| 出线和收线时手里咔多密、多重 | `src/play/reelClick.js` |
| 提出水面的鱼重量来得多快 | `src/play/tipWeight.js`。多重在 `fishKind.js` |
| 鱼什么时候猛甩、多用力 | `src/play/kick.js` |
| 挂在线上的鱼怎么甩、鱼嘴在哪 | [FISH-SCHOOL.md](./FISH-SCHOOL.md) 第 7 节，`src/fish/hung.js` |
| 被带走的鱼从哪回来 | `src/fish/flock.js` 的 `keep` |
| 抄网走的路、快慢 | [NET.md](./NET.md)，`src/play/scoop.js` |
| 抄网的外形 | `src/shore/net.js` |
| 被取走的鱼能写哪些目标 | [FISH-SCHOOL.md](./FISH-SCHOOL.md) 第 6 节，`src/fish/swim.js`、`src/fish/flock.js` |
| 线上的弧多大、落水后直得多快、收好时留多长 | `src/play/lineOut.js` |
| 设置面板里"这一竿"的读数 | 文字在 `src/shore/startShore.js`，显示在 `tunePanel.js` 的 `setCast`，样式 `.tune-cast` |
| 饵怎么飞、怎么荡、在水里怎么跟线、鼻尖怎么转 | [LURE.md](./LURE.md)，`src/shore/lureMove.js` |
| 饵的外形 | `src/shore/lure.js` |
| 渔轮收线时怎么转 | `src/shore/reel.js` 的 `wind` 和顶部常量 |
| 桌面用什么代替手指 | `src/shore/finger.js` 的空格键，取哪一个在 `src/shore/startShore.js` |
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
