#!/bin/bash
set -e
echo "🔄 同步 AI 规则文件..."
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES_FILES=("$PROJECT_ROOT/AGENTS.md" "$PROJECT_ROOT/CLAUDE.md" "$PROJECT_ROOT/.kiro/rules.md" "$PROJECT_ROOT/.qwen/rules.md")
if [ ! -f "${RULES_FILES[0]}" ]; then echo "❌ 错误：主规则文件不存在"; exit 1; fi
MAIN_CONTENT=$(cat "${RULES_FILES[0]}")
for RULES_FILE in "${RULES_FILES[@]:1}"; do mkdir -p "$(dirname "$RULES_FILE")"; echo "$MAIN_CONTENT" > "$RULES_FILE"; echo "✅ 已同步: $RULES_FILE"; done
echo "✅ 规则文件同步完成！"
