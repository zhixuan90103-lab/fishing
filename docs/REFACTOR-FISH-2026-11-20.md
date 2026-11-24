# 鱼群行为重构设计 2026-11-20

> **历史记录，不是现在的设计。** 2026-11-24 注。这份写的是 11-20 那次鱼群重构的计划。鱼群在 11-24 整个重写了：没有 `shoal`，没有整群的朝向、深度和活跃度，没有 `flockWeight`、`tempo`、`roamer`，没有人指挥鱼群。现在的设计在 [FISH-SCHOOL.md](./FISH-SCHOOL.md)。这份里打了勾的三处，当时的实现也和它写的不一样：尾巴摆幅分段用的是米/秒和 `effort > 0.5`，不是体长和 0.85，而且那个封顶实际不生效（`src/fish/swim.js` 文件头有说明）；"活跃度跳高取代急拐"没有发生，急拐当时还在。

## 问题

手机测试发现：
1. **鱼群木纳，没有自主性**：40 条一起冲、一起滑，像被统一指挥
2. **被钓上来的鱼不够自然**：频率固定，衰减机械

## 设计原则（不能破）

来自 Reynolds (1987) 和 FISH-SWIM-RESEARCH.md：

1. **每条鱼只按局部感知决策**：没有整群的控制者
2. **群体行为是涌现的**：少数鱼的偏向能带动整群，但不是命令
3. **物料和玩法分离**：鱼群是物料，自己能游，不含钓鱼规则

## 三处重构

### 重构 1：shoal 职责重新定义

**现在的问题：**
```javascript
// shoal.js 控制整群统一快慢
shoal.mode = 'cruise' / 'sprint' / 'glide'
shoal.effort = 0.18 到 4.2  // 所有鱼的速度倍率
```
40 条鱼一起切换状态，一起加速/减速。

**设计目标：**
- shoal 是**环境**，不是**控制器**
- shoal 提供：
  1. 群中心位置（已有，不改）
  2. 对这片水的偏向：朝向、深度、活跃度
  3. 留在镜头前的引力场
- 每条鱼自己决定快慢

**新职责：**
```javascript
// shoal 只提供环境偏向
shoal.homeYaw      // 这片水的建议朝向（缓慢变化）
shoal.homeDepth    // 这片水的建议深度（缓慢变化）
shoal.activity     // 这片水的活跃度 0-1（影响鱼自己的冲刺概率）
shoal.camX/Z/Yaw   // 镜头位置（用于计算"留在画面里"的引力）
```

**实现思路：**
- 去掉 `mode`、`effort`、`speed`
- 保留 `advanceHeading()`、`advanceDepth()`，但只更新建议值
- 保留"留在画面里"的逻辑（边界引力）
- 加 `activity`：缓慢波动，偶尔跳高（原本的无缘由急拐）

---

### 重构 2：结群权重化

**现在的问题：**
```javascript
// behaviors.js：离散的状态切换
if (fish.boutT > fish.boutDur) beginStray(fish);  // 像开关
```

**设计目标：**
- 结群是**连续的**，不是开关
- roamer 是"结群倾向低的鱼"，不是"切状态的鱼"
- 权重可以波动

**新设计：**
```javascript
// 每条鱼有一个结群权重 0-1
fish.flockWeight = 0.3 到 1.0  // roamer 低，非 roamer 高

// 权重随时间波动（roamer 波动大）
flockWeight = base + amplitude * sin(time * frequency)

// 目标是权重混合
aim.yaw = flockWeight * followYaw + (1 - flockWeight) * wanderYaw
aim.speed = flockWeight * followSpeed + (1 - flockWeight) * ownPace
```

**实现思路：**
- 去掉 `SCHOOL`、`STRAY` 状态
- 合并 `followSchool()` 和 `stray()` 为一个函数，内部按权重混合
- `fish.flockWeight` 初始化：roamer 0.3-0.5，非 roamer 0.9-1.0
- roamer 的权重周期性波动

---

### 重构 3：摆幅算法按速度分段

**现在的问题：**
```javascript
// swim.js：drive 简单跟"想加速多少"
const want = (aim.speed - fish.speed) / aim.cruise;
const driveAim = 0.55 + want * 1.5;
```
不符合真实鱼类运动学。

**研究结论（FISH-SWIM-RESEARCH.md）：**
- 低速（< 0.4 BL/s）：摆幅随使劲变大
- 高速（> 0.4 BL/s）：摆幅封顶 ~0.2 BL，主要靠尾频
- 力竭（effort > 0.85）：摆幅到顶 1.0
- 连续加速：摆幅可暂时超过稳态

**新算法：**
```javascript
// 按速度和使劲分情况
const effort = aim.effort ?? computeEffort(fish);
const speed = fish.speed;
const bodyLength = 0.45;  // 读自 fish.size * baseLength

let driveAim;
if (speed < 0.4 * bodyLength) {
  // 低速：摆幅随使劲线性增大
  driveAim = 0.3 + effort * 0.6;
} else if (effort > 0.85) {
  // 力竭：摆幅到顶
  driveAim = 1.0;
} else {
  // 高速稳态：摆幅封顶，主要靠尾频
  driveAim = 0.55 + effort * 0.4;
}
```

**实现思路：**
- 在 `swimFish` 里改 drive 计算
- 需要知道 bodyLength（从 fish.size 获得）
- 保持平滑过渡

---

## 重构顺序

1. ✅ **重构 2**（最简单，风险最低）
2. ✅ **重构 1**（影响最大，需要仔细测试）
3. ✅ **重构 3**（细节打磨）

每步完成后在 Node 和真机上测试，确保自然。

---

## 不改的部分

✅ 保留：
- 四种状态互斥（自由、游向饵、被钓、出水）
- 位置只由 swim.js 游出来
- 被钓时关掉结群
- 物料和玩法的接口（take/giveBack/hang/keep）
- 两条不能破的规则（鱼不横移、动作连续）

❌ 不加：
- 行为树
- 兴趣值、饥饿
- 为水花单独做的行为

---

## 验收标准

重构后：
1. 鱼群看起来有自主性，不再 40 条一起动
2. 每条鱼有自己的节奏
3. 仍然成群，不会散开
4. 在 Node 和真机上都自然

---

## 文件修改清单

### 重构 1
- `src/fish/shoal.js`：去掉 mode/effort，改为 activity/homeYaw/homeDepth
- `src/fish/behaviors.js`：每条鱼自己的快慢节奏
- `src/fish/flock.js`：传 shoal 的环境偏向给鱼

### 重构 2
- `src/fish/behaviors.js`：合并 school/stray，改为权重混合
- `src/fish/flock.js`：初始化 flockWeight

### 重构 3
- `src/fish/swim.js`：改 drive 计算逻辑
- 需要传 bodyLength 给 swimFish

---

## 下一步

先实施重构 2，测试通过后再做重构 1。
