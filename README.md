# Fishing

竖屏 WebGPU 钓鱼。壳来自 portrait-webgpu-base（390×844 contain、Capacitor iOS、震动插件）。现在有岸边水面、一群会游的鲷鱼、一根第一人称的纺车竿、鱼线和一只拟饵。可以把饵甩出去、落水、长按收回来。咬口和拔河还没做。岸边水面已经定稿，先不要再改海浪、雾和曝光。

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 打开仓库时的第一入口 |
| [docs/FISHING-REQUIREMENTS.md](./docs/FISHING-REQUIREMENTS.md) | 这一竿的规则。已定，玩法未开工 |
| [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) | 做内容时的规矩：物料和玩法分开、坐标、验证、文档 |
| [docs/FISH-SCHOOL.md](./docs/FISH-SCHOOL.md) | 鱼群的设计。已实现。以后来咬钩的鱼从这群里取 |
| [docs/ROD.md](./docs/ROD.md) | 鱼竿和渔轮的设计。会跟镜头、会弯，没接玩法 |
| [docs/PHONE-LOOK.md](./docs/PHONE-LOOK.md) | 手机瞄准和镜头的设计。手机指向哪竿就指向哪；镜头跟手机、按住时停、甩出去以后看落点 |
| [docs/LINE.md](./docs/LINE.md) | 鱼线的设计。会松会绷，绷直了能把竿拉弯 |
| [docs/LURE.md](./docs/LURE.md) | 饵的设计。收在竿尖、飞出去、被线拖着游 |
| [docs/SPLASH.md](./docs/SPLASH.md) | 水花的设计。放在海面上方，不动海面 |
| [docs/PLAY.md](./docs/PLAY.md) | 玩法层：抛投和长按收线怎么落到代码上，先填了哪些数字 |
| [docs/ENGINEERING.md](./docs/ENGINEERING.md) | 壳、水面、打包 |
| [docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md) | 启动链 |
| [docs/HAPTICS.md](./docs/HAPTICS.md) | 震动接入 |
| [docs/AUDIO.md](./docs/AUDIO.md) | 音效方案，尚未实现 |

## 本地

```bash
npm install
npm run dev
# http://127.0.0.1:5190/
```

5190 被别的工程占用时，换一个端口，不要关掉别人的进程。应看到朝向大海的岸边，画面里有一根鱼竿，竿尖上收着一只小饵，水下有鱼群。`/fish.html` 可以单看一条鱼。右上角 **设置** 里可以调雾、水、鱼、鱼竿和镜头，震动测试在面板最下面。桌面没有原生马达。

桌面上走一竿：拖动画面对方向，按住空格约半秒再松开，饵飞出去落水；再按住空格收线，松开就停，一直收到饵回到竿尖。空格按得越久抛得越远，这只是桌面的替身，真机上看的是甩竿的力度。

## 真机

包名 `com.wangzhixuan.fishing`，主屏幕名 Fishing。不要改回模板的 `com.wangzhixuan.pwgbase.hapticstest`。

```bash
npm run ios:bootstrap   # 第一次，或改了 plugins/native-haptics
npm run cap:sync        # 只改了网页
# Xcode 选 zhixuan 的 iPhone → Run
```

`ios:bootstrap` 会把 `SceneDelegate` 设成 `BridgeViewController`。漏了这一步，真机上 `plugin: false`，点震动没有反馈。验收先看状态行 `plugin: true`，再在设置里点 **点我震动**。

## 现在有什么

- 水面外观已定，数值在 [docs/ENGINEERING.md](./docs/ENGINEERING.md) 第 6 节。三层 256² FFT 保留。落水的水花已经有了，是放在海面上方的。气泡、咬口涟漪还没加，加的时候不重调整片海。
- 镜头默认 `(0, 1.7, 2)`，朝向 100°，俯仰 −10°。陆地在 +z，海在 −z。桌面拖画面改朝向。真机点「允许手机转动」后转动手机：没按住屏幕时镜头和竿一起跟，按住时镜头停、只动竿；饵甩出去以后镜头转向落点，收完再缓缓交还给手机。手机拿回原来的姿态画面就回来，偏了用设置里的 **镜头回正**。设计在 [docs/PHONE-LOOK.md](./docs/PHONE-LOOK.md)。
- 水下有 40 条鲷鱼，自己随机游：整群有快慢和急拐，每条鱼有自己的游走和窜，身体会摆、转弯会弯。设计在 [docs/FISH-SCHOOL.md](./docs/FISH-SCHOOL.md)。设置里的 **游速** 可以调。
- 镜头上挂着一根 7 尺纺车竿和渔轮，代码建模。转动镜头时整根竿慢一拍跟上，竿身有惯性：下段先动，竿尖最后到，停下后抖几下。设计在 [docs/ROD.md](./docs/ROD.md)。
- 鱼线从渔轮穿过导环，从竿尖连到饵。线有余量时垂成弧线，绷直时是直线。饵在水里时把竿抬起来或带向旁边，竿会被线拉弯。设计在 [docs/LINE.md](./docs/LINE.md)。
- 饵是一只 9 厘米的米诺。默认线收到头，饵贴在竿尖，甩竿时不晃。真机上按住屏幕、向前甩、甩的途中松手，饵按这一甩的力度飞出去 4 到 28 米，镜头自己转向落点，落水时有水花；飞的途中再按住，饵就近落下。落水后按住是收线，先慢后匀速，松手饵停在水下；收到头这一竿结束，可以再甩。设计在 [docs/LURE.md](./docs/LURE.md) 和 [docs/PLAY.md](./docs/PLAY.md)。
- 设置面板可以临时试雾、水、鱼竿的位置、镜头。面板里"这一竿"一行实时显示甩竿读到的角速度，调抛投手感时看它。震动测试在面板最下面。关掉再开回到上面的默认值。
- 无 WebGPU 就明确失败，不回退 WebGL。

## 资源许可

- 水面代码来自 Minamo，MIT，许可在 `src/shore/minamo/LICENSE`。
- 天空、沙滩、石头来自 Poly Haven，CC0。
- 鲷鱼模型 Bream Fish (Dorade Royale)，作者 BlueMesh，CC BY，发布时需要署名。来源链接在 `src/fish/dorade.js` 文件头。
