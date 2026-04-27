# 推荐接口返回模型元信息设计

## 目标
让推荐匹配相关接口在返回业务结果的同时，额外返回本次实际命中的模型名称和 provider 标识，便于开发和排查时确认当前走的是 DMXAPI 模型还是自有官方模型。

## 范围
- `POST /api/ai/rerank`
- `POST /api/ai/result-enhancement`
- 前端对应的本地代理调用解析逻辑

本次不改动推荐算法、不改动模型调用顺序、不改动正式页面默认展示。

## 用户需求解读
- 模型名称主要供开发者自己查看，用于判断当前实际命中的模型来源。
- 现阶段不建议默认展示给普通用户，避免干扰结果页信息层级。
- 接口层先把信息带出来，前端保留读取能力，后续如需做调试展示再单独加开关。

## 返回结构设计

### 当前问题
目前两个接口直接返回业务结果本体：
- `rerank` 直接返回数组
- `result-enhancement` 直接返回对象

这导致前端无法同时拿到“业务数据”和“实际命中的模型信息”。

### 新结构
两个接口统一包成对象返回：

#### `/api/ai/rerank`
```json
{
  "data": [
    { "id": "产品ID", "reason": "推荐理由" }
  ],
  "modelName": "mimo-v2.5-free",
  "provider": "dmxapi-mimo"
}
```

#### `/api/ai/result-enhancement`
```json
{
  "data": {
    "backupProducts": [],
    "shoppingGuidance": []
  },
  "modelName": "qwen3.5-plus-free",
  "provider": "dmxapi-qwen"
}
```

## 服务端设计
- 服务端 AI provider 执行链除了返回解析后的业务结果，还应返回：
  - `modelName`
  - `provider`
- `provider` 使用当前链路内部 provider id，例如：
  - `dmxapi-mimo`
  - `dmxapi-qwen`
  - `deepseek`
  - `qwen`
- `modelName` 使用实际请求时传给模型服务的模型名，例如：
  - `mimo-v2.5-free`
  - `qwen3.5-plus-free`
  - `deepseek-v4-flash`

## 前端设计
- 前端本地代理请求工具不再假设接口直接返回业务结果本体。
- 它应解析统一包裹结构，并向上层返回：
  - `data`
  - `modelName`
  - `provider`
- 当前结果计算逻辑继续消费 `data` 字段，不改变业务流程。
- `modelName` 和 `provider` 先不接入正式 UI。
- 可在开发态控制台输出简短日志，帮助确认当前模型命中情况。

## 交互策略
- 正式页面默认不展示模型名。
- 如未来需要展示，建议仅限：
  - 开发环境
  - 隐藏调试开关
  - 管理/诊断视图

## 风险与约束
- 需要同时调整服务端和前端的接口契约，否则会造成解析不兼容。
- 这次不扩展到数据库持久化或埋点记录，保持改动范围可控。
- 不为此引入新的可视化 UI 区块，避免把调试信息暴露给普通用户。

## 验收标准
- 两个推荐接口都返回 `data + modelName + provider`。
- 前端仍能正常拿到推荐结果，不影响当前推荐流程。
- 默认页面不展示模型名称。
- 开发者可以通过接口返回值或控制台确认本次命中的模型与 provider。
