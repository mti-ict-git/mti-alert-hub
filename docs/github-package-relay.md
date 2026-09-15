# GitHub package relay (Phase 4)

Implement a private GitHub Release transport for locally signed MSI packages. Source references: deployment-and-environment.md, windows-agent-rollout-stage-1-contract.md and existing filesystem package registry in device-action-service.ts.

The laptop uploads only a signed MSI and minimal manifest. Releases are staged as drafts and published after both assets exist. Published version tags must not be overwritten. The server polls releases using a separate read-only token and outbound HTTPS. It verifies the package SHA256, MSI ProductVersion, Authenticode trust chain and pinned signer before exposing a versioned MSI plus registry manifest on backend_local_packages. Import does not create rollout intents or execute commands from metadata.

Trust anchors are public PEM certificates provided independently by the operator. Private keys stay on the signing laptop. Signature verification errors fail closed. Downloads are bounded and staged; imports are idempotent and do not replace different bytes for an existing version. One worker owns the shared-volume import lock.

No new HTTP endpoint or database migration is needed. The current registry already reads MSI files and adjacent .rollout.json files. Import audit is structured worker output and a persistent manifest with release provenance; it does not create an admin audit-log row.

Implementation and local checks precede live GitHub publication or production deployment.


## Setup on the laptop

1. Initialize the private package repository with a README commit. The read-only repository check on 2026-09-15 succeeded, but the repository reported size 0.
2. Keep GIT_REPO_URL and GITHUB_PACKAGE_UPLOAD_TOKEN in the parent project's .env, outside Git. The uploader also accepts GITHUB_PACKAGE_REPOSITORY=OWNER/REPO.
3. Ensure the MSI's Authenticode status is Valid on the signing laptop. A thumbprint alone is insufficient.
4. Build from the parent repository root, using an unused package version:

    powershell -NoProfile -ExecutionPolicy Bypass -File ".\MTI.Alert.Agent\Installer\build-agent-package.ps1" -EnvironmentProfile Production -ServerBaseUrl "https://mtialert.merdekabattery.com/" -PackageVersion "1.0.14" -UploadGitHub

The GitHub path does not call the production API. Do not combine UploadGitHub and UploadProduction when the VPN path is unwanted. The publisher creates tag agent-v1.0.14 as a draft, uploads canonical MSI and minimal manifest, then publishes. Published versions cannot be overwritten. A repository needs an initial commit.

If upload fails, use the MsiPath printed by the build or the MSI in the build output, without rebuilding:

    powershell -NoProfile -ExecutionPolicy Bypass -File ".\MTI.Alert.Agent\Installer\publish-agent-github.ps1" -MsiPath "C:\absolute\path\MTI.Alert.Agent.Setup.msi"

The adjacent .msi.rollout.json must exist. Matching assets in an existing draft are reused; different bytes are rejected. If publishing already succeeded, the script rejects re-publication. Check the existing release instead. No package or manifest commands are executed by the worker.

## One-time server setup

Use the existing production checkout and the same Compose project name (-p, if production uses one). The shared volume must be the existing backend_local_packages volume, not a new project's volume.

1. Transfer/pull the reviewed implementation to the server. No commits or pushes were performed by this task.
2. Add to the server .env:

    GITHUB_PACKAGE_REPOSITORY=OWNER/REPO
    AGENT_CODE_SIGNING_CERT_THUMBPRINT=40_HEX_CHARACTERS_FROM_TRUSTED_SIGNER

3. Create secrets/ beside docker-compose.yml. It is excluded from Git and Docker build context.
4. Store a separate fine-grained GitHub token (selected package repository, Contents read-only) as secrets/github-package-download-token.txt. Do not copy the upload token to the server.
5. Store the public signing trust anchors as secrets/package-signing-ca.pem. Export the issuing root CA as Base-64 X.509 from Windows Certificate Manager. Include required intermediate certificates in the PEM bundle. For a self-signed signing certificate, export that public certificate. Do not export or transfer a PFX/private key. Obtain trust anchors from the known signing environment, not from downloaded release metadata.
6. Verify server egress permits api.github.com and GitHub release asset hosts, plus timestamp/revocation services needed by the signing certificate. No inbound port is exposed by this worker.
7. Build/start only the worker (reuse production's Compose project options):

    docker compose -f docker-compose.yml -f docker-compose.package-relay.yml up -d --build --no-deps package-relay

8. Inspect logs:

    docker compose -f docker-compose.yml -f docker-compose.package-relay.yml logs --tail=100 -f package-relay

The first run checks existing published agent-v releases too, up to the newest 100 releases. Drafts/prereleases are ignored. Poll interval is 120 seconds; downloads have timeouts and bounded sizes. Failures retry next poll. Run only one replica; a shared-volume lock rejects overlapping workers.

## Acceptance

Publish one approved signed test package. Expect package.imported with version/hash in worker logs and a versioned MSI in Devices. Compare version, signer and SHA256 to local build output. Test rollout on one explicitly selected device afterward; this relay does not create rollout intents.

On verification failure, check public CA bundle, configured thumbprint, timestamp chain, certificate validity/revocation and network. The worker does not bypass verification. Changing the cloud metadata to claim Valid cannot bypass osslsigncode.

Stop the worker without removing packages:

    docker compose -f docker-compose.yml -f docker-compose.package-relay.yml stop package-relay

Do not use down -v: existing production package storage must be preserved.

## Verification evidence and limits

- Token/repository read-only check passed; private repository confirmed. This does not prove write permission.
- Publisher and build script PowerShell syntax checks passed.
- Publisher mock tests passed: assets precede publication; minimal metadata excludes local paths/commands; upload failure stays unpublished; unsigned package rejected before upload.
- 10 Python tests passed: manifest/version/signer validation, signature failure, ProductVersion mismatch, idempotent store/conflicting bytes, draft filtering, hash mismatch cleanup and credential-free restricted redirects.
- Signature subprocess calls were mocked in unit tests. Real osslsigncode/MSI interoperability, Docker image build, CA-chain verification, GitHub upload and registry UI acceptance are still pending: Docker is unavailable on this laptop.
- No release was created, no production deployment happened, and no device rollout was sent.
- No API schema or database change: worker uses the existing filesystem registry and adjacent manifest contract.

## Live small-file diagnostic — 2026-09-16

A 79-byte non-sensitive text asset uploaded successfully using Windows PowerShell Invoke-WebRequest to a separate draft/prerelease diagnostic release (ID 389304265). It was left unpublished and is ignored by the worker. The agent-v1.0.16 draft already contained an uploaded 124,411,904-byte MSI and its 178-byte manifest. GitHub reported no branches and returned HTTP 409, Git Repository is empty, for its tag reference. An initial README commit is needed before publishing.

Publisher now checks that the repository contains commits before upload, reports the failing stage/HTTP status with redacted message, and compares existing manifests by version/hash/signer instead of JSON whitespace/key order. PowerShell syntax and publisher mock tests passed, including draft resume with equivalent JSON formatting. No production package was published or replaced during the diagnostic. After creating README, retry the existing signed MSI with publish-agent-github.ps1; do not rebuild version 1.0.16 into different bytes.
