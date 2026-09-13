import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runDeviceRolloutBatch } from "../src/lib/device-bulk-rollout";

test("rollout snapshots and deduplicates targets, continues after failure without retry", async () => {
  const targets = [
    { id: "a", hostname: "A" },
    { id: "b", hostname: "B" },
    { id: "a", hostname: "A" },
    { id: "c", hostname: "C" },
  ];
  const calls: string[] = [];
  const progress: number[] = [];
  let inFlight = 0;
  const results = await runDeviceRolloutBatch(
    targets,
    async (id) => {
      assert.equal(inFlight++, 0);
      calls.push(id);
      targets[1].hostname = "changed";
      await Promise.resolve();
      inFlight--;
      if (id === "b") throw new Error("Connection lost");
      return { currentlyActiveRollouts: 2 };
    },
    (n) => progress.push(n),
  );
  assert.deepEqual(calls, ["a", "b", "c"]);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(
    results.map((r) => r.success),
    [true, false, true],
  );
  assert.equal(results[1].hostname, "B");
  assert.equal(results[0].activeRollouts, 2);
});

test("empty rollout selection sends no requests", async () => {
  assert.deepEqual(
    await runDeviceRolloutBatch([], async () => assert.fail("unexpected request")),
    [],
  );
});
