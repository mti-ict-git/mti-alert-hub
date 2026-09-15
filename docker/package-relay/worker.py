"""Outbound-only GitHub MSI relay. No cloud-supplied command is executed."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import threading
import uuid
import urllib.error
import urllib.request

MSI = "MTI.Alert.Agent.Setup.msi"
MANIFEST = MSI + ".rollout.json"
MAX_MSI = 512 * 1024 * 1024

def log(event, **fields):
    print(json.dumps({"event": event, **fields}), flush=True)

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()

class DownloadRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        from urllib.parse import urlparse
        url = urlparse(newurl)
        if url.scheme != "https" or url.hostname not in {
            "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"
        }:
            raise ValueError("Unexpected GitHub download redirect")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        redirected.remove_header("Authorization")
        return redirected

def fetch(api_path, token, limit, destination=None):
    # All authenticated requests are constructed against api.github.com.
    req = urllib.request.Request("https://api.github.com" + api_path, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/octet-stream" if destination else "application/vnd.github+json",
        "User-Agent": "MTI-Package-Relay",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    opener = urllib.request.build_opener(DownloadRedirect())
    with opener.open(req, timeout=60) as response:
        count = 0
        chunks = []
        stream = destination.open("wb") if destination else None
        try:
            while chunk := response.read(1024 * 1024):
                count += len(chunk)
                if count > limit:
                    raise ValueError("Download exceeds configured size limit")
                if stream:
                    stream.write(chunk)
                else:
                    chunks.append(chunk)
        finally:
            if stream:
                stream.close()
        return count if destination else json.loads(b"".join(chunks).decode("utf-8-sig"))

def validate_manifest(data, tag, signer):
    version = data.get("Version", "")
    if not isinstance(version, str) or not re.fullmatch(r"\d{1,3}\.\d{1,3}\.\d{1,5}", version):
        raise ValueError("Invalid MSI version")
    if tag != "agent-v" + version:
        raise ValueError("Release tag and manifest version differ")
    sha = data.get("Sha256", "")
    thumb = data.get("Thumbprint", "")
    if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", sha):
        raise ValueError("Invalid package SHA256")
    if not isinstance(thumb, str) or thumb.upper() != signer:
        raise ValueError("Manifest signer is not the configured signer")
    return version, sha.upper()

def verify_msi(path, version, signer, ca_file):
    # SHA1 here identifies the existing certificate thumbprint; it is not the package digest.
    result = subprocess.run([
        "osslsigncode", "verify", "-in", str(path),
        "-CAfile", ca_file, "-TSA-CAfile", "/etc/ssl/certs/ca-certificates.crt",
        "-require-leaf-hash", "sha1:" + signer,
    ], capture_output=True, timeout=120)
    if result.returncode:
        raise ValueError("Authenticode verification failed; check signer, CA, timestamp and revocation access")
    properties = subprocess.run(
        ["msiinfo", "export", str(path), "Property"],
        capture_output=True, text=True, check=True, timeout=30,
    ).stdout
    found = dict(line.split("\t", 1) for line in properties.splitlines() if "\t" in line)
    if found.get("ProductVersion") != version:
        raise ValueError("Signed MSI ProductVersion differs from manifest")
    return found

def install_package(staged, store, version, sha, signer, release_id, properties):
    target = store / ("MTI.Alert.Agent.Setup-" + version + ".msi")
    manifest = Path(str(target) + ".rollout.json")
    if target.exists() and digest(target) != sha:
        raise ValueError("Existing version has different bytes; use a new version")
    data = {
        "Version": version, "Sha256": sha, "Thumbprint": signer,
        "SignatureStatus": "Valid",
        "SignatureStatusMessage": "Verified by osslsigncode with trusted CA and pinned leaf certificate",
        "ProductCode": properties.get("ProductCode"),
        "ImportedFrom": "GitHub", "GitHubReleaseId": release_id,
        "ImportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    # Manifest first, MSI last: listing cannot see a new MSI without its metadata.
    pending = staged.parent / "registry.json"
    pending.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(pending, manifest)
    if not target.exists():
        os.replace(staged, target)
    log("package.imported", version=version, sha256=sha, releaseId=release_id)

def process_release(release, repo, token, store, signer, ca_file):
    if release.get("draft") or release.get("prerelease"):
        return
    tag = release.get("tag_name", "")
    if not re.fullmatch(r"agent-v\d{1,3}\.\d{1,3}\.\d{1,5}", tag):
        return
    assets = release.get("assets", [])
    matched = {name: [a for a in assets if a.get("name") == name] for name in (MSI, MANIFEST)}
    if any(len(items) != 1 for items in matched.values()):
        raise ValueError("Release must contain one MSI and one manifest")
    binary, metadata = matched[MSI][0], matched[MANIFEST][0]
    for asset, limit in ((binary, MAX_MSI), (metadata, 65536)):
        if type(asset.get("id")) is not int or type(asset.get("size")) is not int or not 0 < asset["size"] <= limit:
            raise ValueError("Invalid asset ID or size")
    staging = store / ".relay-staging"
    staging.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=staging) as directory:
        temp = Path(directory)
        meta_path = temp / MANIFEST
        size = fetch(f"/repos/{repo}/releases/assets/{metadata['id']}", token, 65536, meta_path)
        if size != metadata["size"]:
            raise ValueError("Truncated manifest download")
        data = json.loads(meta_path.read_text(encoding="utf-8-sig"))
        version, sha = validate_manifest(data, tag, signer)
        target = store / ("MTI.Alert.Agent.Setup-" + version + ".msi")
        saved_path = Path(str(target) + ".rollout.json")
        if target.exists() and saved_path.exists():
            saved = json.loads(saved_path.read_text(encoding="utf-8"))
            if (saved.get("Sha256") == sha and saved.get("Thumbprint") == signer
                    and saved.get("GitHubReleaseId") == release["id"] and digest(target) == sha):
                return "skipped"
        msi_path = temp / MSI
        size = fetch(f"/repos/{repo}/releases/assets/{binary['id']}", token, MAX_MSI, msi_path)
        if size != binary["size"] or digest(msi_path) != sha:
            raise ValueError("Package size or SHA256 mismatch")
        properties = verify_msi(msi_path, version, signer, ca_file)
        install_package(msi_path, store, version, sha, signer, release["id"], properties)
        return "imported"

def write_state(store, name, data):
    pending = store / (name + ".tmp")
    pending.write_text(json.dumps(data), encoding="utf-8")
    os.replace(pending, store / name)

def heartbeat_loop(store):
    while True:
        try:
            write_state(store, ".relay-heartbeat.json", {"time": time.time()})
        except OSError:
            log("relay.heartbeat.failed")
        time.sleep(5)

def run_sync(store, repo, token, signer, ca_file):
    request_path = store / ".relay-request.json"
    request = json.loads(request_path.read_text(encoding="utf-8")) if request_path.exists() else None
    state = {"id": request["id"] if request else str(uuid.uuid4()), "state": "running",
             "message": "Checking published releases on GitHub.", "imported": 0, "skipped": 0, "rejected": 0}
    write_state(store, ".relay-status.json", state)
    log("relay.sync.started", requestId=state["id"], requestedBy=request.get("requestedBy") if request else "scheduled")
    errors = []
    try:
        releases = fetch(f"/repos/{repo}/releases?per_page=100", token, 4 * 1024 * 1024)
        for release in reversed(releases):
            try:
                if not release.get("draft") and not release.get("prerelease"):
                    state["message"] = "Downloading and verifying published packages."
                    write_state(store, ".relay-status.json", state)
                outcome = process_release(release, repo, token, store, signer, ca_file)
                if outcome:
                    state[outcome] += 1
            except Exception as error:
                state["rejected"] += 1
                detail = str(error) if isinstance(error, ValueError) else "Download or verification failed; check worker logs."
                errors.append(detail)
                log("package.rejected", releaseId=release.get("id"), reason=type(error).__name__, detail=detail)
        state["state"] = "failed" if errors else "completed"
        state["message"] = f'{state["imported"]} imported, {state["skipped"]} already available, {state["rejected"]} rejected.'
        if errors:
            state["message"] += " " + errors[0]
    except Exception as error:
        state["state"] = "failed"
        code = getattr(error, "code", None)
        state["message"] = ("GitHub request failed (HTTP " + str(code) + "). Check repository access and worker token.") if code else "GitHub connection failed. Check worker connectivity and logs."
        log("relay.poll.failed", reason=type(error).__name__, status=code)
    state["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    write_state(store, ".relay-status.json", state)
    if request:
        request_path.unlink(missing_ok=True)
    return state

def main():
    import fcntl
    repo = os.environ["GITHUB_PACKAGE_REPOSITORY"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("Repository must be OWNER/REPO")
    token = Path(os.environ.get("GITHUB_TOKEN_FILE", "/run/secrets/github_package_download_token")).read_text().strip()
    if not token:
        raise ValueError("Download token is empty")
    signer = os.environ["PACKAGE_SIGNER_THUMBPRINT"].replace(" ", "").upper()
    if not re.fullmatch(r"[A-F0-9]{40}", signer):
        raise ValueError("Signer thumbprint must be 40 hex characters")
    ca_file = os.environ.get("PACKAGE_CA_FILE", "/run/secrets/package_signing_ca")
    if not Path(ca_file).is_file():
        raise ValueError("Public signing trust bundle is missing")
    store = Path(os.environ.get("PACKAGE_STORE", "/packages"))
    store.mkdir(parents=True, exist_ok=True)
    lock = (store / ".relay.lock").open("a")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    interval = max(30, int(os.environ.get("PACKAGE_POLL_SECONDS", "120")))
    log("relay.started", repository=repo, pollSeconds=interval)
    write_state(store, ".relay-heartbeat.json", {"time": time.time()})
    threading.Thread(target=heartbeat_loop, args=(store,), daemon=True).start()
    next_poll = 0.0
    while True:
        if time.monotonic() >= next_poll or (store / ".relay-request.json").exists():
            run_sync(store, repo, token, signer, ca_file)
            next_poll = time.monotonic() + interval
            if os.environ.get("PACKAGE_RUN_ONCE") == "1":
                return
        time.sleep(1)

if __name__ == "__main__":
    main()
