# MTI Alert Software Acceptance Test

## Document Status
- Version: `0.1`
- Status: `Working Draft`
- Last Updated: `2026-07-15`
- Audience: `Product Owner`, `QA`, `Operations`, `Backend Engineers`, `Windows Agent Engineers`

## Purpose
This document defines the manual `Software Acceptance Test` (`SAT`) baseline for the current `MTI Alert` release path.

It is intended to answer:
- what must be manually proven before release acceptance
- which user-visible and operational workflows are in scope
- what evidence should be captured for sign-off
- what is explicitly out of scope for the current desktop-first release

## Source Of Truth
This SAT is derived from:
- `docs/implementation-roadmap.md`
- `docs/functional-specification.md`
- `docs/testing-strategy.md`
- `docs/go-live-checklist.md`
- `docs/windows-agent-client-specification.md`
- `docs/windows-agent-integration-checklist.md`
- `docs/operational-runbook.md`
- `docs/openapi.yaml`

If there is a conflict, follow:
1. `docs/openapi.yaml` for backend contract behavior
2. `docs/functional-specification.md` for product behavior
3. `docs/implementation-roadmap.md` and `docs/go-live-checklist.md` for release scope
4. this document for acceptance execution guidance

## Current Acceptance Scope
The current SAT baseline is for the `desktop-first` release path:
- enabled channel: `WindowsAgent`
- admin frontend in scope
- backend API in scope
- Windows Agent runtime behavior in scope
- recurring reminder hybrid flow in scope only if the release cut includes reminder operations

## Explicitly Out Of Scope
- live `WhatsApp` outbound delivery and provider callbacks
- `Email` connector behavior
- `Digital Signage` connector behavior
- full HR or organization ingestion accuracy
- deep reporting exports beyond the current monitoring baseline

## Acceptance Result Scale
Use one result per test case:
- `Pass`
- `Fail`
- `Blocked`
- `Not In Scope`

## Entry Criteria
Before executing this SAT:
- backend build and typecheck pass
- frontend build passes if the admin UI is part of the release
- required migrations are applied
- test admin credentials are available
- at least one registered Windows Agent test device is available
- release environment guardrails match the intended scope:
  - `ENABLED_DELIVERY_CHANNELS=WindowsAgent`
  - `VITE_ENABLED_DELIVERY_CHANNELS=DesktopAgent`

## Recommended Test Data
Prepare at least:
- `1` valid admin account
- `1` invalid or unauthorized account for negative-path checks
- `1` online Windows Agent test device with stable `deviceIdentifier`
- `1` response-enabled workflow
- `1` reminder scenario for `ServerGenerated`
- `1` reminder scenario for `AgentLocalRoutine`

## Evidence To Capture
For each executed test case, record:
- execution date and tester
- environment or base URL
- result: `Pass`, `Fail`, `Blocked`, or `Not In Scope`
- screenshot, screen recording, or request/response snippet where relevant
- defect reference if failed
- short notes for anything unusual

## Suggested Execution Order
1. Authentication and release-scope guardrails
2. Draft authoring and publish guardrails
3. Windows Agent delivery and reconciliation
4. Response and reminder flows
5. Monitoring, diagnostics, and security-sensitive controls

## Acceptance Areas
- `AUTH`: login, session, protected-route behavior
- `AUTHORING`: draft creation, validation, preview, publish
- `AGENT`: session, realtime, heartbeat, reconciliation, rendering evidence
- `REMINDER`: recurring reminder acceptance and policy sync
- `MONITORING`: deliveries, responses, audit, diagnostics
- `SECURITY`: token rotation, device revocation, auth mismatch rejection

## Test Cases

### SAT-AUTH-001 Admin Login Success
- Objective: confirm a valid admin user can access the admin application and authenticated API session.
- Preconditions: valid admin credentials are available.
- Steps:
  1. Open the admin login page.
  2. Submit valid credentials.
  3. Navigate to a protected page such as `Notification Center` or `Devices`.
- Expected Result:
  - login succeeds
  - protected pages load without redirect loops
  - `GET /auth/me` reflects the authenticated operator session
- References:
  - `docs/functional-specification.md` `FR-17`
  - `docs/go-live-checklist.md`

### SAT-AUTH-002 Protected Route Rejects Unauthenticated Access
- Objective: confirm protected admin behavior is not accidentally public.
- Preconditions: no valid session cookie or bearer token is present.
- Steps:
  1. Open a protected admin route directly.
  2. Call one protected API endpoint without authentication.
- Expected Result:
  - UI redirects to login or shows an auth failure state
  - API returns the expected unauthorized status
- References:
  - `docs/go-live-checklist.md`
  - `docs/testing-strategy.md`

### SAT-AUTH-003 Admin Session Rotation Invalidates Prior Token
- Objective: confirm security-sensitive session rotation works as documented.
- Preconditions: authenticated admin session exists.
- Steps:
  1. Call `POST /auth/rotate-session`.
  2. Retry an authenticated call with the old token.
  3. Retry the same call with the new token.
- Expected Result:
  - rotation returns a fresh token
  - old token is rejected
  - new token remains usable
- References:
  - `docs/operational-runbook.md`
  - `docs/implementation-roadmap.md`

### SAT-AUTH-004 Release Scope Blocks Non-Desktop Channels
- Objective: confirm the desktop-first release does not expose or accept out-of-scope channels.
- Preconditions: release environment uses `WindowsAgent`-only channel scope.
- Steps:
  1. Open communication authoring in the admin UI.
  2. Confirm non-approved channels are hidden or unavailable.
  3. Attempt a direct API request using `WhatsApp` if a controlled test tool is available.
- Expected Result:
  - non-desktop channels are not available in the UI
  - backend rejects out-of-scope channel requests with the documented validation error
- References:
  - `docs/go-live-checklist.md`
  - `docs/operational-runbook.md`

### SAT-AUTHORING-001 Create Draft With `Info + Toast`
- Objective: confirm desktop presentation rules for lightweight informational messages.
- Preconditions: authenticated admin session exists.
- Steps:
  1. Create a new communication draft.
  2. Select desktop delivery.
  3. Set priority to `Info`.
  4. Set `Windows Agent presentation` to `Toast`.
  5. Try to add a separate instruction.
  6. Save the draft.
- Expected Result:
  - the UI hides or clears `instruction` for `Info + Toast`
  - draft save succeeds
  - draft detail still shows the selected presentation as `Toast`
- References:
  - `docs/functional-specification.md` `FR-2A`, `FR-2B`, `FR-2C`

### SAT-AUTHORING-002 Create Draft With `Warning + Modal`
- Objective: confirm warning semantics require an instruction and modal presentation.
- Preconditions: authenticated admin session exists.
- Steps:
  1. Create or edit a draft with desktop delivery.
  2. Set priority to `Warning`.
  3. Observe presentation behavior.
  4. Attempt to save without `instruction`.
  5. Add a valid instruction and save again.
- Expected Result:
  - `Warning` is forced to `Modal`
  - save is blocked when `instruction` is missing
  - save succeeds after a valid `instruction` is supplied
- References:
  - `docs/functional-specification.md` `FR-2A`, `FR-2B`, `FR-2C`

### SAT-AUTHORING-003 Audience Preview Before Publish
- Objective: confirm operators can preview recipient coverage before sending.
- Preconditions: at least one eligible Windows Agent device is available.
- Steps:
  1. Create or open a draft targeted to the test device or device location.
  2. Open the audience preview step.
  3. Review recipient and channel plan output.
- Expected Result:
  - preview completes successfully
  - recipient coverage is understandable to the operator
  - preview can be used as the confirmation basis before publish
- References:
  - `docs/functional-specification.md` `FR-6`
  - `docs/go-live-checklist.md`

### SAT-AUTHORING-004 Immediate Publish Creates Live Delivery
- Objective: confirm `publish now` works end to end for the desktop path.
- Preconditions: a valid previewed draft exists for an online device.
- Steps:
  1. Publish the draft with `publishMode = Now`.
  2. Open the communication detail page.
  3. Review status and delivery evidence.
- Expected Result:
  - publish succeeds
  - communication moves out of `Draft`
  - delivery rows are created and visible through the monitoring baseline
- References:
  - `docs/functional-specification.md` `FR-3`, `FR-8`, `FR-9`
  - `docs/go-live-checklist.md`

### SAT-AUTHORING-005 Scheduled Publish And Cancel
- Objective: confirm one-time scheduling and operator cancellation.
- Preconditions: authenticated admin session exists.
- Steps:
  1. Create or edit a draft with a future scheduled time.
  2. Publish it as `Scheduled`.
  3. Confirm the communication appears in the scheduled or live list.
  4. Cancel the scheduled communication.
- Expected Result:
  - scheduled publish succeeds
  - communication shows scheduled state before cancellation
  - cancellation succeeds and state changes to `Cancelled`
- References:
  - `docs/functional-specification.md` `FR-3`
  - `docs/go-live-checklist.md`

### SAT-AUTHORING-006 Draft Lifecycle Quick Actions
- Objective: confirm Notification Center supports the intended operator flow.
- Preconditions: at least one draft and one scheduled or active communication exist.
- Steps:
  1. Open `Notification Center`.
  2. Use direct `Edit Draft` from the list.
  3. Duplicate a prior communication as a new draft.
  4. Execute a valid bulk cancel action for scheduled or active rows.
- Expected Result:
  - list segmentation is understandable
  - quick edit opens the correct draft
  - duplicate creates a new draft
  - bulk actions only allow lifecycle-safe operations
- References:
  - `docs/functional-specification.md` `FR-1A`
  - `docs/implementation-roadmap.md`

### SAT-REMINDER-001 Recurring Reminder With `ServerGenerated`
- Objective: confirm the admin flow supports standard recurring reminders.
- Preconditions: reminder authoring is in release scope.
- Steps:
  1. Create a `Reminder` draft.
  2. Define recurrence rule, timezone, first occurrence, and validity window.
  3. Choose `ServerGenerated`.
  4. Publish the reminder.
  5. Review reminder schedule metadata on the detail page.
- Expected Result:
  - recurring reminder authoring fields are available
  - publish succeeds
  - detail view exposes persisted schedule metadata clearly
- References:
  - `docs/functional-specification.md` `FR-4`, `FR-4C`, `FR-4F`, `FR-4G`

### SAT-REMINDER-002 Recurring Reminder With `AgentLocalRoutine`
- Objective: confirm bounded local routine reminders are operator-safe and enforce guardrails.
- Preconditions: reminder authoring is in release scope and a Windows Agent target device is available.
- Steps:
  1. Create a recurring reminder draft for a device-bound Windows Agent target.
  2. Choose `AgentLocalRoutine`.
  3. Try to publish without `validUntil`.
  4. Supply `validUntil` and publish again.
  5. Review reminder activity on the detail page.
- Expected Result:
  - publish is blocked when the required validity guardrail is missing
  - publish succeeds once guardrails are satisfied
  - reminder activity or policy visibility is available after publish
- References:
  - `docs/functional-specification.md` `FR-4D`, `FR-4E`, `FR-4F`, `FR-4G`, `FR-4H`
  - `docs/go-live-checklist.md`

### SAT-AGENT-001 Device Test Notification From `Devices`
- Objective: confirm operations can test device connectivity without manual draft authoring.
- Preconditions: an online Windows Agent device exists in the device list.
- Steps:
  1. Open the `Devices` admin page.
  2. Trigger `Test` notification for the target device.
  3. Review the resulting communication detail and device delivery result.
- Expected Result:
  - the test action succeeds without placeholder errors
  - a one-time communication is created and published
  - instruction content is present so the Windows Agent popup layout can be checked
- References:
  - `docs/functional-specification.md` `FR-19E`, `FR-19F`
  - `docs/implementation-roadmap.md`

### SAT-AGENT-002 Agent Session, Realtime Negotiate, And Heartbeat
- Objective: confirm the Windows Agent can establish trusted runtime connectivity.
- Preconditions: a stable test device is available.
- Steps:
  1. Call `POST /agent/session` with the device identity.
  2. Call `POST /agent/realtime/negotiate` with the returned session.
  3. Open the negotiated `SSE` stream.
  4. Call `POST /agent/heartbeat`.
- Expected Result:
  - session creation succeeds
  - negotiate returns a concrete realtime URL and connection metadata
  - stream returns `connected` and `messages.snapshot`
  - heartbeat succeeds for the same device session
- References:
  - `docs/windows-agent-client-specification.md`
  - `docs/windows-agent-integration-checklist.md`
  - `docs/go-live-checklist.md`

### SAT-AGENT-003 Publish Push And Reconciliation Recovery
- Objective: confirm push-first delivery still recovers safely after reconnect.
- Preconditions: the agent is connected and a desktop-targeted draft is ready to publish.
- Steps:
  1. Publish a Windows Agent-targeted communication while the device is connected.
  2. Observe stream events.
  3. Disconnect the stream intentionally.
  4. Negotiate again and reopen the stream.
  5. Call `GET /agent/messages`.
- Expected Result:
  - publish emits `messages.available` or equivalent refresh behavior
  - reconnect requires a fresh negotiate step
  - the same pending communication remains recoverable through reconciliation
- References:
  - `docs/windows-agent-client-specification.md`
  - `docs/windows-agent-integration-checklist.md`

### SAT-AGENT-004 Displayed, Read, And Workflow Response Evidence
- Objective: confirm Windows Agent lifecycle evidence is persisted accurately.
- Preconditions: a response-required message has been delivered to the test device.
- Steps:
  1. Render the message in the Windows Agent.
  2. Submit `Displayed`.
  3. Perform a real interaction and submit `Read`.
  4. Submit a valid workflow response.
  5. Review delivery and response status in the admin monitoring view.
- Expected Result:
  - `Displayed` is only reported after actual rendering
  - `Read` is only reported after real interaction
  - workflow response succeeds
  - admin monitoring reflects `Responded` and acknowledgement semantics correctly
- References:
  - `docs/functional-specification.md` `FR-11`, `FR-12`, `FR-13C`, `FR-16B`, `FR-16C`
  - `docs/windows-agent-client-specification.md`

### SAT-AGENT-005 Reminder Policy Sync And Local Event Reporting
- Objective: confirm locally executable reminder policies remain server-governed.
- Preconditions: an `AgentLocalRoutine` reminder has been published for the test device.
- Steps:
  1. Call `GET /agent/reminder-policies`.
  2. Confirm the expected policy is present.
  3. Report a reminder event through `POST /agent/reminder-policies/{policyId}/events`.
  4. Cancel or invalidate the reminder on the admin side.
  5. Refresh reminder policies again.
- Expected Result:
  - the valid reminder policy is synchronized to the agent
  - reminder event reporting succeeds
  - cancelled or invalid policies no longer appear as active after refresh
- References:
  - `docs/functional-specification.md` `FR-4D`, `FR-4E`, `FR-4H`
  - `docs/windows-agent-client-specification.md`

### SAT-MONITORING-001 Deliveries, Responses, Audit, And Diagnostics
- Objective: confirm operators can inspect meaningful persisted evidence after execution.
- Preconditions: at least one published communication with delivery activity exists.
- Steps:
  1. Open communication delivery detail.
  2. Open communication responses view for a response-enabled message.
  3. Open `Audit Logs`.
  4. Call `GET /health/diagnostics`.
- Expected Result:
  - delivery rows show recipient and status visibility
  - response detail shows actor, option, and time where applicable
  - audit logs include representative lifecycle entries
  - diagnostics report database and channel health plus request-correlation behavior
- References:
  - `docs/functional-specification.md` `FR-14`, `FR-15`, `FR-16`, `FR-19`
  - `docs/operational-runbook.md`

### SAT-SECURITY-001 Device Session Revocation
- Objective: confirm operations can revoke a device trust session cleanly.
- Preconditions: an active Windows Agent session exists for the test device.
- Steps:
  1. Trigger `POST /devices/{deviceId}/revoke-session`.
  2. Retry `POST /agent/heartbeat` with the revoked token.
  3. Attempt reconnect using the old session.
- Expected Result:
  - revocation succeeds
  - old token is rejected afterward
  - the device must create a new session before resuming normal operation
- References:
  - `docs/operational-runbook.md`
  - `docs/implementation-roadmap.md`

### SAT-SECURITY-002 Unauthorized Or Mismatched Device Requests Are Rejected
- Objective: confirm backend trust enforcement remains active on agent endpoints.
- Preconditions: one valid device session exists.
- Steps:
  1. Call an agent endpoint with no bearer token.
  2. Call an agent endpoint with an invalid token.
  3. If possible, call an agent endpoint using a valid token but the wrong device identity.
- Expected Result:
  - unauthorized calls are rejected
  - invalid token calls are rejected
  - mismatched device ownership calls are rejected
- References:
  - `docs/go-live-checklist.md`
  - `docs/testing-strategy.md`

## Exit Criteria
The SAT baseline is considered acceptable when:
- all release-critical cases pass
- any failed or blocked cases have explicit disposition and release-owner approval
- out-of-scope items are marked intentionally, not skipped silently
- evidence is attached for all executed release-critical cases

Release-critical cases for the current desktop-first path:
- `SAT-AUTH-001`
- `SAT-AUTH-002`
- `SAT-AUTH-003`
- `SAT-AUTH-004`
- `SAT-AUTHORING-003`
- `SAT-AUTHORING-004`
- `SAT-AGENT-001`
- `SAT-AGENT-002`
- `SAT-AGENT-003`
- `SAT-AGENT-004`
- `SAT-MONITORING-001`
- `SAT-SECURITY-001`
- `SAT-SECURITY-002`

The following are also release-critical if recurring reminders are in the approved release cut:
- `SAT-REMINDER-001`
- `SAT-REMINDER-002`
- `SAT-AGENT-005`

## Execution Record Template
Use this template while executing the SAT:

| Test Case ID | Tester | Date | Environment | Result | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `SAT-...` |  |  |  |  |  |  |

## Sign-Off Template
| Role | Name | Decision | Date | Notes |
| --- | --- | --- | --- | --- |
| `Product Owner` |  |  |  |  |
| `QA Lead` |  |  |  |  |
| `Tech Lead` |  |  |  |  |
| `Operations` |  |  |  |  |
