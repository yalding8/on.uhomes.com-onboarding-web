#!/bin/bash
set -e
echo "🔍 检查 AI 开发规则合规性..."
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXIT_CODE=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
echo -n "📋 检查 Pages Router... "; [ ! -d "$PROJECT_ROOT/src/pages" ] && echo -e "${GREEN}✅${NC}" || { echo -e "${RED}❌${NC}"; EXIT_CODE=1; }
echo -n "🔒 检查 any 类型... "; [ -z "$(grep -r ": any" "$PROJECT_ROOT/src" --include="*.ts*" 2>/dev/null || true)" ] && echo -e "${GREEN}✅${NC}" || { echo -e "${RED}❌${NC}"; EXIT_CODE=1; }
echo -n "🔄 检查规则文件同步... "; BASE=$(cat "$PROJECT_ROOT/AGENTS.md"); SYNC_ISSUE=0; for f in "$PROJECT_ROOT/CLAUDE.md" "$PROJECT_ROOT/.kiro/rules.md" "$PROJECT_ROOT/.qwen/rules.md"; do [ -f "$f" ] && [ "$BASE" != "$(cat "$f")" ] && { echo -e "${RED}❌${NC}"; SYNC_ISSUE=1; }; done; [ $SYNC_ISSUE -eq 0 ] && echo -e "${GREEN}✅${NC}" || { echo -e "${RED}❌${NC}"; EXIT_CODE=1; }
echo ""; [ $EXIT_CODE -eq 0 ] && echo -e "${GREEN}✅ 所有强制规则检查通过！${NC}" || echo -e "${RED}❌ 发现规则违规！${NC}"; exit $EXIT_CODE
