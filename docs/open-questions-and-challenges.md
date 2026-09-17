# MTI Alert Open Questions And Challenges

## Document Status

- Version: `0.5`
- Status: `Open`
- Last Updated: `2026-09-12`

## Purpose

This document records unresolved product and technical questions. No implementation should silently assume answers where these decisions materially affect behavior.

## Current Release Decision

- The current first live release remains desktop-first.
- `WindowsAgent` is the only delivery channel enabled for the current live path by default.
- `WhatsApp`, `Email`, and `Digital Signage` remain deferred unless a controlled environment explicitly enables them.

## Open Questions

### OQ-1. SignalR-Style Realtime Technology Choice

- Question: Which concrete server technology will implement the SignalR-style realtime contract for the Windows Agent?
- Why it matters: This affects framework choice, scaling behavior, deployment topology, and C# client compatibility.
- Current safe assumption: MVP uses a hub-based push model compatible with a C# Windows Agent.
- Current delivery note: the first compatible hub slice now uses `SSE` for the initial Windows Agent go-live path, while the longer-term production technology choice, scaling model, and dedicated hub-token strategy remain open.

### OQ-2. Windows Agent Authentication Strategy

- Question: How should the C# agent authenticate to the server and bind a device to an employee?
- Why it matters: Device trust, impersonation risk, and deployment workflow depend on this.
- Current safe assumption: device registration plus renewable device session token, with desktop delivery remaining device-centric rather than user-centric. Optional active-user context may still be retained on the session to reduce cross-user pending-message replay on shared endpoints.

### OQ-3. Organizational Source Of Truth

- Question: What exact boundaries apply to the hybrid organization source model between external systems and MTI-managed overrides?
- Why it matters: This changes CRUD ownership, sync workflows, and data freshness rules.
- Current safe assumption: basic org data comes from scheduled HR batch sync, while MTI Alert may hold limited local adjustments.
- Current delivery note: this area is explicitly deferred for the first live release and is not treated as a release blocker unless real organization targeting becomes mandatory before go-live.

### OQ-4. WhatsApp Provider Selection

- Question: Which WhatsApp provider or gateway will be used for production?
- Why it matters: Template rules, webhook payloads, retry behavior, and message cost visibility depend on provider capabilities.
- Current delivery note: this is explicitly deferred for the first Windows Agent go-live release and is not a release blocker until the desktop client path is live.

### OQ-5. Response Workflow Limits

- Question: How far should template-driven response policy go in MVP?
- Why it matters: Fully dynamic workflows can significantly increase complexity.
- Current safe assumption: MVP supports template-selected workflows with selectable preset options, optional note fields, timeout-based overdue tracking, and response-implies-ack semantics.

### OQ-6. Escalation Behavior

- Question: What exact recipient-only follow-up actions are allowed in MVP for overdue or unread critical communications?
- Why it matters: Escalation affects workflow engine design, notifications, and reporting.
- Current safe assumption: MVP limits automatic escalation to recipient-only re-alerting or re-attempting the same recipient.

### OQ-7. Knowledge And Article Experience

- Question: Should long-form news, article, and knowledge content use the exact same UX as alerts and reminders, or require specialized presentation?
- Why it matters: Unified engine does not always mean identical UX.

### OQ-8. Critical Dual-Path Timing Range

- Question: What exact short-delay range should be used between desktop-first delivery and WhatsApp follow-up for critical dual-path templates?
- Why it matters: This affects urgency, user noise, and operational consistency.
- Current safe assumption: the delay is template-driven and intentionally short.

### OQ-9. Recipient Identity Conflicts

- Question: If one employee has multiple devices or multiple channels, how should delivery rollup interact with device-centric desktop targeting and user-preference-based channel strategy?
- Why it matters: This affects delivery aggregation and dashboard correctness.

### OQ-10. Template Policy Depth

- Question: Should template version snapshots be stored only at communication level, or also materialized into delivery job policy snapshots for execution auditability?
- Why it matters: This affects debugging, audit traceability, and schema complexity.
- Current safe assumption: communication-level `templateVersion` remains authoritative, and publish execution also materializes effective policy snapshots onto delivery records when channel behavior depends on that policy.

### OQ-11. Local Routine Reminder Missed-Run Semantics

- Question: When a Windows Agent wakes up after sleep, prolonged offline time, or clock drift, should locally executed routine reminders skip missed occurrences, emit one catch-up reminder, or replay multiple missed windows?
- Why it matters: This affects user experience, duplicate suppression, audit semantics, and implementation complexity in the agent scheduler.
- Current safe assumption: skip backlog replay and continue from the next eligible occurrence unless a tighter product rule is later approved.

### OQ-12. Hybrid Reminder Admin Surface

- Question: Should hybrid recurring reminder controls remain inside the unified communication form, or should reminders receive a dedicated authoring and monitoring flow in the admin UI?
- Why it matters: This affects operator comprehension, implementation scope, and whether `ServerGenerated` versus `AgentLocalRoutine` behavior can be explained clearly without overloading the generic notification UX.
- Current safe assumption: keep the shared communication engine for generic reminders, while allowing specialized recurring subflows such as `Wellness Programs` to use a dedicated authoring and monitoring surface under the broader `Notifications` cluster.

### OQ-13. OHIH Module Boundary

- Question: Should OHIH ergonomic programs remain a specialized subset of the generic reminder engine, or should they receive a dedicated admin module and richer agent payload contract from the start?
- Why it matters: OHIH appears to behave more like a locally executed device program than a normal ad hoc notification, which affects server menu structure, data modeling, agent UI templates, and whether reminder-policy sync is extended or a new contract family is introduced.
- Current safe assumption: keep the existing reminder-policy foundation, and proceed with OHIH as a dedicated `Wellness Programs` submodule under the broader `Notifications` cluster, with server-managed policy, agent-executed routine behavior, `Blue` and `Green` theme variants, and a narrowed `GuidedRoutine` MVP for stretching.

### OQ-14. Windows Agent Updater Trust Boundary

- Question: What exact trust and authorization model should govern server-initiated update, repair, and uninstall intent for the Windows Agent?
- Why it matters: Agent-driven lifecycle commands can become a remote-execution vector if package origin, operator authorization, command scope, and rollback behavior are not tightly controlled.
- Current safe assumption: the server should send approved rollout metadata only, the tray app should delegate execution to a dedicated updater component, and endpoint-management tooling remains the fallback path when trust is degraded.
- Current delivery note: the current updater baseline treats rollout `signature` metadata as the expected Authenticode signer certificate thumbprint for the approved `MSI`, while broader signing governance, approval workflow, and certificate rotation policy remain open.

### OQ-15. Wellness Feedback Prompt Shape

- Question: What exact post-routine feedback should the Windows Agent collect for `Wellness Programs`, and when should that prompt appear?
- Why it matters: a usefulness or need rating flow changes the agent UX, event contract, storage model, and admin analytics surface.
- Current safe assumption: keep the current wellness MVP focused on assignment, defer or snooze versus completion evidence, and device-centric compliance monitoring. A dedicated feedback prompt is deferred until the rating scale, trigger timing, required fields, and reporting expectations are explicitly approved.

### OQ-16. Wellness Close Versus Completion Semantics

- Question: Should every user-initiated close path on a wellness popup count as `Dismissed`, or are there any close-style CTA paths that product still wants to count as successful completion?
- Why it matters: OHIH effectiveness reporting depends on a stable distinction between `Completed`, `Deferred`, `Dismissed`, and `TimedOut`. If close behavior is ambiguous, completion rate and defer-vs-ignore analytics become misleading.
- Decision (`2026-09-04`): `GotIt` and `Done` count as `Completed`; `RemindMeLater` counts as defer or snooze; `Start` and `Next` remain non-terminal progress events; both the window close button and any CTA with `actionKind = Close` count as `Dismissed`. No separate `Skipped` outcome is added.
- Compatibility boundary: historical `eventType = Completed` plus `actionKind = Close` evidence from older agents remains `AmbiguousCloseCompletion` and must not be rewritten or included in confirmed completion KPI. New agents must emit `Dismissed` for that CTA path.

### OQ-17. Activity-Aware Wellness Scheduling Semantics

- Question: What exact `activity-based` timing rule should replace or augment the current fixed wall-clock recurrence for `Wellness Programs`?
- Why it matters: `every 2 hours` can mean very different behavior depending on whether the business wants elapsed wall-clock time, accumulated active keyboard or mouse usage, idle-aware suppression, or a hybrid rule after sleep, reconnect, and user switching.
- Current safe assumption: keep the existing recurrence anchor behavior until product approves the precise activity model, because an imprecise implementation could either spam active users or starve reminders on intermittently used laptops.
- Minimum clarification needed:
  - whether `2 hours` means cumulative active usage or simply `do not show while idle`
  - how sleep, lock-screen time, and remote-session idle periods count
  - whether the timer resets on `Completed`, `Dismissed`, or only on the underlying anchored schedule

### OQ-18. Manual Activation Popup Confirmation Boundary

- Question: For devices that require manual setup during activation, should popup confirmation rely on existing `Displayed` device evidence, an explicit user-facing `popup terlihat / tidak terlihat` confirmation step, or both?
- Why it matters: operations needs a reliable activation checklist for problem laptops, but product and engineering should avoid duplicating confirmation semantics if `Displayed` already proves render success.
- Current safe assumption: prefer device-reported `Displayed` evidence as the authoritative technical signal and use explicit end-user confirmation only as an operational fallback when troubleshooting manual activation or setup drift.

## Challenges

### CH-1. Unified Content Without Scope Explosion

- Risk: Supporting alerts, reminders, news, articles, and knowledge items in one engine can become too broad.
- Mitigation: Keep one aggregate model but limit MVP behavior differences to content type metadata and workflow settings.

### CH-2. Real-Time Visibility Across Channels

- Risk: Windows Agent and WhatsApp will produce different delivery and read semantics.
- Mitigation: Separate raw channel events from normalized dashboard states.

### CH-2A. Push Connectivity Reliability

- Risk: Push-first Windows Agent delivery requires stable connection tracking and fallback handling when agents disconnect.
- Mitigation: Track realtime connection health explicitly and support reconciliation for missed messages.

### CH-3. AI-Driven Implementation Drift

- Risk: Multiple AI tools building different parts of the system may interpret behavior differently.
- Mitigation: Keep `functional-specification.md`, `technical-implementation-plan.md`, `database-schema-specification.md`, and `openapi.yaml` synchronized and explicit.

### CH-4. Role Scope Enforcement

- Risk: Frontend-only permission filtering can lead to unauthorized operations.
- Mitigation: Enforce site and area scope in backend query and command handlers.

### CH-5. Scheduling And Recurrence Complexity

- Risk: Recurring reminders can create edge cases around time zones, missed runs, and editing future schedules.
- Mitigation: Keep schedule lifecycle authoritative on the server, use versioned reminder policies for approved local routine execution, and avoid backlog replay after long offline gaps unless explicitly required.

### CH-6. Critical Presentation Policy

- Risk: Immediate modal behavior for critical alerts can become disruptive if policy boundaries are unclear.
- Mitigation: Keep the behavior template-driven, explicit, and constrained by documented priority rules.

### CH-7. Device-Centric Audit Semantics

- Risk: Shared devices can blur the distinction between endpoint-level proof and person-level proof.
- Mitigation: Treat device events as authoritative for desktop delivery, while storing active user context only as optional audit metadata when available. Keep Windows Agent message replay bounded by schedule validity windows and a finite one-time replay TTL so stale backlog does not linger indefinitely across reconnect, reinstall, or later user login on the same endpoint.

### CH-8. Remote Lifecycle Command Abuse

- Risk: Remote update and uninstall capabilities for the Windows Agent could become an unsafe command-execution path if the system accepts arbitrary packages, weak signing, or under-scoped operator permissions.
- Mitigation: Keep rollout centrally governed, distribute only approved package metadata, execute lifecycle actions through a dedicated updater component, verify version plus checksum plus signature before execution, and preserve endpoint-management tooling as the break-glass recovery path.

## Users & Access — confirmed choices and remaining engineering gates

The eight product choices are confirmed in users-access-contract.md section 12, including Viewer recipient
details/export and mandatory login after role/scope changes. Do not reopen them as unanswered questions.
Remaining engineering gates are listed in users-access-verification.md: verified GUID migration, complete
route/job coverage, shared-object ownership, session consistency, agent-local deactivation and API/schema validation.
No production administrator identity has been selected by this documentation task.

## Users & Access cutover activation hold — 2026-09-17

Local acceptance implementation is prepared, but automatic approval review rejected unconditional managed-auth startup activation because missing schema/admin prerequisites could interrupt service. Default authentication remains unchanged. The source activation decision and operational consequences are detailed in users-access-cutover.md. The new frontend must not be deployed with the legacy login path. Legacy queued work without explicit publisher provenance requires authorized review/republication; no automatic ownership backfill is planned.

## Source activation approved and completed — 2026-09-17

This entry supersedes the earlier activation-hold status. The user explicitly approved managed authentication with migration 0020 and verified Administrator startup prerequisites. The default backend now uses PersistentAuthService/PersistentAccessSessionStore, always registers the access routes, enforces the closed administrative route manifest and enables queued agent job authorization. The legacy auto-admin fallback and internal managedAccess option have been removed from application bootstrap. Startup checks prerequisites before serving HTTP and closes the database on prerequisite failure.

Backend build/typecheck and targeted bootstrap lint passed. The authorization suite passed 57 tests (the two explicit PostgreSQL suites skip without a test URL); the separate isolated PostgreSQL/HTTP run passed all 9 TAP tests. Frontend source is unchanged from the previously verified production build. Production migration 0020, Docker redeploy and live AD acceptance remain pending. Source is ready for the coordinated cutover sequence in docs/users-access-cutover.md; this is not a claim that production has been upgraded. Phase 4 remains In Progress until production acceptance.
