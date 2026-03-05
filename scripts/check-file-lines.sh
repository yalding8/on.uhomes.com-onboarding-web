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
        echo -e "\033[1;33mWARNING:\033[0m File $obj has $SLOC lines (exceeds 300-line guideline). Consider refactoring."
        has_error=1
        violating_files+=("$obj")
      fi
    done < <(find "$d" -name '*.ts' -o -name '*.tsx' | grep -v '__tests__' | grep -v '\.test\.')
  fi
done

if [ "$has_error" -eq 1 ]; then
  echo ""
  echo "Above files exceed the 300-line guideline. This is a warning — CI will not fail."
  exit 0
fi

echo "Clean: All files are within the 300-line guideline."
exit 0
