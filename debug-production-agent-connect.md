# [OPEN] Debug Session: production-agent-connect

## Summary
- Symptom: Windows Agent `1.0.8` already shows production host in tray UI, but it still cannot complete first sync against production and remains in `Needs attention` / `Waiting for first sync`.
- Expected: after reinstalling the production-built MSI, the installed agent should complete `POST /agent/session`, continue to heartbeat/message sync, and appear `Online` on production.

## Hypotheses
1. TLS or certificate validation fails on the first agent request to the production host.
2. Public gateway routing for `/agent/*` is incomplete or points to the wrong backend service.
3. Agent session bootstrap fails server-side even though DNS/connectivity is fine.
4. Production backend public URL/proxy configuration causes agent follow-up URLs or headers to be incorrect.
5. Runtime agent log already contains the actual failure, but the tray UI only surfaces a generic degraded state.

## Evidence Plan
- Inspect installed runtime logs for the latest production startup attempt.
- Probe production agent endpoints from the local machine to separate client-side TLS/network issues from server-side routing/auth issues.
- Inspect production-side backend/gateway configuration only if the client evidence points to an upstream failure.

## Status
- Awaiting first runtime evidence collection.
