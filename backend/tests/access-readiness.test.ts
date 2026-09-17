import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAccessReadiness } from "../src/modules/access/service/access-readiness.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
function database(exists: boolean, count: number) {
  const sqls: string[] = [];
  const db = {
    tableExists: async () => exists,
    query: async (sql: string) => {
      sqls.push(sql);
      return sql.includes("verified")
        ? []
        : sql.includes("count(*)::int as count")
          ? [{ count }]
          : [{ legacyCommunications: 2, legacyRollouts: 1 }];
    },
  } as unknown as DatabaseClient;
  return { db, sqls };
}
test("Read-only readiness rejects missing schema and missing verified administrator", async () => {
  await assert.rejects(checkAccessReadiness(database(false, 1).db), /migrations through 0020/);
  await assert.rejects(
    checkAccessReadiness(database(true, 0).db),
    /No verified Active Global Administrator/,
  );
});
test("Readiness inventories pending legacy work without writing users or jobs", async () => {
  const { db, sqls } = database(true, 1);
  const result = await checkAccessReadiness(db);
  assert.deepEqual(result, {
    ready: true,
    verifiedAdministrators: 1,
    legacyCommunications: 2,
    legacyRollouts: 1,
  });
  assert.ok(sqls.every((sql) => sql.trim().startsWith("select")));
});
