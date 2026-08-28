# Windows Agent Updater Service Specification

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-08-26`
- Audience: `Windows Agent Engineers`, `Operations`, `Security Reviewers`

## Purpose
This document defines the technical specification for the local `Windows Agent Updater Service`.

It is the Stage 2 companion to:
- `docs/windows-agent-rollout-blueprint.md`
- `docs/windows-agent-rollout-stage-1-contract.md`

The goal is to make the updater implementable without re-deciding:
- local trust boundaries
- IPC shape
- file-system layout
- update and uninstall flow
- failure handling and local evidence

## Scope
This specification covers:
- the updater service role
- installation shape
- local IPC with the tray app
- staging, verification, and execution flow
- update, repair, and uninstall behavior
- logging, local state, and recovery expectations

This specification does **not** yet define:
- the full backend rollout admin UI
- exact code implementation details
- the final signing infrastructure
- the exact `WiX` authoring layout

## Relationship To Other Documents
If there is a conflict, follow this order:
1. `docs/openapi.yaml` for backend contract shape
2. `docs/windows-agent-rollout-stage-1-contract.md` for rollout intent and status boundaries
3. `docs/windows-agent-rollout-blueprint.md` for rollout architecture decisions
4. this document for updater service implementation detail

## Service Role
The updater service is the privileged local lifecycle executor for the Windows Agent.

It exists because the tray app must not:
- overwrite its own binaries
- uninstall itself directly
- execute arbitrary remote commands

The updater service should:
- receive approved rollout requests from the local tray app
- verify package trust and execution preconditions
- stop the tray app safely
- run silent `MSI` upgrade, repair, or uninstall
- restart the tray app when appropriate
- record local evidence and reportable result state

## Process Model
### Recommended Shape
- Windows Service
- installed machine-wide
- installed by the same `MSI` as the tray app
- service name recommendation: `MTI.Alert.Updater`
- display name recommendation: `MTI Alert Updater`

### Recommended Account
- `LocalSystem`

Reason:
- enough privilege for machine-wide install, repair, startup registration maintenance, and uninstall

This may be narrowed later if security review identifies a lower-privilege model that still supports `MSI` lifecycle actions reliably.

## Trust Boundary
The updater service must trust only:
- the local machine context
- the locally authenticated tray app
- rollout metadata already approved by the backend
- approved package types

The updater service must not trust:
- arbitrary user-supplied file paths
- free-form command text
- unverified package URLs
- unauthenticated localhost callers

## Local IPC
### Recommended IPC
- authenticated named pipe

### Why Named Pipe
- local-only transport
- easier to secure against non-authorized local callers than ad hoc localhost HTTP
- natural fit for a machine-local tray app to service interaction

### IPC Requirements
The service should only accept requests from:
- the installed `MTI Alert Agent` tray process
- a local support utility explicitly introduced later

The IPC layer should validate at minimum:
- caller is local
- caller is the expected executable path or signed binary
- request schema is valid
- requested action is one of `Upgrade`, `Repair`, or `Uninstall`

### IPC Request Shape
The tray app should pass:
- `rolloutId`
- `action`
- `targetVersion`
- `packageType`
- `packageUrl`
- `sha256`
- `signature`
- `mandatory`
- `deadlineAt`

The service should reject the request if any required rollout fields are missing.

## Local File-System Layout
Recommended machine-wide base path:
- `%ProgramData%\\MTI Alert\\`

Recommended subdirectories:
- `%ProgramData%\\MTI Alert\\Updater\\`
- `%ProgramData%\\MTI Alert\\Updater\\Staging\\`
- `%ProgramData%\\MTI Alert\\Updater\\Logs\\`
- `%ProgramData%\\MTI Alert\\Updater\\State\\`
- `%ProgramData%\\MTI Alert\\Updater\\Backup\\` optional

Recommended files:
- `last-rollout.json`
- `active-rollout.json`
- `updater.log`
- `quiesce-request.json` optional handoff marker
- `pre-uninstall.json` optional uninstall marker

## Local State Model
The updater service should persist enough local state to survive process restart during rollout.

Minimum local state fields:
- `rolloutId`
- `action`
- `targetVersion`
- `packagePath`
- `packageSha256`
- `currentState`
- `lastErrorCode`
- `lastErrorMessage`
- `startedAt`
- `lastUpdatedAt`

### Important Rule
Local updater state is operational evidence, not the source of rollout truth. The backend remains authoritative for approved intent.

## Startup And Service Lifecycle
### On Service Start
The updater service should:
1. initialize logs
2. load last persisted local updater state
3. detect whether a previous rollout was interrupted
4. decide whether the interrupted rollout should be:
   - resumed
   - marked failed
   - left for operator review

### On Machine Boot
The service does not need to auto-upgrade immediately on startup.

Normal expected behavior:
- the tray app starts at logon
- the tray app polls `GET /agent/rollout-intent`
- the tray app forwards eligible rollout intent to the updater service

## Accepted Actions
### Upgrade
Use when the device should move to a newer approved version.

### Repair
Use when the same approved version should be re-applied to repair a broken install or missing startup registration.

### Uninstall
Use when the endpoint should remove the agent through an approved remote lifecycle action.

## Package Rules
### Allowed Package Type
Stage 2 baseline allows only:
- `MSI`

### Required Package Validations
Before execution, the service must validate:
- package type is allowed
- package URL is present
- package file is downloaded successfully
- downloaded checksum matches `sha256`
- package signature is valid
- version intent is consistent with the action

Current implementation baseline:
- `signature` is treated as the expected Authenticode signer certificate thumbprint for the `MSI`.
- the updater verifies both the downloaded `sha256` and the embedded signer thumbprint before the package can move to `Staged`.

### Version Rules
For `Upgrade`:
- target version should be greater than installed version unless a controlled exception path is later approved

For `Repair`:
- target version should equal installed version or explicitly allow reinstall semantics

For `Uninstall`:
- installed version may be reported, but package download may not be required if uninstall can run from installed product metadata

## Installed Version Detection
The updater service should determine installed version through a stable local source, such as:
- installed product metadata
- a version file installed with the app
- Windows Installer product information

The service should not rely only on the tray app's self-reported version for execution safety.

## Tray App Quiesce Flow
Before `Upgrade` or `Repair`, the service should request the tray app to quiesce.

Expected steps:
1. service sends a quiesce request over local IPC
2. tray app flushes local queues if possible
3. tray app closes realtime and background loops cleanly
4. tray app exits within a bounded timeout
5. service verifies the tray process has stopped

If the tray app does not exit within timeout:
- service may terminate the process
- service must record that forced termination occurred

Recommended timeout:
- `15` to `30` seconds

## Download And Staging Flow
### Normal Path
1. receive rollout request
2. persist `UpdateAvailable` or `UninstallPending`
3. download package to staging directory
4. write `Downloading`
5. complete download
6. verify checksum
7. verify signature
8. write `Staged`

### Staging Requirements
- staging file name should include rollout id or version
- partial download should not overwrite a prior good staged package
- failed or tampered packages should be deleted or quarantined

## MSI Execution Flow
### Upgrade Or Repair
Recommended execution pattern:
- `msiexec /i "<packagePath>" /qn /norestart`

Service should:
1. persist `InstallPending`
2. quiesce tray app
3. persist `Installing`
4. execute `msiexec`
5. capture exit code
6. verify install success
7. verify startup registration still exists
8. restart tray app
9. persist `Succeeded` or `Failed`

### Uninstall
Recommended execution pattern:
- `msiexec /x {ProductCode} /qn /norestart`

Service should:
1. persist `UninstallPending`
2. quiesce tray app
3. persist `Uninstalling`
4. write pre-uninstall marker
5. execute `msiexec`
6. capture exit code
7. persist final local evidence if still possible

## Restart Behavior
After successful `Upgrade` or `Repair`, the service should:
- re-launch the tray app
- confirm the process starts
- allow the tray app to resume normal session and heartbeat flow

After `Uninstall`, the service should not restart the tray app.

## Startup Registration Verification
The updater service should verify that the installer-created startup registration still exists after:
- install
- repair
- upgrade

For Stage 2, the expected startup mechanism is:
- scheduled task at user logon

The service should record whether startup registration is healthy in its local result and in the status reported back through the tray app.

## Failure Model
The service should emit failure with a clear stage.

Recommended failure categories:
- `IPC_AUTH_FAILED`
- `INVALID_REQUEST`
- `PACKAGE_DOWNLOAD_FAILED`
- `CHECKSUM_MISMATCH`
- `SIGNATURE_INVALID`
- `VERSION_RULE_REJECTED`
- `TRAY_QUIESCE_TIMEOUT`
- `INSTALLER_EXECUTION_FAILED`
- `STARTUP_REGISTRATION_MISSING`
- `RESTART_FAILED`
- `UNINSTALL_FAILED`

## Logging
### Local Log Events
The updater log should record:
- rollout request received
- action type
- rollout id
- package URL host or source summary
- download started and completed
- checksum result
- signature result
- quiesce requested
- tray stopped normally or forcibly
- installer command started
- installer exit code
- startup registration check result
- tray restart result
- final state

### Logging Rule
Do not log:
- session tokens
- raw credentials
- private signing material
- full sensitive query strings if package URLs are signed

## Reportable Status Back To Backend
The updater service itself does not call the backend directly in the current baseline.

Recommended flow:
1. updater service records local state
2. tray app reads or receives updater state
3. tray app calls `POST /agent/rollout-status`

This keeps external server communication owned by the main agent runtime and avoids duplicating session management in the updater service.

Current implementation baseline:
- the tray app now reads `%ProgramData%\MTI Alert\Updater\State\active-rollout.json` and `%ProgramData%\MTI Alert\Updater\State\last-rollout.json`
- rollout progress already produced by the updater, such as `Downloading`, `Staged`, and `Failed`, is now reported back through the agent polling loop on the next successful sync
- the updater now also executes `msiexec /i "<packagePath>" /qn /norestart` for staged `Upgrade` and `Repair` actions, records installer exit code plus detected installed version, and attempts tray-app restart through the `MTI Alert Agent` scheduled task first with a direct executable launch fallback
- because scheduled-task registration is not yet installed by the current MSI implementation, startup-registration health is currently reported as observability data instead of being treated as a hard install failure in every case

## Recovery Behavior
If the service restarts mid-rollout:
- inspect persisted local state
- decide whether the last action reached a terminal state
- if not terminal, classify as interrupted rollout
- expose the interrupted state so the tray app can report it

Recommended Stage 2 baseline:
- interrupted install should be marked `Failed` with interruption detail unless later logic explicitly supports resume

## Security Requirements
- local IPC must be authenticated
- only approved package types are allowed
- checksum verification is mandatory
- signature verification is mandatory
- no arbitrary command execution
- service should run only the known silent installer patterns defined by policy
- uninstall should require an approved rollout intent, not a local user request through unsupported UI

## Operational Diagnostics
The service should make these values locally observable:
- installed version detected
- active rollout id
- current updater state
- last updater state
- last error code
- last error message
- startup registration status
- last successful upgrade time

These diagnostics may later be surfaced through the tray app for support workflows.

## Recommended Implementation Notes
### Language
Prefer the same `.NET` stack as the tray app to reduce maintenance and packaging complexity.

### Packaging
The updater service binary should be shipped in the same `MSI` as the tray app.

### Service Independence
The updater service should stay as small as possible:
- lifecycle execution
- local validation
- local evidence

It should not become a second copy of the full agent runtime.

## Stage 2 Acceptance Criteria
This specification is complete enough when it clearly defines:
- service role and privilege boundary
- local IPC mechanism
- file-system layout
- accepted actions
- update, repair, and uninstall flows
- logging and failure model
- backend reporting boundary

## Expected Next Stage
After this specification, the next practical stage is:
- implementation planning for `WiX/MSI` packaging plus installer component map

That stage should define:
- components and features
- installed file layout
- service registration
- scheduled task registration
- upgrade and uninstall behavior inside the installer
