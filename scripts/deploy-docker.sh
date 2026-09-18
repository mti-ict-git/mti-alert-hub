#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE=""
ENV_FILE_EXPLICIT=0
ACTION="deploy"
WITH_POSTGRES=0
BUILD_IMAGES=1
SKIP_MIGRATIONS=0
FOLLOW_LOGS=0
TAIL_LINES=200

NETWORK_NAME="mti-alert-network"
BACKEND_IMAGE="mti-alert-backend:local"
FRONTEND_IMAGE="mti-alert-frontend:local"
RELAY_IMAGE="mti-alert-package-relay:local"
RELAY_CONTAINER="mti-alert-package-relay"
WITH_RELAY=0
WITHOUT_RELAY=0
PACKAGES_VOLUME_EXPLICIT=0
POSTGRES_IMAGE="postgres:16-alpine"
GATEWAY_IMAGE="nginx:1.27-alpine"
BACKEND_INTERNAL_PORT="4019"
FRONTEND_INTERNAL_PORT="8080"

BACKEND_CONTAINER="mti-alert-backend"
FRONTEND_CONTAINER="mti-alert-frontend"
GATEWAY_CONTAINER="mti-alert-gateway"
POSTGRES_CONTAINER="mti-alert-postgres"

BACKEND_PACKAGES_VOLUME="mti-alert-backend-local-packages"
POSTGRES_DATA_VOLUME="mti-alert-postgres-data"

RUNTIME_POSTGRES_URL=""
DOCKER_ENV_ARGS=()

usage() {
  cat <<'EOF'
Usage:
  bash scripts/deploy-docker.sh [deploy] [options]
  bash scripts/deploy-docker.sh <status|logs|stop|destroy> [options]

Options:
  --env-file PATH        Use a custom Docker env file
  --with-postgres        Start a local PostgreSQL container and point backend to it
  --packages-volume NAME Reuse this existing package volume (required when discovery is ambiguous)
  --without-package-relay Explicitly disable GitHub relay for this deployment
  --no-build             Reuse existing backend, frontend and enabled relay images
  --skip-migrations      Skip backend migrations before container startup
  --follow               Follow logs after deploy or logs command
  --tail N               Number of log lines for logs command. Default: 200
  --help                 Show this help

Examples:
  bash scripts/deploy-docker.sh
  bash scripts/deploy-docker.sh --with-postgres
  bash scripts/deploy-docker.sh --skip-migrations
  bash scripts/deploy-docker.sh status
  bash scripts/deploy-docker.sh logs --follow
  bash scripts/deploy-docker.sh destroy --with-postgres
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

resolve_default_env_file() {
  local candidates=(
    "$ROOT_DIR/.env.docker"
    "$ROOT_DIR/.env"
    "$HOME/.env.docker"
    "$HOME/.env"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      ENV_FILE="$candidate"
      return 0
    fi
  done

  fail "No env file found. Checked: ${candidates[*]}. Use --env-file PATH if your env lives elsewhere."
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_env_file() {
  [[ -f "$ENV_FILE" ]] || fail "Env file not found: $ENV_FILE"

  DOCKER_ENV_ARGS=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$(trim "$line")" ]] && continue
    [[ "$(trim "$line")" == \#* ]] && continue
    [[ "$line" == *=* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"
    key="$(trim "$key")"
    value="$(trim "$value")"
    [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "Invalid environment variable name in env file."

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
    # Pass names only: Docker inherits the parsed values from this process.
    # Raw --env-file would retain dotenv wrapping quotes in passwords.
    DOCKER_ENV_ARGS+=(--env "$key")
  done <"$ENV_FILE"
}

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "Docker is not installed or not in PATH."
  docker info >/dev/null 2>&1 || fail "Docker daemon is not reachable."
}

validate_runtime_config() {
  if [[ -n "${BACKEND_PORT:-}" && "${BACKEND_PORT}" != "$BACKEND_INTERNAL_PORT" ]]; then
    fail "BACKEND_PORT must remain $BACKEND_INTERNAL_PORT for scripts/deploy-docker.sh because the nginx gateway targets backend:$BACKEND_INTERNAL_PORT."
  fi

  if [[ -n "${FRONTEND_PORT:-}" && "${FRONTEND_PORT}" != "$FRONTEND_INTERNAL_PORT" ]]; then
    fail "FRONTEND_PORT must remain $FRONTEND_INTERNAL_PORT for scripts/deploy-docker.sh because the nginx gateway targets frontend:$FRONTEND_INTERNAL_PORT."
  fi
}

# Resolve storage before removing containers or creating an empty replacement volume.
resolve_package_storage() {
  local candidates=() compose_candidates=() volume owner mount_type mount_name mount_source
  if (( PACKAGES_VOLUME_EXPLICIT )); then
    docker volume inspect "$BACKEND_PACKAGES_VOLUME" >/dev/null 2>&1 || fail "Selected package volume does not exist: $BACKEND_PACKAGES_VOLUME"
    echo "Reusing selected package volume: $BACKEND_PACKAGES_VOLUME"
    return
  fi
  while IFS= read -r volume; do
    [[ -n "$volume" ]] || continue
    compose_candidates+=("$volume")
    candidates+=("$volume")
  done < <(docker volume ls --filter label=com.docker.compose.volume=backend_local_packages --format '{{.Name}}')
  if docker volume inspect "$BACKEND_PACKAGES_VOLUME" >/dev/null 2>&1; then
    candidates+=("$BACKEND_PACKAGES_VOLUME")
  fi
  # Include current/legacy backend mounts, even if the volume has no Compose label.
  local owners=("$BACKEND_CONTAINER")
  while IFS='|' read -r owner _; do
    [[ -n "$owner" ]] && owners+=("$owner")
  done < <(find_docker_port_owners "${BACKEND_HOST_PORT:-4019}")
  for owner in "${owners[@]}"; do
    container_exists "$owner" || continue
    while IFS='|' read -r mount_type mount_name mount_source; do
      [[ -n "$mount_type" ]] || continue
      [[ "$mount_type" == volume ]] || fail "Existing backend uses a bind mount at $mount_source. Preserve this storage and migrate it explicitly before using this script."
      candidates+=("$mount_name")
    done < <(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/backend/local-packages"}}{{.Type}}|{{.Name}}|{{.Source}}{{println}}{{end}}{{end}}' "$owner")
  done
  local unique=()
  while IFS= read -r volume; do
    [[ -n "$volume" ]] && unique+=("$volume")
  done < <(printf '%s\n' "${candidates[@]}" | sort -u)
  local unique_compose=()
  while IFS= read -r volume; do
    [[ -n "$volume" ]] && unique_compose+=("$volume")
  done < <(printf '%s\n' "${compose_candidates[@]}" | sort -u)
  if (( ${#unique[@]} > 1 )); then
    if (( ${#unique_compose[@]} == 1 )); then
      BACKEND_PACKAGES_VOLUME="${unique_compose[0]}"
      echo "Package storage: $BACKEND_PACKAGES_VOLUME (auto-selected Compose-compatible volume)"
      return
    fi
    printf 'Existing package volume candidates: %s\n' "${unique[@]}" >&2
    fail "Package storage is ambiguous. Inspect these volumes and rerun with --packages-volume NAME. No volumes were merged, copied or deleted."
  fi
  if (( ${#unique[@]} == 1 )); then BACKEND_PACKAGES_VOLUME="${unique[0]}"; fi
  echo "Package storage: $BACKEND_PACKAGES_VOLUME"
}

configure_relay() {
  (( WITHOUT_RELAY )) && return 0
  if [[ -n "${GIT_REPO_URL:-}" || -n "${AGENT_CODE_SIGNING_CERT_THUMBPRINT:-}" || -e "$ROOT_DIR/secrets/github-package-download-token.txt" ]]; then
    [[ -n "${GIT_REPO_URL:-}" ]] || fail "GitHub relay requires GIT_REPO_URL."
    local signer="${AGENT_CODE_SIGNING_CERT_THUMBPRINT:-}"
    [[ "${signer// /}" =~ ^[a-fA-F0-9]{40}$ ]] || fail "GitHub relay requires the existing AGENT_CODE_SIGNING_CERT_THUMBPRINT."
    [[ -s "$ROOT_DIR/secrets/github-package-download-token.txt" ]] || fail "GitHub relay download token file is missing or empty."
    [[ -s "$ROOT_DIR/secrets/package-signing-ca.pem" ]] || fail "GitHub relay public signing CA file is missing or empty."
    WITH_RELAY=1
  fi
  if (( !WITH_RELAY )); then echo "GitHub relay is not configured; it will not be started."; fi
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

find_docker_port_owners() {
  local port="$1"
  docker ps --filter "publish=$port" --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}'
}

remove_docker_port_owners() {
  local port="$1"
  local label="$2"
  local owners
  owners="$(find_docker_port_owners "$port")"

  [[ -n "$owners" ]] || return 0

  # Never remove unrelated applications just because they use the requested port.
  local expected_service="${label,,}" expected_name
  case "$expected_service" in
    backend) expected_name="$BACKEND_CONTAINER" ;;
    gateway) expected_name="$GATEWAY_CONTAINER" ;;
    postgresql) expected_service=postgres; expected_name="$POSTGRES_CONTAINER" ;;
    *) fail "Unknown port owner role: $label" ;;
  esac
  while IFS='|' read -r container_id container_name image_name status_text; do
    [[ -n "$container_id" ]] || continue
    [[ "$container_name" == "$expected_name" ]] && continue
    local identity
    identity="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}|{{index .Config.Labels "com.docker.compose.service"}}' "$container_id")"
    [[ "$identity" == "$ROOT_DIR|$expected_service" ]] || fail "Port $port belongs to unrelated container $container_name; refusing to remove it."
  done <<<"$owners"

  echo "Replacing existing Docker port owner(s) for $label host port $port..."
  while IFS='|' read -r container_id container_name image_name status_text; do
    [[ -n "$container_id" ]] || continue
    echo "  - removing $container_name ($image_name, $status_text)"
    docker rm -f "$container_id" >/dev/null
  done <<<"$owners"
}

port_in_use() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" 2>/dev/null | grep -q ":$port "
    return $?
  fi

  return 1
}

print_port_owner_hint() {
  local port="$1"
  local printed=0

  if docker ps --format '{{.Names}}|{{.Ports}}' | grep -F ":$port->" >/dev/null 2>&1; then
    echo "Docker containers using host port $port:" >&2
    docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | grep -E "(^NAMES|:$port->)" >&2 || true
    printed=1
  fi

  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    if (( !printed )); then
      echo "Processes listening on host port $port:" >&2
    else
      echo "Additional host listeners on port $port:" >&2
    fi
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    printed=1
  elif command -v ss >/dev/null 2>&1 && ss -ltnp "( sport = :$port )" >/dev/null 2>&1; then
    if (( !printed )); then
      echo "Processes listening on host port $port:" >&2
    else
      echo "Additional host listeners on port $port:" >&2
    fi
    ss -ltnp "( sport = :$port )" >&2 || true
    printed=1
  fi

  if (( !printed )); then
    echo "Host port $port appears busy, but no owner details were available from docker/lsof/ss." >&2
  fi
}

ensure_host_port_available() {
  local port="$1"
  local label="$2"

  if port_in_use "$port"; then
    print_port_owner_hint "$port"
    fail "$label host port $port is already allocated. Stop the existing service or change the host port in your env file."
  fi
}

remove_container_if_exists() {
  local name="$1"
  if container_exists "$name"; then
    docker rm -f "$name" >/dev/null
  fi
}

ensure_network() {
  docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 || docker network create "$NETWORK_NAME" >/dev/null
}

ensure_volume() {
  docker volume inspect "$1" >/dev/null 2>&1 || docker volume create "$1" >/dev/null
}

wait_for_health() {
  local container_name="$1"
  local timeout_seconds="${2:-180}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"

    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      return 0
    fi

    if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
      docker logs --tail 100 "$container_name" >&2 || true
      fail "Container $container_name did not become healthy."
    fi

    if (( "$(date +%s)" - started_at >= timeout_seconds )); then
      docker logs --tail 100 "$container_name" >&2 || true
      fail "Timed out waiting for $container_name to become healthy."
    fi

    sleep 2
  done
}

runtime_postgres_url() {
  if (( WITH_POSTGRES )); then
    printf 'postgresql://%s:%s@postgres:5432/%s' \
      "${POSTGRES_USER:-postgres}" \
      "${POSTGRES_PASSWORD:-postgres}" \
      "${POSTGRES_DB:-ictMTIAlertHub}"
  else
    printf '%s' "${POSTGRES_URL:-}"
  fi
}

build_images() {
  echo "Building backend image..."
  docker build \
    -t "$BACKEND_IMAGE" \
    -f "$ROOT_DIR/Dockerfile.backend" \
    "$ROOT_DIR"

  echo "Building frontend image..."
  docker build \
    -t "$FRONTEND_IMAGE" \
    --build-arg "VITE_API_URL=${DOCKER_VITE_API_URL:-/api}" \
    --build-arg "VITE_ENABLED_DELIVERY_CHANNELS=${VITE_ENABLED_DELIVERY_CHANNELS:-DesktopAgent}" \
    -f "$ROOT_DIR/Dockerfile.frontend" \
    "$ROOT_DIR"
  if (( WITH_RELAY )); then
    echo "Building GitHub package relay image..."
    docker build -t "$RELAY_IMAGE" -f "$ROOT_DIR/docker/package-relay/Dockerfile" "$ROOT_DIR"
  fi
}

start_postgres() {
  ensure_volume "$POSTGRES_DATA_VOLUME"
  remove_container_if_exists "$POSTGRES_CONTAINER"
  remove_docker_port_owners "${POSTGRES_HOST_PORT:-5432}" "PostgreSQL"
  ensure_host_port_available "${POSTGRES_HOST_PORT:-5432}" "PostgreSQL"

  echo "Starting PostgreSQL container..."
  docker run -d \
    --name "$POSTGRES_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias postgres \
    -e "POSTGRES_USER=${POSTGRES_USER:-postgres}" \
    -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}" \
    -e "POSTGRES_DB=${POSTGRES_DB:-ictMTIAlertHub}" \
    -p "${POSTGRES_HOST_PORT:-5432}:5432" \
    -v "${POSTGRES_DATA_VOLUME}:/var/lib/postgresql/data" \
    --health-cmd 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' \
    --health-interval 10s \
    --health-timeout 5s \
    --health-retries 10 \
    "$POSTGRES_IMAGE" >/dev/null

  wait_for_health "$POSTGRES_CONTAINER" 180
}

run_migrations() {
  local migration_container="${BACKEND_CONTAINER}-migrate"
  remove_container_if_exists "$migration_container"

  echo "Running backend migrations..."
  docker run --rm \
    --name "$migration_container" \
    --network "$NETWORK_NAME" \
    "${DOCKER_ENV_ARGS[@]}" \
    -e "POSTGRES_URL=$RUNTIME_POSTGRES_URL" \
    "$BACKEND_IMAGE" \
    sh -lc 'node backend/dist/scripts/run-migrations.js up'
}

start_backend() {
  ensure_volume "$BACKEND_PACKAGES_VOLUME"
  remove_container_if_exists "$BACKEND_CONTAINER"
  remove_docker_port_owners "${BACKEND_HOST_PORT:-4019}" "Backend"
  ensure_host_port_available "${BACKEND_HOST_PORT:-4019}" "Backend"

  echo "Starting backend container..."
  docker run -d \
    --name "$BACKEND_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias backend \
    "${DOCKER_ENV_ARGS[@]}" \
    -e "POSTGRES_URL=$RUNTIME_POSTGRES_URL" \
    -e "BACKEND_PORT=$BACKEND_INTERNAL_PORT" \
    -p "${BACKEND_HOST_PORT:-4019}:${BACKEND_INTERNAL_PORT}" \
    -v "${BACKEND_PACKAGES_VOLUME}:/app/backend/local-packages" \
    --health-cmd "node -e \"fetch('http://127.0.0.1:$BACKEND_INTERNAL_PORT/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))\"" \
    --health-interval 15s \
    --health-timeout 5s \
    --health-retries 10 \
    "$BACKEND_IMAGE" >/dev/null

  wait_for_health "$BACKEND_CONTAINER" 180
}

start_package_relay() {
  (( WITH_RELAY )) || return 0
  # Stop only Compose relay containers using the selected shared package volume.
  local old_relay
  while IFS= read -r old_relay; do
    [[ -n "$old_relay" ]] && docker rm -f "$old_relay" >/dev/null
  done < <(docker ps -aq --filter "volume=$BACKEND_PACKAGES_VOLUME" --filter label=com.docker.compose.service=package-relay)
  remove_container_if_exists "$RELAY_CONTAINER"
  echo "Starting GitHub package relay on shared volume $BACKEND_PACKAGES_VOLUME..."
  docker run -d --name "$RELAY_CONTAINER" --restart unless-stopped \
    --network "$NETWORK_NAME" --read-only --cap-drop ALL \
    --security-opt no-new-privileges:true --tmpfs /tmp \
    --env GIT_REPO_URL \
    -e "PACKAGE_SIGNER_THUMBPRINT=${AGENT_CODE_SIGNING_CERT_THUMBPRINT}" \
    -e PACKAGE_POLL_SECONDS=120 \
    --mount "type=bind,src=$ROOT_DIR/secrets/github-package-download-token.txt,dst=/run/secrets/github_package_download_token,readonly" \
    --mount "type=bind,src=$ROOT_DIR/secrets/package-signing-ca.pem,dst=/run/secrets/package_signing_ca,readonly" \
    -v "$BACKEND_PACKAGES_VOLUME:/packages" \
    --health-cmd "python -c \"import json,time; from pathlib import Path; assert time.time()-json.loads(Path('/packages/.relay-heartbeat.json').read_text())['time'] < 90\"" \
    --health-interval 15s --health-timeout 5s --health-retries 6 \
    "$RELAY_IMAGE" >/dev/null
  wait_for_health "$RELAY_CONTAINER" 120
}

start_frontend() {
  remove_container_if_exists "$FRONTEND_CONTAINER"

  echo "Starting frontend container..."
  docker run -d \
    --name "$FRONTEND_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias frontend \
    -e HOST=0.0.0.0 \
    -e "PORT=$FRONTEND_INTERNAL_PORT" \
    -e NITRO_HOST=0.0.0.0 \
    -e "NITRO_PORT=$FRONTEND_INTERNAL_PORT" \
    --health-cmd "node -e \"fetch('http://127.0.0.1:$FRONTEND_INTERNAL_PORT/favicon.ico').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))\"" \
    --health-interval 15s \
    --health-timeout 5s \
    --health-retries 10 \
    "$FRONTEND_IMAGE" >/dev/null

  wait_for_health "$FRONTEND_CONTAINER" 180
}

start_gateway() {
  local gateway_config="$ROOT_DIR/docker/nginx.admin-gateway.conf"
  [[ -f "$gateway_config" ]] || fail "Gateway config not found: $gateway_config"
  remove_container_if_exists "$GATEWAY_CONTAINER"
  remove_docker_port_owners "${FRONTEND_HOST_PORT:-8080}" "Gateway"
  ensure_host_port_available "${FRONTEND_HOST_PORT:-8080}" "Gateway"

  echo "Starting gateway container..."
  docker run -d \
    --name "$GATEWAY_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias gateway \
    -p "${FRONTEND_HOST_PORT:-8080}:80" \
    -v "${gateway_config}:/etc/nginx/conf.d/default.conf:ro" \
    --health-cmd "wget -q -O /dev/null http://127.0.0.1/ || exit 1" \
    --health-interval 15s \
    --health-timeout 5s \
    --health-retries 10 \
    "$GATEWAY_IMAGE" >/dev/null

  wait_for_health "$GATEWAY_CONTAINER" 60
}

print_access_summary() {
  cat <<EOF
Deployment finished.

Containers:
  - $BACKEND_CONTAINER
  - $RELAY_CONTAINER (enabled: $WITH_RELAY)
  - $FRONTEND_CONTAINER
  - $GATEWAY_CONTAINER$( (( WITH_POSTGRES )) && printf '\n  - %s' "$POSTGRES_CONTAINER" )

Package storage: $BACKEND_PACKAGES_VOLUME

Access:
  - Admin gateway: http://localhost:${FRONTEND_HOST_PORT:-8080}
  - Backend API:   http://localhost:${BACKEND_HOST_PORT:-4019}
$( (( WITH_POSTGRES )) && printf '  - PostgreSQL:    localhost:%s\n' "${POSTGRES_HOST_PORT:-5432}" )

Useful commands:
  - bash scripts/deploy-docker.sh status
  - bash scripts/deploy-docker.sh logs --follow
  - bash scripts/deploy-docker.sh stop$( (( WITH_POSTGRES )) && printf ' --with-postgres' )
EOF
}

deploy() {
  resolve_package_storage
  configure_relay
  ensure_network

  if (( BUILD_IMAGES )); then
    build_images
  else
    docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1 || fail "Backend image not found: $BACKEND_IMAGE"
    docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1 || fail "Frontend image not found: $FRONTEND_IMAGE"
    if (( WITH_RELAY )); then docker image inspect "$RELAY_IMAGE" >/dev/null 2>&1 || fail "Relay image missing; rerun without --no-build."; fi
  fi

  if (( WITH_POSTGRES )); then
    start_postgres
  fi

  RUNTIME_POSTGRES_URL="$(runtime_postgres_url)"
  [[ -n "$RUNTIME_POSTGRES_URL" ]] || fail "POSTGRES_URL is required when --with-postgres is not used."

  if (( SKIP_MIGRATIONS )); then
    echo "Skipping backend migrations (--skip-migrations)."
  else
    run_migrations
  fi
  start_backend
  start_package_relay
  start_frontend
  start_gateway
  status
  print_access_summary

  if (( FOLLOW_LOGS )); then
    logs
  fi
}

status() {
  local containers=("$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" "$GATEWAY_CONTAINER" "$RELAY_CONTAINER")
  if (( WITH_POSTGRES )); then
    containers+=("$POSTGRES_CONTAINER")
  fi

  echo "Container status:"
  for container in "${containers[@]}"; do
    if container_exists "$container"; then
      docker ps -a --filter "name=^/${container}$" --format '{{.Names}} | {{.Status}} | {{.Ports}}'
    else
      echo "$container | not-created"
    fi
  done
}

logs() {
  local containers=("$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" "$GATEWAY_CONTAINER" "$RELAY_CONTAINER")
  if (( WITH_POSTGRES )); then
    containers+=("$POSTGRES_CONTAINER")
  fi

  for container in "${containers[@]}"; do
    if container_exists "$container"; then
      echo "===== $container ====="
      docker logs --tail "$TAIL_LINES" "$container" || true
    fi
  done

  if (( FOLLOW_LOGS )); then
    local follow_targets=()
    local pids=()
    for container in "${containers[@]}"; do
      if container_exists "$container"; then
        follow_targets+=("$container")
      fi
    done
    (( ${#follow_targets[@]} > 0 )) || fail "No running containers available to follow."
    trap 'for pid in "${pids[@]}"; do kill "$pid" >/dev/null 2>&1 || true; done' INT TERM EXIT
    for container in "${follow_targets[@]}"; do
      (
        docker logs -f "$container" 2>&1 | while IFS= read -r line; do
          printf '[%s] %s\n' "$container" "$line"
        done
      ) &
      pids+=("$!")
    done
    wait "${pids[@]}"
  fi
}

stop() {
  local containers=("$GATEWAY_CONTAINER" "$FRONTEND_CONTAINER" "$RELAY_CONTAINER" "$BACKEND_CONTAINER")
  if (( WITH_POSTGRES )); then
    containers+=("$POSTGRES_CONTAINER")
  fi

  for container in "${containers[@]}"; do
    if container_exists "$container"; then
      echo "Stopping $container..."
      docker rm -f "$container" >/dev/null
    fi
  done
}

destroy() {
  stop

  if (( WITH_POSTGRES )); then
    if docker volume inspect "$POSTGRES_DATA_VOLUME" >/dev/null 2>&1; then
      echo "Removing volume $POSTGRES_DATA_VOLUME..."
      docker volume rm "$POSTGRES_DATA_VOLUME" >/dev/null
    fi
  fi

  if docker volume inspect "$BACKEND_PACKAGES_VOLUME" >/dev/null 2>&1; then
    echo "Keeping volume $BACKEND_PACKAGES_VOLUME for uploaded rollout packages."
  fi
}

while (($#)); do
  case "$1" in
    deploy|status|logs|stop|destroy)
      ACTION="$1"
      shift
      ;;
    --env-file)
      [[ $# -ge 2 ]] || fail "--env-file requires a path."
      if [[ "$2" = /* ]]; then
        ENV_FILE="$2"
      else
        ENV_FILE="$ROOT_DIR/$2"
      fi
      ENV_FILE_EXPLICIT=1
      shift 2
      ;;
    --with-postgres)
      WITH_POSTGRES=1
      shift
      ;;
    --packages-volume)
      [[ $# -ge 2 && -n "$2" && "$2" != -* ]] || fail "--packages-volume requires an existing volume name."
      BACKEND_PACKAGES_VOLUME="$2"
      PACKAGES_VOLUME_EXPLICIT=1
      shift 2
      ;;
    --without-package-relay)
      WITHOUT_RELAY=1
      shift
      ;;
    --no-build)
      BUILD_IMAGES=0
      shift
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=1
      shift
      ;;
    --follow)
      FOLLOW_LOGS=1
      shift
      ;;
    --tail)
      [[ $# -ge 2 ]] || fail "--tail requires a numeric value."
      TAIL_LINES="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

if (( !ENV_FILE_EXPLICIT )); then
  resolve_default_env_file
fi

require_docker
load_env_file
validate_runtime_config

case "$ACTION" in
  deploy) deploy ;;
  status) status ;;
  logs) logs ;;
  stop) stop ;;
  destroy) destroy ;;
  *) fail "Unsupported action: $ACTION" ;;
esac
