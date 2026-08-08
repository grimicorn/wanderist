#!/usr/bin/env bash
# Dependency vulnerability gate for CI.
# Runs `npm audit`, prints a severity summary, and fails the build when there is
# at least one high or critical *advisory* that is not on the accepted allowlist
# below. Moderate and low are reported but never fail the build.
# Dev dependencies are intentionally in scope: build/test tooling runs in CI
# and on developer machines, so its advisories matter here.
#
# Blocking is measured per distinct advisory (GHSA id), not per affected package.
# npm's package-level counts inflate a single root advisory into every package
# that pulls it in transitively (e.g. one image-size flaw counts image-size,
# @netlify/dev-utils, and @netlify/blobs). Counting advisories keeps the gate
# honest about how many real, un-remediated flaws exist.
#
# ALLOWLIST POLICY: only advisories with no upstream fix belong here, each with a
# justification and a trigger to remove it. This is NOT a way to silence fixable
# findings — prefer an npm `overrides` bump every time one is available.
set -euo pipefail

# High/critical advisories accepted because no patched version exists upstream.
# Remove an entry the moment its package ships a fix and bump via `overrides`.
ALLOWLISTED_ADVISORIES=(
  # image-size <=2.0.2: crafted ICNS/JXL/HEIF inputs cause an infinite-loop DoS.
  # No patched version exists (GHSA firstPatchedVersion is null as of Aug 2026);
  # 2.0.2 is the latest published release. Reaches the tree only through
  # @netlify/dev-utils' image transform, pulled by @netlify/blobs (pinned to
  # dev-utils 4.4.7) and used by server/utils/mediaStore.ts for blob storage —
  # wanderist never feeds untrusted bytes to that image path. Drop both ids once
  # image-size publishes a fix and bump it through `overrides`.
  "GHSA-w3rx-r6r6-pgpr" # image-size: ICNS parser DoS
  "GHSA-5p2g-fcmc-qvqq" # image-size: JXL/HEIF parser DoS
)

report="$(npm audit --json || true)"

if ! printf '%s' "$report" | jq -e '.metadata.vulnerabilities' >/dev/null 2>&1; then
  echo "npm audit produced no vulnerability metadata (audit failed) — failing the build." >&2
  exit 1
fi

read_count() {
  local severity="$1"
  printf '%s' "$report" | jq -r --arg severity "$severity" \
    '.metadata.vulnerabilities[$severity] // 0'
}

critical="$(read_count critical)"
high="$(read_count high)"
moderate="$(read_count moderate)"
low="$(read_count low)"

{
  echo "## Dependency audit"
  echo ""
  echo "| Severity | Affected packages |"
  echo "| -------- | ----------------- |"
  echo "| Critical | ${critical} |"
  echo "| High     | ${high} |"
  echo "| Moderate | ${moderate} |"
  echo "| Low      | ${low} |"
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

allow_json="$(printf '%s\n' "${ALLOWLISTED_ADVISORIES[@]}" | jq -R . | jq -s .)"

# Distinct high/critical advisory ids present in the report (GHSA id when the
# advisory carries one, otherwise a source-<n> fallback so nothing is dropped).
advisory_ids() {
  printf '%s' "$report" | jq -r '
    [ .vulnerabilities[].via[]
      | select(type == "object" and (.severity == "high" or .severity == "critical"))
      | (((.url // "") | capture("(?<id>GHSA-[-0-9a-z]+)").id)? ) // ("source-" + ((.source // 0) | tostring))
    ] | unique | .[]'
}

blocking_ids="$(advisory_ids | jq -R . | jq -s --argjson allow "$allow_json" '
  map(select(. as $id | ($allow | index($id)) | not))')"

blocking_count="$(printf '%s' "$blocking_ids" | jq 'length')"

accepted_present="$(advisory_ids | jq -R . | jq -s --argjson allow "$allow_json" '
  map(select(. as $id | $allow | index($id))) | length')"

if [ "$accepted_present" -gt 0 ]; then
  echo "Accepted (allowlisted, no upstream fix) high/critical advisories: ${accepted_present}."
fi

if [ "$blocking_count" -gt 0 ]; then
  echo "Found ${blocking_count} un-allowlisted high/critical advisories — failing the build:" >&2
  printf '%s' "$blocking_ids" | jq -r '.[]' >&2
  exit 1
fi

echo "No un-allowlisted high or critical advisories found."
