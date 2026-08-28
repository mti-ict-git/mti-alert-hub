# Windows Agent Rollout Stage 1 Contract

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-08-26`
- Audience: `Backend Engineers`, `Windows Agent Engineers`

## Purpose
This document narrows the first implementation slice for Windows Agent rollout support.

Stage 1 defines only the minimum backend contract needed to:
- tell an agent that an approved rollout exists
- provide trusted package metadata for that rollout
- accept updater lifecycle status back from the agent

This stage intentionally does **not** include:
- full admin rollout-management UI
- arbitrary remote command execution
- endpoint-management replacement
- final rollout analytics or reporting richness

## Why Stage 1 Is Intentionally Small
The rollout path is highly sensitive. If the first slice tries to solve package governance, rollout groups, admin workflow, silent upgrade, uninstall, rollback, analytics, and recovery all at once, the result will be slow and fragile.

The first safe backend contract only needs two agent-facing operations:
1. `GET /agent/rollout-intent`
2. `POST /agent/rollout-status`

That is enough to let the future updater:
- poll for an approved desired action
- receive package metadata instead of free-form commands
- report progress and failures back to the server

## Source Of Truth
The canonical contract definitions live in:
- `docs/openapi.yaml`

This document explains the intent and boundaries behind that contract.

## Stage 1 Scope
### In Scope
- device-scoped rollout intent retrieval
- device-scoped rollout status reporting
- signed package metadata transport
- rollout action vocabulary
- updater state vocabulary

### Out Of Scope
- admin release publishing workflows
- rollout-group management UX
- device targeting editor UX
- final audit dashboard
- package hosting implementation
- actual updater service code
- `MSI` authoring implementation

## Agent-Facing Endpoints
### 1. `GET /agent/rollout-intent`
Purpose:
- let the running agent discover whether a rollout currently applies to it

Behavior:
- authenticated by the existing agent session token
- device identity comes from the session context, not from a free-form target parameter
- returns `intent = null` when no rollout applies
- returns metadata only when a rollout is approved for that device

Why `GET`:
- safe polling shape
- naturally expresses current desired state
- avoids the server pushing arbitrary lifecycle commands over the realtime channel in the first slice

### 2. `POST /agent/rollout-status`
Purpose:
- let the updater report progress, success, and failure for a specific rollout

Behavior:
- authenticated by the existing agent session token
- tied to the calling device only
- records append-only status evidence for the rollout lifecycle
- supports intermediate and terminal states

Why `POST`:
- status is event-like, not a full replacement document
- the same rollout may produce multiple lifecycle updates

## Intent Payload Shape
The intent payload is intentionally narrow.

It includes:
- `rolloutId`
- `action`
- `targetVersion`
- `package`
- `mandatory`
- `deadlineAt`
- `notes`
- `createdAt`

The package block includes:
- `packageType`
- `packageUrl`
- `sha256`
- `signature`
- optional `releaseNotes`

Current implementation baseline:
- `signature` is interpreted as the expected Authenticode signer certificate thumbprint for the approved `MSI` payload.

### Important Boundary
The payload must not contain:
- shell commands
- PowerShell script text
- raw installer arguments from untrusted operators
- arbitrary URLs not associated with approved package metadata

## Allowed Rollout Actions
Stage 1 allows:
- `Upgrade`
- `Repair`
- `Uninstall`

Why these three:
- `Upgrade` is the main routine path
- `Repair` is useful for reinstalling the same approved version
- `Uninstall` supports controlled removal without inventing a separate command system

## Allowed Rollout States
Stage 1 accepts these updater states:
- `UpdateAvailable`
- `Downloading`
- `Staged`
- `InstallPending`
- `Installing`
- `Succeeded`
- `Failed`
- `UninstallPending`
- `Uninstalling`
- `Uninstalled`

These states are intentionally operational, not UI-facing.

## Minimal State Machine
### Upgrade Path
`UpdateAvailable -> Downloading -> Staged -> InstallPending -> Installing -> Succeeded`

Failure path:
`UpdateAvailable -> Downloading -> Failed`
or
`Installing -> Failed`

### Uninstall Path
`UninstallPending -> Uninstalling -> Uninstalled`

Failure path:
`Uninstalling -> Failed`

## Trust Rules
Stage 1 assumes:
- the agent session already identifies the device
- the backend decides whether a rollout applies
- the agent must not choose its own package source
- the updater must verify checksum and signature before execution

Stage 1 does **not** yet solve:
- exact package-signing infrastructure
- exact operator approval policy
- exact rollout-group resolution algorithm

Those remain later implementation details, but the contract is shaped so those decisions can be added without changing the core trust model.

## Why We Do Not Reuse Heartbeat For Rollout Status
Heartbeat should stay about liveness.

If rollout progress is merged into heartbeat too early:
- updater logic becomes coupled to heartbeat cadence
- failure diagnosis gets noisier
- rollout events become harder to audit and replay

So Stage 1 keeps rollout status as its own explicit endpoint.

## Why We Do Not Use Realtime Push For Rollout Intent Yet
The system already has realtime for communications, but rollout commands are more sensitive.

Stage 1 deliberately prefers polling because:
- easier to reason about
- easier to audit
- safer for the first updater slice
- avoids building remote lifecycle execution around transient stream semantics

Realtime-triggered rollout can be considered later as an optimization, not as the trust anchor.

## Database Direction
Stage 1 conceptually relies on:
- `agent_release_packages`
- `agent_rollout_intents`
- `agent_rollout_status_events`

These tables support:
- approved package metadata
- scoped rollout intent
- append-only status history

## Recommended First Implementation Order
1. Persist release package metadata.
2. Persist rollout intent records.
3. Implement `GET /agent/rollout-intent`.
4. Implement `POST /agent/rollout-status`.
5. Expose thin admin visibility only after the device contract is stable.

## Open Questions Deferred Beyond Stage 1
- How operators create and approve a rollout in the admin UI
- Whether rollout targeting needs dedicated groups in MVP
- Whether device rollout polling should be tied to heartbeat cadence or a separate timer
- Whether rollout manifest URLs are direct or short-lived signed URLs
- Whether uninstall should preserve forensic logs by policy

## Done Criteria For Stage 1 Implementation
Stage 1 can be considered implemented when:
- a known device can authenticate normally
- the device can fetch `intent = null` safely when no rollout applies
- the device can fetch approved rollout metadata when a rollout applies
- the device can post intermediate and terminal rollout status
- the server stores rollout status in append-only form
- the OpenAPI contract and persistence model match the implementation
