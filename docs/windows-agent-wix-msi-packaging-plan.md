# Windows Agent WiX MSI Packaging Plan

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-08-26`
- Audience: `Windows Agent Engineers`, `Release Engineers`, `Operations`

## Purpose
This document defines the Stage 3 baseline for packaging the Windows Agent as an enterprise-managed `MSI`.

It turns the rollout blueprint and updater-service specification into a concrete installer plan covering:
- package shape
- installer components
- file layout
- service registration
- scheduled task registration
- upgrade and uninstall behavior

## Source Documents
- `docs/windows-agent-rollout-blueprint.md`
- `docs/windows-agent-rollout-stage-1-contract.md`
- `docs/windows-agent-updater-service-spec.md`
- `docs/windows-agent-client-specification.md`
- `docs/deployment-and-environment.md`
- `docs/implementation-roadmap.md`

## Goals
- Produce a machine-wide `MSI` suitable for `GPO`, `Intune`, `SCCM`, or `PDQ`.
- Install both the tray app and the updater service in one managed package.
- Register auto-start at user logon through a scheduled task.
- Support silent install, silent upgrade, repair, and uninstall.
- Preserve local device identity and app state across normal upgrades.
- Keep uninstall behavior predictable for both remote lifecycle and endpoint-management fallback.

## Non-Goals
- Do not define exact `WiX` XML yet.
- Do not define certificate issuance or signing pipeline internals.
- Do not implement bootstrapper chains or multi-package bundles in this stage.
- Do not add optional features that create partial install modes unless later needed.

## Packaging Baseline
### Package Type
- `MSI`

### Authoring Tool
- `WiX`

### Install Scope
- machine-wide install

### Default Install Path
Recommended base path:
- `%ProgramFiles%\\MTI Alert\\Agent\\`

Recommended subpaths:
- `%ProgramFiles%\\MTI Alert\\Agent\\App\\`
- `%ProgramFiles%\\MTI Alert\\Agent\\Updater\\`

Current implementation compatibility note:
- the existing installer flow in this repository currently preserves the historical root install path `C:\Program Files\MTI\MTI.Alert.Agent\` for the tray app executable
- the first updater-service implementation is added under `C:\Program Files\MTI\MTI.Alert.Agent\Updater\`
- a later cleanup may still move the tray app into a dedicated `App` subfolder if the validation scripts and installed-path assumptions are migrated together

Writable machine-wide operational data:
- `%ProgramData%\\MTI Alert\\`

### Versioning Baseline
- `ProductVersion` should track the released agent version
- `UpgradeCode` must remain stable across normal product evolution
- `ProductCode` should change on major upgrade as expected by MSI rules

## Recommended MSI Features
For the first baseline, keep one main feature tree to avoid support complexity.

### Feature 1. CoreAgent
Includes:
- tray app binaries
- updater service binaries
- shared libraries
- default config templates if needed
- startup scheduled task registration
- service registration

Reason:
- the updater service is not optional in the approved rollout model
- avoiding partial feature states keeps support and upgrade simpler

## Installer Component Map
### Component Group A. Tray Application Binaries
Recommended contents:
- `MTI.Alert.Agent.exe`
- application assemblies and dependencies
- static assets required by the tray app
- runtime configuration files that are safe to replace on upgrade

Install location:
- target architecture recommendation: `%ProgramFiles%\\MTI Alert\\Agent\\App\\`
- current implementation compatibility baseline: `C:\Program Files\MTI\MTI.Alert.Agent\`

### Component Group B. Updater Service Binaries
Recommended contents:
- updater service executable
- updater service assemblies and dependencies
- local IPC contract assemblies if split out

Install location:
- target architecture recommendation: `%ProgramFiles%\\MTI Alert\\Agent\\Updater\\`
- current implementation compatibility baseline: `C:\Program Files\MTI\MTI.Alert.Agent\Updater\`

### Component Group C. Machine-Wide Directories
Create and permission as needed:
- `%ProgramData%\\MTI Alert\\`
- `%ProgramData%\\MTI Alert\\Updater\\`
- `%ProgramData%\\MTI Alert\\Updater\\Logs\\`
- `%ProgramData%\\MTI Alert\\Updater\\State\\`
- `%ProgramData%\\MTI Alert\\Updater\\Staging\\`
- `%ProgramData%\\MTI Alert\\Updater\\Backup\\` optional

Important:
- installer should create writable directories without placing mutable operational state under `%ProgramFiles%`

### Component Group D. Shared Version Metadata
Recommended contents:
- installed version marker if used
- product metadata accessible to tray app and updater

Possible forms:
- version file
- registry product metadata
- MSI product metadata only, if later confirmed sufficient

### Component Group E. Updater Service Registration
The installer should:
- create the `MTI.Alert.Updater` Windows Service
- set startup type to automatic or automatic delayed start based on final implementation choice
- ensure the service account matches the approved baseline
- define service failure behavior later if needed

Recommended first baseline:
- startup type: `Automatic`
- account: `LocalSystem`

### Component Group F. Scheduled Task Registration
The installer should create:
- a logon-triggered scheduled task for the tray app

Recommended task behavior:
- trigger: at user logon
- action: run tray app executable from installed path
- run level: highest only if truly required; otherwise normal user context is preferred
- task should be recreated consistently on repair and upgrade

Recommended task name:
- `MTI Alert Agent`

### Component Group G. Registry Footprint
Minimal registry usage only.

Possible values:
- install path
- product version
- startup registration health marker only if operationally useful

Avoid storing mutable business state in registry when file-backed local state is already the chosen client baseline.

## Service Registration Plan
The updater service installer component should:
- install the service executable
- register service name and display name
- configure startup mode
- allow the service to start after install
- stop and replace the service during upgrade when needed
- remove the service during uninstall

Important service lifecycle expectations:
- service must not be left orphaned after uninstall
- repair must restore missing service registration
- upgrade must preserve service identity while updating binaries

## Scheduled Task Plan
The scheduled task should:
- start the tray app at user logon
- point to the installed executable path
- not depend on a developer-local path
- survive upgrade and repair
- be removed during uninstall

Current implementation note:
- the updater now already looks for a scheduled task named `MTI Alert Agent` when verifying startup registration and when attempting post-upgrade tray restart
- the current `WiX` implementation now creates that scheduled task during install and repair through elevated `schtasks.exe` custom actions, and removes it during uninstall
- the custom actions must live directly inside `<Package>` rather than a standalone `<Fragment>` without references; otherwise WiX drops them from the compiled MSI even though they appear valid in source
- the custom actions use `[System64Folder]schtasks.exe` rather than `[SystemFolder]schtasks.exe` to avoid the 32-bit `SysWOW64` redirect for per-machine 64-bit deployments

Fallback note:
- `Run` registry startup remains fallback-only and should not be the primary install baseline unless later operational evidence forces a change

## Upgrade Plan
### Upgrade Strategy
Preferred baseline:
- major upgrade via MSI standard upgrade path

Why:
- predictable replacement behavior
- natural fit for machine-wide package evolution
- compatible with endpoint-management deployment and updater-driven silent install

### Upgrade Expectations
Upgrade should:
- replace tray app binaries
- replace updater service binaries
- preserve `%ProgramData%` local state
- preserve `deviceIdentifier`
- preserve reminder-policy cache and local event queue unless a controlled migration says otherwise
- preserve scheduled task registration or recreate it if necessary

### Upgrade Sequencing Expectations
The updater service will quiesce the tray app before upgrade, but the installer should still behave safely if:
- the tray app is already closed
- the service is being updated in place
- a repair runs with the tray app absent

### Upgrade Failure Expectations
If the MSI upgrade fails:
- MSI rollback should be preferred as the first safety mechanism
- the pre-existing working version should remain usable when rollback succeeds
- the updater service should record installer exit code and stage of failure

## Repair Plan
Repair should be supported through MSI standard behavior.

Repair should restore:
- missing tray app binaries
- missing updater service binaries
- missing service registration
- missing scheduled task registration

Repair should not wipe:
- `deviceIdentifier`
- healthy `%ProgramData%` operational state

## Uninstall Plan
### Controlled Uninstall
Uninstall may be triggered by:
- endpoint-management tooling
- the updater service executing approved uninstall intent

### Uninstall Should Remove
- tray app binaries
- updater service binaries
- service registration
- scheduled task registration
- install-path registry metadata

### Uninstall May Preserve By Policy
- `%ProgramData%\\MTI Alert\\Updater\\Logs\\`
- last uninstall marker
- selected diagnostics useful for operator review

The exact retention policy may be finalized later, but the installer must not silently leave active runtime components behind.

## File Ownership And Mutability Rules
### Immutable Installed Files
Store under `%ProgramFiles%`:
- tray binaries
- updater service binaries
- packaged assets
- non-user-editable defaults

### Mutable Operational Files
Store under `%ProgramData%`:
- updater logs
- staged packages
- local updater state
- local device state and cached reminder execution data

Rule:
- no runtime code path should attempt to write mutable operational state into `%ProgramFiles%`

## Signing And Trust Assumptions
This stage does not finalize certificate operations, but the packaging plan assumes:
- released MSI artifacts are signed
- updater verification logic can trust the approved signing chain later selected
- unsigned production MSI packages are not acceptable for the rollout model

## WiX Authoring Structure Recommendation
The eventual installer source should likely be split into:
- product definition
- feature definition
- tray app component group
- updater service component group
- scheduled task component
- directory tree definition
- install or upgrade properties

This is a structural recommendation only, not a locked file layout.

## Suggested Build Outputs
For each release:
- `MTI.Alert.Agent.msi`
- version metadata
- checksum file or published checksum value
- release notes
- silent install and uninstall command reference

Optional later outputs:
- detached manifest
- signature verification reference

## Operational Command Baseline
Recommended commands:
- install: `msiexec /i MTI.Alert.Agent.msi /qn /norestart`
- repair: `msiexec /fa MTI.Alert.Agent.msi /qn /norestart`
- upgrade: `msiexec /i MTI.Alert.Agent.msi /qn /norestart`
- uninstall: `msiexec /x {ProductCode} /qn /norestart`

## Installer Verification Checklist
The installer slice should eventually verify:
- clean install on a fresh machine
- service registration exists after install
- scheduled task exists after install
- tray app launches correctly at user logon
- upgrade preserves local device identity
- repair recreates missing scheduled task
- repair recreates missing updater service registration
- uninstall removes binaries
- uninstall removes scheduled task
- uninstall removes updater service
- `%ProgramData%` retention behavior matches the documented policy

## Risks And Guardrails
### Risk: Partial install state
Mitigation:
- keep the first feature tree simple and non-optional

### Risk: Mutable data accidentally placed under `%ProgramFiles%`
Mitigation:
- explicitly separate install path and operational state path in installer authoring

### Risk: Service upgrade breaks remote lifecycle capability
Mitigation:
- verify service registration and start behavior after install, repair, and upgrade

### Risk: Scheduled task drift causes silent startup failures
Mitigation:
- require repair and upgrade verification to check task existence and action path

## Stage 3 Acceptance Criteria
This packaging plan is complete enough when it clearly defines:
- MSI scope and install path
- installer component groups
- service registration baseline
- scheduled task baseline
- upgrade, repair, and uninstall behavior
- mutable versus immutable file placement
- installer verification checklist

## Expected Next Stage
After this document, the next practical step is:
- decide whether to remain in documentation mode and specify the admin rollout release workflow, or
- start implementation planning for the actual installer project structure and build pipeline
