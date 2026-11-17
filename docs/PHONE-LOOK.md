# 手机瞄准

状态：已接上。传感器在 `src/shore/phoneLook.js`，镜头和竿的用法在 `src/shore/startShore.js`。数字以 [ROD.md](./ROD.md) 第 3 节的表为准。玩法规则在 [FISHING-REQUIREMENTS.md](./FISHING-REQUIREMENTS.md)，这一层不含咬口和抛投。

## 1. 分层

数据只往一个方向走。`phoneLook` 不拿镜头，也不拿竿。

```
按钮「允许手机转动」
  → enable()：一次 requestPermission
  → deviceorientation（beta、gamma）
  → devicemotion（acceleration.x）
phoneLook 报出 tilt、axes().lift、slideMetres
  → startShore.applyPhone
       → 没按住：placeLook 摆视线
       → 无论按没按住：aimRod → rod.setAim
rodHold 把瞄准加在安装姿态上，FOLLOW_MAX 不管它
```

## 2. 不能破的规则

- 只用 Web 的 `deviceorientation` 和 `devicemotion`。不加 Core Motion，也不把 `@capacitor/motion` 当成另一套传感器。
- `enable()` 只由「允许手机转动」的点击调用。一次点击里只请求一个接口。`MotionPromptProxy` 必须 `decisionHandler(.prompt)`，不能静默 `.grant`。
- 眼高不变，`camera.up` 是世界 +Y，地平线不跟着滚。倾斜不改镜头的位置。
- 左右看靠手机的左右平移，不靠 `gamma`，也不靠罗盘 `alpha`。向左移动，视线向镜头左。符号是 `yawOff = slideMetres * 120`。
- 这段平移是视线的偏航，不是竿上的力。不要把加速度或 `slideMetres` 送进 `setTipForce` / `setTipTether`。
- 竿的零点是手机竖着（`beta` 约 90°），不是屏幕朝上平放。瞄准只过死区，不再做 1€ 低通。`FOLLOW_MAX` 只限制视线滞后。
- 按住，或玩法调用 `setLookLocked(true)`，先把当前偏航和俯仰烤进基准，再冻住镜头。松开不跳。冻住时竿仍跟着手机。
- 没有传感器样本时用指针拖动，和手机走同一套 `placeLook`。

## 3. 每帧顺序

`applyPhone` 在 `rod.update` 之前：

1. 没有样本：瞄准归零，返回。
2. 第一帧样本：记下眼高和当时的朝向，去掉按钮。
3. 刚按下或刚锁住：烤进基准，再拷贝镜头。
4. 刚松开：只清标志。
5. 用原始 `beta` / `gamma` 摆竿。
6. 仍锁住：把拷贝的镜头贴回去，不积分平移。
7. 否则：积分这一帧的平移，再摆视线。

设置面板和拖动改的是 `tune`。只有手机已有样本、并且镜头没冻住时，才把 `tune` 写进基准并 `rebase`。冻住时不改基准。

## 4. 还没做

- 玩法还没有调用 `setLookLocked`。抛投、甩杆的力度不在这一层。
- 桌面不能平移手机。左右看、上下看在桌面上靠拖动。
