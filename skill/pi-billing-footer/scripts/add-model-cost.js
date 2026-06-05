#!/usr/bin/env node
/**
 * Add or update model cost in ~/.pi/agent/models.json
 *
 * models.json 结构: providers.{provider}.modelOverrides.{modelId}.cost
 *
 * Usage: ./add-model-cost.js <provider> <modelId> <inputPrice> <outputPrice> [cacheRead] [cacheWrite]
 *
 * Examples:
 *   ./add-model-cost.js openrouter "openai/gpt-oss-120b:free" 0 0 0 0
 *   ./add-model-cost.js deepseek deepseek-chat 0.00000027 0.0000011 0.00000007 0.00000027
 *   ./add-model-cost.js openai gpt-4o 0.0000025 0.00001 0.00000125 0.0000025
 */

const fs = require("fs");
const path = require("path");

const configPath = path.join(require("os").homedir(), ".pi", "agent", "models.json");
const [, , provider, modelId, inputPrice, outputPrice, cacheRead, cacheWrite] = process.argv;

if (!provider || !modelId || !inputPrice || !outputPrice) {
  console.error("Usage: add-model-cost.js <provider> <modelId> <inputPrice> <outputPrice> [cacheRead] [cacheWrite]");
  console.error("  e.g.: add-model-cost.js deepseek deepseek-chat 0.00000027 0.0000011");
  process.exit(1);
}

// Ensure file exists
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, JSON.stringify({ providers: {} }, null, 2) + "\n");
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
if (!config.providers) config.providers = {};
if (!config.providers[provider]) config.providers[provider] = { modelOverrides: {} };
if (!config.providers[provider].modelOverrides) config.providers[provider].modelOverrides = {};

const cost = {
  input: parseFloat(inputPrice),
  output: parseFloat(outputPrice),
  cacheRead: cacheRead ? parseFloat(cacheRead) : parseFloat(inputPrice),
  cacheWrite: cacheWrite ? parseFloat(cacheWrite) : parseFloat(inputPrice),
};

config.providers[provider].modelOverrides[modelId] = {
  ...config.providers[provider].modelOverrides[modelId],
  cost,
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log(`✅ Cost added to '${provider}' / '${modelId}':`, JSON.stringify(cost));
