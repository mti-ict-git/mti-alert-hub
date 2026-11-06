import test from "node:test";
import assert from "node:assert/strict";
import { registerDeviceRoutes } from "../src/modules/devices/controller/register-device-routes.js";
import { DeviceReadService } from "../src/modules/devices/service/device-read-service.js";
import { withAccess } from "../src/modules/access/service/access-context.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";

test("target reference allows useful labels but excludes unrelated directory details", async () => {
  const row = {
    id: "id",
    deviceIdentifier: "device",
    hostname: "NB",
    siteId: "site",
    siteName: "MTI",
    areaId: null,
    areaName: null,
    ownershipMode: "LocationOwned",
    status: "Online",
    lastActiveUserIdentifier: "DOMAIN\\user",
    lastDirectoryUsername: "user",
    lastDirectoryDisplayName: "User Name",
    lastDirectoryDepartment: "Engineering",
    lastDirectoryEmail: "private@example.test",
    lastDirectoryMobile: "private",
    lastDirectoryEmployeeNumber: "private",
    lastDirectoryTitle: "private",
  };
  const routes = registerDeviceRoutes({
    deviceReadService: { listDevices: async () => ({ items: [row], page: { totalPages: 1 } }) },
  } as never);
  const route = routes.find((r) => r.path === "/reference/devices")!;
  const result = await route.handler({ url: new URL("http://fixture/reference/devices") } as never);
  const data = result.body as { items: Record<string, unknown>[] };
  assert.equal(data.items[0].siteName, "MTI");
  assert.equal(data.items[0].lastDirectoryDepartment, "Engineering");
  for (const field of [
    "lastDirectoryEmail",
    "lastDirectoryMobile",
    "lastDirectoryEmployeeNumber",
    "lastDirectoryTitle",
  ])
    assert.equal(field in data.items[0], false);
});

test("search row/count SQL retains scope and joins names, including raw Windows user", async () => {
  const queries: { sql: string; values: unknown[] }[] = [];
  const db = {
    maybeQuery: async (_table: string, sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return sql.includes("count(*)") ? [{ totalItems: 0 }] : [];
    },
  } as unknown as DatabaseClient;
  const service = new DeviceReadService(db, { onlineSeconds: 120, staleSeconds: 900 });
  await withAccess(
    {
      userId: "qa",
      authorizationVersion: 1,
      role: "CommunicationOperator",
      scopes: [{ scopeType: "Site", scopeValue: "11111111-1111-4111-8111-111111111111" }],
    },
    () => service.listDevices({ page: 2, pageSize: 200, search: "O'Connor" }),
  );
  assert.equal(queries.length, 2);
  for (const q of queries) {
    assert.match(q.sql, /d.site_id = '11111111-1111-4111-8111-111111111111'::uuid/);
    assert.match(q.sql, /left join public.sites site/);
    assert.match(q.sql, /left join public.areas area/);
    assert.match(q.sql, /site.name::text ilike \$1/);
    assert.match(q.sql, /area.name::text ilike \$1/);
    assert.match(q.sql, /last_active_user_identifier::text ilike \$1/);
    assert.equal(q.sql.includes("O'Connor"), false);
    assert.equal(q.values[0], "%O'Connor%");
  }
  assert.deepEqual(queries[0].values, ["%O'Connor%", 200, 200]);
  assert.deepEqual(queries[1].values, ["%O'Connor%"]);
});
