# Model Pricing Reference

Per-token prices in **USD**. All values are per token (not per 1k tokens).

## OpenAI

| Model | input | output | cacheRead | cacheWrite |
|-------|-------|--------|-----------|------------|
| gpt-4o | 0.0000025 | 0.00001 | 0.00000125 | 0.0000025 |
| gpt-4o-mini | 0.00000015 | 0.0000006 | 0.000000075 | 0.00000015 |
| gpt-4o-audio-preview | 0.0000025 | 0.00001 | 0.00000125 | 0.0000025 |
| o1 | 0.000015 | 0.00006 | 0.0000075 | 0.000015 |
| o1-mini | 0.000003 | 0.000012 | 0.0000015 | 0.000003 |
| o3-mini | 0.0000011 | 0.0000044 | 0.00000055 | 0.0000011 |
| gpt-4-turbo | 0.00001 | 0.00003 | 0.000005 | 0.00001 |
| gpt-3.5-turbo | 0.0000005 | 0.0000015 | 0.00000025 | 0.0000005 |

> Cache: prompt caching at half input price for reads, full input price for writes.

## Anthropic

| Model | input | output | cacheRead | cacheWrite |
|-------|-------|--------|-----------|------------|
| claude-sonnet-4-20250514 | 0.000003 | 0.000015 | 0.0000003 | 0.000003 |
| claude-3-5-sonnet-latest | 0.000003 | 0.000015 | 0.0000003 | 0.000003 |
| claude-3-5-haiku-latest | 0.0000008 | 0.000004 | 0.00000008 | 0.0000008 |
| claude-opus-4-20250514 | 0.000015 | 0.000075 | 0.0000015 | 0.000015 |
| claude-3-opus-latest | 0.000015 | 0.000075 | 0.0000015 | 0.000015 |
| claude-3-haiku-20240307 | 0.00000025 | 0.00000125 | 0.000000025 | 0.00000025 |

> Cache: cacheRead = 10% of input price, cacheWrite = input price.

## DeepSeek

| Model | input | output | cacheRead | cacheWrite |
|-------|-------|--------|-----------|------------|
| deepseek-chat | 0.00000027 | 0.0000011 | 0.00000007 | 0.00000027 |
| deepseek-reasoner | 0.00000055 | 0.00000219 | 0.00000014 | 0.00000055 |

> Cache: cacheRead = $0.07/1M tokens (≈26% of input), cacheWrite equals input price.

## Google (Gemini)

| Model | input | output | cacheRead | cacheWrite |
|-------|-------|--------|-----------|------------|
| gemini-2.5-pro-preview-03-25 | 0.00000125 | 0.00001 | 0.0000000625 | 0.00000125 |
| gemini-2.0-flash | 0.0000001 | 0.0000004 | 0.000000005 | 0.0000001 |
| gemini-2.0-flash-lite | 0.000000075 | 0.0000003 | 0.00000000375 | 0.000000075 |

> Cache: cacheRead = 5% of input price for up to 1M tokens, cacheWrite = input price.

## Mistral

| Model | input | output | cacheRead | cacheWrite |
|-------|-------|--------|-----------|------------|
| mistral-large-latest | 0.000002 | 0.000006 | 0.000001 | 0.000002 |
| mistral-small-latest | 0.000001 | 0.000003 | 0.0000005 | 0.000001 |
| codestral-latest | 0.000001 | 0.000003 | 0.0000005 | 0.000001 |

> Cache: cacheRead = 50% of input price, cacheWrite = input price.

## Grok (xAI)

| Model | input | output | cacheRead | cacheWrite |
|-------|-------|--------|-----------|------------|
| grok-2 | 0.000002 | 0.00001 | 0.000001 | 0.000002 |
| grok-2-vision | 0.000002 | 0.00001 | 0.000001 | 0.000002 |

> Cache: cacheRead = 50% of input price, cacheWrite = input price.

## Note

Prices are per-token (divide standard per-1K prices by 1000, or per-1M prices by 1,000,000).
Prices may change over time; for unknown models, always try the provider's official pricing page or API.
