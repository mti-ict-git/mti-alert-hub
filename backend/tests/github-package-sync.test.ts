import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GitHubPackageSyncService } from "../src/modules/devices/service/github-package-sync-service.js";

test("offline relay fails explicitly and does not enqueue", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "relay-test-"));
  try {
    const service = new GitHubPackageSyncService(root);
    assert.equal((await service.status()).available, false);
    await assert.rejects(service.request("tester"), /worker is unavailable/);
    assert.deepEqual(await fs.readdir(root), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("concurrent requests coalesce; status survives refresh and reports completed import", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "relay-test-"));
  try {
    await fs.writeFile(
      path.join(root, ".relay-heartbeat.json"),
      JSON.stringify({ time: Date.now() / 1000 }),
    );
    const service = new GitHubPackageSyncService(root);
    const results = await Promise.all(Array.from({ length: 8 }, () => service.request("tester")));
    assert.equal(new Set(results.map((result) => result.id)).size, 1);
    assert.ok(results.every((result) => result.state === "queued"));
    const request = JSON.parse(await fs.readFile(path.join(root, ".relay-request.json"), "utf8"));
    await fs.writeFile(
      path.join(root, ".relay-status.json"),
      JSON.stringify({ id: request.id, state: "running", message: "Verifying" }),
    );
    assert.equal((await service.request("tester")).state, "running");
    await fs.writeFile(
      path.join(root, ".relay-status.json"),
      JSON.stringify({ id: request.id, state: "completed", message: "1 imported", imported: 1 }),
    );
    await fs.unlink(path.join(root, ".relay-request.json"));
    assert.equal((await new GitHubPackageSyncService(root).status()).imported, 1);
    await fs.writeFile(
      path.join(root, ".relay-heartbeat.json"),
      JSON.stringify({ time: Date.now() / 1000 - 60 }),
    );
    assert.equal((await service.status()).available, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
