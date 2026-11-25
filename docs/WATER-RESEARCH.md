# 水面扰动检索纪要

三轮检索，加上其后两轮核对：有没有现成的开源水，以及 Three.js 官方示例能不能交互。只保留打开过、并且支撑某条判断的来源。

检索日期：2026-11-20。本文不是规格，也还没有改代码。水面外观仍以 [ENGINEERING.md](./ENGINEERING.md) 第 6 节为准，不要为了这条去改三层 256²、浪高、雾、粗糙、曝光和太阳。水花和水珠仍以 [SPLASH.md](./SPLASH.md) 为准。

## 1. 现在的水

Minamo 是三层 FFT（250 m / 37 m / 7.3 m，各 256²）。物体戳不进频谱。网格用 TSL 的 `oceanNodes.displacement`，半入水的水线用 WGSL 的 `heightAt` / `nearS`。官方说明两边必须是同一个高度函数，改一边必须改另一边。

现在能看见的只有海面上方的东西：落水一次水花，线入水点和近水面的鱼走得够快时喷水珠。慢、或者鱼深于大约 1.5 米，水面上看不出谁在走。饵落水后沉到水面下 0.4 米（`RUN_DEPTH`），不再贴着水面。

## 2. 修改方案

2026-11-25：做的时候没有用下面这块高度贴图，用了按公式现算的圈，原因和做成什么样见 [SPLASH.md](./SPLASH.md) 第 9 节。下面是当时的方案，留作参考。

不换海，不加第四层 FFT。在现有位移旁边加一块跟着镜头的高度贴图：

- 每帧衰减，再按邻居把起伏传开。参考官方 [webgl / gpgpu / water](https://threejs.org/examples/webgl_gpgpu_water.html) 的这一步：格子上存高度，在一个点上戳一下，波传开。不拿它的材质、天空、128 的整池，也不走它的 WebGL 计算贴图。
- 线入水的那一点、靠近水面的鱼嘴，按现在水珠那套「离水面多近、走多快」往这块场里戳。饵贴着水面拖过去要留纹，得把饵的位置也当成第三个戳点。落水那一下仍是现有的一次水花。
- 采样时高度等于原来的 FFT 位移加上这一块。网格和水线两处都加。
- 水花和喷珠留在海面上方的半透明层，不进这块高度。

改完以后：线只在入水那一点走的时候起波；鱼只在靠近水面又在动的时候起波，深水里水面不动；饵在沉到 0.4 米以后不跟着这块场，除非另加戳点。

不采用的做法：把整片海换成池子高度场；再加一层风浪 FFT；只盖一张船尾贴图、波不往外传；只改网格、不改水线。

## 3. 检索到的做法

对得上「FFT 海加上一块会传开的交互高度」的开源，没有一份能摘进 Three.js、同时保住现在这片海。

| 做法 | 谁做的 | 和本方案的关系 |
|---|---|---|
| 动态高度叠在 FFT 或 Gerstner 上，用球加力 | [Crest](https://github.com/wave-harmonic/crest)，MIT，Unity，不支持 WebGL | 分层就是这个。引擎不是 Three.js |
| FFT 与一块限范围的涟漪格子，`addRipple` | [Orillusion](https://github.com/Orillusion/orillusion)，MIT，WebGPU 引擎 | 浏览器里最接近。水做在引擎里，不是 Three.js 的包 |
| 128 格子，鼠标戳、球浮 | Three.js 官方 `webgl_gpgpu_water`，r186 仍在 | 只借「戳一下、传开」。画面和路径不借 |
| 池子高度场，物体按一串球去压 | [jeantimex/threejs-water](https://github.com/jeantimex/threejs-water) | Three.js 里能交互的是池子，不是涌浪 |
| iWave，注水、抽水、扰动、刚体 | [skunami.js](https://github.com/skeelogy/skunami.js)，MIT，2013，9 次提交 | 算法对，停在当年的 Three.js |
| 鱼靠近水线起高度涟漪 | [RippleAquarium](https://github.com/SeanWong17/RippleAquarium)，AGPL-3.0 | 鱼缸。许可不适合直接并进 |
| 四层 FFT，落下打一圈，尾迹还没有 | [Ultra-Water](https://github.com/Humpalumps/Ultra-Water)，MIT，WebGL2 | 作者写明移动物体的尾迹还没做 |
| 船把高度盖进贴图，或按船速摆两套波 | SeedOcean；web-ocean-3d | 不是格子上往外传的波 |
| 纯 FFT，没有加力口 | Poseidon、iodiot/webgpu-ocean、Spiri0、threejs-water-free、david.li/waves、gasgiant/FFT-Ocean | 已查看，未采用 |
| 法线贴图滚动，或流向贴图 | 官方 `webgpu_ocean` 的 `WaterMesh`，`webgpu_water` | 不能被点击或物体带动 |
| 船尾迹弯水面 | Tidewater | 付费，源码不能再分发。不收进开源 |

《荒野大镖客 2》的求解器没有打开到一手材料。能对上的是上面的分层，不是那款游戏的参数。

## 4. 来源

| 标题 | 链接 | 类型 | 用在哪 |
|---|---|---|---|
| Crest Ocean System, Waves | https://crest.readthedocs.io/en/stable/user/waves.html | 官方文档 | 动态场叠在 FFT 上；球加力；阻尼换传播距离；离开原点约 10 km 不稳 |
| Minamo, How it works | https://github.com/kanaworksai-hue/minamo/blob/main/docs/HOW_IT_WORKS.md | GitHub | 网格和水线必须共用一个高度函数 |
| Orillusion WaterRenderer | https://www.orillusion.com/guide/water/Readme.html | 官方文档 | `addRipple`；涟漪可限在约 60 m；`getHeight` 读叠完的高度 |
| ARM Ocean FFT | https://arm-software.github.io/opengl-es-sdk-for-android/ocean_f_f_t.html | 官方文档 | 手机上 N=256 的 FFT 已经是高度、法线、位移多遍。不为鱼再加一层 |
| Tessendorf, Interactive Water Surfaces | https://jtessen.people.clemson.edu/reports/papers_files/Interactive_Water_Surfaces.pdf | 论文 | 脉冲即涟漪；卷积大约收到 ±6 格 |
| Tessendorf, eWave note，2015-03-04 | http://jerrytessendorf.blogspot.com/2015/03/ewave-using-exponential-solver-on-iwave.html | 其他 | iWave 有稳定性和伪影；指数求解换掉这一步 |
| three.js webgl gpgpu water | https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_water.html | 官方文档 | 鼠标扰动水面；球读高度。画面不借 |
| three.js WaterMesh | https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/WaterMesh.js | 官方文档 | 官方海面示例是平整反射，没有加力口 |
| three.js webgpu water | https://threejs.org/examples/webgpu_water.html | 官方文档 | 流向是滑条，不是物体压出来的 |
| ThreeJS Water，jeantimex | https://github.com/jeantimex/threejs-water | GitHub | Three.js 池子，物体按球压水面 |
| skunami.js | https://github.com/skeelogy/skunami.js | GitHub | Three.js 上的 iWave，已停在 2013 |
| RippleAquarium | https://github.com/SeanWong17/RippleAquarium | GitHub | 鱼和鼠标触发高度场；AGPL-3.0 |
| WebGPU Water，PlayCanvas | https://github.com/willeastcott/webgpu-water-playcanvas | GitHub | 同一套池子，引擎不是 Three.js |
| Ultra-Water | https://github.com/Humpalumps/Ultra-Water | GitHub | FFT 海；落下有涟漪；尾迹作者写明还没有 |
| david.li waves | https://github.com/dli/waves | GitHub | 早期 FFT 海，没有物体加力 |
| SeedOcean | https://github.com/reed-soul/SeedOcean | GitHub | 尾迹是盖进 CPU 贴图 |
| web-ocean-3d | https://github.com/2600th/web-ocean-3d | GitHub | 尾迹是按船速摆出来的波，没有带着历史往外传 |
| Orillusion 仓库许可 | https://github.com/Orillusion/orillusion | GitHub | MIT。整颗引擎，不是水面包 |
| Crest 仓库许可 | https://github.com/wave-harmonic/crest | GitHub | MIT 的是 Unity 内置管线那一版 |
