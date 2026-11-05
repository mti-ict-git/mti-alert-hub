# Wellness active-usage scheduling

Phase 4 implementation contract, authorized 2026-11-05. Server release separately authorized on the same date; see release evidence below.

This opt-in mode implements the approved rest-aware flowchart. Existing Fixed and WindowsSignIn schedules retain their behavior until an operator edits and publishes a revision.

## Server-owned configuration

`FREQ=ACTIVE_USAGE;INTERVAL=N;REST=R;GAP=G` is a canonical application extension in the existing recurrence_rule text. N is 1–10080 minutes; R and G are 1–1440 minutes. All values are required integers. It is accepted only for wellness AgentLocalRoutine, Synchronized distribution (no stagger). Activation/expiry and cancellation remain server owned. No new server configuration columns are needed. Editor initial suggestions are REST=5 and GAP=15, explicitly editable before publication, not runtime defaults. The supported agent release must include this feature; old agents ignore the unknown rule rather than interpreting it as fixed/calendar time.

## Device behavior

Count unlocked, connected session time since policy receipt/activation. Lock, disconnect, sleep and hibernate pause usage. On return, a rest at least REST minutes resets this policy's usage, snooze and pending due marker. A short rest preserves accumulated usage. A new Windows logon starts fresh. Agent process restart restores the persisted checkpoint; unobserved time is conservatively treated as a possible rest, never active catch-up. A scheduler gap over 75 seconds uses the same conservative rest fallback. This is session availability, not keyboard/mouse idle detection.

Each policy owns its usage timer; all wellness windows share one device presentation slot. Choose the oldest due policy first, then policy ID. Only one window may be active. The next program waits until the previous window closes plus the larger of the previous and next program's GAP. Restart preserves that cooldown. Different REST values reset programs independently. A rest does not emit Completed or Dismissed. Lock/suspend closes wellness windows without a user outcome. Ordinary urgent communications are outside this slot.

After a wellness window closes, its next usage interval starts from closure. An explicit SnoozedUntil from the current occurrence sets a shorter active-usage delay; qualifying rest clears it. Closed-by-system windows do not count as user dismissal or completion. No missed popup queue is replayed. Policy/version changes initialize a fresh timer. Persist state before presentation to prefer skipping an occurrence after a crash over duplication.

## Monitoring and rollout

Report WaitingForSession while unavailable, WaitingForWellnessSlot while occupied, otherwise effective nextRunAt including remaining usage and cooldown. New report states require prepared migration 0022 before runtime activation. Reports are estimates assuming continued unlocked use; rest, snooze and program closure change them. Publish, duplicate, edit and revision must preserve all three parameters. No migration, build package publication, install, server deployment or device rollout is authorized in this implementation task.

## Verification

- 87 xUnit tests passed, including 17 active-usage engine cases and a real SQLite checkpoint/reopen regression. Coverage includes threshold-boundary rest, brief lock between polls, missing power events, activation/expiry, policy version/logon reset, snooze clearing, clock rollback and shared cooldown.
- 12 targeted Node tests passed: authoring/parser round trips, server rejection of invalid settings/incompatible publication, legacy schedule regressions, report validation and queued-status presentation.
- Backend TypeScript check and frontend Vite production build passed. Full frontend TypeScript check retains baseline diagnostics (including the pre-existing wellness family narrowing); no new diagnostics were observed in changed settings/report files.
- Targeted ESLint has no errors; the existing wellnessDeviceOutcomes hook-dependency warning remains.
- Actual Edge headless browser publish fixture passed. It restored REST=7/GAP=20 from the server rule, rejected zero/oversized values, submitted edited REST=9/GAP=25 with interval 120 and no stagger, and captured the editor for visual review. Every API was intercepted, and non-local requests were blocked. Fixture reporting 503 and existing hydration warnings were observed.
- Source contract and DESIGN/UX documents updated. No production database query/migration, program mutation, package signing/upload, agent launch/install or deployment was performed.
- Physical sleep/lock/resume, closure timing, hibernate and device rollout remain release acceptance tasks. Do not claim live acceptance from deterministic clock tests.


## Local physical pilot — 2026-11-05

User-authorized laptop pilot completed with an isolated copied agent, separate mutex/cache and a synthetic loopback fixture at 127.0.0.1:47819. No production endpoint, installed-agent config, package publication or database migration was changed.

Accelerated settings: interval 2 minutes, minimum rest 1 minute, interprogram gap 1 minute. User confirmed a roughly 20-second lock/unlock: reset anchors remained unchanged. Since Eye Break had already displayed before that lock, remaining-time preservation was checked through the still-pending stretching policy. User then confirmed sleep/return with no immediate popup. Both timers reset to zero at 17:29:17.517 WITA. First post-rest Eye Break Displayed was 17:31:18.423 (120.906 seconds after reset). Stretching stayed WaitingForWellnessSlot, then displayed at 17:32:48.802, 60.613 seconds after the scheduler recorded the previous slot closed. User confirmed one-at-a-time display and the gap. Actual OS power-state classification was not independently established by the checkpoint; sleep was user-confirmed.

Local pilot processes were stopped and fixture policies disabled after testing. Installed agent remained running. Evidence: C:/Scripts/Projects/snipeit-project/wellness-pilot/RESULTS.md, verification.json, checkpoints.jsonl and evidence.jsonl. Initial fixture requests with null fields (before chunked HTTP parsing was fixed) are excluded from event proof. Full two-hour timing, hibernate, other sleep variants and production rollout remain outstanding release acceptance. This pilot does not close Phase 4.


## Terminal reminder event rejection (2026-11-05)

The installed laptop agent had 33 queued historical reminder events whose local policies were inactive. Production returned HTTP 409 / REMINDER_POLICY_INACTIVE. The old queue flusher propagated this terminal response and repeatedly marked the entire connection Degraded.

The agent now archives 404 policy-missing and exact 409 REMINDER_POLICY_INACTIVE responses in local SQLite agent_rejected_reminder_events. Queued evidence is copied and removed from retry atomically, preserving original timestamps, metadata, actor and rejection code/status. Direct terminal rejections are archived too. Unknown conflicts remain errors; network failures, 401, 408, 429 and 5xx remain queued under existing retry behavior. No successful completion/delivery is invented for rejected events.

Verification: 96 xUnit tests passed, including terminal rejection followed by delivery of the next event, evidence preservation, direct rejection, idempotent archive, unknown-conflict retention and transient-error retention. Local package 1.0.19 includes the active-usage scheduler and this queue repair. No package upload or server deployment is part of the laptop update.


## Server release profile — 2026-11-05

User authorized deployment of server-owned interval, minimum rest and interprogram gap. Existing programs will not be converted or published, and no device rollout will be created. Agent 1.0.19 is already imported in the package registry; active-usage programs require that supported client.

Runtime preflight: SSH-pinned host mtimrwcnt01; checkout /root/mti-alert-hub, branch main, baseline 2dfc484660180f192a5f387dc86fcc0e78bc254f. Tracked server tree clean; two untracked .env backups retained. Current production uses standalone containers from scripts/deploy-docker.sh rather than Compose activation: mti-alert-backend and mti-alert-frontend on mti-alert-network, gateway mti-alert-gateway on host port 8086. A legacy Compose frontend also exists and is excluded. Package volume mti-alert-hub_backend_local_packages must remain mounted at /app/backend/local-packages. Relay/gateway/database and all other containers are retained.

Release method: push reviewed source, fast-forward server, build exact Git archive into unique candidate images with revision labels, snapshot previous images/configuration and back up the affected table/ledger/schema, verify all prior migration checksums, rehearse migration 0022 in a rolled-back transaction, apply only pending 0022 through the project migration runner, replace only backend/frontend using their existing environment, mounts, ports, network aliases and healthchecks. Reload the existing nginx gateway after address changes. Migration 0022 only expands an allowed-state constraint and remains compatible with the previous application; image rollback does not remove new states or undo the migration.

Pre-release verification: 15 Node tests passed (active usage, legacy Windows sign-in, route policy and policy application), backend typecheck and frontend production build passed. Browser acceptance and production image/database/health verification are recorded in the subsequent release evidence. Private runtime backups are kept outside Git under /root/mti-alert-releases. No production business records or real notifications are created for acceptance.
