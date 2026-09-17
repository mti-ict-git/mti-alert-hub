#!/usr/bin/env bash
set -Eeuo pipefail
TEST_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
source <(sed '/^while (($#)); do/,$d' "$TEST_ROOT/scripts/deploy-docker.sh")
test_dir="$(mktemp -d)"
trap 'rm -rf -- "$test_dir"' EXIT
ROOT_DIR="$test_dir"
mode=legacy
calls="$test_dir/calls"
: > "$calls"
docker() {
  printf '%s\n' "$*" >> "$calls"
  case "$1 $2" in
    'volume ls') [[ "$mode" == fresh ]] || echo legacy_packages ;;
    'volume inspect')
      [[ "$3" == legacy_packages || ( "$3" == mti-alert-backend-local-packages && "$mode" == ambiguous ) ]] ;;
    'container inspect') return 1 ;;
    'ps --filter') return 0 ;;
    'ps -aq') echo legacy-relay ;;
    'run -d') printf '%s\n' "$@" > "$test_dir/relay.args" ;;
    'rm -f') return 0 ;;
    *) echo "Unexpected Docker operation: $*" >&2; return 1 ;;
  esac
}
resolve_package_storage
[[ "$BACKEND_PACKAGES_VOLUME" == legacy_packages ]]
BACKEND_PACKAGES_VOLUME=mti-alert-backend-local-packages
mode=ambiguous
if (resolve_package_storage) >"$test_dir/ambiguous.log" 2>&1; then echo 'Ambiguous storage was accepted'; exit 1; fi
grep -q 'ambiguous' "$test_dir/ambiguous.log"
PACKAGES_VOLUME_EXPLICIT=1
BACKEND_PACKAGES_VOLUME=legacy_packages
resolve_package_storage
PACKAGES_VOLUME_EXPLICIT=0
mode=fresh
BACKEND_PACKAGES_VOLUME=mti-alert-backend-local-packages
resolve_package_storage
[[ "$BACKEND_PACKAGES_VOLUME" == mti-alert-backend-local-packages ]]
# Incomplete relay setup must fail before any container mutation.
export GIT_REPO_URL=example/packages
unset AGENT_CODE_SIGNING_CERT_THUMBPRINT || true
if (configure_relay) >/dev/null 2>&1; then echo 'Incomplete relay accepted'; exit 1; fi
export AGENT_CODE_SIGNING_CERT_THUMBPRINT=1111111111111111111111111111111111111111
mkdir -p "$ROOT_DIR/secrets"
printf 'fixture-only' > "$ROOT_DIR/secrets/github-package-download-token.txt"
printf 'public-ca-fixture' > "$ROOT_DIR/secrets/package-signing-ca.pem"
configure_relay
[[ "$WITH_RELAY" == 1 ]]
BACKEND_PACKAGES_VOLUME=legacy_packages
remove_container_if_exists() { :; }
wait_for_health() { [[ "$1" == "$RELAY_CONTAINER" ]]; }
start_package_relay
grep -qx 'legacy_packages:/packages' "$test_dir/relay.args"
grep -qx 'GIT_REPO_URL' "$test_dir/relay.args"
grep -q 'github_package_download_token,readonly' "$test_dir/relay.args"
grep -q 'package_signing_ca,readonly' "$test_dir/relay.args"
grep -qx -- '--read-only' "$test_dir/relay.args"
grep -qx 'rm -f legacy-relay' "$calls"
! grep -q 'fixture-only' "$test_dir/relay.args"
! grep -Eq 'volume (rm|prune)' "$calls"
# Reject deletion of other applications when a host port is occupied.
find_docker_port_owners() { echo 'foreign-id|another-app|image|running'; }
docker() {
  [[ "$1" == inspect ]] && { echo '/some/other/project|backend'; return 0; }
  echo "Unexpected mutation $*" >&2; exit 99
}
if (remove_docker_port_owners 4019 Backend) >"$test_dir/foreign.log" 2>&1; then echo 'Unrelated container accepted'; exit 1; fi
grep -q 'refusing to remove' "$test_dir/foreign.log"
printf 'PASS: legacy volume reuse, ambiguity refusal, explicit selection, fresh deployment, relay secrets/shared mount, and unrelated-container protection. No Docker daemon used.\n'
