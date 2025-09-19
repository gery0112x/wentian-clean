#!/usr/bin/env bash
set -euo pipefail
fail=0
echo "== Workflow Doctor =="

for f in .github/workflows/*.yml; do
  echo "-- $f"
  # 檢查 steps: 下一層是否皆以 '-' 起頭（常見縮排漏 '-')
  awk '
    $0 ~ /^steps:/ {insteps=1; next}
    insteps && $0 ~ /^[^[:space:]-]/ {print "  [WARN] suspect indent before first step: " NR; insteps=0}
    insteps && $0 ~ /^[[:space:]]*-[[:space:]]/ {insteps=0}
  ' "$f" | tee /dev/stderr

  # 檢查常用 Secrets 是否有被引用（只提示，不判失敗）
  grep -Eq 'secrets\.VERCEL_TOKEN|secrets\.VERCEL_PROJECT_ID|secrets\.VERCEL_ORG_ID' "$f" \
    || echo "  [INFO] no vercel secrets referenced (ok if not needed)"

  # 粗略 YAML 解析（用 yq 若有）
  if command -v yq >/dev/null 2>&1; then
    yq '.' "$f" >/dev/null || { echo "  [ERR ] yq parse failed"; fail=1; }
  fi
done

if [ $fail -ne 0 ]; then
  echo "== Doctor found errors =="; exit 1
else
  echo "== Doctor passed =="
fi
