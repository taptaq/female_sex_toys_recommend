# 🧠 Agent Harness Architecture (智能体工程架构)

本文档阐述了 Inner Space 项目从“单一的大模型 API 调用”向“Agent Harness (智能体工程调度)”演进的核心架构模式与设计理念。

---

## 1. 架构总览 (Architecture Overview)

Agent Harness 架构的核心目标是：**将混乱的、不可靠的大模型生成逻辑，封装为高可用、具有明确边界的“微服务化智能体”**。

```mermaid
graph TD
    subgraph Client [前端指挥舱 UI]
        A[极简问卷收集] --> B[推荐向导引擎]
        B --> C[全息渲染层]
    end

    subgraph AgentHarness [Agent Harness 层]
        D((Recommender Agent))
        E((Cleaner Agent))
        X((Persona Agent - 建设中))
    end

    subgraph FallbackRouter [多级算力调度路由]
        F[DeepSeek 节点]
        G[Qwen 节点]
        H[Minimax 节点]
    end

    subgraph Storage [星港数据库 (PostgreSQL)]
        I[(Products)]
        J[(Recommender_Toys)]
    end

    B -->|用户标签 & 备选集| D
    D -->|故障/限流| FallbackRouter
    FallbackRouter --> F
    F -.故障降级.-> G
    G -.故障降级.-> H
    FallbackRouter -->|返回结构化推荐| D
    D --> C

    I -->|脏数据/流数据| E
    E --> FallbackRouter
    E -->|格式化为物理标签| J
```

---

## 2. 核心设计原则 (Design Principles)

### 2.1 职责单一原则 (Single Responsibility)
不要试图用一个 System Prompt 解决所有问题。
- `Cleaner Agent` 专门负责信息抽提和格式化。
- `Recommender Agent` 专门负责感性分析和意图匹配。
- 两个智能体互不干扰，即使 `Cleaner Agent` 抓取链路崩溃，`Recommender Agent` 依然可以基于老数据正常运行。

### 2.2 绝对防崩溃兜底 (Zero-Downtime Fallback)
在公网环境下，任何大模型 API 都具有脆弱性。Agent Harness 采用了三级兜底循环：
1. **Model 层级联**：尝试最优模型 -> 降级到同构模型 -> 降级到异构模型（通过自研的格式转换器抹平 API 差异）。
2. **逻辑层回退**：如果全部网络节点熔断，立刻启动预设在系统内部的本地规则引擎 (Rule-based Heuristics)，利用产品自身的 `PhysicalForm` 和 `Waterproof` 等硬指标作硬切计算，保证 100% 能给出推荐。

### 2.3 Prompt 资产化 (Prompt as Code)
所有的智能体的人格设定 (Persona) 和输出格式 (Schema Constraints) 被严格封装在代码/配置内部，避免业务逻辑中穿插大段的文本指令。

---

## 3. 目录与工作流映射 (Workflow Mapping)

未来所有的系统迭代请遵从以下文件存放及升级规范：

*   **新增一个 Agent 功能（例如：售后客服 Agent）**
    1.  前往 `docs/Agents.md` 注册该 Agent 的名称和输入输出定义。
    2.  在 `src/harness/` 目录下新建 `ServiceAgent.ts` 继承 `BaseAgent` 逻辑。
    3.  在 `src/prompts/` 目录下建立 `service.prompt.ts` 将问答知识库注入。
*   **切换底层大模型基座**
    *   直接在现存的 `AgentOrchestrator` / 或独立 Agent 代码（如 `callAiMatching` 函数）中调整 Fallback 顺序及初始化客户端即可，上层业务 `App.tsx` 完全无感。
