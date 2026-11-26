# 震动体验检索纪要

三轮检索里实际打开、并且支撑一条判断的来源。没有来源的判断不写。

检索日期：2026-11-26。本文不是规格。接线仍以 [HAPTICS.md](./HAPTICS.md) 为准，玩法仍以 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md) 为准。

苹果、RichTap 和能对上的开源做法说的是同一件事：短、有出处、和画面同轻重；长震跟着力变，停的时候停干净。没有一组公开的「舒适强度」数字。RichTap 的频率是 0–100，Core Haptics 的锐度是 0–1，两边不能照抄数值。

家电触摸屏（约 100–200 毫秒、0.55–0.70 g、约 230 Hz）和方向盘手传振动的舒适轮廓打开过摘要，单位不是 Taptic Engine，不列入下表，也不作调参依据。开发者论坛此轮多是故障帖，未采用为手感依据。

## 有效来源

| 标题 | 链接 | 类型 | 用在哪 | 轮次 |
|---|---|---|---|---|
| Playing haptics | https://developer.apple.com/design/human-interface-guidelines/playing-haptics | 官方文档 | 因果、对齐、克制、短优先；系统档位的固定含义；长震会干扰陀螺仪、麦克风和相机 | 1 |
| Designing Audio-Haptic Experiences（WWDC19 笔记） | https://wwdcnotes.com/documentation/wwdc19-810-designing-audiohaptic-experiences/ | 官方课程笔记 | 因果、和谐、有用。Taptic Engine 补人耳听不到的低频 | 1 |
| Updating Continuous and Transient Haptic Parameters in Real Time | https://developer.apple.com/documentation/corehaptics/updating-continuous-and-transient-haptic-parameters-in-real-time | 官方文档 | 强度动态控制只会减弱；锐度在 −1 到 1 上加减。连续瞬态示例隔 600 毫秒 | 1 |
| Playing Collision-Based Haptic Patterns | https://developer.apple.com/documentation/corehaptics/playing-collision-based-haptic-patterns | 官方文档 | 碰撞速度归一化到 0–1，再映射强度和锐度。上限靠试 | 1 |
| Representing haptic patterns in AHAP files | https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files | 官方文档 | 强度、锐度、attack、decay 的取值范围 | 2 |
| Playing a Custom Haptic Pattern from a File | https://developer.apple.com/documentation/corehaptics/playing-a-custom-haptic-pattern-from-a-file | 官方文档 | 同时播放的花样会自动叠层；不想叠就等前一段结束 | 1 |
| 浅谈触感设计的表达，RichTap 团队，2023-01-17 | https://www.richtap-haptics.com/post/haptic-design-express | 其他 | 短信号四象限：低沉松弛、紧绷干脆、轻脆轻弹、低柔温和。感知维度：硬度、粗糙、速度、质量、弹性、韵律 | 3 |
| RichTap Creator 帮助，2022-08-26 | https://www.richtap-haptics.com/help-desktop | 其他 | 关联、层级、通感。短信号默认强度 100、频率 50。长信号用时长和锚点做包络 | 2 |
| Transient and continuous haptic patterns，Nice Vibrations，2025-02-02 | https://nice-vibrations-docs.moremountains.com/transient-continuous-haptics.html | 其他 | 示例长震是强度 0.3、锐度 0.8。长震进行中可以再叠瞬态 | 2 |
| Getting Started With Core Haptics，Kodeco | https://www.kodeco.com/10608020-getting-started-with-core-haptics/page/4 | 其他 | 0.5 秒切击：长震配一条从低到高再回到 0 的强度曲线 | 2 |
| Lofelt VT-1 specification v5，2020-04-25 | https://assets.ctfassets.net/qku6b8nf1d79/3rW4oyOJasRTGeBG784LFs/a206ad5394c366643ebb72bc9cc7992b/lofelt-vt-1-specification_v5.pdf | 其他 | 只有开关的震会发嗡。上升要快，否则发糊 | 3 |
| Better Haptics, 10x Faster with Lofelt Studio，Büttner，2020-12-20 | https://medium.com/@danielbuettner/better-haptics-10x-faster-with-lofelt-studio-42e491317ed6 | 其他 | 先从声音抽出包络，再减少断点，让重音站出来 | 3 |
