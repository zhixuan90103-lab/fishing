# 鱼的游动检索纪要

三轮检索加上一次对不一致之处的核对。只保留打开过、并且支撑某条判断的来源。没有来源的判断不写。

检索日期：2026-11-20。本文不是玩法规格。鱼怎么游、群怎么形成，仍以 [FISH-SCHOOL.md](./FISH-SCHOOL.md) 和 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) 为准。第 1 节是身体和结群的测量。第 2 节是实现该用哪一层，同一天补上。

2026-11-24 补：自发游“不超过 0.5 倍体长每秒”出自 18 厘米的鱼在直径 40 厘米的水槽里，论文自己说可能被容器限制，不能当成开阔水里的巡游速度。硬骨鱼平时游动常见 0.5 到 1 倍体长每秒（Svendsen 等 2016 转述 Videler 1993，二手，https://pmc.ncbi.nlm.nih.gov/articles/PMC5087677/ ）；幼鱼最省力的速度报告过 1.5（Svendsen 等 2015）。野生金头鲷在海里巡游多快没有查到直接测量。鱼群现在取 0.62 到 0.94，见 [FISH-SCHOOL.md](./FISH-SCHOOL.md) 第 4 节。

核对后的速度：金头鲷自发游大约不超过 0.5 倍体长每秒；“逃起来到平时的七倍”就是大约 3.5 倍体长每秒，不是 7。临界速度随体型、水温和野生或养殖落在大约 3.2 到 4.8。摆幅在低速随尾频增大，大约每秒 5 下以后封在大约 0.2 倍体长，再快主要靠尾频。加速时摆幅可以超过稳态。近水面的水花表示“正在挣”只有游戏条目，没有鱼的测量。

## 1. 游动和结群的来源

### 身体怎么游

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Convergence of undulatory swimming kinematics across a diversity of fishes，Di Santo 等，USGS，2021-12-07 | https://www.usgs.gov/publications/convergence-undulatory-swimming-kinematics-across-a-diversity-fishes | 论文 | 稳态时头附近摆幅约 0.03 倍体长，尾约 0.2–0.3；波长约 0.75–1.14 倍体长，是连续谱 |
| Scaling the tail beat frequency and swimming speed in underwater undulatory swimming，Sánchez-Rodríguez 等，Nature Communications，2023-09-09 | https://www.nature.com/articles/s41467-023-41368-6 | 论文 | 速度大约是 \(U \approx 3.3\,A\,f\)。体长约 0.5 米以下，尾频大约 2–20 Hz |
| Biomechanics and energetics of swimming，Hawkins 与 Di Santo，2025 | https://sites.tufts.edu/tytelllab/files/2025/08/Hawkins_2025_Biomechani.pdf | 论文 | 稳态加快主要加尾频，不主要加摆幅 |
| The speed of swimming of fish…，Bainbridge，Journal of Experimental Biology，1958-03-01 | https://journals.biologists.com/jeb/article/35/1/109/13233/The-Speed-of-Swimming-of-Fish-as-Related-to-Size | 论文 | 摆幅随尾频增到约每秒 5 下，顶约五分之一体长；过此速度主要跟尾频。\(V = \tfrac{1}{4} L (3f - 4)\) |
| Bainbridge sets the stage on scaling in fish swimming，Webb，Journal of Experimental Biology，2006-05-15 | https://journals.biologists.com/jeb/article/209/10/1789/16037/BAINBRIDGE-SETS-THE-STAGE-ON-SCALING-IN-FISH | 论文 | 复述：主因是尾频，摆幅只在低速有一小段作用 |
| Fish swimming（Videler 与 Wardle 综述） | https://link.springer.com/content/pdf/10.1007/BF00042660.pdf | 论文 | 可用速度范围内尾尖摆幅大约 0.1 倍体长；水槽里位置不动的鱼仍按对水的速度打尾 |
| Burst-and-coast swimmers optimize gait by adapting unique intrinsic cycle，Li 等，Communications Biology，2021-01-14 | https://www.nature.com/articles/s42003-020-01521-z | 论文 | 冲滑步态里尾频和摆幅基本不变，变的是冲刺占多久。不是鲷的测量 |
| The hydrodynamics of eel swimming II，Tytell，2004 | https://sites.tufts.edu/tytelllab/files/2015/04/Tytell2004P271.pdf | 论文 | 连续加速时身体摆幅变大，头也更明显 |
| Fish optimize sensing and respiration during undulatory swimming（Akanyeti 等，2017） | https://sites.harvard.edu/glauder/files/2022/03/Akanyeti.etal_.ALL_.2017.pdf | 论文 | 加速时后身更弯，传给水的轴向动量更大 |
| Hydrodynamics of linear acceleration in bluegill sunfish，Journal of Experimental Biology，2018-11-30 | https://journals.biologists.com/jeb/article/221/23/jeb190892/20531/Hydrodynamics-of-linear-acceleration-in-bluegill | 论文 | 连续几拍都在加速时，摆幅和尾频高于同样峰值加速度的单拍稳态 |
| Routine and escape turns（Howe 与 Astley，2020，全文） | https://blogs.uakron.edu/astleylab/wp-content/uploads/sites/1471/2021/01/howe2020.pdf | 论文 | 日常转弯是一道从头传到尾的弯曲。转多少、加速多少跟弯的大小和持续时间有关 |
| The kinematics and performance of the escape response in the angelfish，Domenici 与 Blake，Journal of Experimental Biology，1991 | https://scholar.google.se/citations?view_op=view_citation&hl=en&user=Blebu2AAAAAJ&citation_for_view=Blebu2AAAAAJ:u-x6o8ySG0sC | 论文 | C 形急转是另一档，不是巡游 |

### 金头鲷游多快、怎么结群

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| The effects of swimming pattern on the energy use of gilthead seabream，Steinhausen、Steffensen、Andersen，2010 | https://web.archive.org/web/20200309190346if_/http://bioold.science.ku.dk/jfsteffensen/Publications/MarFreshBehPhys%20MFS%202010.pdf | 论文 | 约 18 厘米、20°C。自发游 5 分钟平均 0.15–0.43 倍体长每秒，不超过 0.5。被迫游约 3.5，临界速度 \(3.4 \pm 0.2\)。水槽直径 40 厘米，自愿速度可能被容器限制 |
| Sparus aurata in FishEthoBase (Summary)，2015-06 | https://www.researchgate.net/publication/295255918_Sparus_aurata_in_FishEthoBase_Summary | 其他 | “平时约 0.5 倍体长每秒，逃起来最多到平时的七倍。”七倍即约 3.5，不是 7 倍体长每秒 |
| Sparus aurata Dossier，Volstorf，fair-fish database，2022-01-22 | https://fair-fish-database.net/db/species/sparus-aurata/dossier/ | 其他 | 单独或小群到大群；大体型更常单独。档案把自发游写成不超过 0.5、被迫游到 3.5 |
| Comparison of the swimming performance of farmed and wild gilthead sea bream，Basaran 等，Aquaculture Research，2007 | https://doi.org/10.1111/j.1365-2109.2007.01670.x | 论文 | 临界速度：野生 \(4.52 \pm 0.05\) 倍体长每秒，养殖 \(4.21 \pm 0.05\) |
| Oxygen uptake, heart rate and activities of locomotor muscles…，Hachim 等，Journal of Fish Biology，2021 | https://onlinelibrary.wiley.com/doi/pdfdirect/10.1111/jfb.14621 | 论文 | 临界速度约 \(3.2 \pm 0.2\) 倍体长每秒。高速时从只用红肌转到红肌加白肌，然后力竭 |
| Swimming Activity of Gilthead Seabream in Swim-Tunnels，Arechavala-López 等，Frontiers in Animal Science，2021-07-09 | https://www.frontiersin.org/journals/animal-science/articles/10.3389/fanim.2021.679848/full | 论文 | 最省力的速度约 3.26 倍体长每秒。临界速度约 4.78，一半的鱼没游到力竭，数偏低 |
| Intraspecific variation in aerobic and anaerobic locomotion，Svendsen 等，Frontiers in Physiology，2015-02-17 | https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2015.00043/full | 论文 | 约 15 厘米、10°C。临界速度大约 35–56 厘米每秒，平均 \(45.0 \pm 1.6\) |
| Food competition in small groups of juvenile gilthead sea bream，Goldan、Popper、Karplus，2003 | https://ija.scholasticahq.com/article/20340-food-competition-in-small-groups-of-juvenile-gilthead-sea-bream-sparus-aurata.pdf | 论文 | 小群里的直线等级和抢食。是争斗，不是群游规则 |

### 群怎么从个体里长出来

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Flocks, herds and schools: A distributed behavioral model，Reynolds，SIGGRAPH，1987-08-01 | https://web.archive.org/web/20210703170701/https://dl.acm.org/doi/10.1145/37402.37406 | 论文 | 每只只按局部感知自己选路。没有整群的控制者 |
| Flocks, Herds, and Schools，SIGGRAPH 教学转述 | https://education.siggraph.org/static/HyperGraph/animation/art_life/flocks.htm | 其他 | 三条规则：躲开、对齐速度、靠向邻居 |
| Boids Model for Flocking Behavior，Arboria Labs，2026-11-06 | https://www.arborialabs.com/techniques/boids_model_for_flocking_behavior | 其他 | 对齐弱会打转；靠拢和分开打架会抖；参数和步长敏感 |
| Effective leadership and decision-making in animal groups on the move，Couzin、Krause、Franks、Levin，Nature，2005-02-03 | https://www.nature.com/articles/nature03236 | 论文 | 少数个体对一个地点有偏向，就能带整群走。不必发信号，也不必知道谁是带路的 |
| Collective Decision-Making，Couzin 实验室 | https://www.ab.mpg.de/380112/collective-decision-making | 其他 | 同上实验的说明：不知情的多数跟着社交规则走 |

### 玩家从鱼身上读什么

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Aquatic vertebrate locomotion: wakes from body waves，Videler，Journal of Experimental Biology，1999-12-01 | https://journals.biologists.com/jeb/article/202/23/3423/8328/Aquatic-vertebrate-locomotion-wakes-from-body | 论文 | 游动留下的是水下涡街。Rosen 的牛奶层在鱼腹下面，不是水面上的水花 |
| Fishing，Red Dead Wiki，页面更新 2026-07-29 | https://reddead.fandom.com/wiki/Fishing | 社区 | 钩住后左右冲并打水；水花停了才当歇了、可以收。这是游戏信号，不是鱼的测量 |

## 2. 实现分层的来源

同一天另做的三轮。只收用来判断“现在这套要不要换架构”的来源。判定是：保留状态机和 `swim.js`，去掉整群共用的节奏。行为树、强化学习和神经网络不采用。

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Steering Behaviors For Autonomous Characters，Reynolds，GDC 1999 | https://lukasz.dk/mirror/research-scea/research/html/GDC99_steer/GDC99_CWR_steeringbehaviors.html | 其他 | 行动选择、转向、运动三层。转向可叠加。硬约束用优先级，不和结群对半加 |
| Interaction with Groups of Autonomous Characters，Reynolds，2000 | https://www.researchgate.net/publication/2358480_Interaction_with_Groups_of_Autonomous_Characters | 论文 | 行为状态决定这一帧叠哪些转向。被钓时关掉结群 |
| AI for Games 讲义转述 Millington 第 3 章，Georgia Tech，2019-09-16 | https://faculty.cc.gatech.edu/~surban6/2019fa-gameAI/lectures/2019_09_16_steering-presented%20in%20class.pdf | 其他 | 加权混合会抵消、卡住或抖动 |
| AI for Games 第 3 版，Millington，2019 | https://dokumen.pub/ai-for-games-3nbsped-9781138483972-2018041305.html | 其他 | 运动和决策分开。混合结果太小时，优先级组接管 |
| Behavior Trees vs Finite State Machines，Opsive，2024-12-11 | https://opsive.com/support/documentation/behavior-designer-pro/concepts/behavior-trees-vs-finite-state-machines/ | 官方文档 | 模式互斥用状态机。多件事同时可能、失败再试，才用行为树 |
| Comparison between Behavior Trees and Finite State Machines，Iovino 等，arXiv，2024-05-25 | https://arxiv.org/abs/2405.16137 | 论文 | 任务变复杂后行为树更好维护。行为本身不因表示方式改变 |
| Autonomous fish behavior，Atlantis Press | https://www.atlantis-press.com/article/125972056.pdf | 论文 | 水族箱用状态机加转向：游走、追食、逃跑、结群。能量是属性 |
| MLF: Pro Catch 开发日志，Steam | https://store.steampowered.com/news/app/1307150/view/571535612595667155 | 社区 | 每条鱼有兴趣值，可单独游也可结群。页面正文没打开，只用检索摘录，不当实现细节 |
| DEV FAQ 2024，Russian Fishing 4 | https://rf4game.com/forum/index.php?/topic/32605-dev-faq-2024/ | 社区 | 水温、收饵速度、鱼种警惕影响咬口。鱼的数量固定 |
| Fish management，Steam，开发者 Levo，2025-08-25 | https://steamcommunity.com/app/766570/discussions/9/597409652103471527 | 社区 | 放生不改变以后的体型和数量 |
| Simulating Thousands of Fish Using Boids in Unity ECS，Jettelly，2026-04-24 | https://jettelly.com/blog/simulating-thousands-of-fish-using-boids-in-unity-ecs/ | 其他 | 上千条才把三条规则拆成并行作业。40 条用不上 |
| CBIL，arXiv 2504.00234 | https://arxiv.org/html/2504.00234v1 | 论文 | 从视频学习鱼群。对照过 boids 和 DeepFoids。不是这一竿的做法 |
