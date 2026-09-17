#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"
ACTION="deploy"
WITH_POSTGRES=0
BUILD_IMAGES=1
FOLLOW_LOGS=0
TAIL_LINES=200

NETWORK_NAME="mti-alert-network"
BACKEND_IMAGE="mti-alert-backend:local"
FRONTEND_IMAGE="mti-alert-frontend:local"
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

usage() {
  cat <<'EOF'
Usage:
  bash scripts/deploy-docker.sh [deploy] [options]
  bash scripts/deploy-docker.sh <status|logs|stop|destroy> [options]

Options:
  --env-file PATH        Use a custom Docker env file. Default: .env.docker
  --with-postgres        Start a local PostgreSQL container and point backend to it
  --no-build             Reuse existing backend and frontend images
  --follow               Follow logs after deploy or logs command
  --tail N               Number of log lines for logs command. Default: 200
  --help                 Show this help

Examples:
  bash scripts/deploy-docker.sh
  bash scripts/deploy-docker.sh --with-postgres
  bash scripts/deploy-docker.sh status
  bash scripts/deploy-docker.sh logs --follow
  bash scripts/deploy-docker.sh destroy --with-postgres
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_env_file() {
  [[ -f "$ENV_FILE" ]] || fail "Env file not found: $ENV_FILE"

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$(trim "$line")" ]] && continue
    [[ "$(trim "$line")" == \#* ]] && continue
    [[ "$line" == *=* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"
    key="$(trim "$key")"
    value="$(trim "$value")"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
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

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
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
}

start_postgres() {
  ensure_volume "$POSTGRES_DATA_VOLUME"
  remove_container_if_exists "$POSTGRES_CONTAINER"

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
    --env-file "$ENV_FILE" \
    -e "POSTGRES_URL=$RUNTIME_POSTGRES_URL" \
    "$BACKEND_IMAGE" \
    sh -lc 'node backend/dist/scripts/run-migrations.js up'
}

start_backend() {
  ensure_volume "$BACKEND_PACKAGES_VOLUME"
  remove_container_if_exists "$BACKEND_CONTAINER"

  echo "Starting backend container..."
  docker run -d \
    --name "$BACKEND_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias backend \
    --env-file "$ENV_FILE" \
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
  - $FRONTEND_CONTAINER
  - $GATEWAY_CONTAINER$( (( WITH_POSTGRES )) && printf '\n  - %s' "$POSTGRES_CONTAINER" )

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
  ensure_network

  if (( BUILD_IMAGES )); then
    build_images
  else
    docker image inspect "$BACKEND_IMAGE" >/dev/null 2>&1 || fail "Backend image not found: $BACKEND_IMAGE"
    docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1 || fail "Frontend image not found: $FRONTEND_IMAGE"
  fi

  if (( WITH_POSTGRES )); then
    start_postgres
  fi

  RUNTIME_POSTGRES_URL="$(runtime_postgres_url)"
  [[ -n "$RUNTIME_POSTGRES_URL" ]] || fail "POSTGRES_URL is required when --with-postgres is not used."

  run_migrations
  start_backend
  start_frontend
  start_gateway
  status
  print_access_summary

  if (( FOLLOW_LOGS )); then
    logs
  fi
}

status() {
  local containers=("$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" "$GATEWAY_CONTAINER")
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
  local containers=("$BACKEND_CONTAINER" "$FRONTEND_CONTAINER" "$GATEWAY_CONTAINER")
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
  local containers=("$GATEWAY_CONTAINER" "$FRONTEND_CONTAINER" "$BACKEND_CONTAINER")
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
      shift 2
      ;;
    --with-postgres)
      WITH_POSTGRES=1
      shift
      ;;
    --no-build)
      BUILD_IMAGES=0
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
