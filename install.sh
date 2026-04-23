#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ $1 is not installed${NC}" >&2
    exit 1
  fi
  echo -e "${GREEN}✓ $1${NC}"
}

echo "Checking dependencies..."
check_cmd git
check_cmd gh
check_cmd node
check_cmd pi

echo ""
echo "Fetching .pi/ from iapicca/pi_agents..."

TMPDIR=$(mktemp -d)
git clone --depth 1 https://github.com/iapicca/pi_agents.git "$TMPDIR" &> /dev/null

rm -rf ./.pi
cp -r "$TMPDIR/.pi" .
rm -rf "$TMPDIR"

echo -e "${GREEN}✓ .pi/ installed in $(pwd)/.pi${NC}"
