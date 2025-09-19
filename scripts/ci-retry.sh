#!/usr/bin/env bash
# 用法：ci-retry.sh <max_retry> <sleep_sec> <curl args...>
# 例： ./scripts/ci-retry.sh 5 2 curl -sS -o /tmp/x -w "%{http_code}" https://...
set -euo pipefail
max=${1:-5}; shift || true
sleepsec=${1:-2}; shift || true

try=0
code=""
while :; do
  set +e
  out=$("$@")
  rc=$?
  set -e
  code="$out"
  # 允許的成功碼：2xx 或 201
  if [ $rc -eq 0 ] && [[ "$code" =~ ^2[0-9][0-9]$|^201$ ]]; then
    echo "$code"
    exit 0
  fi
  try=$((try+1))
  if [ $try -ge $max ]; then
    echo "RETRY_FAIL code=$code rc=$rc tries=$try" >&2
    echo "$code"
    exit 1
  fi
  echo "RETRY[$try/$max] code=$code rc=$rc; sleep $sleepsec ..." >&2
  sleep "$sleepsec"
done
