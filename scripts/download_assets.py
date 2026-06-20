#!/usr/bin/env python3
"""
Inkstone Asset Downloader
=========================
Downloads the Chinese character stroke database from the makemeahanzi GitHub
project and organises it into the files that Inkstone expects:

  public/assets/characters_v2/N   (one file per group of 256 code-points)
  public/assets/characters.txt    (list of every character that has data)

These files are served as static assets by your web server, so the app
never needs to contact skishore.me again.

Usage:
  python3 scripts/download_assets.py [--out public/assets]

Requirements:  Python 3.6+, no extra packages needed.
"""

import argparse
import json
import os
import sys
import urllib.request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GRAPHICS_URL = (
    "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt"
)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DEFAULT_OUT = os.path.join(PROJECT_DIR, "public", "assets")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def log(msg, prefix="→"):
    print(f"  {prefix}  {msg}")


def ok(msg):
    print(f"  ✓  {msg}")


def warn(msg):
    print(f"  !  {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Download with a simple progress indicator
# ---------------------------------------------------------------------------
def download(url, label="file"):
    print(f"\n  Downloading {label}…")
    print(f"    {url}")

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "inkstone-asset-downloader/1.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        data = bytearray()
        chunk = 65536
        while True:
            block = resp.read(chunk)
            if not block:
                break
            data.extend(block)
            if total:
                pct = int(100 * len(data) / total)
                print(f"\r    {pct:3d}%  ({len(data):,} / {total:,} bytes)", end="", flush=True)
        print()  # newline after progress

    ok(f"Downloaded {len(data):,} bytes")
    return bytes(data)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default=DEFAULT_OUT,
        help=f"Output directory (default: {DEFAULT_OUT})",
    )
    args = parser.parse_args()
    out_dir = os.path.abspath(args.out)

    chars_v2_dir = os.path.join(out_dir, "characters_v2")
    os.makedirs(chars_v2_dir, exist_ok=True)

    print()
    print("=" * 60)
    print("  Inkstone Asset Downloader")
    print("=" * 60)
    print(f"  Output dir : {out_dir}")
    print(f"  Source     : makemeahanzi / graphics.txt (GitHub)")

    # -----------------------------------------------------------------------
    # Step 1 – Download graphics.txt
    # -----------------------------------------------------------------------
    raw = download(GRAPHICS_URL, "graphics.txt (stroke database)")

    # -----------------------------------------------------------------------
    # Step 2 – Parse lines and group by charCode // 256
    # -----------------------------------------------------------------------
    print("\n  Parsing and grouping characters…")
    groups: dict[int, list[str]] = {}
    char_list: list[str] = []
    skipped = 0

    for lineno, line in enumerate(raw.decode("utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            warn(f"Line {lineno}: could not parse JSON, skipping")
            skipped += 1
            continue

        ch = obj.get("character")
        if not ch:
            warn(f"Line {lineno}: no 'character' field, skipping")
            skipped += 1
            continue

        code = ord(ch)
        group = code // 256
        groups.setdefault(group, []).append(line)
        char_list.append(ch)

    total_chars = len(char_list)
    total_groups = len(groups)
    ok(f"Parsed {total_chars:,} characters across {total_groups} group files  ({skipped} skipped)")

    # -----------------------------------------------------------------------
    # Step 3 – Write characters_v2/N files
    # -----------------------------------------------------------------------
    print(f"\n  Writing {total_groups} character group files…")
    for i, group_id in enumerate(sorted(groups.keys()), 1):
        path = os.path.join(chars_v2_dir, str(group_id))
        content = "\n".join(groups[group_id]) + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(
            f"\r    {i}/{total_groups}  (group {group_id:3d}, {len(groups[group_id]):4d} chars)",
            end="",
            flush=True,
        )
    print()
    ok(f"Wrote {total_groups} files to {chars_v2_dir}")

    # -----------------------------------------------------------------------
    # Step 4 – Regenerate characters.txt
    # -----------------------------------------------------------------------
    chars_txt = os.path.join(out_dir, "characters.txt")
    print(f"\n  Regenerating characters.txt ({total_chars:,} entries)…")
    # Sort by code point so the file is deterministic
    sorted_chars = sorted(char_list, key=ord)
    with open(chars_txt, "w", encoding="utf-8") as f:
        for ch in sorted_chars:
            f.write(ch + "\n")
    ok(f"Wrote {chars_txt}")

    # -----------------------------------------------------------------------
    # Done
    # -----------------------------------------------------------------------
    print()
    print("=" * 60)
    print("  All done!")
    print("=" * 60)
    print(f"""
  Next steps
  ----------
  1. Edit src/lib/base.js and point kHomePage at YOUR server:

       const kHomePage = 'https://YOUR-DOMAIN.com/inkstone';

     (or keep the fallback to skishore.me; the local files in
      public/assets/ will now be bundled into your build and
      served directly, so the app won't need to contact any
      external server for stroke data.)

  2. Rebuild:
       npm run build

  3. Deploy:
       ./deploy.sh
""")


if __name__ == "__main__":
    main()
