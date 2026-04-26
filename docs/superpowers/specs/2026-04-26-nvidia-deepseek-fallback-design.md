# NVIDIA DeepSeek Fallback Design

## Goal

Adjust the main recommendation AI chain so DeepSeek first uses NVIDIA's compatible API endpoint, and only falls back to the current self-hosted DeepSeek endpoint if the NVIDIA call fails.

This change should improve resilience without changing the overall recommendation architecture.

## User Need

The current app-level recommendation flow calls the self-hosted DeepSeek endpoint first.

The requested behavior is:

- try NVIDIA's free DeepSeek-compatible route first
- if that fails, fall back to the current DeepSeek route
- keep the rest of the fallback chain intact

## Confirmed Direction

Agreed direction:

- scope is limited to the main app recommendation chain
- do not change scraper / cleaner / translator DeepSeek calls in this round
- do not hardcode the provided NVIDIA key in the repository
- use an environment variable for NVIDIA authentication

## Scope

In scope:

- `src/App.tsx`
- top-3 rerank AI call
- backup explanation and shopping-guidance AI call
- app-level provider order and logging

Out of scope:

- scraper AI chains
- cleaner AI chains
- shared refactor of all model clients
- replacing Qwen or GLM behavior

## Chosen Approach

Recommended approach: `insert NVIDIA as the first DeepSeek provider in App`

### How it works

For each DeepSeek-backed app call:

1. Try NVIDIA compatible OpenAI API first
2. If NVIDIA fails, try the current DeepSeek endpoint
3. If DeepSeek fails, continue with existing `Qwen -> GLM -> local fallback`

### Why this approach

- smallest safe change
- preserves current chain structure
- avoids touching unrelated scraper logic
- keeps rollback simple if needed

## Provider Order

For the app recommendation chain after this change:

1. `NVIDIA DeepSeek`
   - base URL: `https://integrate.api.nvidia.com/v1`
   - model: `deepseek-ai/deepseek-v4-pro`
2. `DeepSeek`
   - base URL: `https://api.deepseek.com/v1`
   - model: `deepseek-v4-flash`
3. `Qwen`
   - model: `qwen-turbo`
4. `GLM`
   - model: `glm-4.6v`
5. local structured fallback or local guidance fallback

## Configuration

Add a new environment variable for the NVIDIA provider:

- `NVIDIA_API_KEY`

The implementation should not embed secrets in source files.

If `NVIDIA_API_KEY` is missing, the app should skip or fail that provider quickly and continue to the current DeepSeek provider.

## Request Behavior

The NVIDIA branch should stay compatible with the current JSON-response flow:

- use non-streaming completion requests
- keep current prompt structure unchanged
- preserve current JSON parsing logic

If supported by the compatible API call, `chat_template_kwargs: { thinking: false }` can be applied only to the NVIDIA request so the existing providers remain untouched.

## Logging

Logs should clearly distinguish:

- NVIDIA DeepSeek start / failure
- self-hosted DeepSeek start / failure
- Qwen fallback
- GLM fallback

This makes debugging provider availability much easier.

## Testing

Given the current repo setup, use focused verification:

- type-check after the provider insertion
- production build after the app chain changes

No new browser or network-dependent end-to-end verification is required for this design.

## Risks

Main risks:

- NVIDIA compatible API may differ slightly from the current OpenAI-compatible assumptions
- adding the new provider inline in two app call sites may introduce duplication

This design keeps the scope intentionally narrow. If the pattern proves stable, a later round can extract a shared app-level provider helper.
