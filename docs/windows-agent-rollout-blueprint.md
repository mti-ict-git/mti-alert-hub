# MTI Alert Windows Agent Rollout Blueprint

## Document Status
- Version: `0.1`
- Status: `Draft Blueprint`
- Last Updated: `2026-08-26`
- Audience: `Windows Agent Engineers`, `Backend Engineers`, `Operations`

## Purpose
This document defines the implementation blueprint for Windows Agent packaging, startup, update, rollback, and remote uninstall behavior for broader desktop rollout.

It turns the approved hybrid rollout direction into a concrete technical baseline that can later be implemented without re-deciding the same architecture in code.

This blueprint does not yet change the live API contract. Any backend endpoint or payload addition described here must still update `docs/openapi.yaml` before implementation begins.

## Source Documents
- `docs/implementation-roadmap.md`
- `docs/technical-implementation-plan.md`
- `docs/windows-agent-client-specification.md`
- `docs/deployment-and-environment.md`
- `docs/architecture-decisions.md`
- `docs/open-questions-and-challenges.md`

## Problem Statement
The Windows Agent pilot may require:
- repeated bulk deployment
- silent install and uninstall
- automatic startup at user logon
- routine remote update without physically visiting the endpoint
- remote uninstall when an endpoint should no longer run the agent

A pure endpoint-management rollout is acceptable for bootstrap and emergency recovery, but too rigid for frequent patching. A pure self-updating tray app is also not acceptable because it creates file-locking, privilege, and remote-execution trust problems.

## Design Goals
- Keep the user-facing client as a normal tray-first WPF app.
- Support machine-managed install, repair, upgrade, and uninstall.
- Allow routine update and uninstall to be initiated from the running agent.
- Keep endpoint-management tooling available as bootstrap and break-glass fallback.
- Preserve stable `deviceIdentifier` and local state across normal upgrades.
- Make package trust, rollout scope, and rollback behavior auditable.

## Non-Goals
- Do not turn the backend into a generic remote shell or software-distribution engine.
- Do not allow arbitrary command text to be executed on endpoints.
- Do not require the tray app to replace or uninstall itself directly.
- Do not remove endpoint-management compatibility in favor of app-only updating.

## Approved Baseline
The rollout model is hybrid:
- `GPO`, `Intune`, `SCCM`, or `PDQ` remain the authoritative bootstrap and break-glass paths.
- Routine update and uninstall may be orchestrated by the running agent.
- Lifecycle execution must be delegated to a dedicated updater component.
- The preferred package format is `MSI`.
- Startup at user logon should be enforced by an installer-created `Scheduled Task`.

## Target Architecture
The rollout baseline uses four cooperating pieces:

### 1. Windows Agent Tray App
Responsibilities:
- maintain the normal agent session, realtime, heartbeat, and UI behavior
- report current app version and updater visibility state
- receive approved rollout intent from the backend
- hand rollout intent to the local updater service
- surface local user messaging only when required by policy

The tray app must not:
- overwrite its own binaries directly
- call `msiexec` against itself for live replacement
- execute arbitrary scripts received from the server

### 2. Local Updater Service
Recommended shape:
- Windows Service installed machine-wide with the agent package
- service account: `LocalSystem` unless a later security review narrows this further
- owns the privileged lifecycle operations for update, repair, rollback trigger, and uninstall

Responsibilities:
- accept rollout requests only from the local trusted agent process
- download the approved package or manifest into a protected staging directory under `ProgramData`
- verify version intent, checksum, and signature before execution
- stop the tray app cleanly
- run `MSI` upgrade, repair, or uninstall in silent mode
- restart the tray app after success when appropriate
- persist rollout logs and last-result status locally

Preferred local communication:
- named pipe or another local authenticated IPC channel
- no unauthenticated localhost HTTP listener

### 3. Package Repository
Responsibilities:
- host signed `MSI` artifacts and release manifests
- provide immutable versioned package URLs
- expose package metadata needed by the updater:
  - `version`
  - `packageUrl`
  - `sha256`
  - `signature`
  - `packageType`
  - optional `releaseNotes`

The package repository may be:
- internal file share
- internal web server
- object storage behind signed URLs

### 4. Backend Rollout Control
Responsibilities:
- decide which devices or rollout groups should move to which version
- return rollout metadata to eligible agents
- persist rollout intent, status, error reason, and last success or failure evidence
- revoke or disable rollout for unhealthy populations

The backend should send approved rollout metadata only, not shell commands.

## Packaging Blueprint
### Package Format
Preferred package:
- `MSI`

Recommended tooling:
- `WiX`

Required MSI behaviors:
- silent install
- silent upgrade
- silent uninstall
- support machine-wide installation
- install both the tray app and updater service
- register the startup `Scheduled Task`

Recommended command conventions:
- install: `msiexec /i MTI.Alert.Agent.msi /qn`
- upgrade: `msiexec /i MTI.Alert.Agent.msi /qn`
- uninstall: `msiexec /x {ProductCode} /qn`

### Installed Components
The package should install:
- `MTI Alert Agent` tray application
- `MTI Alert Updater` Windows Service
- shared configuration and version metadata
- startup `Scheduled Task` for user logon
- protected staging and log directories under `ProgramData`

### Local Persistence Rules
Upgrades must preserve:
- `deviceIdentifier`
- local reminder policy data
- pending local event queues
- updater history needed for support

Controlled uninstall may remove:
- binaries
- startup registration
- updater service

Controlled uninstall may preserve by policy:
- recent logs
- final uninstall marker

## Startup Blueprint
Preferred startup mechanism:
- installer-created `Scheduled Task` at user logon

Reasoning:
- more manageable in enterprise environments than startup-folder shortcuts
- more explicit than relying only on `Run` registry keys
- easier to recreate consistently on repair or upgrade

Fallback:
- `Run` registry startup only if the scheduled-task path proves operationally unsuitable in a specific environment

## Update Flow Blueprint
### Normal Update Sequence
1. The agent heartbeat or a dedicated sync call receives rollout metadata from the backend.
2. The tray app validates that the rollout is intended for this device or rollout group.
3. The tray app sends the rollout request to the local updater service.
4. The updater service downloads the package or manifest to a protected staging location.
5. The updater service verifies:
   - intended version
   - package checksum
   - package signature
   - package type is allowed
6. The updater service asks the tray app to quiesce and exit.
7. The updater service executes the silent MSI upgrade.
8. The updater service verifies install success.
9. The updater service restarts the tray app.
10. The agent reports the new installed version and rollout result back to the backend.

### Recommended Update Policy Controls
- rollout ring or channel such as `pilot`, `stable`, `urgent`
- optional maintenance window
- optional deadline for mandatory upgrade
- retry policy with bounded attempts
- backoff after repeated failure
- rollback escalation to operations when threshold is exceeded

## Remote Uninstall Blueprint
### Normal Uninstall Sequence
1. Operations approve an uninstall intent for a device or rollout scope.
2. The backend exposes uninstall metadata to the device.
3. The tray app hands the intent to the updater service.
4. The updater service records a local pre-uninstall marker.
5. The tray app closes.
6. The updater service runs silent MSI uninstall.
7. The backend should treat the device as revoked or retired if it does not return after the uninstall deadline.

### Important Rule
Remote uninstall must be modeled as a constrained lifecycle action, not as remote arbitrary command execution.

## Break-Glass And Recovery Blueprint
Endpoint-management tooling remains the fallback when:
- the tray app is not healthy
- the updater service is missing or unhealthy
- the device is too old to understand the current rollout contract
- a forced uninstall is required without depending on the running agent
- trust has been degraded and the device should be redeployed cleanly

Examples:
- force reinstall via `Intune`
- forced silent uninstall via `SCCM`
- startup-registration repair via `GPO`

## Rollout State Model
The system should eventually support these states:
- `Idle`
- `UpdateAvailable`
- `Downloading`
- `Staged`
- `InstallPending`
- `Installing`
- `Succeeded`
- `Failed`
- `RollbackRequired`
- `UninstallPending`
- `Uninstalling`
- `Uninstalled`

Minimum device telemetry fields:
- `agentVersion`
- `desiredVersion`
- `rolloutChannel`
- `updaterState`
- `lastRolloutAttemptAt`
- `lastRolloutResult`
- `startupRegistered`

## Backend Blueprint
The backend rollout slice should eventually provide:
- release metadata management
- rollout-group targeting
- desired-version evaluation per device
- rollout status ingestion
- device-level rollout history
- admin visibility for failed rollout populations

Preferred integration direction:
- extend existing agent sync semantics rather than inventing a separate unmanaged command tunnel
- keep rollout intent auditable like other high-risk administrative actions

Possible contract shapes to evaluate during implementation:
- add rollout intent to `POST /agent/heartbeat` response
- add a dedicated `GET /agent/runtime-policy` or `GET /agent/rollout-intent`
- add a dedicated updater status endpoint for lifecycle result reporting

The exact contract choice remains open until implementation begins and `docs/openapi.yaml` is updated.

## Security Guardrails
The rollout path is security-sensitive and must follow these rules:
- backend never sends arbitrary script or shell text
- updater only accepts approved package types and trusted manifest structure
- package source must be trusted and immutable
- checksum verification is mandatory
- signature verification is mandatory
- lifecycle actions must be authorized and auditable on the backend
- local IPC between tray app and updater service must be authenticated
- uninstall and update intent should be scoped to explicit device or rollout groups

## Observability And Audit Blueprint
Local logs should capture:
- rollout request received
- package download started and completed
- checksum and signature validation outcome
- tray app shutdown request
- installer exit code
- restart attempt
- final success or failure reason

Backend visibility should capture:
- who approved the rollout
- which devices were targeted
- current installed version
- desired version
- last rollout state
- error category
- whether fallback endpoint-management action was required

## Failure And Rollback Model
If upgrade fails:
- the updater service should report the exact stage of failure
- the tray app should remain on the previous working version when MSI rollback succeeds automatically
- the backend should mark the device as failed rather than repeatedly hammering the same action without operator review

If uninstall fails:
- report the uninstall failure reason
- keep endpoint-management fallback available
- allow backend operators to move the device into a `break-glass required` bucket

## Recommended Implementation Phases
### Phase A. Packaging Foundation
- create `WiX` MSI packaging
- install tray app plus updater service
- register startup scheduled task
- support silent install and uninstall

### Phase B. Local Updater Foundation
- implement trusted local IPC
- implement package download, checksum verification, and signature verification
- implement silent MSI upgrade and restart flow
- write local updater logs and status

### Phase C. Backend Rollout Visibility
- persist device app version and updater state
- add desired-version evaluation
- expose rollout status to admin operations
- add audit logs for rollout approval and uninstall approval

### Phase D. Break-Glass Operations
- validate `Intune`, `SCCM`, `PDQ`, or `GPO` fallback procedure
- document redeploy and forced-removal steps in the runbook
- challenge unhealthy-agent recovery

## Verification Checklist For Future Execution
- MSI install works on a clean machine
- MSI upgrade preserves `deviceIdentifier` and local state
- uninstall removes binaries and startup registration
- startup registration survives upgrade and repair
- updater rejects tampered package checksum
- updater rejects invalid signature
- backend can detect failed rollout state
- fallback endpoint-management uninstall still works when the tray app is offline

## Open Items To Resolve Before Implementation
- exact package-signing approach and certificate handling
- exact backend rollout contract shape and response semantics
- whether the updater service downloads packages directly or receives only pre-resolved signed URLs
- whether uninstall should preserve any local forensic logs by default
- whether rollback should be explicit or rely only on MSI transaction behavior

## Recommended Next Document Updates During Execution
When implementation starts, the following documents will need synchronized changes:
- `docs/openapi.yaml`
- `docs/database-schema-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/operational-runbook.md`
- `docs/windows-agent-client-specification.md`
