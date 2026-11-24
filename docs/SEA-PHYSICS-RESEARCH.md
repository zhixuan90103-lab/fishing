# 海水和接触物检索纪要

三轮检索，加上一次把对不齐的数核对掉。只保留读过、并且支撑某条判断的来源。没有来源的判断不写。

检索日期：2026-11-24。本文不是规格，也没有改代码。水面外观仍以 [ENGINEERING.md](./ENGINEERING.md) 第 6 节为准。鱼和线怎么在现有海面上加一块会传开的高度，仍以 [WATER-RESEARCH.md](./WATER-RESEARCH.md) 为准。

这些来源支撑的判断：岸边用表层海水，15°C、盐度 35 的密度是 1026.0 kg/m³，20°C 是 1024.8 kg/m³。20°C、盐度 35 g/kg 的表面张力是 73.81 mN/m，比同温度纯水的 72.74 mN/m 略高。用这两个数算出的最低波速是 0.23 m/s，直线慢于它形不成稳定波列。鱼受浮力、平方阻力和附加质量；深了水面几乎不动。尼龙比重约 1.15，氟碳 1.78，PE 约 0.97。拉断时尼龙和氟碳都大约伸 15%–30%。10 克实心铅约 1.9 米/秒下沉，带体积的 10 克饵大约 0.2–0.7 米/秒。岸钓的竿在空气里。0.3 毫米的线细过毛细长度 2.7 毫米，这个长度也是用上面的张力和密度算的。

最低波速和毛细长度不是某篇论文印好的海水值，是用 IAPWS 的张力和 EOS-80 的密度算出来的。

## 有效来源

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| EOS-80 密度表，15°C 与 20°C、盐度 35 | https://codingace.net/physics/seawater_density_from_temperature.html | 其他 | 1026.0 kg/m³ 和 1024.8 kg/m³。公式页给出 UNESCO 一层大气的多项式 |
| UNESCO 海水状态方程 1980 | https://www.vliz.be/imisdocs/publications/ocrd/270530.pdf | 官方文档 | 密度由盐度、温度、压力决定。表层用一个大气压那一支 |
| 海洋状态变量，Nature Scitable | https://www.nature.com/scitable/knowledge/library/key-physical-variables-in-the-ocean-temperature-102805293/ | 其他 | 现场密度大约在 1000–1060 kg/m³。EOS-80 之后由 TEOS-10 接替，岸边这个密度量级不变 |
| IAPWS 海水表面张力指南 G14-19 | https://iapws.org/documents/release/Seawater-Surf.download | 官方文档 | 20°C、35 g/kg 为 73.81 mN/m。盐让表面张力升高。依据 Nayar 等 2014 |
| IAPWS 纯水表面张力 R1-76(2014) | https://iapws.org/documents/release/Surf-H2O.download | 官方文档 | 20°C 纯水 72.74 mN/m。用来和海水比 |
| 慢速物体的重力–毛细波，Chepelianskii、Chevy、Raphaël，2008 | https://ar5iv.labs.arxiv.org/html/0704.3990 | 论文 | 最低波速公式。直线慢于它没有稳定波列；转弯仍有波阻。文中淡水例子是 0.23 m/s |
| 海水热物性，MIT | https://web.mit.edu/seawater/ | 官方文档 | 密度、黏度、表面张力都是温度、盐度的函数。表面张力关联引用 Nayar 等 2014 |
| 海水物性表，MIT，2023-12-09 | https://web.mit.edu/seawater/2017_MIT_Seawater_Property_Tables_r2b_2023c.pdf | 官方文档 | 20°C、盐度往 35 g/kg 时动力黏度约 1.08×10⁻³ Pa·s |
| 鱼线沉还是浮，Begin to Fish，2021-06-12 | https://www.begintofish.com/will-fishing-line-sink-or-float-an-engineer-explains/ | 其他 | 尼龙约 1.15 g/cm³、氟碳约 1.78、编织线约 0.97。同页把海水写成 1.25 g/cm³，这个密度不用 |
| Seaguar 产品册 | https://merricktackle.com/home-images/seaguar_catalog.pdf | 其他 | 氟碳比重 1.78，尼龙 1.15。对照图里氟碳下沉比尼龙快 |
| Shakespeare FL-8 PVDF 钓线数据表 | https://www.lookpolymers.com/polymer_Shakespeare-FL-8-Fluorocarbon-PVDF-Fishing-Line-12-lb.php | 其他 | 氟碳拉断伸长 23%–28% |
| 钓线拉伸试验，岛津 | https://www.shimadzu.com.tw/industries/engineering-materials/textile/various-fishing/index.html | 其他 | 同样试验里尼龙和氟碳拉断伸长接近，金属线大约只有十分之一 |
| Fishing for the best line，ASEE，2004 | https://peer.asee.org/fishing-for-the-best-line-evaluating-polymers-used-in-sport-fishing.pdf | 论文 | 那组样品拉断伸长：尼龙约 19%，氟碳约 17% |
| 编织线、尼龙、氟碳怎么选，Tackle Room | https://thetackleroom.com/blogs/news/what-fishing-line-for-what-situation-braid-vs-mono-vs-fluoro-explained | 社区 | 同样拉力下编织线更细，水流里的拖曳更小。没有力的测量 |
| 波面以下的水质点，Nortek，2025-09-03 | https://support.nortekgroup.com/hc/en-us/articles/21694249619484-Subsurface-wave-properties | 其他 | 轨道速度随深度、随波长变短而指数衰减 |
| 潜体的开尔文尾迹在低弗劳德数下指数地小 | https://par.nsf.gov/servlets/purl/10556663 | 论文 | 潜得深、走得慢，水面波幅度指数变小 |
| 蓝鳃太阳鱼滑行阻力系数，Tandler 等，2019 | https://par.nsf.gov/servlets/purl/10097592 | 论文 | 雷诺数约 4 万时，按浸湿面积的阻力系数约 0.015。不是鲷鱼 |
| 鱼的尾迹，Videler，2002 | https://zimmer.fresnostate.edu/~umuller/FBDS/FBDS-publications/FBDS-publications-pdfs/VidelerICB2002.pdf | 论文 | 成鱼尾迹是一串涡环和向后的射流，鱼离开后还能留几秒 |
| 礁鱼的水面热迹，Judd 等，SPIE，2020 | https://www.spiedigitallibrary.org/conference-proceedings-of-spie/11420/114200M/On-the-surface-thermal-expressions-of-various-reef-fish/10.1117/12.2559915.full | 论文 | 0.3 米的鱼到 1 米的海龟，近水面才留下从几厘米到约一米的痕迹 |
| 水生运动里的附加质量，Journal of Fluid Mechanics，2021 | https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/on-the-role-of-added-mass-and-vorticity-release-for-selfpropelled-aquatic-locomotion/EB142092C8F70CB199085F67781F0679 | 论文 | 加速时要带着周围的水，并往尾迹里泄涡 |
| 浮力加速和附加质量，2019 | https://arxiv.org/html/1901.00557v2 | 论文 | 细长体附加质量系数大约 0.1 |
| 金头鲷行为摘要，FishEthoBase | https://www.researchgate.net/publication/295255918_Sparus_aurata_in_FishEthoBase_Summary | 其他 | 日常约 0.5 倍体长/秒，冲刺可到大约 7 倍。没有阻力系数 |
| 野生和养殖金头鲷的临界游速，Basaran 等，2007 | https://www.researchgate.net/publication/230117450_Comparison_of_the_swimming_performance_of_farmed_and_wild_gilthead_sea_bream_Sparus_aurata | 论文 | 野生鱼临界游速约 0.86 米/秒、约 4.5 倍体长/秒。仍不是阻力系数 |
| 路亚甩投里竿尖的回弹，MDPI Robotics，2026 | https://www.mdpi.com/2218-6581/15/2/42 | 论文 | 饵的惯性把线从竿尖带出。竿是空气里的弹性件 |
| 物体入水，Truscott、Epps、Belden，2014 | https://www.researchgate.net/publication/263022576_Water_Entry_of_Projectiles | 论文 | 入水有径向射流、水冠、气腔和闭合 |
| 铅坠下沉时间，Begin to Fish，2021-09-03 | https://www.begintofish.com/how-fast-will-a-lead-fishing-weight-or-jig-sink-in-water/ | 其他 | 3/8 盎司铅坠沉 100 英尺约 16 秒，海水和淡水几乎一样。同页写明海水只密大约 2.5%。这是计算表，不是计时实验 |
| 木虾下沉标注，RUI | https://www.squidfishing.com.au/guides/squid-jig-sinking-rate-guide-australia/ | 其他 | 10 克、2.5 号标注约 4.2–4.5 秒/米。厂商标注，不是独立水槽 |
| 倒数下沉，Westernbass，2016 年春 | https://storage.westernbass.com/mag_wb/wb_mag_spring_2016/page55/index.html | 其他 | 3/8 盎司带软饵大约 0.5–1 英尺/秒。钓手经验，不是实验室 |

已查看、未写入上表：FuncFish 的下沉整理表没有测量过程，不采用。钓具文章里「氟碳只伸 10%–15%、尼龙伸 25%–30%」和上面三份拉断试验不一致，不采用。Begin to Fish 鱼线那一页的海水密度 1.25 g/cm³ 不采用，线的比重仍用。
