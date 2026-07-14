from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path("/Users/widjis/Documents/Projects/mti-alert-hub")
NODE_BIN = "/Users/widjis/.nvm/versions/node/v22.21.1/bin"
BACKEND_URL = "http://127.0.0.1:4033/health"
FRONTEND_URL = "http://127.0.0.1:8087/login"


def wait_for_url(url: str, timeout: int, process: subprocess.Popen[bytes], name: str) -> None:
    started_at = time.time()
    while time.time() - started_at < timeout:
        if process.poll() is not None:
            raise RuntimeError(f"{name} exited early with code {process.returncode}")
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if 200 <= response.status < 500:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f"{name} did not become ready at {url} within {timeout}s")


def main() -> None:
    env = os.environ.copy()
    env["PATH"] = f"{NODE_BIN}:{env.get('PATH', '')}"

    backend_env = env.copy()
    backend_env.update(
        {
            "NODE_ENV": "development",
            "BACKEND_PORT": "4033",
            "LDAP_ALLOWED_GROUPS": "",
            "ENABLED_DELIVERY_CHANNELS": "WindowsAgent",
            "ADMIN_SESSION_TTL_MINUTES": "120",
            "AGENT_SESSION_TTL_MINUTES": "30",
        }
    )
    frontend_env = env.copy()
    frontend_env.update(
        {
            "VITE_API_URL": "http://127.0.0.1:4033",
        }
    )

    backend_log = ROOT / "tmp" / "browser-validation-backend.log"
    frontend_log = ROOT / "tmp" / "browser-validation-frontend.log"

    with backend_log.open("wb") as backend_output, frontend_log.open("wb") as frontend_output:
        backend = subprocess.Popen(
            ["node", "backend/dist/index.js"],
            cwd=ROOT,
            env=backend_env,
            stdout=backend_output,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid,
        )
        frontend = None
        try:
            wait_for_url(BACKEND_URL, 30, backend, "backend")

            frontend = subprocess.Popen(
                ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "8087"],
                cwd=ROOT,
                env=frontend_env,
                stdout=frontend_output,
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid,
            )
            wait_for_url(FRONTEND_URL, 60, frontend, "frontend")

            result = subprocess.run(
                [sys.executable, str(ROOT / "tmp" / "browser_validate_reminder.py")],
                cwd=ROOT,
                check=False,
            )
            raise SystemExit(result.returncode)
        finally:
            for process in [frontend, backend]:
                if process and process.poll() is None:
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(os.getpgid(process.pid), signal.SIGKILL)


if __name__ == "__main__":
    main()
