#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "${BASH_SOURCE[0]%/*}/.."
build=1
project=()
while (($#)); do
  case "$1" in
    --no-build) build=0; shift ;;
    --project-name) [[ $# -ge 2 && -n "$2" ]] || exit 2; project=(-p "$2"); shift 2 ;;
    --help) echo "Usage: bash scripts/redeploy-docker.sh [--no-build] [--project-name EXISTING_PROJECT]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
fail() { echo "ERROR: $*" >&2; exit 1; }
trap 'echo "Stopped at line $LINENO. Deployment may be partial; inspect compose ps before retrying. No automatic rollback or volume deletion." >&2' ERR
command -v docker >/dev/null || fail "Docker is not installed."
docker compose version >/dev/null
for file in .env secrets/github-package-download-token.txt secrets/package-signing-ca.pem; do
  [[ -r "$file" && -s "$file" ]] || fail "Missing, empty or unreadable: $file"
done
compose=(docker compose "${project[@]}" -f docker-compose.yml -f docker-compose.package-relay.yml)
# Never source .env or print expanded configuration.
"${compose[@]}" config --quiet
backend=$("${compose[@]}" ps -q backend)
frontend=$("${compose[@]}" ps -q frontend)
gateway=$("${compose[@]}" ps -q gateway)
[[ -n "$backend" && -n "$frontend" && -n "$gateway" ]] ||
  fail "Existing services not found. Use --project-name with the existing Compose project."
gateway_before=$(docker inspect --format '{{.Id}} {{.Image}} {{.State.StartedAt}}' "$gateway")
volume_before=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/backend/local-packages"}}{{.Name}}{{end}}{{end}}' "$backend")
[[ -n "$volume_before" ]] || fail "Existing package volume not found."
configured_volume=$("${compose[@]}" config --format json | docker exec -i "$backend" node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
 const c=JSON.parse(s); process.stdout.write(c.volumes.backend_local_packages.name);
});')
[[ "$configured_volume" == "$volume_before" ]] || fail "Configured package volume differs from the live volume."
echo "Preflight passed. Package volume: $volume_before"
echo "Current images for manual rollback:"
docker inspect --format '{{.Name}} {{.Image}}' "$backend" "$frontend"
if ((build)); then
  "${compose[@]}" build backend frontend package-relay
fi
"${compose[@]}" config --images | while IFS= read -r image; do docker image inspect "$image" >/dev/null; done
echo "Deploying backend and frontend..."
"${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 backend frontend
# Refresh static upstream DNS after backend/frontend replacement, without recreating gateway.
"${compose[@]}" exec -T gateway nginx -t
"${compose[@]}" exec -T gateway nginx -s reload
[[ "$(docker inspect --format '{{.Id}} {{.Image}} {{.State.StartedAt}}' "$gateway")" == "$gateway_before" ]] ||
  fail "Gateway container identity changed unexpectedly."
echo "Starting relay; published GitHub packages may now be imported."
"${compose[@]}" up -d --no-deps --no-build --pull never package-relay
"${compose[@]}" exec -T backend node -e '
const fs=require("node:fs"); const end=Date.now()+60000;
const check=()=>{
 try {
  const h=JSON.parse(fs.readFileSync("/app/backend/local-packages/.relay-heartbeat.json","utf8"));
  if(Math.abs(Date.now()-h.time*1000)<15000){ console.log("Relay heartbeat OK"); return; }
 } catch {}
 if(Date.now()>=end){console.error("Relay heartbeat missing; inspect package-relay logs.");process.exitCode=1;return;}
 setTimeout(check,2000);
}; check();'
"${compose[@]}" exec -T backend node -e '
(async()=>{
 for(const path of ["/","/api/health"]){
  const r=await fetch("http://gateway"+path,{signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw Error(path+" HTTP "+r.status);
  console.log("Gateway "+path+" HTTP "+r.status);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});'
"${compose[@]}" ps
echo "Redeploy complete. No migrations or device rollouts executed."
echo "Check Package Registry > Get from GitHub for import/signature results."
