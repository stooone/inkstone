#!/usr/bin/env bash
# =============================================================================
# Inkstone Asset Downloader
# Downloads all character stroke database and word list files from the
# original Inkstone server so you can self-host them.
#
# Usage: bash scripts/download_assets.sh [--target /path/to/output]
# Default output: ./public/assets/  (served as static files by Vite)
# =============================================================================

set -euo pipefail

ORIGIN="https://www.skishore.me/inkstone"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TARGET="${1:-$PROJECT_DIR/public/assets}"

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }
info() { echo -e "${CYAN}→${NC} $*"; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
command -v curl >/dev/null 2>&1 || fail "'curl' is required but not installed."
command -v python3 >/dev/null 2>&1 || fail "'python3' is required but not installed."

mkdir -p "$TARGET/characters_v2"
mkdir -p "$TARGET/lists"

echo ""
echo "=================================================="
echo "  Inkstone Asset Mirror Script"
echo "=================================================="
echo "  Source  : $ORIGIN"
echo "  Target  : $TARGET"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Download characters.txt
# ---------------------------------------------------------------------------
CHARS_TXT="$TARGET/characters.txt"
info "Downloading characters.txt ..."
curl -fsSL "$ORIGIN/assets/characters.txt" -o "$CHARS_TXT" || \
  fail "Could not fetch characters.txt from $ORIGIN/assets/characters.txt"
ok "characters.txt downloaded ($(wc -l < "$CHARS_TXT") characters)"

# ---------------------------------------------------------------------------
# Step 2: Compute which characters_v2/N files are needed
# ---------------------------------------------------------------------------
info "Computing which character group files are needed ..."

GROUPS=$(python3 - "$CHARS_TXT" <<'PYEOF'
import sys

groups = set()
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        # Each line is a single character
        for ch in line:
            code = ord(ch)
            groups.add(code // 256)

for g in sorted(groups):
    print(g)
PYEOF
)

TOTAL=$(echo "$GROUPS" | wc -l | tr -d ' ')
ok "Found $TOTAL character group files to download"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Download character group files
# ---------------------------------------------------------------------------
info "Downloading character stroke database files ..."
COUNT=0
FAILED=0

for group in $GROUPS; do
    FILE="$TARGET/characters_v2/$group"
    if [ -f "$FILE" ] && [ -s "$FILE" ]; then
        # Already downloaded and non-empty
        COUNT=$((COUNT + 1))
        continue
    fi

    URL="$ORIGIN/assets/characters_v2/$group"
    if curl -fsSL "$URL" -o "$FILE" 2>/dev/null; then
        COUNT=$((COUNT + 1))
        echo -e "  ${GREEN}✓${NC} characters_v2/$group  ($COUNT/$TOTAL)"
    else
        FAILED=$((FAILED + 1))
        warn "Failed to download characters_v2/$group (may not exist)"
        rm -f "$FILE"
    fi
done

echo ""
ok "Downloaded $COUNT/$TOTAL character group files  (${FAILED} skipped/missing)"
echo ""

# ---------------------------------------------------------------------------
# Step 4: Download all.json (list index)
# ---------------------------------------------------------------------------
info "Downloading all.json (word list index) ..."
curl -fsSL "$ORIGIN/all.json" -o "$TARGET/all.json" && \
  ok "all.json downloaded" || \
  warn "Could not download all.json (non-fatal)"

# ---------------------------------------------------------------------------
# Step 5: Download every word list referenced in all.json
# ---------------------------------------------------------------------------
if [ -f "$TARGET/all.json" ]; then
    info "Downloading all word lists ..."

    LISTS=$(python3 - "$TARGET/all.json" <<'PYEOF'
import sys, json
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
for entry in data:
    print(entry['category'], entry['name'])
PYEOF
)

    LIST_COUNT=0
    while IFS=' ' read -r category name; do
        dir="$TARGET/lists/$category"
        mkdir -p "$dir"
        URL="$ORIGIN/lists/$category/$name.list"
        FILE="$dir/$name.list"
        if curl -fsSL "$URL" -o "$FILE" 2>/dev/null; then
            LIST_COUNT=$((LIST_COUNT + 1))
            echo -e "  ${GREEN}✓${NC} lists/$category/$name.list"
        else
            warn "Failed to download lists/$category/$name.list"
        fi
    done <<< "$LISTS"

    echo ""
    ok "Downloaded $LIST_COUNT word list files"
fi

# ---------------------------------------------------------------------------
# Step 6: Download radicals.json
# ---------------------------------------------------------------------------
info "Downloading radicals.json ..."
curl -fsSL "$ORIGIN/assets/radicals.json" -o "$TARGET/radicals.json" && \
  ok "radicals.json downloaded" || \
  warn "Could not download radicals.json (non-fatal)"

echo ""
echo "=================================================="
echo -e "  ${GREEN}All done!${NC}"
echo "=================================================="
echo ""
echo "  Next steps:"
echo "  1. Your assets are in: $TARGET"
echo "  2. Edit src/lib/base.js and change kHomePage to your own server URL."
echo "     For example:  const kHomePage = 'https://YOUR-DOMAIN.com/inkstone';"
echo "  3. Run: npm run build"
echo "  4. Deploy as usual with ./deploy.sh"
echo ""
