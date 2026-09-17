import { test } from "node:test";
import assert from "node:assert/strict";
import { can, canVisit } from "../src/lib/access";
import {
  rolePermissions,
  type AccessRole,
} from "../backend/src/modules/access/model/permission-catalog";
import type { User } from "../src/types";
const user = (role: AccessRole): User => ({
  id: "fixture",
  username: "fixture",
  name: "Fixture",
  email: "",
  role: "Viewer",
  permissions: [...rolePermissions[role]],
});
test("UI route capabilities match every role without trusting the legacy display role", () => {
  assert.equal(canVisit(user("ManagementViewer"), "/notifications/new"), false);
  assert.equal(canVisit(user("ManagementViewer"), "/reports"), true);
  assert.equal(can(user("ManagementViewer"), "reports.export"), true);
  assert.equal(canVisit(user("ITOperator"), "/settings"), true);
  assert.equal(canVisit(user("CommunicationOperator"), "/devices"), false);
  assert.equal(canVisit(user("CommunicationOperator"), "/wellness-programs/new"), true);
  assert.equal(canVisit(user("EmergencyOfficer"), "/wellness-programs/new"), false);
  assert.equal(can(user("EmergencyOfficer"), "notifications.emergency"), true);
  assert.equal(canVisit(user("CentralAdmin"), "/unknown"), false);
  assert.equal(canVisit({ ...user("CentralAdmin"), permissions: undefined }, "/settings"), false);
});
