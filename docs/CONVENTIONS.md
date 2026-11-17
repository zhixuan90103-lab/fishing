# 规范

做这个工程时要守的约定，按主题排。不能破的壳约定在 [AGENTS.md](../AGENTS.md) 的"硬性约定"，这里不重复，只写做内容时的规矩。

每一条后面的文档是它的出处，细节以出处为准。

## 1. 物料和玩法分开

现在做的水面、鱼群、鱼竿都是**物料**：自己能看、能动，不含钓鱼规则。玩法以后接上来，通过物料留的口子驱动它们。

- 钓鱼的规则只写在 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md)，代码只写在玩法那一层。不要在水面、鱼群、鱼竿里另写一套咬口或拔河。
- 物料对外只给**口子**，不给内部状态。现有的口子：

| 物料 | 口子 | 出处 |
|---|---|---|
| 鱼群 | `fishes`、`take(fish, brain)`、`giveBack(fish)` | [FISH-SCHOOL.md](./FISH-SCHOOL.md) 第 6 节 |
| 渔轮 | `rod.reel.rotor` / `spool` / `handle` 三个组 | [ROD.md](./ROD.md) |
| 鱼竿 | `rod.setTipLoad(kg)`、`rod.setTipForce(force)`、`rod.setPose(pose)` | [ROD.md](./ROD.md) 第 6 节 |
| 震动 | `haptics.*` | [HAPTICS.md](./HAPTICS.md) |

- 每个物料有自己的单看页面或单看办法，不必进游戏才能检查。鱼是 `fish.html`。

## 2. 坐标和单位

单位是米、秒、弧度。设置面板上给人看的角度用度。

| 对象 | 约定 |
|---|---|
| 世界 | +Y 向上。陆地在 +Z，海在 −Z。水面在 y = 0 附近 |
| 镜头 | 默认 `(0, 1.7, 2)`，朝向 100°，俯仰 −10° |
| 朝向角 yaw | 绕 +Y。yaw = 0 朝 +Z，增大时转向 +X。前进方向是 `(sin yaw, cos yaw)` |
| 鱼 | 头在 holder 的局部 +Z。旋转顺序 YXZ。正的 X 是低头。正的 yaw 是向鱼自己的左转 |
| 鱼竿 | 局部 +Y 从竿尾到竿尖。局部 +Z 是下面，导环和渔轮挂在这一侧 |
| 渔轮 | 原点在轮脚和轮座相接处。+Y 指竿尖，+Z 远离竿，+X 是钓手左手侧 |
| 屏幕 | 设计空间 390×844。触控先过 `clientToDesign` |

新加的模型也按"头或尖端朝局部正轴"来摆，并在文件头写明哪根轴是什么。

## 3. 会动的东西

出处：[FISH-SCHOOL.md](./FISH-SCHOOL.md) 第 2 节。

- **先定目标，再游过去。** 行为只写"想去的朝向、速度、深度"，真正挪位置的只有一处（`swim.js` 的 `swimFish`）。
- **鱼不横移。** 水平面上只沿鼻尖方向前进。任何新的力都先变成目标朝向和速度。
- **动作连续。** 目标可以突变，物体不能。速度、朝向、深度都朝目标逼近，加速快、减速慢。不瞬移，不突然掉头。
- **随机要有各自的钟。** 每条鱼的节奏、幅度、间隔出场时各取一次，不共用一个计时器，也不用固定循环。
- **逼近用 `1 - exp(-k·dt)`**，不用固定的每帧比例，这样帧率变了结果不变。`dt` 在入口处已经封顶到 1/20 秒。

## 4. 代码怎么放

| 目录 | 内容 | 语言 |
|---|---|---|
| `src/main.ts`、`src/adapt/`、`src/utils/` | 壳：启动、适配、安全区、震动 | TypeScript，strict |
| `src/shore/` | 岸边场景、鱼竿、渔轮 | JavaScript |
| `src/shore/minamo/` | 水面，第三方 MIT 代码 | JavaScript。尽量不改 |
| `src/fish/` | 鱼的模型和游动 | JavaScript |

- `npm run build` 里的 `tsc` 只严格检查 TypeScript。`.js` 文件不做类型检查，写错属性名不会报错，所以 JS 的改动要跑起来看。
- **一个文件一件事，文件头写清它管什么、不管什么。** 分层的例子是 `src/fish/`：`shoal`（整群）、`behaviors`（想做什么）、`swim`（怎么游）、`flock`（一帧流程）、`school`（接到场景）。竿也一样：`rodHold`（握）、`rodBeam`（梁）、`rodFlex`（弯）、`rod`（模型和接线）。
- **模拟和渲染分开。** `flock.js` 往下不引 Three，一条鱼只要有个能摆姿态的 `holder` 就行。这样游动可以在 Node 里用固定随机种子跑。竿的弯曲同理，在 `rodBeam.js` 和 `rodFlex.js`。
- **`startShore.js` 只负责创建和每帧调用。** 不要把游动、建模、玩法写进去。
- **尺寸和调节量放在文件顶部的常量里**，带一句说明。形状用数据表（比如渔轮的 `[半径, y]` 轮廓、鱼的 `SPINE` 表），改形状就是改表。
- **代码建模的东西按能动的部件分组**，每个组的原点放在它自己的转轴上。
- 注释用英文，写"为什么"和约定，不复述代码。文档用中文。

## 5. 资源

- 路径一律 `./assets/...` 相对路径。Capacitor 里绝对路径 `/assets/` 会白屏。
- 模型只加载一次，用对象池克隆。热路径不加载、不克隆、不销毁。
- 用了别人的资源，在用它的那个文件头写作者、来源链接和许可。现有的：

| 资源 | 许可 | 要求 |
|---|---|---|
| Minamo 水面代码 | MIT | 保留 `src/shore/minamo/LICENSE` |
| Poly Haven 的天空、沙滩、石头 | CC0 | 无 |
| 鲷鱼模型，作者 BlueMesh | CC BY | **发布时必须署名**。来源链接在 `src/fish/dorade.js` 文件头 |

## 6. 定稿的外观

出处：[ENGINEERING.md](./ENGINEERING.md) 第 6 节，[AGENTS.md](../AGENTS.md) 硬性约定第 9 条。

- 水面外观已定。启动默认值写在 `startShore.js`，对应的表在 ENGINEERING 第 6 节，两处要一致。
- 设置面板只用于当次试看。试出来的数不写回默认值，除非明确要求改默认。
- 以后别的物料定稿了，也按这个办法：默认值在代码里，表在文档里，面板只是试看。

## 7. 改完怎么验

按改的东西选，至少做一项，并在交付时说清做了哪项、没做哪项。

| 改了什么 | 怎么验 |
|---|---|
| 任何东西 | `npm run build` 通过；游戏页面加载后控制台无报错 |
| 模型外形 | 从几个角度截图看；再看第一人称镜头里的样子 |
| 只整理结构、不该改变结果 | 证明前后一致：画面逐像素比，或同一随机种子逐帧比数值 |
| 鱼的游动 | 在 Node 里跑 `flock.js` 几分钟，量：运动方向和鱼头的夹角（应为 0）、鱼群散布、两条鱼贴得太近的比例。和改之前的数对比 |
| 竿的弯曲 | 在 Node 里跑 `rodFlex.js`：甩一下再急停，量各阶频率、每次回摆的幅度、竿长、各段开始落后的先后；匀速转动时的偏移应接近 0。和改之前的数对比 |
| 鱼的身体姿态 | `fish.html` 把发力、弯身拉到最大，看有没有撕裂、方向对不对 |
| 手感、震动、甩竿 | 只能真机。桌面没有马达，也不能甩 |

动起来好不好看，截图和数值都判断不了，要人看。交付时把这一点说明白，不要说成已经确认。

## 8. 文档

每份文档只管一件事。同一个事实只写在一处，别处用链接。

| 文档 | 管什么 |
|---|---|
| [AGENTS.md](../AGENTS.md) | 第一入口：入口地图、不能破的硬性约定、命令、还没做的事 |
| [README.md](../README.md) | 给人看的简介：怎么跑、现在有什么 |
| CONVENTIONS.md（本文） | 做内容时的规矩 |
| [ENGINEERING.md](./ENGINEERING.md) | 壳、配置、水面定稿数值、iOS 流程、已知坑、变更记录 |
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 启动链，"要改什么找哪个文件" |
| [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) | 这一竿的规则。唯一的玩法真源 |
| [FISHING-FEEL.md](./FISHING-FEEL.md)、[FISHING-RESEARCH.md](./FISHING-RESEARCH.md) | 参考材料，不是本版范围 |
| [FISH-SCHOOL.md](./FISH-SCHOOL.md) | 鱼群的设计 |
| [ROD.md](./ROD.md) | 鱼竿和渔轮的设计 |
| [LINE-RESEARCH.md](./LINE-RESEARCH.md) | 鱼线做法的检索纪要，不是规格 |
| [HAPTICS.md](./HAPTICS.md)、[AUDIO.md](./AUDIO.md) | 震动接线；音效方案（未实现） |
| [MERGE.md](./MERGE.md) | 底座合并时的历史对照，不再更新 |

- 改了代码的结构、接口、默认值或约定，同一次改动里把对应文档改掉。
- 新加一个物料：加一份它自己的设计文档，在 AGENTS 的入口地图和 ENTRYPOINTS 第 5 节各加一行，在 ENGINEERING 第 10 节记一笔。
- 文档写现状和规则，不写过程。"还没做"的事单列，不混在已实现的描述里。

## 9. 提交

- 一次提交做一件事。提交信息是一句英文祈使句，首字母大写，句号结尾，说做了什么。例：`Split the school into layers and the reel into its own part.`
- `dist/` 和 `ios/App/App/public` 是产物，不手改。
- 改 Swift 改 `plugins/native-haptics/`，再跑 `ios:bootstrap`。不要直接改 `ios/` 里的拷贝。
