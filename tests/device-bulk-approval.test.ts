import assert from "node:assert/strict";
import test from "node:test";
import { approveDeviceRequests } from "../src/lib/device-bulk-approval";

test("approvals continue after a failed request and expose per-device outcomes", async () => {
  const calls: string[] = [];
  const progress: number[] = [];
  const results = await approveDeviceRequests(
    [
      { id: "a", hostname: "Laptop A" },
      { id: "b", hostname: "Laptop B" },
      { id: "c", hostname: "Laptop C" },
    ],
    async (id) => {
      calls.push(id);
      if (id === "b") throw new Error("Already decided");
    },
    (completed) => progress.push(completed),
  );
  assert.deepEqual(calls, ["a", "b", "c"]);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(
    results.map((r) => r.approved),
    [true, false, true],
  );
  assert.equal(results[1].error, "Already decided");
  const retryCalls: string[] = [];
  await approveDeviceRequests(
    results.filter((r) => !r.approved),
    async (id) => {
      retryCalls.push(id);
    },
  );
  assert.deepEqual(retryCalls, ["b"]);
});

test("snapshot targets, deduplicate request IDs, and avoid concurrent submissions", async () => {
  const targets = [
    { id: "a", hostname: "Laptop A" },
    { id: "a", hostname: "Laptop A" },
    { id: "b", hostname: "Laptop B" },
  ];
  const calls: string[] = [];
  let active = 0;
  const results = await approveDeviceRequests(targets, async (id) => {
    assert.equal(active++, 0);
    calls.push(id);
    targets.splice(0); // A polling update must not change the already-confirmed batch.
    await Promise.resolve();
    active--;
  });
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal(results.length, 2);
});

test("empty selection performs no approval; unknown failures remain unconfirmed", async () => {
  assert.deepEqual(
    await approveDeviceRequests([], async () => {
      assert.fail("must not call");
    }),
    [],
  );
  const [result] = await approveDeviceRequests([{ id: "a", hostname: "Laptop A" }], async () => {
    throw null;
  });
  assert.equal(result.approved, false);
  assert.match(result.error!, /Refresh device data/);
});
