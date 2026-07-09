# MTI Alert Windows Agent Integration Checklist

## Document Status
- Version: `0.1`
- Status: `Working Integration Checklist`
- Last Updated: `2026-07-09`
- Audience: `Windows Agent Engineers`, `Backend Engineers`, `QA`

## Purpose
This document defines the minimum practical checklist for integrating the Windows Agent client with the current MTI Alert server baseline.

It is intentionally operational:
- what to implement first
- which endpoint to call
- what response shape to expect
- what counts as success
- what can wait until later

## Source Of Truth
This checklist is derived from:
- `docs/windows-agent-client-specification.md`
- `docs/openapi.yaml`
- `docs/implementation-roadmap.md`
- `docs/go-live-checklist.md`

If there is a conflict, follow:
1. `docs/openapi.yaml`
2. `docs/windows-agent-client-specification.md`
3. this checklist

## Current Start Point
The Windows Agent client may begin real integration testing now.

The current server baseline is already ready for the first client-server loop:
- device session creation
- realtime negotiation
- `SSE` stream connection
- heartbeat
- pending message reconciliation
- publish-triggered push notification
- reconnect recovery

The client engineer does **not** need to wait for:
- WhatsApp delivery
- dashboards or reporting endpoints
- richer analytics
- a transport beyond the current `SSE` baseline

## Integration Order
Implement and test in this order:
1. stable local `deviceIdentifier`
2. agent session creation
3. realtime negotiation
4. `SSE` stream handling
5. heartbeat loop
6. startup reconciliation
7. reconnect recovery
8. basic message rendering
9. `Displayed` reporting
10. `Read` reporting
11. workflow response submission
12. reminder policy sync

## Step 1: Device Identity
### Goal
Persist a stable local `deviceIdentifier` and reuse it across restart.

### Client Action
- Load local device identity from SQLite or local config.
- If absent, generate it once and persist it.
- Keep `hostname` as metadata only.

### Success Criteria
- The same `deviceIdentifier` is reused after app restart.
- The client never generates a new identifier during normal reconnect.

## Step 2: Create Agent Session
### Endpoint
- `POST /agent/session`

### Minimum Request
```json
{
  "deviceIdentifier": "device-mti-ops-01",
  "agentVersion": "0.1.0",
  "activeUserIdentifier": "optional-user",
  "hostname": "OPS-PC-01"
}
```

### Expected Response
- `200 OK`
- response contains:
- `sessionToken`
- `expiresAt` nullable
- `device`

### What To Store
- `sessionToken`
- returned device metadata
- current `deviceIdentifier`

### Success Criteria
- The server accepts the known device.
- The client can reuse the returned `sessionToken` for the next agent calls.

## Step 3: Negotiate Realtime
### Endpoint
- `POST /agent/realtime/negotiate`

### Headers
- `Authorization: Bearer <sessionToken>`

### Minimum Request
```json
{
  "deviceIdentifier": "device-mti-ops-01"
}
```

### Expected Response
- `200 OK`
- response contains:
- `connectionUrl`
- `accessToken`
- `connectionId`
- `transport = SSE`

### Success Criteria
- The client receives a valid `connectionUrl`.
- The client records `connectionId`.
- The client does not assume any transport other than the returned one.

## Step 4: Open The SSE Stream
### Endpoint
- `GET /agent/realtime-hub`

### Headers
- `Authorization: Bearer <sessionToken>`

### Query
- `connectionId`
- `deviceIdentifier`

### Expected Stream Behavior
- initial comment frame may arrive first
- then event `connected`
- then event `messages.snapshot`

### Minimum Client Behavior
- parse `text/event-stream`
- ignore keepalive comments
- parse event name and JSON payload
- keep the stream open

### Success Criteria
- The client opens the stream successfully.
- The client receives `connected`.
- The client receives `messages.snapshot`.

## Step 5: Start Heartbeat
### Endpoint
- `POST /agent/heartbeat`

### Headers
- `Authorization: Bearer <sessionToken>`

### Minimum Request
```json
{
  "deviceIdentifier": "device-mti-ops-01",
  "heartbeatAt": "2026-07-09T10:00:00.000Z",
  "status": "Online",
  "activeUserIdentifier": "optional-user"
}
```

### Expected Response
- `204 No Content`

### Success Criteria
- Heartbeat is accepted repeatedly.
- The client can keep sending heartbeat while the stream is active.
- The client can still send heartbeat after realtime reconnect.

## Step 6: Startup Reconciliation
### Endpoint
- `GET /agent/messages`

### Headers
- `Authorization: Bearer <sessionToken>`

### Expected Response
- `200 OK`
- response contains:
- `items`
- `nextCursor` nullable

### Expected Item Fields
- `messageId`
- `communicationId`
- `title`
- `body`
- `priority`
- `windowsAgentPresentation`
- `requiresResponse`
- `templateVersion` nullable
- `workflow` nullable
- `criticalBehaviorMode` nullable

### Success Criteria
- The client can process an empty list safely.
- The client can load pending messages during startup even before any new realtime push arrives.

## Step 7: Reconnect Recovery
### Required Rule
- After disconnect, negotiate again.
- Do not reuse the old `connectionId`.

### Reconnect Sequence
1. detect stream disconnect
2. keep session token if still valid
3. call `POST /agent/realtime/negotiate` again
4. open a new `SSE` stream
5. wait for `connected`
6. process `messages.snapshot`
7. call `GET /agent/messages`

### Success Criteria
- Reconnect returns a fresh `connectionId`.
- The client can recover the same pending communication after reconnect.
- The client does not depend only on realtime for recovery.

## Step 8: Publish-Push Test
### Setup
- Ask the backend or admin operator to publish a Windows Agent-targeted communication to the target device.

### Expected Stream Event
- `messages.available`

### Expected Client Behavior
- treat this event as a refresh signal
- ingest payload if needed
- reconcile current pending messages
- deduplicate locally if the same active set appears again

### Success Criteria
- The client receives `messages.available` while connected.
- The same communication becomes available through reconciliation.

## Step 9: Basic Rendering
### Input Fields To Honor
- `priority`
- `windowsAgentPresentation`
- `requiresResponse`
- `workflow`
- `criticalBehaviorMode`

### Minimum Rendering Rules
- `Toast` renders as lightweight notification
- `Modal` renders as blocking interaction surface
- `Fullscreen` is reserved for stronger presentation
- critical messages must not silently downgrade into a toast

### Success Criteria
- The rendered surface matches the server payload.
- The client is policy-driven, not hardcoded by message category alone.

## Step 10: Displayed Reporting
### Endpoint
- `POST /agent/messages/{messageId}/displayed`

### Minimum Request
```json
{
  "occurredAt": "2026-07-09T10:01:00.000Z",
  "activeUserIdentifier": "optional-user"
}
```

### Expected Response
- `204 No Content`

### Rule
- send this only after the message is actually rendered on screen

### Success Criteria
- The client does not report `Displayed` merely because payload arrived.
- Repeated safe retry of the same event does not break the flow.

## Step 11: Read Reporting
### Endpoint
- `POST /agent/messages/{messageId}/read`

### Minimum Request
```json
{
  "occurredAt": "2026-07-09T10:01:10.000Z",
  "activeUserIdentifier": "optional-user"
}
```

### Expected Response
- `204 No Content`

### Rule
- send this only after a real interaction

### Success Criteria
- `Read` is tied to actual operator interaction.
- Safe duplicate retry does not corrupt the lifecycle.

## Step 12: Workflow Response
### Endpoint
- `POST /agent/messages/{messageId}/response`

### Minimum Request
```json
{
  "responseOptionKey": "SAFE",
  "responseNote": null,
  "occurredAt": "2026-07-09T10:01:20.000Z",
  "activeUserIdentifier": "optional-user"
}
```

### Expected Response
- `200 OK`
- response contains recipient response payload from the backend

### Rule
- only enable this when `requiresResponse = true`
- render workflow options from payload, not from hardcoded client defaults

### Success Criteria
- Valid workflow options can be submitted successfully.
- Invalid response states are blocked by the client and still safely validated by the server.

## Step 13: Reminder Policy Sync
### Endpoint
- `GET /agent/reminder-policies`

### Expected Response
- `200 OK`
- response contains `items`

### Minimum Policy Fields
- `policyId`
- `communicationId`
- `scheduleVersion`
- `recurrenceRule`
- `timezone`
- `validFrom`
- `validUntil`
- `title`
- `body`

### Success Criteria
- The client can store and replace policies by version.
- The client stops using expired or missing policies after refresh.

## Step 14: Reminder Event Reporting
### Endpoint
- `POST /agent/reminder-policies/{policyId}/events`

### Minimum Request
```json
{
  "eventType": "Triggered",
  "occurredAt": "2026-07-09T12:00:00.000Z",
  "activeUserIdentifier": "optional-user",
  "metadata": null
}
```

### Expected Response
- `204 No Content`

### Success Criteria
- The client can report local reminder evidence without blocking the main agent flow.

## First Definition Of Done
The first client integration pass is considered good enough when:
- session creation works
- realtime negotiation works
- `SSE` stream opens
- heartbeat works
- startup reconciliation works
- reconnect recovery works
- publish from admin produces a visible client-side refresh path

At this stage, the client does **not** need:
- final polished tray UX
- complete workflow UX
- full reminder execution UX
- post-MVP reporting features

## Second Definition Of Done
The next meaningful client milestone is reached when:
- messages render correctly by policy
- `Displayed` and `Read` are reported accurately
- workflow response submission works
- reconnect does not duplicate destructive behavior

## Known Current Constraints
- The current realtime transport is `SSE`, not a final production-grade hub technology.
- The current access token for realtime still reuses the persisted agent session token.
- The server may emit the active message set, not only a delta.
- The client should keep local deduplication and reconciliation logic in place.

## Recommended Debug Evidence
When testing, capture:
- local agent log for startup
- session response payload
- negotiation response payload
- stream event order
- heartbeat timestamp
- reconciliation payload before and after reconnect
- displayed/read submission timestamps
- response submission payload and result

## Handoff Note
If the Windows Agent engineer follows this checklist in order, they can keep pace with the current backend progress without waiting for deferred channel or monitoring work.
