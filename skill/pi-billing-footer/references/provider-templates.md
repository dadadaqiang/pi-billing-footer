# Provider Templates — Balance API

Templates for registering balance providers. Each entry includes the API endpoint and how to extract the balance from the response.

## openai

```
URL:       https://api.openai.com/dashboard/billing/credit_grants
Method:    GET
Currency:  USD
Extract:   grantedPath = "total_granted", usedPath = "total_used"
           balance = total_granted - total_used
```

Example response (simplified):
```json
{
  "object": "credit_grants",
  "total_granted": 50.00,
  "total_used": 12.34,
  "total_available": 37.66
}
```

## anthropic

```
URL:         https://api.anthropic.com/v1/billing/credits
Method:      GET
Currency:    USD
Extract:     balancePath = "balance"
```

Example response:
```json
{
  "balance": 25.00
}
```

## openrouter

```
URL:         https://openrouter.ai/api/v1/credits
Method:      GET
Currency:    USD
Extract:     balancePath = "data.credits"
```

Example response:
```json
{
  "data": {
    "credits": 15.50
  }
}
```

## deepseek (already built-in, listed for reference)

```
URL:         https://api.deepseek.com/user/balance
Method:      POST
Currency:    CNY
Extract:     balancePath = "balance_infos.0.total_balance"
```

Example response:
```json
{
  "balance_infos": [
    {
      "currency": "CNY",
      "total_balance": "8.50"
    }
  ],
  "is_available": true
}
```

## generic template (for unknown providers)

When a provider isn't in this list, try:
1. Check their API documentation for `/billing`, `/credits`, `/balance` endpoints
2. Try common patterns: GET with `Authorization: Bearer <key>`
3. Look for response fields named `balance`, `credits`, `available`, `total_balance`
