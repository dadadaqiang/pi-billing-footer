#!/usr/bin/env node
/**
 * Remove model cost from ~/.pi/agent/models.json
 *
 * models.json 结构: providers.{provider}.modelOverrides.{modelId}.cost
 *
 * Usage: ./delete-model-cost.js <provider> <modelId>
 *
 * Example:
 *   ./delete-model-cost.js deepseek deepseek-chat
 *   ./delete-model-cost.js openrouter "openai/gpt-oss-120b:free"
 */

const fs = require("fs");
const path = require("path");

const configPath = path.join(require("os").homedir(), ".pi", "agent", "models.json");
const [, , provider, modelId] = process.argv;

if (!provider || !modelId) {
  console.error("Usage: delete-model-cost.js <provider> <modelId>");
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error("models.json not found at " + configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const overrides = config.providers?.[provider]?.modelOverrides;

if (!overrides || !overrides[modelId]?.cost) {
  console.log(`No cost definition found for '${provider}' / '${modelId}'.`);
  process.exit(0);
}

delete overrides[modelId].cost;

// Clean up empty modelOverrides
if (Object.keys(overrides[modelId]).length === 0) {
  delete overrides[modelId];
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log(`✅ Removed cost from '${provider}' / '${modelId}'. It will now show ¥—.`);
