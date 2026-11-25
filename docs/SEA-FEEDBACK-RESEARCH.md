# 水面反馈检索纪要

三轮检索。只保留读过、并且支撑某条判断的来源。没有来源的判断不写。海水的密度、表面张力和最低波速在 [SEA-PHYSICS-RESEARCH.md](./SEA-PHYSICS-RESEARCH.md)，这里不重复那张表。

检索日期：2026-11-24。本文不是规格，也没有改代码。水面外观仍以 [ENGINEERING.md](./ENGINEERING.md) 第 6 节为准。怎么在现有海面上加一块会传开的高度，仍以 [WATER-RESEARCH.md](./WATER-RESEARCH.md) 为准。

这些来源支撑的判断：鱼日常游动的尾迹在水下，是涡，不自动变成海面的纹。鱼群在水下好几个体长时，水面应仍是原来的风浪。水泡和热迹只在鱼贴着水面、破水、或去咬浮着的食物时出现。饵的连续 V 形纹只在贴着水膜拖时有；沉到十几到三十厘米，这条纹就没有了。落水的水冠是撞击，和游动分开。线没有波高测量。停在水膜上的细腿才能压出大约一个毛细长度的坑，切进水里的钓线不是这种坑。咬钩在水下是嘴前短促的一股流，默认不该是水冠；近水面可以鼓一个小包，嘴破出水面才是炸水。

直线慢于大约 0.23 米/秒没有稳定波列，这个门槛的算法在 [SEA-PHYSICS-RESEARCH.md](./SEA-PHYSICS-RESEARCH.md)，不是下面新文献里印好的海水值。拍动翼「潜深超过大约 5 倍弦长，自由表面的影响就弱了」是模型翼，不是鲷鱼的体长。

## 有效来源

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| 鱼的尾迹，Videler，2002 | https://zimmer.fresnostate.edu/~umuller/FBDS/FBDS-publications/FBDS-publications-pdfs/VidelerICB2002.pdf | 论文 | 约 12 厘米的鲻鱼，尾迹是水下涡环，宽约 8 厘米，鱼离开后还能留几秒 |
| 潜体的开尔文尾迹在低弗劳德数下指数地小 | https://par.nsf.gov/servlets/purl/10556663 | 论文 | 潜得深、走得慢，水面波幅度指数变小 |
| 礁鱼的水面热迹，Judd 等，SPIE，2020 | https://www.spiedigitallibrary.org/conference-proceedings-of-spie/11420/114200M/On-the-surface-thermal-expressions-of-various-reef-fish/10.1117/12.2559915.full | 论文 | 0.3 米的鱼到 1 米的海龟，只在近水面、破水、咬浮饵时留下从几厘米到约一米的痕迹 |
| 近水面自航波动水翼，Journal of Fluid Mechanics，2026 | https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/abs/hydrodynamics-of-a-selfpropelled-undulating-hydrofoil-at-fixed-submergence-near-a-free-surface/A0E98111FC5F9F5ED1863E3D5108C49B | 论文 | 越靠近自由表面，造的波越强 |
| 拍动翼在自由表面附近的推进，2025 | https://www.researchgate.net/publication/388962667_Propulsion_performance_of_a_flapping_foil_near_free_surfaces_Effects_of_submergence_depth_Strouhal_number_and_pitching_amplitude | 论文 | 潜深超过大约 5 倍弦长，自由表面的影响很快消失。是模型翼，不是鱼的体长 |
| 慢速物体的重力–毛细波，Chepelianskii、Chevy、Raphaël，2008 | https://ar5iv.labs.arxiv.org/html/0704.3990 | 论文 | 直线慢于最低波速没有稳定波列。文中淡水例子是 0.23 米/秒 |
| 水下一口在水面鼓包，Tenkara Angler，2026-05-20 | https://tenkaraangler.com/2026/05/20/bump-fishing-for-bluegill-a-subsurface-strategy-for-stained-water/ | 社区 | 饵在水面下几厘米，鱼吸时鼓一个小包；再深这个包不再出现；饵露在水面就是炸水 |
| 醒饵怎么留 V 形纹，FishingHCM | https://fishinghcm.com/en/how-to-fish-a-wakebait-over-shallow-weed-flats-for-largemouth-bass.html | 社区 | 连续的 V 形纹要饵贴着水面、稳定拖。沉进草里就没有这条纹 |
| 醒饵与浮线，Shaye Baker，MONSTERBASS | https://monsterbass.com/blogs/fishing-tips/wakebait-101-with-shaye-baker | 社区 | 氟碳把饵拖离水面，贴着水面的 V 形纹就保不住 |
| 物体入水，Truscott、Epps、Belden，2014 | https://www.researchgate.net/publication/263022576_Water_Entry_of_Projectiles | 论文 | 落水是径向射流、水冠和气腔，与游动尾迹分开 |
| 水面行走的昆虫，Bush，2008 | http://math.mit.edu/~bush/wordpress/wp-content/uploads/2012/09/BugReview2008.pdf | 论文 | 停在水膜上的细腿靠表面张力压坑。测量到的静止坑大约 0.1 毫米这一档，腿可以压到大约一个毛细长度再刺破 |
| 吸食时嘴前的流，Holzman、Wainwright，2009 | https://fishlab.ucdavis.edu/wp-content/uploads/sites/397/2020/05/Holzman-Wainwright-2009.pdf | 论文 | 咬是嘴前短促的流：先是头推开的水，嘴一张流反过来吸。扰动集中在猎物那一点，不推得很远 |
| 表面波被动物探测 | https://en.wikipedia.org/wiki/Surface_wave_detection_by_animals | 其他 | 表面摄食的鱼循的是猎物在水面上发出的毛细波。敏感频率大约 10–250 Hz，峰值大约 75–150 Hz |

2026-11-25 补的"尾迹"几行，为的是走着的东西在水面上该留什么形状：

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| 开尔文尾迹 | https://en.wikipedia.org/wiki/Kelvin_wake_pattern | 其他 | 深水里走着的东西身后是 V 形，两臂和中线各成约 19.47 度，和它多快无关 |
| Ship wakes: Kelvin or Mach angle?，Rabaud、Moisy，2013 | https://arxiv.org/pdf/1304.2653 | 论文 | 航拍里快船的尾迹比 19.47 度窄，速度大时张角按速度的倒数变小，像马赫锥；转折在按船长算的弗劳德数 0.5 上下。0.4 米的鱼每秒 1 米就过了这个数 |
| Physics World 对后续工作的报道 | https://physicsworld.com/a/physicists-rethink-celebrated-kelvin-wake-pattern-for-ships/ | 其他 | Darmon、Benzaquen、Raphaël：最外沿仍是开尔文角，最高的那一道随速度变窄。所以开尔文角当上限用 |
| Mach-like capillary-gravity wakes | https://ar5iv.labs.arxiv.org/html/1406.0422 | 论文 | 很小的东西（细线这一档）快走时，尾迹同样是马赫锥那样的窄 V |
| 钓友论坛：水面上移动的 V 形 | https://www.bassresource.com/bass-fishing-forums/topic/126654-v-shapes-moving-on-the-surface/ | 社区 | 近水面游的鱼在水面上留 V 形纹，前头有一个鼓包。是钓友的说法，没有测量 |

这些支撑的判断：走着的东西留的是两条斜臂的 V，不是一串圆；慢的张到开尔文角，快的更窄。做成什么样见 [SPLASH.md](./SPLASH.md) 第 9 节。没有查到的：钩住的鱼冲的时候水面的照片或测量；鱼前头那个鼓包没有做。

2026-11-25 再补：鱼在水面扑腾时溅起的水是什么样。

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Splashing of impacting drops | https://arxiv.org/pdf/1701.02504 | 论文 | 溅起来先是一片薄水，薄水的边缘起指状，再碎成大量小水珠：是一片喷雾，不是几颗大水珠 |
| Growth and breakup of ligaments in unsteady fragmentation | https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/abs/growth-and-breakup-of-ligaments-in-unsteady-fragmentation/CFD8837691FCBF62EC8805FB7571E4A8 | 论文 | 薄水片先拉成一道道细丝再断成水珠 |
| 飞鱼的旧文献（archive.org） | https://archive.org/download/biostor-194322/biostor-194322.pdf | 论文 | 鱼破水之前是用尾巴把水甩成喷雾的，快到肉眼只看见一团 |
| Saltwater Sportsman 的一篇拍摄手记 | https://www.saltwatersportsman.com/?p=52062 | 社区 | 条纹鲈在水面抢食：水面起沫，尾巴拍水，水溅到镜头上 |

这些支撑的判断：扑腾的水花是甩出去的薄水碎成的一片小水珠，四溅、偏低偏远。没有查到的：往哪个方向甩得多、甩多高的测量。做成什么样见 [SPLASH.md](./SPLASH.md) 第 3 节。

已查看、未写入上表：没有 0.3 毫米钓线的波高测量，所以不给线的浪高。SUBOFF 潜深到大约 3 到 4 个直径以后散开波看不清，那是艇体，不是鱼，不写进上表。
