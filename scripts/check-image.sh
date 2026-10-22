#!/usr/bin/env bash
# Checks a running Tablefront image: that it serves the app, the bundle and the mock worker with
# the right headers, and that missing files are real 404s. Usage: scripts/check-image.sh [base-url]
set -euo pipefail

base="${1:-http://localhost:8080}"

for _ in $(seq 1 30); do
  curl -fs "$base/" >/dev/null && break
  sleep 1
done
curl -fs "$base/" >/dev/null || { echo "not serving $base/"; exit 1; }

fail() { echo "FAIL: $1"; exit 1; }
status() { curl -s -o /dev/null -w '%{http_code}' "$base$1"; }
headers() { curl -sI "$@"; }

index="$(curl -fs "$base/")"
grep -q '<div id="app">' <<<"$index" || fail "/ is not the app"
[ "$(status /orders)" = 200 ] || fail "deep link /orders is not served"
[ "$(status /admin/menu)" = 200 ] || fail "deep link /admin/menu is not served"

bundle="$(grep -o '/assets/index-[^"]*\.js' <<<"$index" | head -1)"
[ -n "$bundle" ] || fail "no bundle linked from the page"
h="$(headers -H 'Accept-Encoding: gzip' "$base$bundle")"
grep -qi '^content-type: .*javascript' <<<"$h" || fail "bundle is not served as JavaScript"
grep -qi '^cache-control: .*immutable' <<<"$h" || fail "bundle is not cached as immutable"
grep -qi '^content-encoding: gzip' <<<"$h" || fail "bundle is not gzipped"
grep -qi '^x-content-type-options: nosniff' <<<"$h" || fail "bundle lacks nosniff"

h="$(headers "$base/mockServiceWorker.js")"
grep -qi '^cache-control: no-cache' <<<"$h" || fail "mock worker is cacheable"
grep -qi '^x-content-type-options: nosniff' <<<"$h" || fail "mock worker lacks nosniff"
grep -qi '^service-worker-allowed: /' <<<"$h" || fail "mock worker lacks Service-Worker-Allowed"

grep -qi '^cache-control: no-cache' <<<"$(headers "$base/")" || fail "the page is cacheable"

for missing in /assets/missing.js /missing.js /favicon.ico /robots.txt; do
  [ "$(status "$missing")" = 404 ] || fail "$missing should be a 404"
done

echo "image ok"
