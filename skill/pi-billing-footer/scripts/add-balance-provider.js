#!/usr/bin/env node
/**
 * Add a balance provider entry to ~/.pi/agent/balance-providers.json
 *
 * Usage: ./add-balance-provider.js <name> <url> [method] [currency] [balancePath] [grantedPath] [usedPath]
 *
 * Examples:
 *   ./add-balance-provider.js openai "https://api.openai.com/dashboard/billing/credit_grants" GET USD "" total_granted total_used
 *   ./add-balance-provider.js anthropic "https://api.anthropic.com/v1/billing/credits" GET USD balance
 *   ./add-balance-provider.js openrouter "https://openrouter.ai/api/v1/credits" GET USD data.credits
 */

const fs = require("fs");
const path = require("path");

const configPath = path.join(require("os").homedir(), ".pi", "agent", "balance-providers.json");
const [, , name, url, method = "GET", currency = "USD", balancePath, grantedPath, usedPath] = process.argv;

if (!name || !url) {
  console.error("Usage: add-balance-provider.js <name> <url> [method] [currency] [balancePath] [grantedPath] [usedPath]");
  process.exit(1);
}

// Ensure directory exists
fs.mkdirSync(path.dirname(configPath), { recursive: true });

// Read or create config
let config = [];
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// Build the new entry
const entry = { name: name.toLowerCase(), url, method, currency };
if (balancePath) entry.balancePath = balancePath;
if (grantedPath && usedPath) {
  entry.grantedPath = grantedPath;
  entry.usedPath = usedPath;
}

// Check if already exists
const idx = config.findIndex((p) => p.name === entry.name);
if (idx >= 0) {
  config[idx] = entry;
  console.log(`Updated provider '${name}' in balance-providers.json`);
} else {
  config.push(entry);
  console.log(`Added provider '${name}' to balance-providers.json`);
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
