import { spawn } from "node:child_process";

function spawnShell(command) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "cmd.exe";
    return spawn(comspec, ["/d", "/s", "/c", command], { stdio: "inherit" });
  }

  return spawn("sh", ["-lc", command], { stdio: "inherit" });
}

const processes = [
  spawnShell("npm run backend:dev"),
  spawnShell("npm run dev"),
];

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of processes) {
    if (child.killed) {
      continue;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      try {
        child.kill();
      } catch {}
    }
  }
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }
    const normalized = typeof code === "number" ? code : 0;
    shutdown(normalized);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
