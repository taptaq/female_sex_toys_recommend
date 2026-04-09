# 🤖 Inner Space - Agents Registry (智能体名录)

本文档集中定义和管理本项目中所有的 AI Agents。在将应用重构为 Agent Harness 工程后，所有新增的大模型调用节点都必须在此登记。

---

## 1. 推荐专家 Agent (Recommender Agent)

这是直面临床（前端）的核心智能体，负责通过用户的感官偏好进行装备匹配分析。

*   **节点位置**：`src/App.tsx` (未来将迁移至 `src/harness/RecommenderAgent.ts`)
*   **角色设定**：“你是一个专业的性健康装备选品专家，专注提取和分析用户的深层使用偏好。”
*   **输入 Schema**：
    *   `userPreferences`: string[] (用户标签，如：["男性向", "复合机型", "< 45dB"])
    *   `candidateProducts`: Product[] (基础软性筛选后的全息商品池候选集)
*   **输出 Schema**：
    *   JSON Array 包含:
        *   `id`: string (产品主键)
        *   `reason`: string (30字以内的专业推荐理由，透传至前端气泡)
*   **级联降级策略 (Cascade Fallback)**：
    1.  🥇 **首选 (Primary)**: DeepSeek (`deepseek-chat`)
    2.  🥈 **次选 (Secondary)**: Qwen (`qwen-turbo`)
    3.  🥉 **全息补偿 (Tertiary)**: Minimax (`MiniMax-M2.5-highspeed`)

---

## 2. 数据降维清洗 Agent (Cleaner Agent)

这是在后台星际爬虫抓取数据后，进行无序文本清洗的基建智能体。

*   **节点位置**：`src/scraper/cleaner.ts` (未来将迁移至 `src/harness/CleanerAgent.ts`)
*   **角色设定**：“你是一个专注提取硬件参数的专业机器人。”
*   **输入 Schema**：
    *   `productDescription`: string (电商渠道获取的原始长文本描述/推文)
*   **输出 Schema**：
    *   JSON Object 包含硬性降维指标：
        *   `maxDb`: number (静音阈值)
        *   `waterproof`: number (IPX 级别)
        *   `appearance`: 'high_disguise' | 'normal'
        *   `physicalForm`: 'external' | 'internal' | 'composite'
        *   `motorType`: 'gentle' | 'strong'
*   **级联降级策略 (Cascade Fallback)**：
    1.  🥇 **首选 (Primary)**: Qwen/DeepSeek (依据环境变量优先匹配)
    2.  🥈 **底层补偿 (Secondary)**: Minimax (`chatcompletion_v2`) 携带特制 `bot_setting`

---

## 3. (规划中) Persona 评论分析 Agent

*此 Agent 正在设计中，旨在通过真实用户口碑推导产品的 "适用人群（Persona）"*

*   **拟定位置**：`src/harness/PersonaAnalyzerAgent.ts`
*   **功能预期**：定时批量拉取数据库中的原始电商评论，推导出简练的“受众特质”并更新至 `persona_analysis` 字段。
