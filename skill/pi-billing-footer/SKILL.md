---
name: pi-billing-footer
description: Register balance providers and set model costs for the pi-billing-footer extension. Use when the user wants to configure provider billing (balance API) or set model pricing so per-turn/accumulated costs appear correctly.
---

# Billing Config

Configure balance providers and model cost definitions so the **pi-billing-footer** extension can display `Balance:¥xx.xx` and per-turn `¥xx.xx` correctly.

## Overview

Two independent registries:

| What | Where | Effect |
|------|-------|--------|
| Balance provider | `~/.pi/agent/balance-providers.json` | Shows `Balance:¥xx.xx (Provider)` or `Balance:—` |
| Model cost | `~/.pi/agent/models.json` (`providers.{p}.modelOverrides.{id}.cost`) | Shows `¥xx.xx` or `¥0.00` in per-turn & total cost |

## Quickest Path: Built-in Commands

The extension registers the `/billing` command. Use it to immediately register a balance provider or model cost without reading any documentation.

| Subcommand | Example |
|------------|---------|
| `/billing provider register <name>` | `/billing provider register openrouter` |
| `/billing cost register <modelName>` | `/billing cost register gpt-oss-120b:free` |
| `/billing list` | list all registered providers and costs |
| `/billing help` | show full command reference |

Built-in templates (auto-complete):

- **Balance providers**: deepseek, openai, anthropic, openrouter
- **Model pricing**: ~30 common models across OpenAI, Anthropic, DeepSeek, Gemini, Mistral, Grok (see `references/pricing.md`)

If the user asks for a provider or model **not** in the built-in lists, follow the manual workflows below.

## Workflow: Register a Balance Provider

User says something like "register openai's balance" or "add balance provider for anthropic".

### Step 1 — Check built-in templates

Read `references/provider-templates.md`. If the provider is listed, you can:

**Option A (recommended)**: Tell the user to run the command if they're in Pi:
```
/billing provider register openai
```

**Option B (via script)**: Run the helper script:
```bash
cd skill/pi-billing-footer
./scripts/add-balance-provider.js openai \
  "https://api.openai.com/dashboard/billing/credit_grants" \
  GET USD "" total_granted total_used
```

### Step 2 — Research if not found

If not in templates, use `curl` to find the provider's balance API:

```bash
# Example: search for openrouter balance api
curl -s "https://openrouter.ai/api/v1/credits" \
  -H "Authorization: Bearer <test-key>" \
  -H "Content-Type: application/json"
```

Analyze the response JSON to determine:
- `balancePath` — dot-path to the numeric balance value
- or `grantedPath` / `usedPath` for grant-minus-used patterns
- `currency` — USD or CNY
- HTTP method (GET / POST)

### Step 3 — Write the config

Read existing `~/.pi/agent/balance-providers.json` (create if missing) and add the entry:

```bash
cat ~/.pi/agent/balance-providers.json
```

Expected structure:
```json
[
  {
    "name": "openai",
    "url": "https://api.openai.com/dashboard/billing/credit_grants",
    "method": "GET",
    "currency": "USD",
    "grantedPath": "total_granted",
    "usedPath": "total_used"
  }
]
```

Supported fields:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | **yes** | — | Lowercase, matches model's `provider` field |
| `url` | **yes** | — | Balance API endpoint |
| `method` | no | `"GET"` | HTTP method |
| `currency` | no | `"USD"` | Currency (`"USD"` 或 `"CNY"`) |
| `balancePath` | no | `"balance"` | Dot-path to balance value (e.g. `"data.credits"`) |
| `grantedPath` | no | — | For OpenAI-style: grant amount path |
| `usedPath` | no | — | For OpenAI-style: used amount path |

> If both `grantedPath` and `usedPath` are set, balance = grant - used.
> If only `balancePath` is set, balance = value at that path.
> **汇率转换：** 无论返回 `"USD"` 还是 `"CNY"`，footer 统一以 **¥** 显示。USD 余额会自动乘以汇率（`/billing rate <N>` 设置，默认 7.2）后再显示。

### Step 4 — Check API key

Verify that `~/.pi/agent/auth.json` has a key for this provider:

```json
{
  "openai": { "type": "api_key", "key": "sk-..." }
}
```

If missing, tell the user: "已写入 balance-providers.json，但 `auth.json` 中没有 `{provider}` 的 API key，请补充。"

## Workflow: Set Model Cost

User says something like "set cost for gpt-4o" or "add pricing for claude".

### Step 1 — Check built-in pricing

Read `references/pricing.md`. If the model is listed, you can:

**Option A (recommended)**: Tell the user to run the command:
```
/billing cost register gpt-4o
```

**Option B (via script)**: Run the helper script:
```bash
cd skill/pi-billing-footer
./scripts/add-model-cost.js openai gpt-4o 0.0000025 0.00001 0.00000125 0.0000025
```

### Step 2 — Research if not found

If not in pricing table, try to find the model's official pricing:

- For OpenAI: `https://openai.com/api/pricing/`
- For Anthropic: `https://docs.anthropic.com/en/docs/about-claude/models`
- For OpenRouter: `curl -s https://openrouter.ai/api/v1/models | jq '.data[] | select(.id | contains("model-name")) | .pricing'`
- Generic: search the web or curl the provider's models endpoint

Extract the per-token prices in USD:

| Cost field | Meaning |
|------------|---------|
| `input` | Price per input token |
| `output` | Price per output token |
| `cacheRead` | Price per cache-read token (usually half of input) |
| `cacheWrite` | Price per cache-write token (usually equal to input) |

### Step 3 — Write the cost

If you know the provider name and the model's exact ID in Pi, use the script:

```bash
cd skill/pi-billing-footer
./scripts/add-model-cost.js <provider> <modelId> <input> <output> [cacheRead] [cacheWrite]
```

Or write directly with `jq`:

```bash
# Add cost for openrouter's openai/gpt-oss-120b:free (free model)
jq '.providers.openrouter.modelOverrides["openai/gpt-oss-120b:free"].cost = {"input":0,"output":0,"cacheRead":0,"cacheWrite":0}' \
  ~/.pi/agent/models.json > /tmp/models.json && mv /tmp/models.json ~/.pi/agent/models.json
```

### Step 4 — Determine the correct modelId

The modelId in `models.json` **must match** `ctx.model?.id` in Pi (the model's full ID shown in the footer).

For OpenRouter models, the ID usually includes the original provider prefix:
```
openai/gpt-oss-120b:free        # OpenRouter → modelId = "openai/gpt-oss-120b:free"
google/gemini-2.0-flash         # OpenRouter → modelId = "google/gemini-2.0-flash"
```

For direct providers (DeepSeek, OpenAI, etc.), the modelId is the short name:
```
deepseek-chat                    # DeepSeek  → modelId = "deepseek-chat"
gpt-4o                           # OpenAI    → modelId = "gpt-4o"
```

If unsure, ask the user to check the Pi footer or run:
```
/billing list
```

### Step 5 — Verify

Tell the user what was added and that it will take effect after restarting Pi (or switching models).

## Workflow: Delete Model Cost

User says "remove cost for gpt-4o" or "delete model pricing".

**Option A (recommended)**: Tell the user to run:
```
/billing cost remove gpt-4o
```

**Option B (via script)**:
```bash
cd skill/pi-billing-footer
./scripts/delete-model-cost.js openrouter "openai/gpt-oss-120b:free"
```

**Option C (manual jq)**:
```bash
jq 'del(.providers.openai.modelOverrides["gpt-4o"].cost)' \
  ~/.pi/agent/models.json > /tmp/models.json && mv /tmp/models.json ~/.pi/agent/models.json
```

Tell the user: "已移除 `{model}` 的 cost 定义，切换到此模型后会显示 `¥—`。"

## Helper Scripts

The skill includes convenience scripts under `scripts/`:

```bash
# Balance provider (uses ~/.pi/agent/balance-providers.json)
./scripts/add-balance-provider.js <name> <url> [method] [currency] [balancePath] [grantedPath] [usedPath]

# Model cost (uses ~/.pi/agent/models.json, providers.{p}.modelOverrides.{id}.cost)
./scripts/add-model-cost.js <provider> <modelId> <inputPrice> <outputPrice> [cacheRead] [cacheWrite]
./scripts/delete-model-cost.js <provider> <modelId>
```

Run from the skill directory. Use these as an alternative to manual JSON editing.

## models.json Structure Reference

The current structure of `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "openai/gpt-oss-120b:free": {
          "name": "GPT-OSS 120B (Free)",
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      }
    },
    "deepseek": {
      "modelOverrides": {
        "deepseek-v4-flash": {
          "name": "DeepSeek V4 Flash",
          "cost": { "input": 1, "output": 2, "cacheRead": 0.02, "cacheWrite": 0 }
        }
      }
    }
  }
}
```

Each `cost` block supports four numeric fields: `input`, `output`, `cacheRead`, `cacheWrite`.

## Note

- Changes to `balance-providers.json` and `models.json` require a Pi restart to take effect (or a model switch triggers re-read).
- The `pi-billing-footer.ts` extension reads `balance-providers.json` on startup and registers providers automatically.
- If a model has no `cost` field, or its provider has no balance provider registered, the footer gracef ally shows `¥—` and `Balance:—`.
- If a model has `cost` set to all zeros (free model), the footer shows `¥0.00`.
