<p align="center">
  <h1 align="center">pi-billing-footer</h1>
  <p align="center">
    A generic, provider‑independent billing footer for the Pi terminal.
    <br/>
    Shows token costs in <strong>¥ (RMB)</strong> and live balance from any provider.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License MIT"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>
</p>

---

## Features

- **¥ Cost Display** — Converts USD token costs to RMB via configurable exchange rate
- **Live Balance** — Shows `Balance:¥xx.xx (Provider)` from any provider with a balance API
- **Provider‑Agnostic** — Register new balance providers via command or JSON — no code changes
- **Per‑Model Cost** — Configure per‑token pricing for any model (including free models like `¥0.00`)
- **Single Command** — All operations via `/billing`:
  ```bash
  /billing                     # toggle footer on/off
  /billing rate 7.2            # set exchange rate
  /billing list                # list providers & costs
  /billing balance             # refresh balance
  /billing provider register   # register balance provider
  /billing cost register       # register model cost
  ```
- **Built‑in Templates** — DeepSeek, OpenAI, Anthropic, OpenRouter balance APIs + pricing for ~30 models
- **AI‑Assisted Setup** — The accompanying `pi-billing-footer` skill lets the AI configure providers and costs via conversation

---

## Installation

### One‑liner

```bash
curl -sSfL https://raw.githubusercontent.com/dadadaqiang/pi-billing-footer/main/install.sh | sh
```

### Manual

```bash
# Copy extension
cp extension/pi-billing-footer.ts ~/.pi/agent/extensions/pi-billing-footer.ts

# Copy skill
cp -r skill/pi-billing-footer ~/.pi/agent/skills/pi-billing-footer
chmod +x ~/.pi/agent/skills/pi-billing-footer/scripts/*.js


### Requirements

- **Pi** (>= 0.78.0) — the terminal AI coding agent
- **Node.js** (>= 18, for `fetch`) — bundled with Pi

---

## Quick Start

After installation, restart Pi, then:

```bash
# 1. Register a balance provider
/billing provider register openrouter

# 2. Register a model's cost (auto-fills from built-in pricing)
/billing cost register gpt-oss-120b:free

# 3. Verify
/billing list

# 4. (Optional) Set custom exchange rate
/billing rate 7.5

# 5. Toggle billing footer
/billing
```

**You should see** something like this in the footer:

```
↑1.2k ↓3.4k R456 T1.2k H72.3% ¥0.05 | ctx:123/8192 (1.5%) h75.0% ¥0.00  (openrouter) openai/gpt-oss-120b:free
Balance:¥0.00 (Openrouter)
```

---

## Commands

### `/billing` — unified control

| Subcommand | Description |
|------------|-------------|
| *(no args)* | Toggle billing footer on/off |
| `rate <N>` | Set USD→CNY exchange rate (default: `7.2`) |
| `list` | List all registered balance providers and cost definitions |
| `balance` | Manually refresh the current provider's balance |
| `help` | Show detailed help with all subcommands |
| `provider register <name>` | Register a balance provider from built-in templates (`deepseek`, `openai`, `anthropic`, `openrouter`) |
| `provider remove <name>` | Remove a balance provider |
| `cost register <modelName>` | Register model cost from built-in pricing table |
| `cost remove <modelName>` | Remove a model's cost definition |

### Legacy compatibility

Old commands `rmbfooter`, `balance`, `balance-provider`, `cost-provider` have been removed in favor of the unified `/billing` command.

---

## Configuration Reference

### Balance Providers (`~/.pi/agent/balance-providers.json`)

```json
[
  {
    "name": "openrouter",
    "url": "https://openrouter.ai/api/v1/credits",
    "method": "GET",
    "currency": "USD",
    "balancePath": "data.credits"
  }
]
```

All fields:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | **yes** | — | Lowercase, must match the provider name in Pi |
| `url` | **yes** | — | Balance API endpoint |
| `method` | no | `"GET"` | HTTP method (`GET` / `POST`) |
| `currency` | no | `"USD"` | `"USD"` or `"CNY"` |
| `balancePath` | no | `"balance"` | Dot‑path to the numeric balance in the JSON response |
| `grantedPath` | no | — | For OpenAI‑style: path to total granted |
| `usedPath` | no | — | For OpenAI‑style: path to total used |

> If `grantedPath` + `usedPath` are set: `balance = grant - used`.
> Otherwise `balance = value at balancePath`.

### Model Costs (`~/.pi/agent/models.json`)

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "openai/gpt-oss-120b:free": {
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      }
    },
    "deepseek": {
      "modelOverrides": {
        "deepseek-chat": {
          "cost": { "input": 0.00000027, "output": 0.0000011, "cacheRead": 0.00000007, "cacheWrite": 0.00000027 }
        }
      }
    }
  }
}
```

> ⚠️ The `modelId` key in `modelOverrides` **must match** `ctx.model?.id` in Pi.
> - OpenAI models: `gpt-4o`
> - DeepSeek models: `deepseek-chat`
> - OpenRouter models: `openai/gpt-oss-120b:free` (includes the original provider prefix)

---

## Built‑in Templates

### Balance Providers

| Name | URL | Method | Currency |
|------|-----|--------|----------|
| `deepseek` | `https://api.deepseek.com/user/balance` | POST | CNY |
| `openai` | `https://api.openai.com/dashboard/billing/credit_grants` | GET | USD |
| `anthropic` | `https://api.anthropic.com/v1/billing/credits` | GET | USD |
| `openrouter` | `https://openrouter.ai/api/v1/credits` | GET | USD |

### Model Pricing

~30 models from **OpenAI**, **Anthropic**, **DeepSeek**, **Gemini**, **Mistral**, **Grok**.
See [skill/pi-billing-footer/references/pricing.md](skill/pi-billing-footer/references/pricing.md) for the full table.

---

## API Key Setup

Create or edit `~/.pi/agent/auth.json`:

```json
{
  "openrouter": { "type": "api_key", "key": "sk-or-..." },
  "deepseek":   { "type": "api_key", "key": "sk-..." },
  "openai":     { "type": "api_key", "key": "sk-..." }
}
```

The key name (e.g. `"openrouter"`) is matched case‑insensitively against the provider name.

---

## AI‑Assisted Configuration (Skill)

When the AI can't resolve a request via built‑in commands, it uses the **`pi-billing-footer`** skill:

- "帮我注册 openai 的 balance"
- "给 gpt-4o 配上 cost"
- "帮我查一下 deepseek 的余额 API"

The skill reads reference docs, uses `curl` to research unknown APIs, and writes the config files directly. See [`skill/pi-billing-footer/SKILL.md`](skill/pi-billing-footer/SKILL.md) for the full workflow.

---

## Development

```bash
git clone https://github.com/<YOUR_GITHUB_USER>/pi-billing-footer.git
cd pi-billing-footer

# Edit extension
extension/pi-billing-footer.ts

# Sync to Pi
cp extension/pi-billing-footer.ts ~/.pi/agent/extensions/pi-billing-footer.ts

# Restart Pi to test changes
```

---

## Contributing

PRs are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/...`)
3. Commit your changes
4. Open a PR against `main`

---

## License

[MIT](LICENSE) © 2025 pi-billing-footer
