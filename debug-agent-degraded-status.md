# Debug Session: agent-degraded-status

Status: OPEN

## Symptom
- Windows Agent still shows `Degraded` after restart.

## Hypotheses
1. The running agent instance is still using an older binary, so the previous null-guard fix is not active.
2. Local SQLite reminder policy rows contain legacy or malformed data that the current mapper cannot read safely.
3. `agent_reminder_policies.workflow_json` contains non-JSON legacy payloads, causing repeated scheduler failures on startup.
4. Realtime connectivity is healthy enough, but local reminder scheduler faults are keeping runtime status effectively degraded/noisy.
5. A stale local reminder policy is still triggering reminder event reporting against a server policy that no longer exists.

## Evidence
- `agent-20260715.log` shows the latest restart (`20:29:30`) immediately entering `Local reminder scheduler evaluation failed`.
- The exception changed from `NULL at ordinal 12` to `JsonException` parsing `workflow_json` with payload that starts like `2026-...`, strongly indicating a select-column ordinal mismatch.
- `GetActiveReminderPoliciesAsync()` omitted `toast_auto_dismiss_seconds` in the `SELECT` list while `MapReminderPolicyState()` still expected that column at ordinal 11. This shifted every later column.
- The same log then shows `AgentApiException: The reminder policy was not found for this device.` during reminder event reporting, proving at least one stale local reminder policy remained active.
- The realtime client also broadcasts `Disconnected` during startup `ConnectAsync()` because it always calls `DisconnectAsync()` first, even when no active connection exists. `AgentConnectionWorker` treats that event as a degradation signal.
- After additional startup instrumentation, the connection cycle consistently stalled immediately after `Agent connection cycle resolved identity ...` and before session acquisition.
- The stall disappeared after marshalling tray UI updates (`TaskbarIcon.ToolTipText`, tray `MenuItem.Header`) onto the WPF dispatcher, confirming the background connection worker was getting stuck when tray property-change handlers touched UI objects from a non-UI thread.
- Post-fix evidence from `agent-20260715.log` now shows the full healthy chain: cached session load -> session refresh -> realtime negotiation -> `Realtime SSE connection established` -> `Heartbeat sent` -> `Pending message sync completed` -> `Reminder policy sync completed`.

## Next Step
- Keep the tray menu on the stable native context-menu path for now, and separately clean up stale local reminder-policy rows so old debug reminder data cannot reintroduce noisy runtime warnings later.
