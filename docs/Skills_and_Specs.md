# 🛠️ Agent Skills & Tools Registry (技能与工具集规范)

在 Agent Harness 工程体系中，**Skill（技能）** 是连接大语言模型（LLM）与外部真实世界（数据库、第三方API、本地文件）的桥梁。
本文件作为全息工程的 `Skills.md` 规范，用于注册和约束所有的 Agent Tools（函数调用/Function Calling）。

---

## 1. 核心设计规范 (Skill Design Specs)

如果需要给现有的 Agent（如 Recommender 或 Cleaner）赋予新的能力，你必须遵循以下 Spec（规范）：

- **单一职责 (Single Responsibility)**：每个 Skill 函数必须且只能做一件事。
- **强类型校验 (Strong Typing)**：所有的入参和回参必须通过 Zod 或 TypeScript Interface 严格校验，防止大模型“幻象”传入错误参数。
- **异常不外溢 (Error Isolation)**：每个 Skill 内部必须 `try-catch` 捕获异常，绝不在外部抛出致命错误，而是给大模型返回明确的报错理由（如：`"User not found in database"`），触发它的重新思考。

---

## 2. 现役 Skills 名录

### 🎯 Skill: 数据库透传查询 (`queryProductsFromDB`)

- **归属 Agent**: `Recommender Agent`
- **功能描述**: 允许大模型获取当前星港数据库中所有的（或条件过滤后的）全息装备集。
- **入参 Schema**:
  - `filters?`: Object (可选，如 `{ motorType: 'strong' }`)
- **返回类型**: `Product[] | string` (返回商品数组，或错误描述)

### 🎯 Skill: 分析报告写回 (`updatePersonaProfile`)

- **归属 Agent**: `Persona Agent (规划中)`
- **功能描述**: 允许大模型在阅读海量评价后，将分析出的"人群特征总结"结构化写入到 Postgres 数据库的 `persona_analysis` 字段中。
- **入参 Schema**:
  - `productId`: string
  - `personaInsight`: string (200字以内)
- **返回类型**: `boolean` (写入是否成功)

---

## 3. (规划中) Agent Spec 编写指南 (Testing Specs)

在引入新的 Agent 或 Skill 时，我们需要建立对应的 `.spec.ts` 文件（如 `RecommenderAgent.spec.ts`），来保障 Agent 的智力水平不会因为基座模型的切换而断崖式下跌：

1.  **兜底测试 (Fallback Test)**：
    - 屏蔽首选模型（强制模拟 Network Error），验证是否能平滑过渡到二级模型，并且输出 Schema 一致。
2.  **幻觉对抗测试 (Hallucination Test)**：
    - 输入极其离谱的用户标签（如 "我想买一架歼20"）。
    - 要求 `Recommender Agent` 能正确按照预设防御 Prompt 回复“本全息指挥舱无法提供此类军工装备”，而不是生硬地推荐玩具。
