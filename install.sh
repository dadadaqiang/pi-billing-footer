#!/usr/bin/env bash
set -euo pipefail

# ── pi-billing-footer 安装脚本 ─────────────────────────────────────
# 用法: curl -sSfL https://raw.githubusercontent.com/<USER>/pi-billing-footer/main/install.sh | sh

REPO_RAW="https://raw.githubusercontent.com/<YOUR_GITHUB_USERNAME>/pi-billing-footer/main"
PI_EXT_DIR="$HOME/.pi/agent/extensions"
PI_SKILL_DIR="$HOME/.pi/agent/skills/pi-billing-footer"
PI_REF_DIR="$PI_SKILL_DIR/references"
PI_SCRIPT_DIR="$PI_SKILL_DIR/scripts"

echo "📦 Installing pi-billing-footer..."

# 创建目录
mkdir -p "$PI_EXT_DIR"
mkdir -p "$PI_REF_DIR"
mkdir -p "$PI_SCRIPT_DIR"

# 下载扩展
echo "  → 下载 extension..."
curl -sSfL "$REPO_RAW/extension/pi-billing-footer.ts" -o "$PI_EXT_DIR/pi-billing-footer.ts"

# 下载 skill
echo "  → 下载 skill..."
curl -sSfL "$REPO_RAW/skill/pi-billing-footer/SKILL.md" -o "$PI_SKILL_DIR/SKILL.md"

# 下载 references
for f in pricing.md provider-templates.md; do
  curl -sSfL "$REPO_RAW/skill/pi-billing-footer/references/$f" -o "$PI_REF_DIR/$f"
done

# 下载 scripts
for f in add-balance-provider.js add-model-cost.js delete-model-cost.js; do
  curl -sSfL "$REPO_RAW/skill/pi-billing-footer/scripts/$f" -o "$PI_SCRIPT_DIR/$f"
  chmod +x "$PI_SCRIPT_DIR/$f"
done

echo "✅ 安装完成！"
echo ""
echo "下一步："
echo "  1. 重启 Pi（或在 Pi 内运行 /billing 以启用 footer）"
echo "  2. 注册 balance provider:  /billing provider register <name>"
echo "  3. 配置模型 cost:          /billing cost register <modelName>"
echo ""
echo "详细用法: https://github.com/<YOUR_GITHUB_USERNAME>/pi-billing-footer"
