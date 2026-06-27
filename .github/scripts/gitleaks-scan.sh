#!/usr/bin/env bash
# Secret scan for CI using the gitleaks binary directly (no marketplace action).
# Downloads the pinned release, then scans:
#   - pull_request: only the PR commit range (BASE_SHA..HEAD_SHA)
#   - push:         the full repository history
# Fails the build on any finding.
set -euo pipefail

GITLEAKS_VERSION="8.30.1"
install_dir="${RUNNER_TEMP:-/tmp}/gitleaks"
archive="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
release_url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"

mkdir -p "$install_dir"
curl --fail --silent --show-error --location "${release_url}/${archive}" \
  --output "${install_dir}/${archive}"
curl --fail --silent --show-error --location \
  "${release_url}/gitleaks_${GITLEAKS_VERSION}_checksums.txt" \
  --output "${install_dir}/checksums.txt"

# Verify the archive against the published checksum before executing it.
expected_checksum="$(awk -v file="$archive" '$2 == file { print $1 }' "${install_dir}/checksums.txt")"
if [ -z "$expected_checksum" ]; then
  echo "No published checksum found for ${archive} — refusing to run." >&2
  exit 1
fi
if ! echo "${expected_checksum}  ${install_dir}/${archive}" | sha256sum --check --status; then
  echo "gitleaks archive checksum mismatch — refusing to run." >&2
  exit 1
fi

tar -xzf "${install_dir}/${archive}" -C "$install_dir" gitleaks
gitleaks_bin="${install_dir}/gitleaks"

common_args=(--config .gitleaks.toml --redact --no-banner --verbose)

if [ "${GITHUB_EVENT_NAME:-}" != "pull_request" ]; then
  "$gitleaks_bin" git "${common_args[@]}" .
  exit
fi

if [ -z "${BASE_SHA:-}" ] || [ -z "${HEAD_SHA:-}" ]; then
  echo "pull_request event but BASE_SHA/HEAD_SHA empty — refusing to scan a partial range." >&2
  exit 1
fi

"$gitleaks_bin" git "${common_args[@]}" --log-opts "${BASE_SHA}..${HEAD_SHA}" .
