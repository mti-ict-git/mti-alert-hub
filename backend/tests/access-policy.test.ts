import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessRole,
  assignmentSchema,
  allowsLocation,
  requirePermission,
  rolePermissions,
  requiresEmergencyPermission,
} from "../src/modules/access/model/permission-catalog.js";
import {
  decodeDirectoryGuid,
  encodeDirectoryGuid,
} from "../src/modules/access/service/directory-identity.js";
const site = "11111111-1111-4111-8111-111111111111",
  area = "22222222-2222-4222-8222-222222222222";
const input = {
  roleId: "ITOperator",
  scopes: [{ scopeType: "Site", scopeValue: site }],
  expectedRevision: 1,
  reason: "Approved site coverage",
};
test("Viewer can export recipient details but cannot mutate access or notifications", () => {
  requirePermission("ManagementViewer", "reports.export");
  requirePermission("ManagementViewer", "reports.recipients.read");
  for (const p of ["notifications.publish", "access.manage", "rollouts.apply"] as const)
    assert.throws(() => requirePermission("ManagementViewer", p));
});
test("Emergency is limited to the two confirmed roles", () => {
  for (const r of accessRole.options) {
    if (["CentralAdmin", "EmergencyOfficer"].includes(r))
      requirePermission(r, "notifications.emergency");
    else assert.throws(() => requirePermission(r, "notifications.emergency"));
  }
  assert.ok(requiresEmergencyPermission("Critical", null));
  assert.ok(requiresEmergencyPermission("Info", "ForceFullscreen"));
  assert.equal(requiresEmergencyPermission("Info", null), false);
});
test("Scope never widens empty or local grants to Global", () => {
  assert.equal(allowsLocation([], site, area), false);
  assert.equal(allowsLocation([{ scopeType: "Site", scopeValue: site }], null, null), false);
  assert.equal(allowsLocation([{ scopeType: "Site", scopeValue: site }], site, area), true);
  assert.equal(allowsLocation([{ scopeType: "Area", scopeValue: area }], site, site), false);
  assert.equal(allowsLocation([{ scopeType: "Global", scopeValue: "*" }], null, null), true);
});
test("Reject invalid admin, duplicate, mixed and arbitrary grants", () => {
  assert.ok(assignmentSchema.safeParse(input).success);
  for (const scopes of [
    [],
    [input.scopes[0], input.scopes[0]],
    [{ scopeType: "Global", scopeValue: "*" }, input.scopes[0]],
    [{ scopeType: "Department", scopeValue: site }],
  ]) {
    assert.equal(assignmentSchema.safeParse({ ...input, scopes }).success, false);
  }
  assert.equal(assignmentSchema.safeParse({ ...input, roleId: "CentralAdmin" }).success, false);
  assert.equal(
    assignmentSchema.safeParse({ ...input, permissions: ["access.manage"] }).success,
    false,
  );
  assert.throws(() => requirePermission("LocalOperator", "notifications.publish"));
  assert.ok(rolePermissions.ITOperator.includes("packages.import"));
  assert.equal(rolePermissions.ITOperator.includes("packages.delete"), false);
});
test("AD binary GUID decodes little-endian fields without guessing identity", () => {
  assert.equal(
    decodeDirectoryGuid(Buffer.from("33221100554477668899aabbccddeeff", "hex")),
    "00112233-4455-6677-8899-aabbccddeeff",
  );
  assert.throws(() => decodeDirectoryGuid("00112233-4455-6677-8899-aabbccddeeff"));
  assert.throws(() => decodeDirectoryGuid(Buffer.alloc(15)));
});

test("Invalid service mutation input returns 422 before database access", async () => {
  const { UserAccessService } =
    await import("../src/modules/access/service/user-access-service.js");
  const service = new UserAccessService(
    {} as import("../src/infrastructure/db/connection.js").DatabaseClient,
  );
  for (const operation of ["assignment", "status", "revoke"] as const) {
    await assert.rejects(
      service.change(
        { id: "actor", authorizationVersion: 1 },
        "target",
        operation,
        {},
        "test-idempotency-key",
      ),
      (error: unknown) => (error as { statusCode: number }).statusCode === 422,
    );
  }
});

test("AD GUID search encodes each binary byte exactly once and rejects filter injection", () => {
  const guid = "00112233-4455-6677-8899-aabbccddeeff";
  const filter = encodeDirectoryGuid(guid);
  assert.equal(filter, String.raw`\33\22\11\00\55\44\77\66\88\99\aa\bb\cc\dd\ee\ff`);
  assert.equal(decodeDirectoryGuid(Buffer.from(filter.replaceAll("\\", ""), "hex")), guid);
  assert.throws(() => encodeDirectoryGuid("*)(objectClass=*)"));
});
