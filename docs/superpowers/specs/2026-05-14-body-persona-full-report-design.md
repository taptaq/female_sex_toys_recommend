# 身体人格测试 · 完整星系人格档案设计

## 目标

将当前 `0.5 元解锁完整报告` 从“多看几段补充说明”升级为一个有明显解锁感的 `完整星系人格档案` 体验。

本次设计的核心不是单纯增加字段数量，而是提升三件事：

- `解锁感`：用户要明确感知到“打开了一个完整人格宇宙”
- `可分享感`：后续可自然承接星系人格画像、分享卡、星系徽章素材
- `可决策感`：人格结果不仅能看，还能反向帮助用户做长期选品判断

## 背景问题

当前完整报告存在三个明显问题：

1. `字段过薄`
   目前完整报告主要只有 `portrait / hiddenRouteSummary / goodFits / avoidNotes / productPicks`，不足以支撑付费升级感。

2. `展示方式偏平铺`
   当前前端结果更像“免费结果的扩展块”，而不是一个独立的完整人格档案。

3. `内容重心不清晰`
   现在同时想讲人格画像、隐藏路线和产品建议，但没有形成“先爽点、后解释、再决策”的信息节奏。

## 已确认方向

基于当前讨论，已确认以下产品决策：

- 完整解锁内容采用 `画像优先，但把选品决策也装进去`
- 免费测试与基础画像 `不要求先登录`
- 点击 `0.5 元解锁完整档案` 时 `必须先登录`
- 登录成功后继续原操作，不要求用户重复点击
- 支付成功后 `自动弹出完整人格弹窗`
- 结果页中保留 `再次查看完整档案` 的入口
- 未来会补充 `星系人格画像素材`

## 用户体验目标

用户完成身体人格测试后，应该经历下面的感受变化：

1. 免费层先建立“有点准”的信任
2. 解锁卡片明确告诉用户：付费不是“多几段文案”，而是“打开完整人格档案”
3. 付费成功后立即进入一个更强感知的完整人格弹窗
4. 用户先看到自己的人格主舞台和星系画像，再理解为什么自己是这种类型
5. 最后再把人格结论转成长期更适合的路线和产品方向

## 解锁链路

### 免费层

用户在不登录的前提下可以：

- 开始身体人格测试
- 完成 10 题
- 查看基础画像

### 付费层

点击解锁完整档案时：

1. 若未登录：
   弹出登录框
2. 登录成功：
   自动继续支付/确认解锁链路
3. 支付成功：
   自动弹出 `完整星系人格档案弹窗`
4. 结果页保留 `再次查看完整档案` 入口

### 交互原则

- 登录要求不前置到免费测试入口，避免过早拦截
- 登录要求不应“突袭”用户，因此解锁卡片上要提前说明 `登录后可解锁`
- 支付成功后的反馈必须是“自动弹出完整档案”，而不是只把页面某块静默展开

## 结果页上的解锁卡片

当前“完整报告已锁定”的表达过薄，建议升级为：

- 标题：`完整星系人格档案已锁定`
- 说明：`登录后可解锁你的主人格画像、隐藏路线、副人格倾向，以及长期更适合的体验路线与产品方向`
- 补充：`0.5 元一次解锁，可随时回看`

按钮文案建议：

- 未登录：`登录并解锁完整档案`
- 已登录：`0.5 元解锁完整档案`
- 已解锁：`再次查看完整档案`

## 完整人格弹窗信息架构

完整弹窗采用 `先爽点、后解释、再决策` 的结构。

### 1. Hero 主舞台

展示内容：

- 星系人格画像
- 人格名
- 星系副标题
- 一句人格宣言
- 主人格 / 副人格 / 隐藏路线标签
- 隐藏力 / 共居安心度小指标

设计目标：

- 让用户第一眼感知“这不是补充说明，而是一份完整人格档案”
- 后续图片素材未到位时，也需要有稳定的图片占位结构

### 2. 你为什么是这个人格

展示内容：

- 长版人格画像描述
- 为什么会形成这个人格
- 维度拆解卡片
- `3-5` 个关键词标签

设计目标：

- 把“像不像我”解释清楚
- 让人格类型有可解释性，而不是只停留在命名

### 3. 你的隐藏路线

展示内容：

- 隐藏路线短说明
- 隐藏路线长说明
- 伪装倾向
- 收纳倾向
- 隐私需求强度

设计目标：

- 把“隐藏偏好”从附属信息升级成完整副人格模块
- 给用户明显的隐秘爽点与识别感

### 4. 你长期更适合什么

展示内容：

- 最适合路线总结
- 更适合的路线
- 暂不优先的路线
- 更适合的场景
- 节奏建议
- 参数关注点

设计目标：

- 把人格结论转成可行动建议
- 明确回答“我以后更该怎么买、怎么筛”

### 5. 更贴合你的人格产品方向

展示内容：

- 更适合的品类方向
- 更贴合人格的产品清单
- 每个产品的人格匹配理由
- 看起来想买但长期不一定适合的提醒

设计目标：

- 避免完整报告只剩情绪价值
- 让人格结果反向服务选品决策

### 6. 底部操作区

建议保留：

- 关闭弹窗
- 返回结果页
- 再次查看完整档案
- 预留后续 `生成分享卡`

## 数据结构扩展

建议将 `BodyPersonaFullReport` 从当前薄结构扩展为以下模型：

```ts
type BodyPersonaDimensionScore = {
  id:
    | "safety_boundary"
    | "pace_control"
    | "atmosphere_need"
    | "response_need"
    | "privacy_need"
    | "disguise_need";
  label: string;
  score: number;
  summary: string;
};

type BodyPersonaCategoryMatch = {
  id: string;
  label: string;
  fitScore: number;
  reason: string;
};

type BodyPersonaProductPick = {
  id: string;
  name: string;
  score: number;
  personaScore: number;
  reason: string;
  categoryLabel?: string;
};

type BodyPersonaFullReport = {
  reportTitle: string;
  personaName: string;
  personaSubtitle: string;
  personaManifesto: string;
  personaImageAsset: string | null;
  primaryPersonaCode: string;
  secondaryPersonaCode: string | null;
  secondaryPersonaName: string | null;
  hiddenRouteCode: string;
  hiddenRouteName: string;
  hiddenPowerGrade: "S" | "A" | "B";
  coLivingComfortGrade: "high" | "medium" | "low";

  portraitShort: string;
  portraitLong: string;
  whyYouAreThis: string;
  strengthTags: string[];
  growthTip: string;

  dimensionBreakdown: BodyPersonaDimensionScore[];

  hiddenRouteSummaryShort: string;
  hiddenRouteSummaryLong: string;
  disguisePreference: string;
  storagePreference: string;
  privacyNeedLevel: string;

  bestRouteSummary: string;
  goodFits: string[];
  avoidNotes: string[];
  sceneMatches: string[];
  paceAdvice: string[];
  parameterFocus: string[];

  topCategoryMatches: BodyPersonaCategoryMatch[];
  pickReasonSummary: string;
  mismatchWarnings: string[];
  productPicks: BodyPersonaProductPick[];
};
```

## 前端模块拆分

为避免继续把完整体验堆进现有 `BodyPersonaResultPanel`，建议拆成以下模块：

- `BodyPersonaUnlockPanel`
- `BodyPersonaFullReportDialog`
- `BodyPersonaHeroCard`
- `BodyPersonaDimensionGrid`
- `BodyPersonaHiddenRouteCard`
- `BodyPersonaRouteAdviceCard`
- `BodyPersonaCategoryMatchesCard`
- `BodyPersonaProductMatchesCard`
- `BodyPersonaDialogActions`

职责边界：

- `BodyPersonaUnlockPanel` 只负责基础画像 + 解锁 CTA
- `BodyPersonaFullReportDialog` 只负责完整档案容器与开关
- 各内容卡片独立负责自己的子信息层，避免大组件继续膨胀

## 内容表达原则

完整档案不能只多写几段长文，而要遵守以下原则：

- `先身份，后解释，最后行动`
- `每一块都要回答一个明确问题`
- `人格不是文学包装，而是长期决策工具`
- `产品建议不能只是重复当前推荐，而要体现人格层的长期偏好差异`

## 示例文案方向

以 `隐私安全型` 为例：

- 人格宣言：`你不是退缩，你只是更需要边界清晰的靠近方式。`
- 长版画像：`你对“被打扰”和“被暴露”的敏感度比多数人更高，这不是保守，而是你的身体在优先确认安全边界。只要边界被尊重，你反而更容易稳定进入状态。`
- 路线总结：`你长期更适合低存在感、易收纳、节奏温和但可控的路线，而不是一开始就追求高存在感或明显刺激反馈。`
- 产品总结：`这类产品不是单纯“更弱”，而是更符合你先确认边界、再逐步进入的长期节奏。`

## 工程边界

本次设计要求：

- 支持 `personaImageAsset` 为空时的稳定占位
- 前端结构先行，图片素材后续补上不需要重新设计协议
- 保持免费层与付费层的数据边界清晰
- 未登录状态下不允许解锁，但允许免费测试

本次设计不要求：

- 立即接入真实支付商户
- 立即上线分享卡与海报生成
- 立即补齐全部星系人格图素材

## 风险与注意事项

### 1. 信息过载

如果完整弹窗一次塞太多卡片，会让用户从“解锁人格”变成“看报告考试”。  
因此必须优先保证 Hero 与人格解释区最强，产品建议部分只保留最关键的决策信息。

### 2. 付费价值感不足

如果完整报告只是免费层文案的同义反复，0.5 元依旧会显得不值。  
因此必须新增维度拆解、隐藏路线长说明、品类方向与人格匹配原因。

### 3. 未来素材未到位

在星系人格图片还没补齐前，前端要能优雅展示占位状态，不能因为缺图导致整个 Hero 区塌掉。

## 推荐实施顺序

1. 扩展 `BodyPersonaFullReport` 数据结构
2. 改造完整报告生成逻辑，先补齐本地确定性字段
3. 将结果页中的完整报告区改成 `BodyPersonaUnlockPanel`
4. 新增 `BodyPersonaFullReportDialog`
5. 接入登录前置解锁链路
6. 完成支付成功后的自动弹窗
7. 后续再接入星系人格图片素材与分享卡能力
