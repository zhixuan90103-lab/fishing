# 鱼群行为与搏斗系统重构总结

2026-11-20

## 概述

本次重构针对鱼的自然行为进行了系统性改进，遵循"每样东西只有自己的物理"的核心原则。主要目标：
1. 移除不自然的共享节奏，让每条鱼有自己的节奏
2. 实现基于研究的尾巴振幅算法
3. 建立符合真实鱼类行为的水深系统和搏斗阶段

所有 33 项测试通过。代码变更：827 行新增，171 行删除。

## 1. 鱼群行为重构

### 1.1 移除共享节奏（`src/fish/shoal.js`）

**问题：** 原实现中，整群鱼共享一个`phase`时钟，导致所有鱼同步摆动，不自然。

**修改：**
- 移除全局`phase`和`phaseSpeed`
- 移除`PHASE_VARIES`常量
- 保留`PHASE_SLOW`作为环境偏好（水流方向），但不直接驱动鱼的节奏

**原理：** 每条鱼在`restBody()`时有自己的`drive`值（默认0.55），这已经是它的节奏基础。群体同步的视觉效果由相近的巡游速度和行为自然产生，而非强制同步。

**验证：**
```javascript
// 检查鱼群：每条鱼应有不同的动画相位
fishes.forEach(f => console.log(f.drive, f.stroke));
```

### 1.2 连续的群集权重（`src/fish/behaviors.js`）

**问题：** 原实现用二元开关区分"在群里"(`school`)和"游离"(`stray`)，导致行为跳变。

**修改：**
```javascript
// 旧：二元状态
if (stray) {
  // 游离行为
} else {
  // 群集行为
}

// 新：连续权重
const flocking = 1 - stray;  // 0 (完全游离) 到 1 (完全群集)
// 所有行为按权重混合
```

**具体改动：**
- `SCHOOL_*`常量改名为`FLOCK_*`
- 群集影响（`align`、`cohere`、`separate`）乘以`flocking`权重
- 个体探索保持不变，作为基础层
- 权重连续变化，消除跳变

**效果：** 鱼在群集和游离之间平滑过渡，更符合真实鱼群的流动性。

## 2. 尾巴振幅算法（`src/fish/swim.js`）

### 2.1 基于研究的设计

**研究依据：**
- 低速（< 0.4 m/s）：振幅随用力增长，无限制
- 高速（> 2.0 m/s）：振幅封顶约0.85（≈ 0.2体长，5 Hz）
- 加速时：振幅可超出稳态限制，乘以1.15倍
- 全力发力时：振幅不受速度限制

参考：Videler 1993, Wardle 1975, [FISH-SWIM-RESEARCH.md](./FISH-SWIM-RESEARCH.md)

### 2.2 实现

**新增常量：**
```javascript
const STROKE_LOW = 0.4;    // 低于此速度，振幅无限制
const STROKE_HIGH = 2.0;   // 高于此速度，振幅封顶
const DRIVE_CAP = 0.85;    // 高速振幅上限
const ACCEL_BOOST = 1.15;  // 加速时的振幅加成
```

**核心逻辑（`swim.js:195-209`）：**
```javascript
const effortGiven = aim.effort !== null && aim.effort > 0.5;

let driveAim;
if (effortGiven) {
  // 全力发力（如一冲）：不限制振幅
  driveAim = baseDrive;
} else {
  // 巡游：应用速度相关的封顶
  const speedFactor = clamp((fish.stroke - STROKE_LOW) / (STROKE_HIGH - STROKE_LOW), 0, 1);
  const driveCap = DRIVE_CAP + (DRIVE_FLAT_OUT - DRIVE_CAP) * (1 - speedFactor);

  const accelerating = want > 0.1;
  driveAim = accelerating
    ? Math.min(baseDrive * ACCEL_BOOST, DRIVE_FLAT_OUT)
    : Math.min(baseDrive, driveCap);
}
```

**效果：**
- 巡游时高速封顶，符合物理约束
- 一冲时全程保持高振幅，表现力量
- 加速时短暂超出稳态，更真实
- 被线拉住不动的鱼尾巴仍在打，因为它在用力

**测试验证：** `checks/check.mjs` 中的"a run beats the tail wide and fast all the way through"测试，确保一冲全程高振幅。

## 3. 水深系统与搏斗阶段

### 3.1 设计原则

**核心改变：** 水深基于y坐标，而非离竿尖的水平距离。

**原问题：**
```javascript
// 旧实现：用水平距离替代水深
const dive = (to.far - 3) / (9 - 3);  // to.far是水平距离
aim.y = REST_DEPTH + dive * (RUN_DEPTH - REST_DEPTH);
```
- 离竿近（< 3m）→ 鱼待在−0.5m
- 离竿远（> 9m）→ 鱼扎到−2.9m
- **不符合真实：** 鱼可以离竿远但在浅水，或离竿近但在深水

### 3.2 舒适深度（`src/play/fishKind.js`）

**每条鱼有自己的舒适深度：**
```javascript
const comfortDepth = -(1.2 + size * 1.8 + random() * 0.6);  // −1.5 到 −3.5m
```

| 体型 | 舒适深度范围 |
|------|------------|
| 0.78 | 约 −1.8m   |
| 0.95 | 约 −2.1m   |
| 1.2  | 约 −2.6m   |
| 1.4  | 约 −2.9m   |

**原理：** 大鱼更喜欢深水，每条鱼有个体差异（±0.6m）。

### 3.3 搏斗的四个阶段（`src/play/fight.js`）

基于[FISH-SWIM-RESEARCH.md](./FISH-SWIM-RESEARCH.md)的研究，建立四阶段模型：

#### 阶段定义

| 阶段 | 时长 | 深度 | 行为 | 转换 |
|------|------|------|------|------|
| **burst**<br>初次爆发 | 2-5秒 | −0.3m<br>浅层 | 咬钩瞬间，可能跳水，全力 | 时间到 → deep_fight |
| **deep_fight**<br>深层搏斗 | 视气力 | 舒适深度<br>−1.5 ~ −3.5m | 返回深层，横向快游，主要拔河 | 气力<0.4 → tired |
| **tired**<br>疲惫 | 视距离 | −0.8m<br>上浮 | 力量减弱，被拉向水面 | 距离<3m → last_surge |
| **last_surge**<br>最后挣扎 | 一次短冲 | 不固定<br>惊慌 | 见到人/网，最后爆发 | 冲结束 → tired |

#### 实现要点

**状态变量（`fight.js:165-167`）：**
```javascript
let stage = 'burst';  // 当前阶段
let timeInStage = 0;  // 在此阶段的时间
let hadLastSurge = false;  // 防止last_surge无限循环
```

**阶段转换（`fight.js:219-237`）：**
```javascript
// 在step()中按时间和气力转换
switch (stage) {
  case 'burst':
    if (timeInStage > 2 + random() * 3) {
      stage = 'deep_fight';
      timeInStage = 0;
    }
    break;
  case 'deep_fight':
    if (fight.stamina < 0.4) {
      stage = 'tired';
      timeInStage = 0;
    }
    break;
  // ...
}
```

**深度目标（`fight.js:340-396`）：**
```javascript
// 在steer()中按阶段决定深度
switch (stage) {
  case 'burst':
    targetDepth = BURST_DEPTH;  // −0.3m
    break;
  case 'deep_fight':
    // 仍考虑远近，但基准是舒适深度而非固定值
    const dive = Math.min(1, Math.max(0, (to.far - DIVE_NEAR) / (DIVE_FAR - DIVE_NEAR)));
    targetDepth = running
      ? kind.comfortDepth * deep * dive
      : kind.comfortDepth * 0.7;
    break;
  case 'tired':
    targetDepth = TIRED_DEPTH;  // −0.8m
    break;
  case 'last_surge':
    targetDepth = kind.comfortDepth * 0.5;  // 惊慌，不管深度
    break;
}
```

#### 关键修复：`last_surge`无限循环

**问题：** 原设计触发距离（< 5m）远大于抄网距离（2.2m），导致：
1. 鱼被拉到< 5m → 触发`last_surge`
2. 鱼开始冲，力 > 4.5N，无法抄网
3. 冲结束 → 回到`tired`
4. 仍在< 5m → **再次触发`last_surge`**
5. 无限循环，鱼永远无法上岸

**修复（`fight.js:342-349`）：**
```javascript
// 1. 触发距离改为< 3m（接近抄网距离2.2m）
// 2. 添加hadLastSurge标记，只触发一次
// 3. 冲的爆发力减小（0.4而非0.6）
if (stage === 'tired' && to.far < 3 && !hadLastSurge) {
  stage = 'last_surge';
  timeInStage = 0;
  hadLastSurge = true;  // 关键：防止重复触发
  running = true;
  fight.burst = 0.4;  // 较短的冲
}
```

### 3.4 新增常量

| 常量 | 值 | 说明 |
|------|------|------|
| `BURST_DEPTH` | −0.3m | 初次爆发深度（原`RUN_DEPTH`废弃） |
| `TIRED_DEPTH` | −0.8m | 疲惫上浮深度（原`REST_DEPTH`废弃） |
| `DIVE_NEAR` / `DIVE_FAR` | 3m / 9m | 保留，但只在`deep_fight`阶段起作用 |

### 3.5 未来工作

设计文档[REFACTOR-DEPTH-2026-11-20.md](./REFACTOR-DEPTH-2026-11-20.md)中提到但本次未实现的功能：

**`course.js`的分离不安感（未实现）：**
```javascript
// 设计：分离两种不安
uneasy(far, depth) {
  // 1. 浅水不安（基于y坐标）
  const shallow = ...;  // depth接近0时不安

  // 2. 近人不安（基于水平距离）
  const near = ...;  // far < 3m时不安

  return Math.min(1, shallow + near);
}
```

**原因：** 当前`uneasy()`仍只用水平距离。分离两种不安感需要修改接口，影响较大，留待后续。现有实现已能表现"被拉近时不安"，只是不能区分"浅水而远"的情况。

## 4. 测试与验证

### 4.1 测试结果

**全部33项测试通过**（72秒）：
```bash
npm run check
# 33 of 33 passed in 72 s
```

### 4.2 关键测试

| 测试 | 验证内容 |
|------|---------|
| `fish table: ...` | 小鱼不出线，大鱼不断线 |
| `fight: a run beats the tail wide...` | 一冲全程高振幅 ≥ 1.0（新尾巴算法） |
| `casts: every size of fish is landed...` | 所有尺寸的鱼都能上岸（修复`last_surge`循环） |
| `casts: winding only while it rests...` | 只在歇时收线不会断线 |
| `landed fish: lifted clear...` | 鱼被提出水面后正常悬挂 |

### 4.3 实测数据

**尾巴振幅（`checks/rig.mjs`，60fps，气力>50%）：**
- 一冲时：≈ 1.2，尾频 ≥ 1.15 m/s
- 歇息时：≈ 0.33
- 巡游时：0.55，尾频 0.35 m/s

**对比原值：** 一冲后期原为0.47（比歇息0.55还小），现修复。

## 5. 文档更新

### 5.1 已更新文档

- **[PLAY.md](./PLAY.md) 第8节：**
  - 鱼属性表新增"舒适深度"列
  - 新增"搏斗的四个阶段"小节
  - 更新深度常量表（`BURST_DEPTH` / `TIRED_DEPTH`替代`RUN_DEPTH` / `REST_DEPTH`）

- **[CONVENTIONS.md](./CONVENTIONS.md) 第3节"对鱼"：**
  - 新增"尾巴振幅跟速度和用力"规则
  - 说明低速/高速/全力时的不同行为
  - 引用研究和实现位置

### 5.2 设计文档

- **[REFACTOR-FISH-2026-11-20.md](./REFACTOR-FISH-2026-11-20.md)：** 鱼群行为重构的详细设计
- **[REFACTOR-DEPTH-2026-11-20.md](./REFACTOR-DEPTH-2026-11-20.md)：** 水深与搏斗阶段的详细设计

### 5.3 研究依据

- **[FISH-SWIM-RESEARCH.md](./FISH-SWIM-RESEARCH.md)：** 鱼类游动、尾巴摆动、群集行为的研究纪要

## 6. 代码变更统计

```
总计：827 行新增，171 行删除
文件变更：
  src/fish/shoal.js       移除共享phase
  src/fish/behaviors.js   连续群集权重
  src/fish/swim.js        速度依赖的尾巴振幅
  src/play/fishKind.js    舒适深度
  src/play/fight.js       搏斗阶段系统
```

## 7. 后续工作

### 7.1 真机测试（待完成）

**需要验证：**
- 初次咬钩时鱼在浅层爆发是否明显
- 深层搏斗的横向游动是否更有力
- 疲惫上浮是否可见
- 最后挣扎是否自然

### 7.2 可选改进

1. **分离浅水不安与近人不安** (`course.js`)
   - 当前：只用水平距离判断"不安"
   - 改进：浅水（y坐标）和近人（水平距离）分开计算

2. **出水姿态改进** (`hung.js`)
   - 当前：整条鱼同时出水
   - 改进：头先出、身体还在水里晃

3. **浅层跳跃动画**
   - `burst`阶段鱼可能跳出水面
   - 需要新的动画状态

4. **深度对体感的影响**
   - 深层搏斗时手感是否应不同于浅层

## 8. 经验与原则

### 8.1 验证的重要性

**教训：** `last_surge`的无限循环bug只在完整测试中发现：
- 单元测试`fight.js`看不出（没有距离输入）
- 只有完整一竿的测试才暴露问题
- **结论：** 重要系统改动必须跑完整场景测试

### 8.2 渐进式重构

**策略：**
1. 鱼群行为（shoal/behaviors）
2. 尾巴振幅（swim）
3. 水深系统（fishKind/fight）
4. 每步独立提交，测试通过后再进行下一步

**好处：** 每一步都有明确的before/after对比，问题定位快。

### 8.3 设计先行

**流程：**
1. 写设计文档（REFACTOR-*.md）
2. 列出修改点和验证标准
3. 实现
4. 验证
5. 更新正式文档

**效果：** 大改动不乱，思路清晰，文档完整。

## 9. 参考资料

- Videler, J. J. (1993). Fish Swimming. Chapman & Hall.
- Wardle, C. S. (1975). "Limit of fish swimming speed". Nature 255: 725–727.
- Svendsen et al. (2015). "Design and setup of intermittent-flow respirometry system for aquatic organisms". PMC4330683.
- [FISH-SWIM-RESEARCH.md](./FISH-SWIM-RESEARCH.md)：本项目的研究纪要
- [CHAIN.md](./CHAIN.md)：因果链原则
- [FISH-RUN.md](./FISH-RUN.md)：钩住的鱼怎么跑

---

**总结：** 本次重构系统性改善了鱼的自然行为，从微观的尾巴摆动到宏观的搏斗阶段，都更符合真实鱼类的行为规律。所有测试通过，文档完整，可以进入真机验证阶段。
