/**
 * Pi Billing Footer - 将底部显示的 token 费用从美元转换为人民币
 *
 * 完全保留默认 footer 的所有信息，仅将 $ 费用改为 ¥ 显示。
 *
 * 自动生效。支持命令：
 *   /billing             - 切换 billing footer / 默认 footer
 *   /billing rate <N>    - 设置汇率 (默认 7.2)
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── 余额查询注册表 ──────────────────────────────────────────────────────────

interface BalanceResult {
  currency: string;
  balance: number;
  error?: string;
}

interface BalanceProvider {
  name: string;
  fetchBalance(apiKey: string): Promise<BalanceResult>;
}

const balanceRegistry = new Map<string, BalanceProvider>();

function _registerBalanceProvider(provider: BalanceProvider): void {
  balanceRegistry.set(provider.name.toLowerCase(), provider);
}

function getBalanceProvider(name: string): BalanceProvider | undefined {
  return balanceRegistry.get(name.toLowerCase());
}

function listBalanceProviders(): string[] {
  return Array.from(balanceRegistry.keys());
}

// ── 内置 provider 模板（供 register 命令自动补齐参数） ──────────────

interface BuiltinTemplate {
  url: string;
  method: "GET" | "POST";
  currency: "USD" | "CNY";
  balancePath?: string;
  grantedPath?: string;
  usedPath?: string;
}

const builtinTemplates: Record<string, BuiltinTemplate> = {
  deepseek: {
    url: "https://api.deepseek.com/user/balance",
    method: "POST",
    currency: "CNY",
    balancePath: "balance_infos.0.total_balance",
  },
  openai: {
    url: "https://api.openai.com/dashboard/billing/credit_grants",
    method: "GET",
    currency: "USD",
    grantedPath: "total_granted",
    usedPath: "total_used",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/billing/credits",
    method: "GET",
    currency: "USD",
    balancePath: "balance",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/credits",
    method: "GET",
    currency: "USD",
    balancePath: "data.credits",
  },
};

function persistBalanceProvider(config: ConfigBalanceProvider): void {
  const configPath = join(homedir(), ".pi", "agent", "balance-providers.json");
  let list: ConfigBalanceProvider[] = [];
  if (existsSync(configPath)) {
    list = JSON.parse(readFileSync(configPath, "utf-8"));
  }
  const idx = list.findIndex((p) => p.name === config.name);
  if (idx >= 0) {
    list[idx] = config;
  } else {
    list.push(config);
  }
  writeFileSync(configPath, JSON.stringify(list, null, 2) + "\n");
  // 同步注册到内存
  _registerBalanceProvider({
    name: config.name,
    fetchBalance: createFetchBalance(config),
  });
}

// ── 内置模型定价表 ─────────────────────────────────────────────────────
// 数据来源: skill/pi-billing-footer/references/pricing.md

interface BuiltinPricing {
  provider: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** 如果模型在 Pi 中的完整 ID 不同于查找 key，则指定（例如 openai/gpt-oss-120b:free） */
  modelId?: string;
}

const builtinPricing: Record<string, BuiltinPricing> = {
  // OpenAI
  "gpt-4o":              { provider: "openai", input: 0.0000025, output: 0.00001, cacheRead: 0.00000125, cacheWrite: 0.0000025 },
  // OpenRouter (free)
  "gpt-oss-120b:free":   { provider: "openrouter", input: 0, output: 0, cacheRead: 0, cacheWrite: 0, modelId: "openai/gpt-oss-120b:free" },
  "gpt-4o-mini":         { provider: "openai", input: 0.00000015, output: 0.0000006, cacheRead: 0.000000075, cacheWrite: 0.00000015 },
  "gpt-4o-audio-preview": { provider: "openai", input: 0.0000025, output: 0.00001, cacheRead: 0.00000125, cacheWrite: 0.0000025 },
  "o1":                  { provider: "openai", input: 0.000015, output: 0.00006, cacheRead: 0.0000075, cacheWrite: 0.000015 },
  "o1-mini":             { provider: "openai", input: 0.000003, output: 0.000012, cacheRead: 0.0000015, cacheWrite: 0.000003 },
  "o3-mini":             { provider: "openai", input: 0.0000011, output: 0.0000044, cacheRead: 0.00000055, cacheWrite: 0.0000011 },
  "gpt-4-turbo":         { provider: "openai", input: 0.00001, output: 0.00003, cacheRead: 0.000005, cacheWrite: 0.00001 },
  "gpt-3.5-turbo":       { provider: "openai", input: 0.0000005, output: 0.0000015, cacheRead: 0.00000025, cacheWrite: 0.0000005 },
  // Anthropic
  "claude-sonnet-4-20250514":  { provider: "anthropic", input: 0.000003, output: 0.000015, cacheRead: 0.0000003, cacheWrite: 0.000003 },
  "claude-3-5-sonnet-latest":  { provider: "anthropic", input: 0.000003, output: 0.000015, cacheRead: 0.0000003, cacheWrite: 0.000003 },
  "claude-3-5-haiku-latest":   { provider: "anthropic", input: 0.0000008, output: 0.000004, cacheRead: 0.00000008, cacheWrite: 0.0000008 },
  "claude-opus-4-20250514":    { provider: "anthropic", input: 0.000015, output: 0.000075, cacheRead: 0.0000015, cacheWrite: 0.000015 },
  "claude-3-opus-latest":      { provider: "anthropic", input: 0.000015, output: 0.000075, cacheRead: 0.0000015, cacheWrite: 0.000015 },
  "claude-3-haiku-20240307":   { provider: "anthropic", input: 0.00000025, output: 0.00000125, cacheRead: 0.000000025, cacheWrite: 0.00000025 },
  // DeepSeek
  "deepseek-chat":       { provider: "deepseek", input: 0.00000027, output: 0.0000011, cacheRead: 0.00000007, cacheWrite: 0.00000027 },
  "deepseek-reasoner":   { provider: "deepseek", input: 0.00000055, output: 0.00000219, cacheRead: 0.00000014, cacheWrite: 0.00000055 },
  // Gemini
  "gemini-2.5-pro-preview-03-25": { provider: "gemini", input: 0.00000125, output: 0.00001, cacheRead: 0.0000000625, cacheWrite: 0.00000125 },
  "gemini-2.0-flash":    { provider: "gemini", input: 0.0000001, output: 0.0000004, cacheRead: 0.000000005, cacheWrite: 0.0000001 },
  "gemini-2.0-flash-lite": { provider: "gemini", input: 0.000000075, output: 0.0000003, cacheRead: 0.00000000375, cacheWrite: 0.000000075 },
  // Mistral
  "mistral-large-latest": { provider: "mistral", input: 0.000002, output: 0.000006, cacheRead: 0.000001, cacheWrite: 0.000002 },
  "mistral-small-latest": { provider: "mistral", input: 0.000001, output: 0.000003, cacheRead: 0.0000005, cacheWrite: 0.000001 },
  "codestral-latest":    { provider: "mistral", input: 0.000001, output: 0.000003, cacheRead: 0.0000005, cacheWrite: 0.000001 },
  // Grok (xAI)
  "grok-2":              { provider: "grok", input: 0.000002, output: 0.00001, cacheRead: 0.000001, cacheWrite: 0.000002 },
  "grok-2-vision":       { provider: "grok", input: 0.000002, output: 0.00001, cacheRead: 0.000001, cacheWrite: 0.000002 },
};

/** 将模型 cost 写入 ~/.pi/agent/models.json 的 providers.{provider}.modelOverrides 下 */
function persistModelCost(modelId: string, provider: string, cost: { input: number; output: number; cacheRead: number; cacheWrite: number }): void {
  const configPath = join(homedir(), ".pi", "agent", "models.json");
  let config: any = { providers: {} };
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  }
  if (!config.providers) config.providers = {};
  if (!config.providers[provider]) config.providers[provider] = { modelOverrides: {} };
  if (!config.providers[provider].modelOverrides) config.providers[provider].modelOverrides = {};
  config.providers[provider].modelOverrides[modelId] = {
    ...config.providers[provider].modelOverrides[modelId],
    cost,
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

/** 从 models.json 移除以 modelId 为 key 的 cost */
function removeModelCost(modelId: string): boolean {
  const configPath = join(homedir(), ".pi", "agent", "models.json");
  if (!existsSync(configPath)) return false;
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const providers = config.providers;
  if (!providers) return false;
  for (const providerKey of Object.keys(providers)) {
    const overrides = providers[providerKey]?.modelOverrides;
    if (overrides && overrides[modelId]?.cost) {
      delete overrides[modelId].cost;
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
      return true;
    }
  }
  return false;
}

/** 列出所有有 cost 定义的模型（provider: modelId） */
function listModelCosts(): string[] {
  const configPath = join(homedir(), ".pi", "agent", "models.json");
  if (!existsSync(configPath)) return [];
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const providers = config.providers;
  if (!providers) return [];
  const result: string[] = [];
  for (const providerKey of Object.keys(providers)) {
    const overrides = providers[providerKey]?.modelOverrides;
    if (!overrides) continue;
    for (const modelId of Object.keys(overrides)) {
      if (overrides[modelId]?.cost) {
        result.push(`${modelId} (${providerKey})`);
      }
    }
  }
  return result;
}

interface AuthJson {
  [provider: string]: { type: string; key: string };
}

function getLegacyApiKeyFromAuth(providerName: string): string {
  // 后备方案：直接从 auth.json 读取并尝试解析 $VAR_NAME / ${VAR_NAME}
  try {
    const authPath = join(homedir(), ".pi", "agent", "auth.json");
    if (!existsSync(authPath)) return "";
    const raw = readFileSync(authPath, "utf-8");
    const auth = JSON.parse(raw) as AuthJson;
    for (const [key, config] of Object.entries(auth)) {
      if (key.toLowerCase().includes(providerName.toLowerCase()) && config.type === "api_key" && config.key) {
        const val = config.key.trim();
        // 尝试解析 $VAR_NAME 或 ${VAR_NAME}
        if (val.startsWith("$")) {
          const envName = val.replace(/^\$\{?/, "").replace(/\}?$/, "");
          return process.env[envName] || "";
        }
        return val;
      }
    }
    return "";
  } catch {
    return "";
  }
}

/** 使用 Pi 内置的 API key 解析机制获取 key */
async function getApiKeyFromProvider(ctx: ExtensionContext, providerName: string): Promise<string | undefined> {
  // 优先使用 modelRegistry.getApiKeyForProvider()——它通过 AuthStorage.getApiKey() 调用
  // resolveConfigValue()，完整支持 $VAR、${VAR}、!command、$$ 转义等
  try {
    if (ctx.modelRegistry?.getApiKeyForProvider) {
      const key = await ctx.modelRegistry.getApiKeyForProvider(providerName);
      if (key) return key;
    }
  } catch {
    // modelRegistry 不可用，降级
  }
  // 降级：直接读 auth.json
  const fallback = getLegacyApiKeyFromAuth(providerName);
  return fallback || undefined;
}

// ── JSON 配置加载: ~/.pi/agent/balance-providers.json ────────────────

interface ConfigBalanceProvider {
  name: string;
  url: string;
  method?: "GET" | "POST";
  currency?: "USD" | "CNY";
  balancePath?: string;
  grantedPath?: string;
  usedPath?: string;
}

/** 按点路径从嵌套对象取值，支持 balance_infos.0.total_balance 格式 */
function getNestedValue(obj: any, path: string): number {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      current = current?.[arrMatch[1]]?.[parseInt(arrMatch[2])];
    } else {
      current = current?.[part];
    }
    if (current == null) return 0;
  }
  return typeof current === "number" ? current : (parseFloat(String(current)) || 0);
}

/** 根据配置生成通用的 fetchBalance 函数 */
function createFetchBalance(config: ConfigBalanceProvider): (apiKey: string) => Promise<BalanceResult> {
  return async (apiKey: string): Promise<BalanceResult> => {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      const fetchOpts: RequestInit = { method: config.method || "GET", headers };
      if ((config.method || "GET") === "POST") {
        fetchOpts.body = "{}";
      }
      const response = await fetch(config.url, fetchOpts);
      if (!response.ok) {
        return { currency: config.currency || "USD", balance: 0, error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      let balance: number;
      if (config.grantedPath && config.usedPath) {
        const granted = getNestedValue(data, config.grantedPath);
        const used = getNestedValue(data, config.usedPath);
        balance = granted - used;
      } else if (config.balancePath) {
        balance = getNestedValue(data, config.balancePath);
      } else {
        balance = getNestedValue(data, "balance");
      }
      if (typeof balance !== "number" || isNaN(balance)) {
        return { currency: config.currency || "USD", balance: 0, error: "could not parse balance" };
      }
      return { currency: config.currency || "USD", balance };
    } catch (e: any) {
      return { currency: config.currency || "USD", balance: 0, error: e.message || "fetch failed" };
    }
  };
}

/** 从 ~/.pi/agent/balance-providers.json 加载外部 provider 配置 */
function loadBalanceProvidersFromConfig(): void {
  const configPath = join(homedir(), ".pi", "agent", "balance-providers.json");
  if (!existsSync(configPath)) return;
  try {
    const raw = readFileSync(configPath, "utf-8");
    const list = JSON.parse(raw) as ConfigBalanceProvider[];
    for (const cfg of list) {
      if (!cfg.name || !cfg.url) {
        console.warn(`[pi-billing-footer] 跳过无效 provider 配置: name=${cfg.name} url=${cfg.url}`);
        continue;
      }
      const provider: BalanceProvider = {
        name: cfg.name,
        fetchBalance: createFetchBalance(cfg),
      };
      _registerBalanceProvider(provider);
    }
    console.log(`[pi-billing-footer] 已从 balance-providers.json 注册 ${list.length} 个 provider`);
  } catch (e: any) {
    console.error(`[pi-billing-footer] 加载 balance-providers.json 失败: ${e.message}`);
  }
}

// 预置 DeepSeek 余额查询
_registerBalanceProvider({
  name: "deepseek",
  async fetchBalance(apiKey: string): Promise<BalanceResult> {
    const response = await fetch("https://api.deepseek.com/user/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      return { currency: "CNY", balance: 0, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data.balance_infos && data.balance_infos.length > 0) {
      const total = parseFloat(data.balance_infos[0].total_balance);
      return { currency: "CNY", balance: total };
    }
    return { currency: "CNY", balance: 0, error: "no balance_infos" };
  },
});

// 从 ~/.pi/agent/balance-providers.json 加载外部 provider 配置
loadBalanceProvidersFromConfig();


export default function (pi: ExtensionAPI) {
	let enabled = true;
	let exchangeRate = 7.2;

	// 余额
	let balanceFetching = false;

	// 缓存检测（render 时自动更新）
	let supportsCache = false;

	// 保存 interval ID 以便清理
	let balanceIntervalId: NodeJS.Timeout | null = null;

	// 清理余额更新 interval
	function clearBalanceInterval() {
		if (balanceIntervalId) {
			clearInterval(balanceIntervalId);
			balanceIntervalId = null;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		// 清除旧版 deepseek-balance 残留的 "money" 状态（防止重复显示）
		ctx.ui.setStatus("money", undefined);

		if (enabled) {
			setCustomFooter(ctx);
		}

		// 初始化余额（根据当前 provider 自动查询）
		await updateBalance(ctx);

		// 清理旧的 interval（防止会话切换后残留）
		clearBalanceInterval();

		// 每 60 秒自动刷新余额
		// 如果 ctx 已 stale（session 被 newSession/fork/switchSession 替换），
		// updateBalance 会抛出异常，此时应清除 interval
		balanceIntervalId = setInterval(async () => {
			try {
				await updateBalance(ctx);
			} catch (e: any) {
				if (e?.message?.includes("stale") || e?.message?.includes("session replacement")) {
					clearBalanceInterval();
				} else {
					throw e;
				}
			}
		}, 60000);
	});

	// 会话结束时清理 interval
	pi.on("session_end", () => {
		clearBalanceInterval();
	});

	// 模型切换时立即刷新余额
	pi.on("model_select", async (_event, ctx) => {
		await updateBalance(ctx);
	});

	function fmtTokens(count: number): string {
		if (count < 1000) return `${count}`;
		if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
		if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
		if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
		return `${Math.round(count / 1_000_000)}M`;
	}

	function sanitizeStatusText(text: string): string {
		return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
	}

	function setCustomFooter(ctx: ExtensionContext) {
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange
				? footerData.onBranchChange(() => tui.requestRender())
				: () => {};

			return {
				dispose: unsubBranch,
				invalidate() {},
				render(width: number): string[] {
					const lines: string[] = [];

					// ── Line 1: working directory + branch + session name ──
					const session = (ctx as any).sessionManager;
					const cwd = session.getCwd();
					const home = process.env.HOME || process.env.USERPROFILE || "";
					let pwd = cwd;
					if (home) {
						const resolvedCwd = cwd;
						const resolvedHome = home;
						if (resolvedCwd.startsWith(resolvedHome)) {
							const rel = resolvedCwd.slice(resolvedHome.length);
							pwd = rel ? `~${rel}` : "~";
						}
					}
					const branch = footerData.getGitBranch();
					if (branch) pwd = `${pwd} (${branch})`;
					const sessionName = session.getSessionName();
					if (sessionName) pwd = `${pwd} • ${sessionName}`;
					lines.push(truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "...")));

					// ── Line 2: token stats + cost (RMB) + context usage + model ──
					// Use getEntries() (all entries, including compacted) like default footer
					let totalInput = 0,
						totalOutput = 0;
					let totalCacheRead = 0,
						totalCacheWrite = 0;
					let totalCost = 0;
					let lastInput = 0, lastOutput = 0, lastCacheRead = 0, lastCacheWrite = 0, lastCost = 0;
					for (const entry of session.getEntries()) {
						if (entry.type === "message" && entry.message.role === "assistant") {
							const m = entry.message as AssistantMessage;
							totalInput += m.usage.input;
							totalOutput += m.usage.output;
							totalCacheRead += m.usage.cacheRead ?? 0;
							totalCacheWrite += m.usage.cacheWrite ?? 0;
							totalCost += m.usage.cost.total;
							// 记录最后一次的独立值
							lastInput = m.usage.input;
							lastOutput = m.usage.output;
							lastCacheRead = m.usage.cacheRead ?? 0;
							lastCacheWrite = m.usage.cacheWrite ?? 0;
							lastCost = m.usage.cost.total;
						}
					}

					// 累计缓存命中率: cacheRead / (cacheRead + cacheWrite + input)
					const totalPrompt = totalCacheRead + totalCacheWrite + totalInput;
					let cacheHitRate: string;
					if (totalPrompt > 0) {
						cacheHitRate = ((totalCacheRead / totalPrompt) * 100).toFixed(1);
					} else {
						cacheHitRate = "0.0";
					}
					// 本次缓存命中率
					const lastPrompt = lastCacheRead + lastCacheWrite + lastInput;
					let lastCacheHitRate: string;
					if (lastPrompt > 0) {
						lastCacheHitRate = ((lastCacheRead / lastPrompt) * 100).toFixed(1);
					} else {
						lastCacheHitRate = "0.0";
					}

					// Cost in RMB
					const totalCostCNY = totalCost * exchangeRate;
					const usingSubscription =
						ctx.model ? (ctx as any).modelRegistry?.isUsingOAuth?.(ctx.model) : false;
					const lastCostCNY = lastCost * exchangeRate;

					// Context usage: 显示实际 token 数 + 百分比
					const contextUsage = (ctx as any).getContextUsage?.();
					const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
					const contextTokens = contextUsage?.tokens ?? 0;
					const contextPercentValue = contextUsage?.percent ?? 0;
					const contextPercent =
						contextUsage?.percent !== null && contextUsage?.percent !== undefined
							? contextPercentValue.toFixed(1)
							: "?";
					const autoCompactEnabled = (ctx as any).autoCompactEnabled !== false;
					const autoIndicator = autoCompactEnabled ? " (auto)" : "";
					const contextPercentDisplay =
						contextPercent === "?"
							? `ctx:?/${fmtTokens(contextWindow)}${autoIndicator}`
							: `ctx:${fmtTokens(contextTokens)}/${fmtTokens(contextWindow)} (${contextPercent}%)${autoIndicator}`;

					let contextStr: string;
					if (contextPercentValue > 90) {
						contextStr = theme.fg("error", contextPercentDisplay);
					} else if (contextPercentValue > 70) {
						contextStr = theme.fg("warning", contextPercentDisplay);
					} else {
						contextStr = contextPercentDisplay;
					}

					// 更新缓存能力检测（只要有一次 cacheRead>0 就认为支持）
					supportsCache = totalCacheRead > 0 || lastCacheRead > 0;

					// 当前模型是否有 cost 定义（只要 cost 对象存在就算，即使全为 0）
					const hasModelCost = ctx.model?.cost != null;

					// Build stats parts: 输入 输出 R命中 [H命中率] [¥总费用] | ctx信息 [h本次命中率] [¥本次费用]
					const statsParts: string[] = [];
					// --- 左半部分（| 之前）---
					if (totalInput) statsParts.push(`↑${fmtTokens(totalInput)}`);
					if (totalOutput) statsParts.push(`↓${fmtTokens(totalOutput)}`);
					if (totalCacheRead > 0) statsParts.push(`R${fmtTokens(totalCacheRead)}`);
					const totalSessionTokens = totalInput + totalOutput + totalCacheRead + totalCacheWrite;
					if (totalSessionTokens > 0) statsParts.push(`T${fmtTokens(totalSessionTokens)}`);
					// H：仅当 provider 支持缓存时才显示
					if (supportsCache && totalPrompt > 0) {
						statsParts.push(`H${cacheHitRate}%`);
					}
					// 累计费用：始终显示 session 累计值（不依赖当前模型是否有 cost）
					if (totalCost > 0 || usingSubscription) {
						statsParts.push(`¥${totalCostCNY.toFixed(2)}${usingSubscription ? " (sub)" : ""}`);
					} else {
						statsParts.push(`¥0.00`);
					}
					// --- 分隔符 ---
					statsParts.push("|");
					// --- 右半部分（| 之后）---
					statsParts.push(contextStr);
					// h：仅当 provider 支持缓存时才显示
					if (supportsCache && lastPrompt > 0) {
						statsParts.push(`h${lastCacheHitRate}%`);
					}
					// 本次费用：始终显示，无 cost 定义时显示 ¥-
					if (hasModelCost) {
						if (lastCost > 0) {
							statsParts.push(`¥${lastCostCNY.toFixed(2)}`);
						} else {
							statsParts.push(`¥0.00`);
						}
					} else {
						statsParts.push(`¥—`);
					}

					let statsLeft = statsParts.join(" ");
					const statsLeftWidth = visibleWidth(statsLeft);

					// Right side: model info
					const modelName = ctx.model?.id || "no-model";
					let rightSideWithoutProvider = modelName;
					if (ctx.model?.reasoning) {
						const thinkingLevel = (ctx as any).thinkingLevel || "off";
						rightSideWithoutProvider =
							thinkingLevel === "off"
								? `${modelName} • thinking off`
								: `${modelName} • ${thinkingLevel}`;
					}
					let rightSide = rightSideWithoutProvider;
					if (footerData.getAvailableProviderCount() > 1 && ctx.model) {
						rightSide = `(${ctx.model.provider}) ${rightSideWithoutProvider}`;
						if (statsLeftWidth + 2 + visibleWidth(rightSide) > width) {
							rightSide = rightSideWithoutProvider;
						}
					}
					const rightSideWidth = visibleWidth(rightSide);
					const minPadding = 2;
					const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

					let statsLine: string;
					if (totalNeeded <= width) {
						const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
						statsLine = statsLeft + padding + rightSide;
					} else {
						const availableForRight = width - statsLeftWidth - minPadding;
						if (availableForRight > 0) {
							const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
							const truncatedRightWidth = visibleWidth(truncatedRight);
							const padding = " ".repeat(Math.max(0, width - statsLeftWidth - truncatedRightWidth));
							statsLine = statsLeft + padding + truncatedRight;
						} else {
							statsLine = statsLeft;
						}
					}

					const dimStatsLeft = theme.fg("dim", statsLeft);
					const remainder = statsLine.slice(statsLeft.length);
					const dimRemainder = theme.fg("dim", remainder);
					lines.push(dimStatsLeft + dimRemainder);

					// ── Line 3+: Extension statuses ──
					const extensionStatuses = footerData.getExtensionStatuses();
					if (extensionStatuses.size > 0) {
						const sortedStatuses = Array.from(extensionStatuses.entries())
							.sort(([a], [b]) => a.localeCompare(b))
							.map(([, text]) => sanitizeStatusText(text))
							.filter(t => t.length > 0);
						if (sortedStatuses.length > 0) {
							const statusLine = sortedStatuses.join(" ");
							lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
						}
					}

					return lines;
				},
			};
		});
	}

	// ── 余额查询 ──────────────────────────────────────────────────────────

	async function updateBalance(ctx: ExtensionContext) {
		const providerName = ctx.model?.provider;
		if (!providerName) {
			ctx.ui.setStatus("balance", ctx.ui.theme.fg("dim", "Balance:—"));
			return;
		}

		const provider = getBalanceProvider(providerName);
		if (!provider) {
			ctx.ui.setStatus("balance", ctx.ui.theme.fg("dim", "Balance:—"));
			return;
		}

		if (balanceFetching) return;
		balanceFetching = true;

		const apiKey = await getApiKeyFromProvider(ctx, providerName);
		if (!apiKey) {
			ctx.ui.setStatus("balance", ctx.ui.theme.fg("dim", "Balance:—"));
			balanceFetching = false;
			return;
		}

		try {
			const result = await provider.fetchBalance(apiKey);
			if (result.error) {
				ctx.ui.setStatus("balance", ctx.ui.theme.fg("error", `Balance:⚠ ${result.error}`));
			} else {
				// 统一以 ¥ 显示余额，USD 按汇率转换
				const balanceCNY = result.currency === "CNY" ? result.balance : result.balance * exchangeRate;
				const label = providerName.charAt(0).toUpperCase() + providerName.slice(1);
				ctx.ui.setStatus("balance", ctx.ui.theme.fg("success", `Balance:¥${balanceCNY.toFixed(2)} (${label})`));
			}
		} catch (e: any) {
			ctx.ui.setStatus("balance", ctx.ui.theme.fg("error", `Balance:⚠ ${e.message || "unknown"}`));
		} finally {
			balanceFetching = false;
		}
	}

	// ── /billing 统一命令 ──

	pi.registerCommand("billing", {
		description:
			"控制 billing footer。\n子命令:\n" +
			"  /billing                       — 切换开/关\n" +
			"  /billing rate <N>              — 设置汇率\n" +
			"  /billing list                  — 列出 provider 和 cost\n" +
			"  /billing balance               — 刷新余额\n" +
			"  /billing help                  — 显示详细帮助\n" +
			"  /billing provider register <n> — 注册 balance provider\n" +
			"  /billing provider remove <n>   — 删除 balance provider\n" +
			"  /billing cost register <m>     — 注册 cost\n" +
			"  /billing cost remove <m>       — 删除 cost",
		handler: async (args: string, ctx: ExtensionContext) => {
			const parts = (args || "").trim().split(/\s+/);
			const subcmd = parts[0]?.toLowerCase();

			// 无参数 → 切换 footer 开/关
			if (!subcmd) {
				enabled = !enabled;
				if (enabled) {
					setCustomFooter(ctx);
					ctx.ui.notify(`Billing footer 已启用 (汇率: 1 USD = ${exchangeRate} CNY)`, "info");
				} else {
					ctx.ui.setFooter(undefined);
					ctx.ui.notify("已恢复默认 footer", "info");
				}
				return;
			}

			if (subcmd === "rate") {
				const rate = parseFloat(parts[1]);
				if (isNaN(rate) || rate <= 0) {
					ctx.ui.notify(`无效汇率: "${parts[1] || ""}"`, "error");
					return;
				}
				exchangeRate = rate;
				if (enabled) setCustomFooter(ctx);
				ctx.ui.notify(`汇率已设为 1 USD = ${exchangeRate} CNY`, "info");
				return;
			}

			if (subcmd === "list") {
				const pNames = listBalanceProviders();
				const pMsg = pNames.length > 0
					? `已注册的 balance provider: ${pNames.join(", ")}`
					: "当前没有已注册的 balance provider。";
				const cItems = listModelCosts();
				const cMsg = cItems.length > 0
					? `已有 cost 定义的模型:\n${cItems.join("\n")}`
					: "当前没有模型配置 cost。";
				ctx.ui.notify(`${pMsg}\n\n${cMsg}`, "info");
				return;
			}

			if (subcmd === "balance") {
				const providerName = ctx.model?.provider;
				if (!providerName) {
					ctx.ui.notify("未检测到当前 provider", "error");
					return;
				}
				const provider = getBalanceProvider(providerName);
				if (!provider) {
					ctx.ui.notify(`provider "${providerName}" 没有注册余额查询`, "warning");
					return;
				}
				ctx.ui.notify(`正在查询 ${providerName} 余额...`, "info");
				await updateBalance(ctx);
				ctx.ui.notify("余额已刷新", "success");
				return;
			}

			if (subcmd === "provider") {
				const action = parts[1]?.toLowerCase();
				const name = parts[2]?.toLowerCase();

				if (action === "register") {
					if (!name) {
						ctx.ui.notify("用法: /billing provider register <providerName>", "error");
						return;
					}
					const tmpl = builtinTemplates[name];
					if (!tmpl) {
						ctx.ui.notify(`未内置 "${name}" 的模板。请对我说：帮我注册 ${name} 的 balance provider`, "warning");
						return;
					}
					const config: ConfigBalanceProvider = {
						name, url: tmpl.url, method: tmpl.method, currency: tmpl.currency,
					};
					if (tmpl.balancePath) config.balancePath = tmpl.balancePath;
					if (tmpl.grantedPath && tmpl.usedPath) {
						config.grantedPath = tmpl.grantedPath;
						config.usedPath = tmpl.usedPath;
					}
					persistBalanceProvider(config);
					ctx.ui.notify(`已注册 balance provider "${name}"`, "success");
					await updateBalance(ctx);
					return;
				}

				if (action === "remove") {
					if (!name) {
						ctx.ui.notify("用法: /billing provider remove <providerName>", "error");
						return;
					}
					const configPath = join(homedir(), ".pi", "agent", "balance-providers.json");
					if (existsSync(configPath)) {
						const list: ConfigBalanceProvider[] = JSON.parse(readFileSync(configPath, "utf-8"));
						const newList = list.filter((p) => p.name !== name);
						if (newList.length < list.length) writeFileSync(configPath, JSON.stringify(newList, null, 2) + "\n");
					}
					balanceRegistry.delete(name);
					ctx.ui.notify(`已移除 balance provider "${name}"`, "success");
					await updateBalance(ctx);
					return;
				}

				ctx.ui.notify("用法: /billing provider [register | remove] <name>", "error");
				return;
			}

			if (subcmd === "cost") {
				const action = parts[1]?.toLowerCase();
				const modelName = parts[2];

				if (action === "register") {
					if (!modelName) {
						ctx.ui.notify("用法: /billing cost register <modelName>", "error");
						return;
					}
					const pricing = builtinPricing[modelName];
					if (!pricing) {
						ctx.ui.notify(`未内置 "${modelName}" 的定价。请对我说：给 ${modelName} 配上 cost`, "warning");
						return;
					}
					const cost = {
						input: pricing.input, output: pricing.output,
						cacheRead: pricing.cacheRead, cacheWrite: pricing.cacheWrite,
					};
					const modelId = pricing.modelId || modelName;
					persistModelCost(modelId, pricing.provider, cost);
					ctx.ui.notify(`已为 "${modelName}" 添加 cost: input=$ ${pricing.input} output=$ ${pricing.output}`, "success");
					return;
				}

				if (action === "remove") {
					if (!modelName) {
						ctx.ui.notify("用法: /billing cost remove <modelName>", "error");
						return;
					}
					const pricing = builtinPricing[modelName];
					const keysToTry = [modelName, pricing?.modelId].filter(Boolean) as string[];
					let removed = false;
					for (const key of keysToTry) {
						if (removeModelCost(key)) removed = true;
					}
					if (removed) {
						ctx.ui.notify(`已移除 "${modelName}" 的 cost 定义`, "success");
					} else {
						ctx.ui.notify(`未找到 "${modelName}" 的 cost 定义`, "warning");
					}
					return;
				}

				ctx.ui.notify("用法: /billing cost [register | remove] <modelName>", "error");
				return;
			}

			if (subcmd === "help") {
				ctx.ui.notify(
					"用法: /billing [子命令]\n\n" +
					"  无参数        切换 billing footer 开/关\n" +
					"  rate <N>      设置汇率 (默认 7.2)\n" +
					"  list          列出所有 balance provider 和模型 cost\n" +
					"  balance       手动刷新当前余额\n" +
					"  provider\n" +
					"    register <n> 注册 balance provider (deepseek/openai/anthropic/openrouter)\n" +
					"    remove <n>   删除 balance provider\n" +
					"  cost\n" +
					"    register <m> 注册模型 cost (从内置定价表自动补齐)\n" +
					"    remove <m>   删除模型 cost\n" +
					"  help          显示此帮助",
					"info"
				);
				return;
			}

			ctx.ui.notify(
				"用法: /billing [rate <N> | list | balance | help | provider register|remove <name> | cost register|remove <modelName>]",
				"info"
			);
		},
	});
}
