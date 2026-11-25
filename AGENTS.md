# AGENTS.md — Fishing

> 打开本仓库时的第一入口。  
> 壳来自 niantu 的适配和 three-webgpu-cap-shell 的打包。玩法规则以 `docs/FISHING-REQUIREMENTS.md` 为准。  
> 做内容时的规矩在 `docs/CONVENTIONS.md`。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 的竖屏钓鱼。设计空间 **390×844**。镜头在离岸四十多米的海面上方，当作站在船上（船没有画），脚下水深五米半上下。当前启动的是这片水：水面、鱼群、第一人称鱼竿、鱼线、饵、水花、水纹、涟漪和抄网，这些是物料。手机就是鱼竿。玩法能把一竿走到头：甩出去、落水、长按收线，没有人派鱼：饵边的鱼各有饥饿、兴趣和惊吓，自己聚到饵边，一次一条上去一口一口地咬（轻咬、中咬、重咬、咬死，从竿尖和手里读，不出字）；饵离鱼群远时从画面外补 1 到 10 条另加的鱼；慢慢收带停顿最招鱼，一直按着快收鱼不追；钩在嘴里时把手机往上一抽才钩住，抬空会惊到饵边的鱼，正咬的惊得多、旁边的少，饿的留下、不饿的跑；钩住以后冲的时候把线带出去，耗到没力以后收到身边，咬着饵甩着被提出水面，落进抄网，网带着它出画面，这一竿结束。鱼分小、大两档，力气跟体型走，每条鱼还有自己的底子；它往哪跑是它自己的事，我们只能用线牵制：它总想离岸更远，一冲有几秒、横着窜出几米，咬钩以后待在水面下 0.35 米，自己不上来；玩家把竿抬高十来度，线把它带到水面：它按自己的速度游上来，头先出水，在那里跟着竿的回弹上下、侧翻露出侧面、落回去猛摆尾，切出尾迹、甩出四溅的水花（深度在画面上会读成远近），往哪一侧起冲主要看鱼头朝哪，鱼头是线带成的，所以它在一个范围里来回；近岸它待不住，会再冲；冲和歇不按时钟，看它的爆发力和气力；一场是几轮（小鱼两三轮，大鱼六轮上下），每一轮冲的力、冲多久、带走的线都比上一轮小一截，没有另设的阶段；歇的时候它顶着线、背对着竿，一收线头被线带过来、鼻尖在前被拖到跟前，缓过劲再扭头跑；给它松线它会拿回去；冲的时候竿深弯、点头、手发颤，一歇这些一起停；冲的时候按住是硬顶：线出得慢，竿更弯、手更吃力；冲的时候逆着它游的方向带竿，它横着跑得慢、这一冲更短（照实只有百分之几，放大了四倍）；把竿压低，渔轮顶得更实，线出得慢。线不会断（2026-11-24 定了不做断线）；线松久了鱼会把钩甩掉，饵留在水里接着钓；线被带光要收回空线。咬口、抬杆、跑离、脱钩是 2026-11-24 做的一版，数字是起点，只在 Node 里量过。水对碰它的东西有反应（2026-11-25）：砸进去起水花和一圈圈涟漪，走着的东西身后拖 V 形尾迹，水下的东西头顶只是缓涌，出了水面的不动水面。需求另要冲的整段手机一直轻震，还没做，见 `docs/FISHING-REQUIREMENTS.md` 第 10 节。种类和重量留在内容里，不写上画面。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.ts` |
| 岸边场景 | `src/shore/startShore.js` |
| 鱼群 | `docs/FISH-SCHOOL.md`，入口 `src/fish/school.js`，分层见文档第 1 节。没有人指挥鱼群：一条鱼看得见什么在 `neighbours.js`，它怎么拿主意在 `behaviors.js`，它们待的那片水在 `homeWater.js`。出了水的鱼怎么摆在 `src/fish/hung.js` |
| 鱼竿和渔轮 | `docs/ROD.md`，入口 `src/shore/rod.js`，分层见文档第 1 节。吃力的手是 `src/shore/rodHand.js`，渔轮是 `src/shore/reel.js` |
| 不用手机能跑的检查 | `checks/`：`rig.mjs` 在 Node 里搭一整竿，`check.mjs` 是常驻的检查，`record.mjs` 给只整理结构的改动做前后对比，`shot.mjs` 把真的页面截出来看。见 `docs/CONVENTIONS.md` 第 7 节 |
| 手机瞄准和镜头 | `docs/PHONE-LOOK.md`，读姿态 `src/shore/phoneLook.js`，镜头追什么、剩下的给竿 `src/shore/aim.js`，逆着线的力手欠多少 `src/shore/handLag.js`，接线在 `src/shore/startShore.js` 的 `applyPhone` |
| 手指和设置面板 | `src/shore/finger.js`（按没按着、拖了多远，桌面用空格键代替手指、方向键上或 W 代替抬杆），`src/shore/tunePanel.js`（滑条、镜头回正、这一竿的读数），`src/shore/phoneAsk.js`（请求读手机转动的按钮）。画面上现在没有提示文字 |
| 鱼线 | `docs/LINE.md`，`src/shore/line.js`，形状在 `src/shore/lineCurve.js` |
| 饵 | `docs/LURE.md`，模型 `src/shore/lure.js`，怎么动 `src/shore/lureMove.js`，朝哪 `src/shore/lurePose.js` |
| 抄网 | `docs/NET.md`，模型 `src/shore/net.js`，走的路 `src/play/scoop.js` |
| 水花、水纹和涟漪 | `docs/SPLASH.md`。水面自己的起伏（涟漪，第 9 节）：算数 `src/shore/rippleField.js`，交给水面 `src/shore/ripples.js`，只认哪里、多重、多沉、多深；线、鱼、饵各留多大的尾迹在 `src/shore/wakeMarks.js`，多近算在水面上在 `src/shore/waterTop.js`。落水的水花：画 `src/shore/splash.js`，形状 `src/shore/splashBurst.js`。贴着水面划过去的纹（线入水的那一点、近水面的鱼）：画 `src/shore/wake.js`，多快多强 `src/shore/wakeTrack.js`，没有人打开它，只看那个点走多快。都放在海面上方，不动海面 |
| 玩法 | `docs/PLAY.md`，玩法只有这一份设计：一竿怎么走、咬口和抬杆（第 7 节）、钩住的鱼的规则（第 8 节，开头有一张"钓手手上有几样，各管什么"）、还没定的（第 14 节）、提过的需求和出过的问题（第 16 节）。接线的三个：`src/play/fishing.js`（饵这一半和整竿走到哪）、`src/play/suitors.js`（钩住之前围着饵的鱼）、`src/play/catch.js`（钩住的鱼）。其余只算数，一个文件回答一个问题：`swing`、`retrieve`、`lineOut`、`looseLine`、`fishKind`、`allure`、`muster`、`outOfSight`、`visit`、`bite`、`strike`、`fright`、`flee`、`fight`、`course`、`onLine`、`sideStrain`、`posture`、`highRod`、`surfacing`、`shed`、`haul`、`lean`、`lowRod`、`thump`、`strain`、`reelClick`、`tipWeight`、`kick`、`scoop`，表在文档第 1 节。每条鱼不一样的数（力气、气力、甩头、多重）只写在 `fishKind.js` 的表里 |
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
| 因果链 | `docs/CHAIN.md`。力和运动从手经竿、轮、线到线头上的东西怎么传。五段都做过一遍，第 3、4 段只做了要紧的一半，没做的在它的第 5 节。由它来的规矩在 `docs/CONVENTIONS.md` 第 3 节开头 |
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
9. **水面外观已定，先不要改；水对碰它的东西要有反应。** 外观指样式和颜色（2026-11-25 说明）：不要换掉三层 256² FFT，也不要再调浪高、雾、粗糙、曝光、太阳和反射压暗，数值见 `docs/ENGINEERING.md` 第 6 节。反应分两样：溅起来的水（水花、水珠）放在海面上方另加，半透明的放进 `startShore` 的 `onWater` 场景，放进主场景会在水面上留洞；水面自己的起伏（涟漪）是唯一写进水面的东西，接在水面材质的 `ripples` 上，只加高度和倾斜，颜色和光照的算法不动。水面上的东西让水面猛地动，水下的只让它缓缓地动，出了水面的不动它。见 `docs/SPLASH.md` 第 2、9 节。
10. **包名保持 `com.wangzhixuan.fishing`**。模板 id `com.wangzhixuan.pwgbase.hapticstest` 会覆盖别的已装 App。
11. **物料里不写玩法。** 每样东西只做自己的物理，能用统一规则的不写特殊规则，由力决定的事不用时钟和开关（`docs/CONVENTIONS.md` 第 3 节开头）。 水面、鱼群、鱼竿、鱼线、饵、水花、水纹、涟漪、抄网不含抛投、咬口和拔河；深了变成什么样、多近算在水面，是物料的事，玩法只报东西在哪、多重、多深、使了几成劲。规则只写在 `src/play/`，只通过物料留的口子动物料；口子的表在 `docs/CONVENTIONS.md` 第 1 节。物料只报数，这个数意味着什么由玩法判断；什么时候、多用力归玩法，成什么样归物料。镜头不由玩法直接动，玩法只报出要看的点 `fishing.watch`。
12. **鱼不横移，动作连续，没有人指挥鱼群。** 没被取走的鱼每条自己拿主意，只看身边的鱼和它待的那片水；不加整群的朝向、深度、节奏，也不加整群共用的钟（`docs/FISH-SCHOOL.md` 第 2 节）。 行为只写目标：朝向、速度、深度，和姿势（侧躺多少、鼻尖被带起多少、猛摆尾多少），由 `src/fish/swim.js` 游过去。不要直接改鱼的位置和姿势。例外有三个：出了水、挂在线上的鱼，走鱼群的 `hang` 和 `keep`（`docs/FISH-SCHOOL.md` 第 7 节）；备用的鱼进水出水走 `bring` 和 `dismiss`，只许在看不见的地方（第 6 节）；钩住、还在水里的鱼可以被线整条拖着走（`aim.towX`、`aim.towZ`），它自己游的那一份仍只沿鼻尖，拖它的只能是线、只能朝竿尖（2026-11-24，`docs/PLAY.md` 第 8 节）。
13. **竿和线：只用位置去追，帧率不改变结果。** 不对镜头的输入求加速度，不设撞上去的上限，竿不拉长。想让竿受力，改线的远端或线长，不要直接往竿尖加力。出了水、挂在线上的重量就是线头上的一个重物，由线带着（`line.carry`），经过线压到竿尖；握竿的手多吃力走 `rod.setStrain`。见 `docs/ROD.md` 第 2、3 节。
14. **手机瞄准只读姿态。** 同一个手机姿态永远是同一个瞄准。不从加速度积分位移，不逐帧累加偏移。镜头在追什么可以换（手机、不动、玩法指的点），换的只是目标，不切换算法。线在拉的时候握竿的手可以欠着手机一段，那是手的状态：有上限，力没了就清掉，手不转就不欠。见 `docs/PHONE-LOOK.md` 第 2、4 节。
15. **`startShore.js` 只创建、接线、定每帧的顺序。** 规则进 `src/play/`，物料进各自的文件，输入进 `finger.js`，面板进 `tunePanel.js`，请求读手机转动的按钮在 `phoneAsk.js`。
16. **改了 `src/` 就跑 `npm run check`，只整理结构还要 `npm run record` 前后逐行相同。** 出了新的错，修的同时在 `checks/check.mjs` 加一项；加了一种新的手上动作，给录数加一竿做这个动作的。它们判断不了手感和观感，截图也只回答"有没有、在不在"，大小快慢像不像要真机。见 `docs/CONVENTIONS.md` 第 7 节。
17. **尺寸照真的东西填，先量再改。** 鱼多长、多重、多大力，竿多长，水多深，是同一个比例，表在 `docs/CONVENTIONS.md` 第 2 节。人说哪里看着不对，先量成数、找到主因再动手，一次只改一件；能截图的用 `npm run shot` 看。见 `docs/CONVENTIONS.md` 第 7 节"先看清楚，再动手"。

18. **每个主题的设计只有一份。** 玩法是 `docs/PLAY.md`，鱼群、竿、线、饵、抄网、水花（连同水纹和涟漪）、手机瞄准、因果链各一份。改设计就改那一份，不另起带日期的、专题的、待办的文档；还没定的写在那一份的"还没做"里。见 `docs/CONVENTIONS.md` 第 8 节。

第 11 到 18 条以及坐标、资源、验证、文档的规矩，展开写在 `docs/CONVENTIONS.md`。

## 命令

```bash
npm install
npm run dev           # http://127.0.0.1:5190/  端口被占就换端口
npm run build
npm run check         # 不用手机能跑的检查，改了 src/ 就跑。可以带一个词只跑名字里有它的
npm run record        # 录数。只整理结构时前后各跑一遍，逐行相同才算没改行为
npm run shot          # 把真的页面截出来。带 cast 是抛一竿、拍落水以后的水面；带 fight 是抛一竿、拍遛鱼的过程。图在 /tmp/fishing-shots
npm run cap:sync      # 只改网页
npm run ios:bootstrap # 首次 / 改 Swift
npm run ios           # sync 并打开 Xcode
```

真机：Xcode 选已连接的 iPhone，Run。开发签名团队是工程里已有的 `DEVELOPMENT_TEAM`。

## 还没做

先看 `docs/PLAY.md` 第 14 节：2026-11-24 遛鱼这一块改了很多，同一天加了咬口、抬杆、不派鱼、惊吓、脱钩和反着带竿，都有几样等定。

- **等定的几件**（`docs/PLAY.md` 第 14 节最上面）：咬死降到每一口 2.3% 以后干等 40 秒仍约五竿一竿自己钩上，还要不要再少；反着带竿能不能逼它当场掉头；竿偏着不回正整场反而长；脱口的鱼多数留下不跑。

- **遛鱼等定的**（`docs/PLAY.md` 第 14 节）：咬钩后急转往远处逃，现在转到横着就跑、往外很慢，小鱼出不去；小鱼顶着的劲小，头转得慢、松线拿不回；起冲甩头在真机上还需不需要。深度和姿势 2026-11-25 做了一版（抬竿带鱼到水面、跟着竿的回弹上下、头被线牵着、侧翻、猛摆尾，`docs/PLAY.md` 第 8 节"深度和姿势"），数都是起点：抬多高算数；头抬低头的节奏会不会太碎；大鱼侧得够不够。
- 松着的线画出来有一串小折，要改 `lineCurve.js`。现在线很少松，检查过得了，毛病还在。
- **咬口和抬杆等定的**（`docs/PLAY.md` 第 14 节）：三种口在手里分不分得开、来不来得及抬、抬杆的门槛（现在手机每秒往上倾 110 度）。全是起点。
- **饵边的鱼等定的**（`docs/PLAY.md` 第 14 节）：几条合适、会不会太挤，补的鱼游进来要五秒上下，旁边的鱼受的惊很小，按住不到一秒就算快收。全是起点。
- 每条鱼看不看得见饵只按远近（7 米），喜好没做。轻碰、咬钩时加速转身这些鱼自己的动作和咬口的涟漪没做。饵沉多深（现在停在 2.4 米，下面还有三米水）没定。
- 压竿让线出得慢 2026-11-24 做了；抬竿 2026-11-25 做了一半：把鱼带到水面，不改线上的力、没有代价（定了先不动）。鱼起跳和压竿防跳没做。参考材料在 `docs/LURE-FIGHT-RESEARCH.md`，都还不是规则。
- 量出来、不去调的：小鱼在按着收线时冲和歇在竿上分不开，一直按着十来秒就上来，这是照实的，不为它另写逻辑。
- 断线定了不做（2026-11-24）。硬顶只叠力，没有会输的代价；会丢鱼的是线松了脱钩。
- 带竿的回报：2026-11-24 加了反着带竿刹它，冲的时候带、歇了回正整场短一成上下。放大四倍够不够、竿偏着不回正整场反而长两三成，都没定。见 `docs/PLAY.md` 第 14 节。
- 脱钩的数是起点：线一直绷着不脱，每次歇都送竿放松二十到四十秒甩掉；完全放着不管的大鱼一分半钟里二十四竿脱两三竿，要不要这么多没定。跳出水面暂时不做。
- 真机：用户每次改完都在真机上试，试出来的问题当场提、当场改（来历在 `docs/PLAY.md` 第 16 节）。文档里"量到"的数都是 Node 里跑出来的，和真机上试是两回事：不要把"Node 里量过"写成"真机没试过"，也不要把它写成"确认过"。哪些手感用户已经认可，文档里没有逐条记，要知道就问。设置面板的"这一竿"一行显示玩法正在读到的数。
- 抛投的快慢是松手时竿尖的速度，照实；往哪抛、抛多高是手指按下那一刻镜头看的方向，不是竿尖出手的方向。线挡不开合，只在规则里。
- 饵的重量不压竿（竿按鱼的力调硬以后更是这样）。落水以后水面上读得出饵在哪的只有它被拖着走时那一道很轻的缓纹，停着或下沉时读不出。十几米外水下的鱼很淡。见 `docs/LURE.md` 第 6 节。
- 竿的软硬跟着鱼的力定（`docs/ROD.md` 第 4 节的转角表，表里的牛顿数是乘六以前的）。出线点或者鱼的力再改时，要回来对这张表。
- 水的反应（`docs/SPLASH.md`）还差：饵下沉时的气泡和越深越淡；鱼落网、网入水不砸水；圈不会被石头挡回来；鱼和线同时拖尾迹时同时近四十条在算，手机上的帧率没有数；镜头要是会下水，镜头前那条水线要补上涟漪。大小和强弱都是起点。
- 音效（`docs/AUDIO.md`）。震动已有几处，轻重还没定；冲的整段一直轻震还没做（需求第 10 节）。
- 水花还差：水冠和水柱是硬边的几何体，天光是一个定死的颜色；鱼出水的那堆水没有跟着鱼的身形。网兜是整体拉长的，没有拿网的手。
- 线只有 70 米，真的线轮一般一百五十米以上。船没有画。
- Android。
