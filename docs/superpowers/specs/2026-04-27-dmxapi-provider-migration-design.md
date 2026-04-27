# DMXAPI Provider Migration Design

## Goal
Replace the current NVIDIA-backed app recommendation providers with DMXAPI-backed providers, while keeping the existing local server proxy shape and the current self-hosted DeepSeek / Qwen / GLM fallback chain intact.

## Scope
- Update the app-level provider order helper used by the local AI proxy.
- Replace NVIDIA-specific provider identifiers, labels, key lookup, base URL, and model names with DMXAPI equivalents.
- Keep the frontend request path unchanged: the browser should still call the local `/api/ai/*` endpoints only.
- Keep the direct self-hosted fallback providers after all DMXAPI-backed providers fail.

## Non-Goals
- No change to the recommendation prompt structure.
- No change to the browser/server proxy boundary.
- No change to the final self-hosted provider behavior.
- No migration of unrelated historical design docs in this round.

## Provider Strategy

### New Environment Variable
- Replace `NVIDIA_API_KEY` with `DMXAPI_API_KEY`.

If `DMXAPI_API_KEY` is missing, the DMXAPI-backed providers should fail fast and the chain should continue to the existing self-hosted providers.

### New Provider Identities
Replace the current NVIDIA-prefixed provider ids with DMXAPI-prefixed ids:

1. `dmxapi-mimo`
2. `dmxapi-qwen`
3. `dmxapi-glm`
4. `dmxapi-kimi`
5. `deepseek`
6. `qwen`
7. `glm`

### Provider Order
The app recommendation chain should become:

`DMXAPI Mimo -> DMXAPI Qwen -> DMXAPI GLM -> DMXAPI Kimi -> DeepSeek -> Qwen -> GLM`

This preserves the current “third-party priority, self-hosted fallback” behavior while switching service vendors.

## Model Mapping

All DMXAPI-backed providers use:
- base URL: `https://www.dmxapi.cn/v1`
- auth key: `DMXAPI_API_KEY`

Model mapping:
- `dmxapi-mimo` -> `mimo-v2.5-free`
- `dmxapi-qwen` -> `qwen3.5-plus-free`
- `dmxapi-glm` -> `glm-5.1-free`
- `dmxapi-kimi` -> `kimi-k2.6-free`

The former NVIDIA DeepSeek slot should be replaced by `dmxapi-mimo`, per the user requirement.

## Response Handling
- Keep using the current OpenAI-compatible `chat.completions.create(...)` flow.
- Keep reading the main text response from `response.choices[0].message.content`.
- Keep the existing JSON-cleanup and parse flow, because the recommendation chain still expects structured JSON-like content from the model output.

The provided DMXAPI example indicates that the response remains compatible with the current server-side parsing approach.

## Code Changes

### `src/lib/app-ai-chain.ts`
- Replace the NVIDIA-first provider order constant with the new DMXAPI-first order.
- Update the exported `AppAiProvider` union through the new literal list.
- Ensure the primary provider becomes `dmxapi-mimo`.

### `src/server/index.ts`
- Replace NVIDIA provider labels with DMXAPI labels.
- Replace the environment variable lookup from `NVIDIA_API_KEY` to `DMXAPI_API_KEY`.
- Replace the OpenAI-compatible base URL from NVIDIA to DMXAPI for the third-party provider group.
- Replace the third-party model names with the DMXAPI model names provided by the user.
- Update logs so failures and attempts clearly mention `DMXAPI ...` instead of `NVIDIA ...`.

### Tests
- Update provider-order tests to assert the DMXAPI-first order.
- Update proxy-ladder tests to use the renamed provider ids.
- Preserve the fallback behavior assertions: when earlier DMXAPI providers fail, the next provider should still run in order.

## Risks
- DMXAPI model behavior may differ from the previous NVIDIA-hosted models even with OpenAI-compatible transport.
- Some existing logs, docs, or plans may still mention NVIDIA after this change; code correctness takes priority in this round.
- If DMXAPI returns more reasoning-heavy output for some models, the existing JSON-normalization path may still need future hardening, but this migration should not widen scope unless we see a concrete failure.

## Acceptance Criteria
- The local AI proxy no longer depends on any NVIDIA API configuration for app recommendation calls.
- The third-party provider order is DMXAPI-first, with `dmxapi-mimo` in the first slot.
- The environment variable used by the server is `DMXAPI_API_KEY`.
- Both `/api/ai/rerank` and `/api/ai/result-enhancement` still use the same provider ladder machinery.
- Existing self-hosted fallbacks remain available after all DMXAPI-backed providers fail.
