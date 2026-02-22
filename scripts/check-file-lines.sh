#!/bin/bash
set -e

# Define directories to check for files over 300 lines (excluding test and api directories)
search_dirs=("src/app/" "src/components/" "src/lib/")

has_error=0

for d in "${search_dirs[@]}"; do
  if [ -d "$d" ]; then
    while IFS= read -r obj; do
      SLOC=$(wc -l < "$obj" | xargs)
      if [ "$SLOC" -gt 300 ]; then
        echo -e "\033[0;31mERROR:\033[0m Architecture violation ($SLOC lines)! File $obj crossed 300 max LOC rule policy. Refactor logical blocks or UI sub-components out to pass CI."
        has_error=1
      fi
    done < <(find "$d" -name '*.ts' -o -name '*.tsx')
  fi
done

if [ "$has_error" -eq 1 ]; then
  exit 1
fi

echo "Clean: No module files breached the < 300 LOC limit."
exit 0
