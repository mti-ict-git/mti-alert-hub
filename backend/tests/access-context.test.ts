import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withAccess,
  currentAccess,
  locationScopeSql,
  referenceScopeSql,
  requireLocation,
  appendScopeWhere,
  type RequestAccess,
} from "../src/modules/access/service/access-context.js";
const site = "11111111-1111-4111-8111-111111111111",
  area = "22222222-2222-4222-8222-222222222222";
const actor: RequestAccess = {
  userId: site,
  role: "ITOperator",
  authorizationVersion: 1,
  scopes: [{ scopeType: "Site", scopeValue: site }],
};
test("Concurrent asynchronous access contexts do not leak scope between requests", async () => {
  await Promise.all([
    withAccess(actor, async () => {
      await new Promise((r) => setTimeout(r, 15));
      assert.equal(currentAccess()?.userId, site);
      requireLocation(site, area);
      assert.throws(() => requireLocation(null, null), { code: "NOT_FOUND" });
    }),
    withAccess({ ...actor, userId: area, scopes: [] }, async () => {
      await Promise.resolve();
      assert.equal(currentAccess()?.userId, area);
      assert.equal(locationScopeSql("d.site_id", "d.area_id"), "false");
    }),
  ]);
  assert.equal(currentAccess(), undefined);
});
test("Invalid grants cannot become SQL and columns cannot come from request input", () => {
  assert.throws(() =>
    withAccess({ ...actor, scopes: [{ scopeType: "Site", scopeValue: "x' or true--" }] }, () =>
      locationScopeSql("d.site_id", "d.area_id"),
    ),
  );
  withAccess(actor, () => assert.throws(() => locationScopeSql("d.site_id;delete", "d.area_id")));
});
test("Pagination/count conditions retain search and conjunctively restrict scope", () =>
  withAccess(actor, () => {
    const where = appendScopeWhere(
      { clause: "where (name ilike $1 or code ilike $1)", params: ["%test%"] },
      locationScopeSql("d.site_id", "d.area_id"),
    );
    assert.match(where.clause, /where \(name ilike \$1 or code ilike \$1\) and/);
    assert.ok(where.clause.includes(site));
    assert.deepEqual(where.params, ["%test%"]);
  }));
test("Area-only reference sites derive their parent without treating the area UUID as a site grant", () =>
  withAccess({ ...actor, scopes: [{ scopeType: "Area", scopeValue: area }] }, () => {
    const sql = referenceScopeSql("sites");
    assert.ok(sql.includes("access_area.site_id = sites.id"));
    assert.ok(sql.includes(`access_area.id = '${area}'`));
    assert.ok(!sql.includes(`sites.id = '${area}'`));
    assert.throws(() => requireLocation(site, null), { code: "NOT_FOUND" });
    requireLocation(site, area);
  }));
