#!/usr/bin/env bash
# Fails loudly if a site that must be indexable tells search engines otherwise.
#
#   deploy/check-indexable.sh https://prudentgabriel.com
#
# Production is noindex-by-default unless its NEXT_PUBLIC_APP_URL is a production
# host (prudential-atelier/search-indexing.mjs). A wrong URL there fails toward
# noindex silently — the shop drops out of search over weeks with nothing broken
# on screen. The production deploy runs this after the container is recreated.
set -euo pipefail

BASE="${1:?usage: check-indexable.sh https://host}"
BASE="${BASE%/}"
WAIT_SECONDS="${WAIT_SECONDS:-300}"

# Wait for the recreated container to answer (502/404 while it boots and migrates).
deadline=$(( $(date +%s) + WAIT_SECONDS ))
until [ "$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$BASE/robots.txt")" = "200" ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "::error::$BASE/robots.txt did not return 200 within ${WAIT_SECONDS}s" >&2
    exit 1
  fi
  sleep 10
done

fail=0
host="${BASE#*://}"
for url in "$BASE/" "$BASE/robots.txt" "$BASE/shop" "https://www.${host#www.}/"; do
  # -L: check every hop, so a noindex on a redirect or the final page is caught.
  headers="$(curl -sIL -m 30 "$url" || true)"
  if printf '%s\n' "$headers" | grep -iE '^x-robots-tag:.*(noindex|none)' >/dev/null; then
    echo "::error::$url sends $(printf '%s\n' "$headers" | grep -iE '^x-robots-tag' | head -1 | tr -d '\r')" >&2
    fail=1
  else
    echo "ok  $url — no noindex X-Robots-Tag"
  fi
done

robots="$(curl -s -m 15 "$BASE/robots.txt")"
if printf '%s\n' "$robots" | grep -qiE '^Disallow:[[:space:]]*/[[:space:]]*$' \
  && ! printf '%s\n' "$robots" | grep -qiE '^Allow:[[:space:]]*/'; then
  echo "::error::$BASE/robots.txt disallows the whole site" >&2
  fail=1
else
  echo "ok  $BASE/robots.txt does not disallow the whole site"
fi

if [ "$fail" -ne 0 ]; then
  echo "::error::$BASE is telling search engines not to index it. Check NEXT_PUBLIC_APP_URL (PA_BUILD_NEXT_PUBLIC_APP_URL) and prudential-atelier/search-indexing.mjs." >&2
  exit 1
fi
echo "$BASE is indexable."
