// Explicit integration check: all fixture tables are temporary and rolled back.
import { strict as assert } from "node:assert";
import { Pool } from "pg";
import { loadEnv } from "../src/app/config/env.js";
import { resolvePostgresConnectionConfig } from "../src/infrastructure/db/postgres-connection-config.js";
import { OrganizationManagementService } from "../src/modules/organization/service/organization-management-service.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
const pool = new Pool(resolvePostgresConnectionConfig(loadEnv()));
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const table of [
    "sites",
    "areas",
    "departments",
    "sections",
    "employees",
    "devices",
    "audit_logs",
  ]) {
    await client.query(
      `create temporary table ${table} (like public.${table} including defaults) on commit drop`,
    );
  }
  const adapter = {
    async query(sql: string, params: unknown[] = []) {
      return (await client.query(sql.replaceAll("public.", "pg_temp."), params)).rows;
    },
    async withTransaction<T>(run: (tx: unknown) => Promise<T>) {
      return run(adapter);
    },
  } as unknown as DatabaseClient;
  const service = new OrganizationManagementService(adapter);
  const site = await service.save(
    "sites",
    null,
    { name: "Integration Site", code: "QA", parentId: null, status: "Active" },
    "integration-test",
  );
  const area = await service.save(
    "areas",
    null,
    { name: "Integration Area", code: "A", parentId: site.id as string, status: "Active" },
    "integration-test",
  );
  const listed = await service.list();
  assert.equal(listed.sites.length, 1);
  assert.equal(listed.areas.length, 1);
  const siteRow = listed.sites[0];
  await assert.rejects(
    service.save(
      "sites",
      site.id as string,
      {
        name: "Integration Site",
        code: "QA",
        parentId: null,
        status: "Inactive",
        updatedAt: siteRow.updatedAt as string,
      },
      "integration-test",
    ),
  );
  await service.save(
    "areas",
    area.id as string,
    {
      name: "Area renamed",
      code: "A",
      parentId: site.id as string,
      status: "Inactive",
      updatedAt: listed.areas[0].updatedAt as string,
    },
    "integration-test",
  );
  await service.save(
    "sites",
    site.id as string,
    {
      name: "Site renamed",
      code: "QA",
      parentId: null,
      status: "Inactive",
      updatedAt: siteRow.updatedAt as string,
    },
    "integration-test",
  );
  const result = await service.list();
  assert.equal(result.sites[0].status, "Inactive");
  assert.equal(result.areas[0].name, "Area renamed");
  assert.equal(
    (await client.query("select count(*)::int as n from pg_temp.audit_logs")).rows[0].n,
    4,
  );
  console.log(
    "PASS: PostgreSQL create/list/update/deactivation/child guard/audit. Temporary fixtures rolled back.",
  );
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
