#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
plugin_dir="$repo_root/example/vault/.obsidian/plugins/tincan"

mkdir -p "$plugin_dir"
cp "$repo_root/main.js" "$repo_root/manifest.json" "$repo_root/styles.css" "$plugin_dir/"
