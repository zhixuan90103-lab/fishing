# 鱼线和鱼钩检索纪要

三轮检索的结论，以及支撑这些结论的来源。只保留打开过、并且支撑某条结论的来源。没有来源的判断不写。

检索日期：2026-11-17。本文不是玩法规格。咬口、出线、拔河的规则仍以 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) 为准。竿和轮的现状见 [ROD.md](./ROD.md)。

## 1. 结论

采用三种做法合成一条线，不把整根 Verlet 粒子绳当成权威，也不用离散弹性杆做鱼线。

玩法只认三个量：放出的长度、竿尖、鱼钩。鱼钩在没钩住时是饵，钩住后是鱼嘴。松弛量是放出长度减去两端的直线距离。大于零是松，接近零是绷，鱼还想走得更远就是拉力。收线把长度变短，出线把长度变长。超过出线点就加长，而不是把鱼拽回来。

画面按这个量切换：

- 松的时候，用悬链线把竿尖和鱼钩连起来。抛投在空中飞的那一段也走这里，长度跟着饵走，线不能瞬移。
- 绷的时候画直线。需求里饵一落水线就是直的，所以入水后的正常状态是这条直线。
- 拉力的方向是竿尖指向鱼钩。竿只吃其中垂直于竿身的分量。冲的时候深弯，冲停了浅弯，线上没有重量就弹直。

鱼仍然只接受目标方向和速度，由现有的游动走过去。线绷紧时，把「沿鱼线被拉或被挡住」写成这个目标，不把鱼放进粒子约束里。

Verlet 粒子链只在抛投的甩动能看出来时再加几段中间点。它不决定出线、断线和气力。离散弹性杆留给以后的竿身，不留给这根几乎没有抗弯的线。

对应检索里的做法：松弛检测和只抗拉的最大长度来自方式 C，垂弧来自方式 A，张力和出线当作玩法量来自方式 E。方式 B 只作抛投甩动的可选画面。方式 D 不用于鱼线。

## 2. 有效来源

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Cable Components，Unreal Engine 5.6 | https://dev.epicgames.com/documentation/en-us/unreal-engine/cable-components-in-unreal-engine?application_version=5.6 | 官方文档 | Verlet、静止长度、两端钉住、迭代次数当刚度 |
| CatmullRomCurve3 | https://threejs.org/docs/pages/CatmullRomCurve3.html | 官方文档 | 样条只负责画。文档里的 tension 是曲线形状，不是鱼线拉力 |
| The Mathematics of Catenary，Zucconi，2020-12-13 | https://www.alanzucconi.com/2020/12/13/catenary-1/ | 其他 | 悬链线画平衡垂弧。会动的缆绳另用 Verlet |
| Position based dynamics，Müller 等，2007 | https://www.sciencedirect.com/science/article/pii/S1047320307000065 | 论文 | 直接改位置比硬弹簧稳 |
| XPBD，Macklin、Müller、Chentanez，2016 | https://learn.physics-simulation.org/examples/xpbd.html | 论文 | 柔度决定能被拉长多少，和迭代次数分开 |
| XPBD 讲义，Müller | https://matthias-research.github.io/pages/tenMinutePhysics/09-xpbd.pdf | 其他 | 普通距离约束拉长和压短都改。柔度为 0 时拉不长 |
| Discrete elastic rods，Bergou 等，2008 | https://dl.acm.org/doi/10.1145/1360612.1360662 | 论文 | 拉伸、弯曲、扭转一起算，适合竿身，不适合鱼线 |
| Advanced Character Physics，Jakobsen，GDC 2001 | https://gpgstudy.com/gpgiki/GDC_2001:_Advanced_Character_Physics | 其他 | Verlet 加反复把点拉回段长 |
| CableConstraint | https://docs.rs/oxiphysics-softbody/0.1.0/oxiphysics_softbody/pbd_constraints/struct.CableConstraint.html | GitHub 文档 | 只在超过最大长度时往回拉，短于最大长度时不施力 |
| detect_slack | https://docs.rs/oxiphysics-constraints/0.1.1/oxiphysics_constraints/cable_constraints/fn.detect_slack.html | GitHub 文档 | 松弛由两端位置、线长和容差判定 |
| compute_slack_amount | https://docs.rs/oxiphysics-constraints/0.1.1/oxiphysics_constraints/cable_constraints/fn.compute_slack_amount.html | GitHub 文档 | 松弛量为正是松，为负是被拉长 |
| Unity3D-FishingRodMotion | https://github.com/Kevin-Kwan/Unity3D-FishingRodMotion | GitHub | 钓鱼线用 Verlet 的原型，约 2023–2024 |
| millag/DiscreteElasticRods | https://github.com/millag/DiscreteElasticRods | GitHub | 弹性杆为了稳定改用位置约束 |
| Fishing line in a cartoonish game | https://www.reddit.com/r/howdidtheycodeit/comments/gcwl9e/fishing_line_in_a_cartoonish_game | 社区 | 卡通鱼线用两端锚点加悬链线，2020-05-03 |
| Chain & Rope | https://www.mysimulator.uk/chain-rope/ | 其他 | 等式距离约束会把相邻点推开或拉拢，2026-07-05 |
| Fishing Rod Tip Deflection Calculator | https://funcfish.com/fishing-rod-tip-deflection-calculator/ | 其他 | 同样的拉力，线和竿的夹角越大，弯竿的横向力越大。2026-08-09 |
| Interactive Virtual Fishing，Tsuji 等，SIGGRAPH Asia 2024 | https://doi.org/10.1145/3681755.3688950 | 论文 | 松弛和卷轮阻力分开。拔河看张力，张力受收线、拉力和鱼的速度影响 |
| Fish In VR | https://discussions.unity.com/t/30-discount-fish-in-vr-a-complete-physics-driven-vr-fishing-solution/949777 | 社区 | 张力、出线、断线作为玩法量，2024-06-09。帖子没有给出求解器 |
| Simulating a fishing pole? | https://discourse.mcneel.com/t/simulating-a-fishing-pole/217798 | 社区 | 竿用段长加转角，2026-04-08 |

已查看、未写入上表：Three.js 论坛 2026-07 的线缆帖没有给出仓库地址。Heathen Verlet Line 和 Hrober0/Cable-physics 只重复了「可拉伸、迭代变硬」，没有新的鱼钩接法。`CableConstraint::project` 的源码页被截断，没有读到那一行判断，只采用了文档说明。
