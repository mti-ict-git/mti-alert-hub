#!/usr/bin/env bash
set -Eeuo pipefail
TEST_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
# Load definitions only. No Docker command or deployment is executed.
source <(sed '/^while (($#)); do/,$d' "$TEST_ROOT/scripts/deploy-docker.sh")
test_dir="$(mktemp -d)"
trap 'rm -rf -- "$test_dir"' EXIT
ENV_FILE="$test_dir/fixture.env"
cat > "$ENV_FILE" <<'ENV'
# Literal fixture values only; no real credentials.
LDAP_BIND_PASSWORD="a $word #hash !bang =equal `literal`"
SINGLE='single $dollar #hash'
SPACED="  preserve spaces  "
EMPTY=""
PLAIN=plain=value
DUPLICATE=first
DUPLICATE="last"
NO_EXEC="$(touch should-not-exist)"
ENV
# Exercise CRLF input and a final line without a newline.
sed 's/$/\r/' "$ENV_FILE" > "$test_dir/crlf.env"
printf 'FINAL="tail"' >> "$test_dir/crlf.env"
ENV_FILE="$test_dir/crlf.env"
load_env_file
[[ "$LDAP_BIND_PASSWORD" == 'a $word #hash !bang =equal `literal`' ]]
[[ "$SINGLE" == 'single $dollar #hash' ]]
[[ "$SPACED" == '  preserve spaces  ' ]]
[[ "$EMPTY" == '' && "$PLAIN" == 'plain=value' && "$DUPLICATE" == last && "$FINAL" == tail ]]
[[ "$NO_EXEC" == '$(touch should-not-exist)' ]]
[[ "${#DOCKER_ENV_ARGS[@]}" == 18 ]]

# Both real launch functions must pass names only and inherit parsed values.
calls=0
docker() {
  [[ "$1" == run ]] || return 1
  calls=$((calls + 1))
  local previous='' arg seen=0
  for arg in "$@"; do
    [[ "$arg" != --env-file && "$arg" != "$LDAP_BIND_PASSWORD" ]]
    if [[ "$previous" == --env ]]; then
      [[ "$arg" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]
      [[ -v "$arg" ]]
      seen=$((seen + 1))
    fi
    previous="$arg"
  done
  [[ "$seen" == 9 ]]
  [[ "$(printenv LDAP_BIND_PASSWORD)" == 'a $word #hash !bang =equal `literal`' ]]
  [[ "$(printenv DUPLICATE)" == last ]]
}
ensure_volume() { :; }
remove_container_if_exists() { :; }
remove_docker_port_owners() { :; }
ensure_host_port_available() { :; }
wait_for_health() { :; }
RUNTIME_POSTGRES_URL='postgresql://fixture'
run_migrations
start_backend
[[ "$calls" == 2 ]]
printf 'BAD-NAME=value\n' > "$test_dir/invalid.env"
if (ENV_FILE="$test_dir/invalid.env"; load_env_file) >/dev/null 2>&1; then
  echo 'Invalid variable name was accepted' >&2
  exit 1
fi
printf 'PASS: parsed environment preserved in migration/backend launches; quotes, literals, spaces, empty values, CRLF, duplicate keys and invalid names checked. No Docker daemon used.\n'
