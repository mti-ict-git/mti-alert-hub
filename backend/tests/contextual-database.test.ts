import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createContextualDatabase,
  afterCommit,
} from "../src/infrastructure/db/contextual-database.js";
import type { DatabaseClient, TransactionClient } from "../src/infrastructure/db/connection.js";

function fixture() {
  const events: string[] = [];
  let sequence = 0;
  const base: DatabaseClient = {
    query: async () => {
      events.push("outside");
      return [];
    },
    maybeQuery: async () => [],
    tableExists: async () => true,
    ping: async () => {},
    async withTransaction(run) {
      const id = ++sequence;
      const tx: TransactionClient = {
        ...base,
        query: async () => {
          events.push("query:" + id);
          return [];
        },
      };
      events.push("begin:" + id);
      try {
        const result = await run(tx);
        events.push("commit:" + id);
        return result;
      } catch (e) {
        events.push("rollback:" + id);
        throw e;
      }
    },
  };
  return { db: createContextualDatabase(base), events };
}
test("Nested collaborating services commit atomically before dispatch", async () => {
  const { db, events } = fixture();
  await db.withTransaction(async () => {
    await db.query("first");
    await db.withTransaction(async () => {
      await db.query("nested");
      await afterCommit(db, async () => {
        events.push("dispatch");
        await db.query("after");
      });
    });
    assert.ok(!events.includes("dispatch"));
  });
  assert.deepEqual(events, ["begin:1", "query:1", "query:1", "commit:1", "dispatch", "outside"]);
});
test("Rollback discards deferred notification dispatch", async () => {
  const { db, events } = fixture();
  await assert.rejects(
    db.withTransaction(async () => {
      await afterCommit(db, async () => {
        events.push("dispatch");
      });
      throw Error("audit failure");
    }),
    /audit failure/,
  );
  assert.deepEqual(events, ["begin:1", "rollback:1"]);
});
test("Concurrent requests use independent transactions", async () => {
  const { db, events } = fixture();
  await Promise.all([
    db.withTransaction(async () => {
      await new Promise((r) => setTimeout(r, 15));
      await db.query("a");
    }),
    db.withTransaction(async () => {
      await db.query("b");
    }),
  ]);
  assert.deepEqual(events, ["begin:1", "begin:2", "query:2", "commit:2", "query:1", "commit:1"]);
});
