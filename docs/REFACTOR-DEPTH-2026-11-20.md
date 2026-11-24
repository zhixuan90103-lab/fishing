# 重构水深与搏斗状态 (Refactor Water Depth and Fighting States)

> **历史记录，不是现在的设计。** 2026-11-24 注。这份写的是 11-20 加"搏斗四个阶段"（`burst`、`deep_fight`、`tired`、`last_surge`）和每条鱼的"舒适深度"的设计。两样都在 11-24 拿掉了：它们按时间和开关走，实际只改了鱼游多深，贴着竿尖还往深处扎。深度回到按远近：冲的时候往下扎，远处扎得深、近处扎不下去，歇的时候在 −0.5 米。遛鱼现在是一轮比一轮弱，没有阶段。现在的设计和拿掉的原因在 [PLAY.md](./PLAY.md) 第 8 节。文末"现在是固定 −4m 到 0"这个数，代码里从来没有过。

2026-11-20

## 问题 (Problem)

当前实现用"离竿尖的水平距离"替代"水深"，不符合实际鱼的行为：

### 当前代码 (Current Implementation)

**fight.js:324-325**
```javascript
const dive = Math.min(1, Math.max(0, (to.far - DIVE_NEAR) / (DIVE_FAR - DIVE_FAR)));
aim.y = running ? REST_DEPTH + (RUN_DEPTH - REST_DEPTH) * deep * dive * dive * (3 - 2 * dive) : REST_DEPTH;
```

- `to.far` = 鱼到竿尖的**水平距离** (line:268 `Math.hypot(out.x, out.z)`)
- 离竿尖近 (< 3m) → `dive = 0` → 待在 REST_DEPTH (-0.5m)
- 离竿尖远 (> 9m) → `dive = 1` → 扎到 RUN_DEPTH (-2.9m)

**course.js:74-79**
```javascript
// There is no sea bed here: how near the rod tip it is stands in for how shallow the water is.
const BANK_ALARMS = 0.45;  // 靠近竿尖 → 认为是浅水 → 不安
```

### 与研究结论的差异 (Mismatch with Research)

用户提供的研究显示：

1. **搏斗发生在水下**，不是水面
2. **离竿近 ≠ 水浅** - 这是两个独立的维度
   - 水浅 = 靠近水面 (y坐标接近0)
   - 离竿近 = 水平距离小 (hypot(x, z) 小)
3. **鱼会返回舒适深度层** - 不是被竿尖拖到浅层
4. **搏斗分几个阶段**，不只是"冲/歇"两态

## 设计原则 (Design Principles)

### 1. 分离两个维度 (Separate Two Dimensions)

**水深 (Water Depth)** - 基于 y 坐标
- 水面在 y=0（或某个常量）
- 浅水：y 接近 0
- 深水：y 远离 0（负值更大）

**离竿远近 (Distance to Rod)** - 基于水平距离
- 计算：`Math.hypot(fish.x - tip.x, fish.z - tip.z)`
- 只影响不安、逃窜倾向，**不影响深度**

### 2. 鱼有舒适深度层 (Comfortable Depth Layer)

每条鱼根据以下因素选择舒适深度：
- **鱼种和体型**：大鱼倾向更深层
- **搏斗阶段**：不同阶段有不同的深度偏好
- **体力**：有力时敢去深层，累了上浮

舒适深度是鱼的**目标**，不是强制：
- 鱼游向这个深度
- 被竿尖拖拽、或冲向水面时偏离
- 一有机会就回到这个深度

### 3. 搏斗分阶段 (Fighting Stages)

研究显示的四个阶段：

| 阶段 | 行为 | 深度偏好 | 速度 | 转换条件 |
|---|---|---|---|---|
| **Stage 1: burst**<br>初次咬钩爆发 | 炸水、可能跳出水面 | 浅层 (-0.3 to 0) | 最快 | → Stage 2: 2-5秒后 |
| **Stage 2: deep_fight**<br>深层搏斗 | 返回舒适深度层，横向游动 | 舒适深度 (-1.5 to -3.5) | 快 | → Stage 3: 体力 < 0.4 |
| **Stage 3: tired**<br>疲惫 | 被拉近，抵抗减弱 | 上浮 (-0.8 to -0.3) | 慢 | → Stage 4: 距离 < 5m |
| **Stage 4: last_surge**<br>最后挣扎 | 见到人/网，再次爆发 | 任意（惊慌） | 中等 | → 被抄网 |

当前的 `running` / 非running 对应：
- `running=true` ≈ 有力的阶段 (Stage 1, 2, 4)
- `running=false` ≈ 歇息 (Stage 3)

但当前没有区分：
- 初次咬钩的浅层爆发 vs 深层横冲
- 疲惫上浮 vs 最后挣扎

### 4. 实现策略 (Implementation Strategy)

**不新增状态机** - 在现有 `running` 基础上细化：

```javascript
fight: {
  running: true/false,           // 现有：是否在冲
  stage: 'burst' | 'deep_fight' | 'tired' | 'last_surge',  // 新增：哪个阶段
  comfortDepth: -2.5,            // 新增：这条鱼当前的舒适深度
  timeInStage: 0,                // 新增：在当前阶段多久了
}
```

## 具体修改 (Specific Changes)

### 修改 1: fight.js - 移除"距离 → 深度"的映射

**当前 (Current):**
```javascript
const dive = Math.min(1, Math.max(0, (to.far - DIVE_NEAR) / (DIVE_FAR - DIVE_NEAR)));
aim.y = running ? REST_DEPTH + (RUN_DEPTH - REST_DEPTH) * deep * dive * dive * (3 - 2 * dive) : REST_DEPTH;
```

**改为 (Change to):**
```javascript
// 根据阶段决定目标深度
let targetDepth;
switch (fight.stage) {
  case 'burst':
    targetDepth = BURST_DEPTH;  // -0.3 to 0, 可能跳出水面
    break;
  case 'deep_fight':
    targetDepth = fight.comfortDepth;  // -1.5 to -3.5, 鱼自己的层
    break;
  case 'tired':
    targetDepth = TIRED_DEPTH;  // -0.8 to -0.3, 上浮
    break;
  case 'last_surge':
    targetDepth = fight.comfortDepth * 0.5;  // 惊慌，不管深度
    break;
}
aim.y = targetDepth;
```

### 修改 2: course.js - 分离"浅水不安"和"近竿不安"

**当前 (Current):**
```javascript
uneasy(far) {
  // far = 离竿尖的水平距离，用它算"浅水"不安
  const near = Math.min(1, Math.max(0, (BANK_FAR - far) / (BANK_FAR - BANK_NEAR)));
  return BANK_ALARMS * near * near * (3 - 2 * near);
}
```

**改为 (Change to):**
```javascript
uneasy(far, depth) {  // 新增 depth 参数
  // 1. 浅水不安：基于 y 坐标
  const shallow = Math.min(1, Math.max(0, (depth - SHALLOW_MIN) / (SHALLOW_MAX - SHALLOW_MIN)));
  const shallowAlarm = SHALLOW_ALARMS * shallow * shallow * (3 - 2 * shallow);

  // 2. 近人不安：基于水平距离（保留原逻辑）
  const near = Math.min(1, Math.max(0, (BANK_FAR - far) / (BANK_FAR - BANK_NEAR)));
  const nearAlarm = BANK_ALARMS * near * near * (3 - 2 * near);

  // 两种不安叠加
  return Math.min(1, shallowAlarm + nearAlarm);
}
```

新常量：
```javascript
const SHALLOW_MIN = -0.5;   // 比这浅开始不安
const SHALLOW_MAX = -0.1;   // 这里最不安
const SHALLOW_ALARMS = 0.3; // 浅水不安的强度
```

### 修改 3: fight.js - 新增阶段转换逻辑

```javascript
// 在 fight.step() 里
function advanceStage(dt, tension, far, depth) {
  fight.timeInStage += dt;

  switch (fight.stage) {
    case 'burst':
      // 2-5秒后进入深层搏斗
      if (fight.timeInStage > 2 + random() * 3) {
        fight.stage = 'deep_fight';
        fight.timeInStage = 0;
      }
      break;

    case 'deep_fight':
      // 体力 < 0.4 时进入疲惫
      if (fight.stamina < 0.4) {
        fight.stage = 'tired';
        fight.timeInStage = 0;
      }
      break;

    case 'tired':
      // 被拉近到 5m 以内 → 最后挣扎
      if (far < 5) {
        fight.stage = 'last_surge';
        fight.timeInStage = 0;
        // 最后一冲
        running = true;
        fight.burst = 0.6;
      }
      break;

    case 'last_surge':
      // 这一冲用完 → 回到疲惫，可以抄网了
      if (!running) {
        fight.stage = 'tired';
        fight.timeInStage = 0;
      }
      break;
  }
}
```

### 修改 4: fishKind.js - 给每条鱼分配舒适深度

```javascript
export function fishOf(size, random = Math.random) {
  // ... 现有代码 ...

  // 新增：舒适深度，大鱼更深
  const comfortDepth = -(1.2 + size * 1.8 + random() * 0.6);  // -1.5 to -3.5

  return {
    // ... 现有字段 ...
    comfortDepth,
  };
}
```

## 向后兼容 (Backwards Compatibility)

现有测试和代码依赖：
- `fight.running` 保持不变
- `fight.force`, `fight.stamina`, `fight.burst` 保持不变
- `aim.y` 仍然控制目标深度，只是计算方式变了

新增字段：
- `fight.stage` - 只在 fight.js 内部使用
- `fight.comfortDepth` - 从 fishKind 传入
- 外部调用不需要改变

## 验证标准 (Verification Criteria)

### 1. 视觉检查 (Visual Check)

- [ ] 初次咬钩时鱼在浅层爆发（可能露出水面）
- [ ] 随后鱼返回深层，横向游动
- [ ] 累了上浮到浅层，可以看到鱼的轮廓
- [ ] 拉近到身边时有最后一冲
- [ ] 鱼在远处时也能在深层搏斗（不再因为"离竿远"就扎深）

### 2. 数值检查 (Numeric Check)

```javascript
// 在 checks/check.mjs 里
check('fight: stages transition correctly', () => {
  const fish = fishOf(0.6);
  const fight = createFight();
  fight.begin(fish);

  // 初始阶段应该是 burst
  assert(fight.stage === 'burst');

  // 推进 3 秒 → 进入 deep_fight
  for (let i = 0; i < 180; i++) fight.step(1/60, 5, 0);
  assert(fight.stage === 'deep_fight');

  // 耗到 stamina < 0.4 → 进入 tired
  while (fight.stamina > 0.4) fight.step(1/60, 5, 0);
  assert(fight.stage === 'tired');
});

check('depth: based on y-coordinate not distance', () => {
  // 鱼在远处但浅层 → 应该感到不安
  const uneasy1 = course.uneasy(20, -0.2);  // far=20m, depth=-0.2m
  assert(uneasy1 > 0.3);  // 浅水不安

  // 鱼在近处但深层 → 只因为近人不安，不因为"浅"
  const uneasy2 = course.uneasy(2, -3.0);   // far=2m, depth=-3.0m
  // ... 检查 uneasy2 的来源
});
```

### 3. 现有测试不退化 (No Regression)

所有 33 个现有测试继续通过：
```bash
npm run check
```

## 实现顺序 (Implementation Order)

1. **先加字段** - fight.stage, fight.comfortDepth, fishKind.comfortDepth
2. **改深度计算** - fight.js 的 aim.y 从 stage 读，而不是从 to.far
3. **分离 uneasy** - course.js 的 uneasy() 接受 depth 参数
4. **加阶段转换** - fight.js 的 advanceStage()
5. **验证** - 跑测试、看真机

每一步独立提交，保持测试通过。

## 与现有文档的关系 (Relation to Existing Docs)

- **PLAY.md 第 8 节** - 需要更新 fight.js 的说明
- **FISHING-REQUIREMENTS.md** - 可能需要补充"水有深度"的规则
- **FISH-SWIM-RESEARCH.md** - 这次重构是基于该文档的研究结论

## 未来工作 (Future Work)

这次重构只处理**搏斗时的深度**。以下方面留待后续：

1. **出水姿态** - hung.js 的改进（头先出、身体还在水里晃）
2. **浅层跳跃** - Stage 1 时鱼可能跳出水面（需要新的动画状态）
3. **深度对体感的影响** - 深层搏斗时手感是否应该不同？
4. **环境差异** - 不同水域的深度范围（现在是固定 -4m 到 0）
