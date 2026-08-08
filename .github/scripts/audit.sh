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

# Build the allowlist as a JSON array — safe even when the array is emptied
# (removing every entry is the documented next step once fixes ship).
allow_json="$(jq -cn '$ARGS.positional' --args ${ALLOWLISTED_ADVISORIES[@]+"${ALLOWLISTED_ADVISORIES[@]}"})"

# Distinct high/critical advisory ids in the report (GHSA id when the advisory
# carries one, otherwise a source-<n> fallback so nothing is silently dropped).
all_ids="$(printf '%s' "$report" | jq -c '
  [ .vulnerabilities[].via[]
    | select(type == "object" and (.severity == "high" or .severity == "critical"))
    | (((.url // "") | capture("(?<id>GHSA-[-0-9a-z]+)").id)? ) // ("source-" + ((.source // 0) | tostring))
  ] | unique')"

# NOTE on staleness: there is no reliable per-advisory "patched upstream" signal
# in `npm audit --json` — `fixAvailable` is per-package, and its value covers
# breaking tree-surgery (e.g. downgrading a parent) as readily as a clean patch.
# So removal is manual: this gate re-runs `npm audit` every CI run, keeping the
# data fresh; when a maintainer next touches deps and sees image-size (or its
# consumer) ship a real fix, drop the entry above and bump it via `overrides`.
blocking_ids="$(printf '%s' "$all_ids" | jq -c --argjson allow "$allow_json" '
  map(select(. as $id | ($allow | index($id)) | not))')"
blocking_count="$(printf '%s' "$blocking_ids" | jq 'length')"

accepted_ids="$(printf '%s' "$all_ids" | jq -c --argjson allow "$allow_json" '
  map(select(. as $id | $allow | index($id)))')"
accepted_present="$(printf '%s' "$accepted_ids" | jq 'length')"

if [ "$accepted_present" -gt 0 ]; then
  {
    echo ""
    echo "Accepted (allowlisted, no upstream fix) high/critical advisories:"
    printf '%s' "$accepted_ids" | jq -r '.[] | "- " + .'
  } | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
fi

if [ "$blocking_count" -gt 0 ]; then
  echo "Found ${blocking_count} un-allowlisted high/critical advisories — failing the build:" >&2
  printf '%s' "$blocking_ids" | jq -r '.[]' >&2
  exit 1
fi

echo "No un-allowlisted high or critical advisories found."
