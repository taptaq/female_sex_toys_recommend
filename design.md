# Luna 移动端设计 / 动画交互系统文档

# 项目定位

Luna 是一个面向女性用户的移动端私密装备推荐 App。

它不是传统电商，也不是参数导向工具，而是：

> 一个带有「柔软陪伴感」的情绪化探索体验。

整体体验以：

* 萌系宇航员 IP
* 柔和星际感
* 低压力决策
* 女性向安全感
* 情绪陪伴感

作为核心设计语言。

设计目标不是「更科技」，而是：

> 更安心、更轻盈、更像被温柔引导。

---

# 一、整体视觉方向

## 核心关键词

* 女性向
* 柔软星际
* 治愈感
* 萌系高级感
* 情绪陪伴
* 奶油蓝粉
* 玻璃泡泡
* Clay 3D
* Cozy Sci-Fi
* Emotional UI
* Soft Motion

---

# 二、视觉风格规范

## 1. 色彩系统

### 主色

| 类型          | 色值      | 用途    |
| ----------- | ------- | ----- |
| Milky Pink  | #F8E7E7 | 主背景   |
| Baby Blue   | #DDEBFF | 辅助背景  |
| Cream White | #FFF9F5 | 卡片主体  |
| Warm Beige  | #EEDFD6 | 宇航员主体 |
| Soft Gold   | #E8D3A8 | 高亮点缀  |

---

## 2. 材质语言

整体材质：

* clay toy
* soft plastic
* milky glass
* translucent bubble
* subtle gloss

避免：

* 金属硬科技感
* 赛博朋克
* 高对比 neon
* 强纹理
* 写实工业感

---

## 3. UI 形态

统一使用：

* 圆角
* 大留白
* 低信息密度
* 小阴影
* 柔和渐变
* 卡片化布局

避免：

* 参数面板感
* 数据后台感
* 极复杂图标
* 高频元素

---

# 三、UX Motion System（核心）

# Motion Personality

Luna 的动画系统不是「炫技型」，而是：

> 像漂浮、呼吸、被轻轻推动。

所有动效都必须：

* 低攻击性
* 低运动量
* 情绪化
* 轻盈
* 有空气感

---

# Motion Keywords

统一动效关键词：

* floating
* breathing
* drifting
* soft inertia
* emotional motion
* gentle transition
* feminine motion
* cozy sci-fi motion
* slow easing
* soft delay

---

# 禁止出现的动画风格

禁止：

* TikTok 风格动画
* 游戏式 bounce
* 高频缩放
* 强弹簧感
* cyberpunk motion
* 夸张 overshoot
* 高频粒子
* 复杂 3D 飞行

避免用户产生：

* 焦虑
* 压迫
* 疲劳
* 廉价互联网感

---

# 四、动画基础规范

## 1. 动画速度

| 类型   | 时长            |
| ---- | ------------- |
| 微交互  | 0.18s - 0.3s  |
| 页面转场 | 0.35s - 0.55s |
| 漂浮循环 | 4s - 8s       |
| 呼吸循环 | 3s - 6s       |

---

## 2. Easing 规范

推荐：

```css
cubic-bezier(0.22, 1, 0.36, 1)
```

或者：

```css
ease-out
```

避免：

```css
spring-heavy
bounce
elastic
```

---

## 3. 漂浮规范

允许：

* 2px ~ 6px 漂移
* 0.5° ~ 2° 旋转
* 极轻微 scale

禁止：

* 大范围飞行
* 快速位移
* 强抖动

---

# 五、首页动效系统

## 首页目标

首页不是传统 banner。

它更像：

> Luna 正在温柔引导用户进入一段探索。

---

## 首页动画结构

### 第一阶段：星球漂浮

* 四颗核心星球缓慢漂浮
* 有不同速度差
* 保持低密度
* 不出现复杂轨道

Motion：

* 轻微上下漂浮
* 极慢 rotation
* 小范围 inertia

---

### 第二阶段：宇航员进入

Luna 从屏幕边缘缓慢漂浮进入。

避免：

* 飞入
* 跳入
* 强 easing

更像：

> 在失重环境中慢慢靠近。

---

### 第三阶段：收束进入装备舱

所有星球轻微靠近中心。

页面进入 CTA 状态。

CTA 不应突然出现。

应：

* opacity 渐显
* slight upward drift

---

# 六、Questionnaire 动效

## 核心原则

答题页不是考试。

而是：

> 被温柔引导表达偏好。

---

## 交互规范

### 选项点击

允许：

* 轻微 glow
* scale 1.02
* 柔和颜色变化

禁止：

* 强烈缩放
* 激烈 bounce
* 震动感反馈

---

## 页面切换

页面应：

* fade
* soft slide
* slight blur transition

不要：

* 卡片翻页
* 复杂滑动
* 游戏式过渡

---

# 七、Matching Page 动效

## 核心目标

等待过程不是 loading。

而是：

> Luna 正在为用户校准装备。

---

## 推荐动画

### Luna Idle Motion

* 轻微漂浮
* visor 光泽慢移动
* 呼吸感 scale
* 控制杆轻晃

---

### 星球状态

* 缓慢旋转
* 微弱 glow
* 漂浮粒子

粒子要求：

* 数量少
* 透明度低
* 低速度

---

## Loading 文案建议

避免：

* 正在加载
* AI 分析中
* 数据处理中

推荐：

* 正在校准你的探索偏好
* Luna 正在匹配更适合的装备
* 正在整理你的星球线索
* 正在寻找更安心的选择

---

# 八、结果页交互

## 目标

结果页不应该像：

* 电商列表
* 参数页
* 排行榜

而应该像：

> Luna 给出的温柔建议。

---

## 推荐卡片动效

### 卡片进入

* stagger fade
* slight upward drift
* soft opacity

不要：

* 强烈滑入
* bounce
* 大 scale

---

## 商品切换

使用：

* dissolve
* fade morph

避免：

* carousel 炫技
* 大滑动

---

# 九、Mascot 动效系统

## Luna 宇航员

Luna 的动作必须：

* 低频
* 可爱但克制
* 有陪伴感
* 不过度拟人

---

## 推荐动作

| 场景      | 动作       |
| ------- | -------- |
| 首页      | 漂浮 + 微呼吸 |
| loading | 调整控制杆    |
| 成功推荐    | 轻微开心晃动   |
| 空状态     | 小幅思考动作   |
| 引导      | 缓慢指向     |

---

# 十、移动端 UX 原则

## 1. 一屏优先

首页优先保证：

* 不滚动
* 核心信息聚焦
* CTA 清晰

---

## 2. 手指友好

按钮：

* 足够大
* 间距宽松
* 避免密集交互

---

## 3. 女性向安全感

减少：

* 强刺激
* 大量推荐
* 侵略性 CTA

强化：

* 陪伴感
* 可控感
* 安全感

---

# 十一、推荐技术实现

## 前端 Motion 技术栈

推荐：

* Framer Motion
* GSAP（仅复杂时间轴）
* CSS Transition
* Rive（IP 动效）
* Lottie（轻动画）

避免：

* 过度依赖复杂 WebGL
* 高频 shader 动画

---

# 十二、推荐 AI Design Skill Prompt

用于 Cursor / Claude Code / v0 / Lovable：

```txt
Design a soft feminine emotional mobile experience.
Motion should feel breathable, floating, gentle, and emotionally safe.
Avoid startup flashy motion and gaming-style transitions.
Use subtle floating, opacity transitions, soft inertia, and slow easing.
Visual style should feel like a cozy pastel sci-fi wellness app.
Clay-like 3D mascots, warm glass materials, low information density, soft gradients.
```

---

# 十三、设计参考网站

## UI / UX 灵感

### Mobbin

[https://mobbin.com](https://mobbin.com)

重点研究：

* Calm
* Finch
* Headspace
* Flo
* Fabulous

---

### PageFlows

[https://pageflows.com](https://pageflows.com)

用于研究：

* onboarding
* transition
* 女性向 UX flow

---

### Dribbble

[https://dribbble.com](https://dribbble.com)

推荐关键词：

* pastel 3d app
* feminine mascot
* cute astronaut ui
* cozy sci-fi
* clay 3d illustration

---

### Behance

[https://behance.net](https://behance.net)

用于：

* 完整品牌系统
* mascot UI 系统
* 女性向 app case study

---

### Pinterest

[https://pinterest.com](https://pinterest.com)

用于：

* 情绪板
* 色彩方向
* 女性向氛围

---

# 十四、动画参考资源

## LottieFiles

[https://lottiefiles.com](https://lottiefiles.com)

推荐搜索：

* soft loading
* floating mascot
* breathing animation
* emotional ui motion

---

## Rive

[https://rive.app](https://rive.app)

重点：

* mascot interaction
* interactive animation
* state machine animation

---

## Jitter

[https://jitter.video](https://jitter.video)

用于：

* onboarding animation
* motion storyboard
* UI transition demo

---

## Motion Primitives

[https://motion-primitives.com](https://motion-primitives.com)

用于：

* React motion
* floating interaction
* stagger animation

---

## Magic UI

[https://magicui.design](https://magicui.design)

适合参考：

* modern motion
* soft transition
* glass motion

注意：

需要降低 startup 炫技感。

---

# 十五、推荐竞品参考

## Finch

参考方向：

* 情绪陪伴感
* mascot 驱动 UX
* 女性向温柔体验

---

## Headspace

参考方向：

* 极简情绪动效
* breathing motion
* 治愈引导感

---

## Flo

参考方向：

* 女性向安全感
* 柔和 UI
* 情绪色彩系统

---

## Earkick

参考方向：

* 情绪反馈
* 陪伴型 AI UX

---

# 十六、最终设计原则

Luna 不应该像：

* 电商
* AI 工具
* 参数平台
* 游戏

它应该更像：

> 一个温柔陪伴用户探索的宇宙向导。

真正高级的体验不是：

“更多动画”。

而是：

> 动画轻到用户几乎意识不到。

但会感受到：

* 安心
* 柔和
* 高级
* 被照顾
* 有生命感
