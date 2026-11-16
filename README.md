# Fishing

竖屏 WebGPU 钓鱼。壳来自 portrait-webgpu-base（390×844 contain、Capacitor iOS、震动插件）。岸边水面已经定稿，先不要再改海浪、雾和曝光。钓鱼流程还没做。

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 打开仓库时的第一入口 |
| [docs/FISHING-REQUIREMENTS.md](./docs/FISHING-REQUIREMENTS.md) | 这一竿的规则。已定，玩法未开工 |
| [docs/FISH-SCHOOL.md](./docs/FISH-SCHOOL.md) | 岸边看得见的鱼群。已实现，不是被钩住的鱼 |
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

5190 被别的工程占用时，换一个端口，不要关掉别人的进程。应看到朝向大海的岸边。右上角 **设置** 里可以调雾、水和镜头，震动测试在面板最下面。桌面没有原生马达。

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
- 水下有 40 条鲷鱼。规则在 [docs/FISH-SCHOOL.md](./docs/FISH-SCHOOL.md)。出生在画面中部的水里，不是画面最底下。
- 设置面板可以临时试雾、水和镜头。震动测试在面板最下面。关掉再开回到上面的默认值。
- 无 WebGPU 就明确失败，不回退 WebGL。
