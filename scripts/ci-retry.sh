#!/usr/bin/env bash
set -euo pipefail
max=${1:-5}; shift || true
sleepsec=${1:-2}; shift || true
try=0
while :; do
  set +e
  out=$("$@"); rc=$?
  set -e
  code="$out"
  if [ $rc -eq 0 ] && [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    echo "$code"; exit 0
  fi
  try=$((try+1))
  if [ $try -ge $max ]; then
    echo "RETRY_FAIL code=$code rc=$rc tries=$try" >&2
    echo "$code"; exit 1
  fi
  echo "RETRY[$try/$max] code=$code rc=$rc; sleep $sleepsec ..." >&2
  sleep "$sleepsec"
done
