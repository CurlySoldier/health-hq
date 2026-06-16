#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

if [ ! -d "$REPO_ROOT/.git/hooks" ]; then
  echo "Missing .git/hooks in $REPO_ROOT"
  exit 1
fi

chmod +x "$REPO_ROOT/.githooks/pre-commit"
ln -sfn "$REPO_ROOT/.githooks/pre-commit" "$REPO_ROOT/.git/hooks/pre-commit"

echo "Installed pre-commit hook -> .githooks/pre-commit"
