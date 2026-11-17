# Fishing

竖屏 WebGPU 钓鱼。壳来自 portrait-webgpu-base（390×844 contain、Capacitor iOS、震动插件）。现在有岸边水面、一群会游的鲷鱼、一根第一人称的纺车竿和连到水里的鱼线，都是物料。岸边水面已经定稿，先不要再改海浪、雾和曝光。钓鱼流程还没做。

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 打开仓库时的第一入口 |
| [docs/FISHING-REQUIREMENTS.md](./docs/FISHING-REQUIREMENTS.md) | 这一竿的规则。已定，玩法未开工 |
| [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) | 做内容时的规矩：物料和玩法分开、坐标、验证、文档 |
| [docs/FISH-SCHOOL.md](./docs/FISH-SCHOOL.md) | 鱼群的设计。已实现。以后来咬钩的鱼从这群里取 |
| [docs/ROD.md](./docs/ROD.md) | 鱼竿和渔轮的设计。会跟镜头、会弯，没接玩法 |
| [docs/LINE.md](./docs/LINE.md) | 鱼线的设计。会松会绷，绷直了能把竿拉弯。远端和线长先由设置面板给 |
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

5190 被别的工程占用时，换一个端口，不要关掉别人的进程。应看到朝向大海的岸边，画面里有一根鱼竿，一条线从竿尖连到前方水里，水下有鱼群。`/fish.html` 可以单看一条鱼。右上角 **设置** 里可以调雾、水、鱼、鱼竿、鱼线和镜头，震动测试在面板最下面。桌面没有原生马达。

## 真机

包名 `com.wangzhixuan.fishing`，主屏幕名 Fishing。不要改回模板的 `com.wangzhixuan.pwgbase.hapticstest`。

```bash
npm run ios:bootstrap   # 第一次，或改了 plugins/native-haptics
npm run cap:sync        # 只改了网页
# Xcode 选 zhixuan 的 iPhone → Run
```

`ios:bootstrap` 会把 `SceneDelegate` 设成 `BridgeViewController`。漏了这一步，真机上 `plugin: false`，点震动没有反馈。验收先看状态行 `plugin: true`，再在设置里点 **点我震动**。

## 现在有什么

- 水面外观已定，数值在 [docs/ENGINEERING.md](./docs/ENGINEERING.md) 第 6 节。三层 256² FFT 保留。落水水花、气泡、咬口涟漪还没加，加的时候不重调整片海。
- 镜头默认 `(0, 1.7, 2)`，朝向 100°，俯仰 −10°。陆地在 +z，海在 −z。拖画面改朝向。这还不是「手机就是鱼竿」。
- 水下有 40 条鲷鱼，自己随机游：整群有快慢和急拐，每条鱼有自己的游走和窜，身体会摆、转弯会弯。设计在 [docs/FISH-SCHOOL.md](./docs/FISH-SCHOOL.md)。设置里的 **游速** 可以调。
- 镜头上挂着一根 7 尺纺车竿和渔轮，代码建模。转动镜头时整根竿慢一拍跟上，竿身有惯性：下段先动，竿尖最后到，停下后抖几下。设计在 [docs/ROD.md](./docs/ROD.md)。
- 鱼线从渔轮穿过导环，从竿尖连到 12 米外的水下。线有余量时垂成弧线，绷直时是直线。绷直后把竿抬起来或带向旁边，竿会被线拉弯。远端现在是固定的一个点，还没有饵。设计在 [docs/LINE.md](./docs/LINE.md)。
- 设置面板可以临时试雾、水、鱼竿的位置、鱼线的落点和余线、镜头。震动测试在面板最下面。关掉再开回到上面的默认值。
- 无 WebGPU 就明确失败，不回退 WebGL。

## 资源许可

- 水面代码来自 Minamo，MIT，许可在 `src/shore/minamo/LICENSE`。
- 天空、沙滩、石头来自 Poly Haven，CC0。
- 鲷鱼模型 Bream Fish (Dorade Royale)，作者 BlueMesh，CC BY，发布时需要署名。来源链接在 `src/fish/dorade.js` 文件头。
