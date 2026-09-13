import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  OrganizationManagementService,
  organizationInput,
  organizationKind,
  isLocalOrganizationSource,
} from "../src/modules/organization/service/organization-management-service.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
function fixture(
  options: { source?: string; child?: boolean; parentStatus?: string; duplicate?: boolean } = {},
) {
  const calls: { sql: string; params: unknown[] }[] = [];
  let committed = false;
  const tx = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes("select *, updated_at"))
        return [
          { id: "id", source_system: options.source ?? null, version: "v1", site_id: "parent" },
        ];
      if (sql.includes("select status")) return [{ status: options.parentStatus ?? "Active" }];
      if (sql.includes("status='Active'")) return options.child ? [{ id: "child" }] : [];
      if (sql.includes("lower(name)")) return options.duplicate ? [{ id: "duplicate" }] : [];
      if (sql.includes("returning id")) return [{ id: "saved" }];
      return [];
    },
  };
  const db = {
    ...tx,
    async withTransaction(run: (client: unknown) => Promise<unknown>) {
      const result = await run(tx);
      committed = true;
      return result;
    },
  } as unknown as DatabaseClient;
  return { service: new OrganizationManagementService(db), calls, committed: () => committed };
}
const input = {
  name: "Test site",
  code: "TEST",
  status: "Active" as const,
  parentId: null,
  updatedAt: "v1",
};
test("organization schemas reject unknown kinds and blank names", () => {
  assert.equal(organizationKind.safeParse("users;drop table sites").success, false);
  assert.equal(organizationInput.safeParse({ ...input, name: " " }).success, false);
  assert.equal(isLocalOrganizationSource("AD"), false);
  assert.equal(isLocalOrganizationSource("Local"), true);
});
test("create stores local entry and audit in same transaction", async () => {
  const f = fixture();
  await f.service.save("sites", null, input, "operator");
  assert.ok(f.committed());
  assert.ok(f.calls.some((c) => c.sql.includes("'Local'")));
  assert.ok(f.calls.some((c) => c.sql.includes("insert into public.audit_logs")));
});
test("external source and stale version block writes", async () => {
  for (const [options, payload] of [
    [{ source: "AD" }, input],
    [{}, { ...input, updatedAt: "old" }],
  ] as const) {
    const f = fixture(options);
    await assert.rejects(f.service.save("sites", "id", payload, "operator"));
    assert.equal(
      f.calls.some((c) => c.sql.startsWith("update ")),
      false,
    );
    assert.equal(f.committed(), false);
  }
});
test("active children block parent deactivation", async () => {
  const f = fixture({ child: true });
  await assert.rejects(f.service.save("sites", "id", { ...input, status: "Inactive" }, "operator"));
  assert.equal(f.committed(), false);
});
test("inactive parent, changed parent and duplicate names are rejected", async () => {
  await assert.rejects(
    fixture({ parentStatus: "Inactive" }).service.save(
      "areas",
      null,
      { ...input, parentId: "parent" },
      "operator",
    ),
  );
  await assert.rejects(
    fixture().service.save("areas", "id", { ...input, parentId: "other" }, "operator"),
  );
  await assert.rejects(fixture({ duplicate: true }).service.save("sites", null, input, "operator"));
});
test("deactivation preserves assignments and never deletes", async () => {
  const f = fixture();
  await f.service.save("sites", "id", { ...input, status: "Inactive" }, "operator");
  assert.ok(f.committed());
  assert.equal(
    f.calls.some((c) => /delete from|update public.devices|update public.employees/i.test(c.sql)),
    false,
  );
});
