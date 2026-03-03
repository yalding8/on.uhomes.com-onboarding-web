#!/bin/bash
set -e

# Usage: bash scripts/check-file-lines.sh [--with-llm]
#   --with-llm  Use Claude CLI to suggest refactoring for files exceeding 300 lines

WITH_LLM=0
for arg in "$@"; do
  case "$arg" in
    --with-llm) WITH_LLM=1 ;;
  esac
done

# Define directories to check for files over 300 lines (excluding test and api directories)
search_dirs=("src/app/" "src/components/" "src/lib/")

has_error=0
violating_files=()

for d in "${search_dirs[@]}"; do
  if [ -d "$d" ]; then
    while IFS= read -r obj; do
      SLOC=$(wc -l < "$obj" | xargs)
      if [ "$SLOC" -gt 300 ]; then
        echo -e "\033[0;31mERROR:\033[0m Architecture violation ($SLOC lines)! File $obj crossed 300 max LOC rule policy. Refactor logical blocks or UI sub-components out to pass CI."
        has_error=1
        violating_files+=("$obj")
      fi
    done < <(find "$d" -name '*.ts' -o -name '*.tsx' | grep -v '__tests__' | grep -v '\.test\.')
  fi
done

if [ "$has_error" -eq 1 ]; then
  if [ "$WITH_LLM" -eq 1 ]; then
    if ! command -v claude &>/dev/null; then
      echo -e "\033[1;33mWARN:\033[0m --with-llm requires the Claude CLI ('claude') to be installed. Skipping LLM analysis."
    else
      echo ""
      echo "==========================================="
      echo "  LLM Refactoring Suggestions"
      echo "==========================================="
      for vf in "${violating_files[@]}"; do
        echo ""
        echo -e "\033[1;34m--- $vf ---\033[0m"
        claude -p "You are a code architecture advisor. The following TypeScript file exceeds a 300-line limit and must be split into smaller modules. Analyze the file and provide a concrete refactoring plan:
1. Identify independent concerns (data fetching, UI components, helpers, types, constants).
2. Propose specific new files with names and what code moves into each.
3. Keep each resulting file under 300 lines.
Be concise — output only the plan, no code." < "$vf" 2>/dev/null || echo "(Claude CLI returned an error for this file)"
      done
      echo ""
      echo "==========================================="
    fi
  fi
  exit 1
fi

echo "Clean: No module files breached the < 300 LOC limit."
exit 0
