// Isolated PostgreSQL fixture: temporary tables, always rolled back.
import { strict as assert } from "node:assert";
import { Pool } from "pg";
import { loadEnv } from "../src/app/config/env.js";
import { resolvePostgresConnectionConfig } from "../src/infrastructure/db/postgres-connection-config.js";
import {
  DevicePlacementService,
  placementUpdate,
  type Placement,
} from "../src/modules/devices/service/device-placement-service.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
const pool = new Pool(resolvePostgresConnectionConfig(loadEnv()));
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const table of ["sites", "areas", "devices", "audit_logs"])
    await client.query(
      `create temporary table ${table} (like public.${table} including defaults) on commit drop`,
    );
  const sites = (
    await client.query(
      "insert into pg_temp.sites(code,name) values ('A','A'),('B','B') returning id",
    )
  ).rows;
  const area = (
    await client.query(
      "insert into pg_temp.areas(site_id,name) values ($1,'Area A') returning id",
      [sites[0].id],
    )
  ).rows[0];
  const device = (
    await client.query(
      "insert into pg_temp.devices(hostname,site_id,area_id,location_label,ownership_mode,last_directory_department) values ('TEST', $1,$2,'Old label','LocationOwned','AD Department') returning id",
      [sites[0].id, area.id],
    )
  ).rows[0];
  const adapter = {
    async query(sql: string, params: unknown[] = []) {
      return (await client.query(sql.replaceAll("public.", "pg_temp."), params)).rows;
    },
    async withTransaction<T>(run: (tx: unknown) => Promise<T>) {
      return run(adapter);
    },
  } as unknown as DatabaseClient;
  const service = new DevicePlacementService(adapter);
  const row = await service.get(device.id);
  const expected: Placement = {
    siteId: row.siteId as string,
    areaId: row.areaId as string,
    locationLabel: row.locationLabel as string,
    ownershipMode: "LocationOwned",
  };
  assert.equal(
    placementUpdate.safeParse({ expected, changes: { department: "Manual" } }).success,
    false,
  );
  assert.equal(placementUpdate.safeParse({ expected, changes: {} }).success, false);
  await assert.rejects(
    service.update(device.id, { expected, changes: { siteId: sites[1].id } }, "test"),
  );
  await assert.rejects(
    service.update(
      device.id,
      { expected, changes: { siteId: sites[1].id, areaId: area.id } },
      "test",
    ),
  );
  await service.update(
    device.id,
    { expected, changes: { siteId: sites[1].id, areaId: null } },
    "test",
  );
  const after = await service.get(device.id);
  assert.equal(after.siteId, sites[1].id);
  assert.equal(after.areaId, null);
  assert.equal(after.locationLabel, "Old label");
  assert.equal(after.department, "AD Department");
  await assert.rejects(
    service.update(device.id, { expected, changes: { locationLabel: "stale" } }, "test"),
  );
  assert.equal(
    (await client.query("select count(*)::int as n from pg_temp.audit_logs")).rows[0].n,
    1,
  );
  console.log(
    "PASS: placement change, unchanged fields, AD preservation, invalid area/site, stale conflict, strict input, audit. Fixtures rolled back.",
  );
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
