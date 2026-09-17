import { test } from "node:test";
import assert from "node:assert/strict";
import { PersistentAuthService } from "../src/modules/auth/service/persistent-auth-service.js";
import { AppError } from "../src/shared/errors/app-error.js";
import type { AccessSession } from "../src/modules/access/service/persistent-access-session-store.js";
const identity = {
  directoryId: "test",
  directorySubjectId: "11111111-1111-4111-8111-111111111111",
  username: "verified",
  fullName: "Verified User",
  email: null,
};
const session: AccessSession = {
  sessionToken: "test-token",
  expiresAt: "2099-01-01T00:00:00Z",
  user: { id: "db-user", username: "verified", fullName: "Verified User", email: null },
  accessProfile: {
    roleType: "ManagementViewer",
    scopes: [{ scopeType: "Global", scopeValue: "*" }],
  },
  permissions: ["reports.read"],
  authorizationVersion: 4,
};
function fixture() {
  const calls: string[] = [];
  const dependencies = {
    authenticator: {
      authenticate: async () => {
        calls.push("authenticate");
        return {
          username: "verified",
          distinguishedName: "verified-dn",
          directorySubjectId: identity.directorySubjectId,
          fullName: "Verified User",
          email: null,
          memberOf: [],
        };
      },
    },
    directory: {
      resolveAuthenticatedDn: async (dn: string) => {
        assert.equal(dn, "verified-dn");
        calls.push("resolve");
        return identity;
      },
    },
    users: {
      recordAuthenticatedIdentity: async (value: typeof identity) => {
        assert.deepEqual(value, identity);
        calls.push("record");
        return "db-user";
      },
    },
    sessions: {
      create: async (id: string) => {
        assert.equal(id, "db-user");
        calls.push("create");
        return session;
      },
      get: async () => session,
      rotate: async () => session as AccessSession | undefined,
      revoke: async () => {
        calls.push("revoke");
      },
    },
  };
  return {
    calls,
    dependencies,
    create: () =>
      new PersistentAuthService(
        dependencies.authenticator,
        dependencies.directory,
        dependencies.users,
        dependencies.sessions,
      ),
  };
}
test("Persistent login issues only database assignment and version after verified AD authentication", async () => {
  const f = fixture();
  assert.deepEqual(
    await f.create().login({ username: "input", password: "test-password" }),
    session,
  );
  assert.deepEqual(f.calls, ["authenticate", "resolve", "record", "create"]);
});
test("Failed AD authentication never writes identity or creates a session", async () => {
  const f = fixture();
  f.dependencies.authenticator.authenticate = async () => {
    throw Error("Rejected");
  };
  await assert.rejects(f.create().login({ username: "input", password: "wrong" }));
  assert.deepEqual(f.calls, []);
});
test("Directory outage and Pending access do not fall back to auto-admin", async () => {
  const f = fixture();
  f.dependencies.directory.resolveAuthenticatedDn = async () => {
    throw Error("Unavailable");
  };
  await assert.rejects(f.create().login({ username: "input", password: "test" }));
  assert.deepEqual(f.calls, ["authenticate"]);
  const p = fixture();
  p.dependencies.sessions.create = async () => {
    throw new AppError({ statusCode: 403, code: "ACCESS_PENDING", message: "Access pending" });
  };
  await assert.rejects(
    p.create().login({ username: "input", password: "test" }),
    (e) => (e as AppError).code === "ACCESS_PENDING",
  );
});
test("Logout awaits database revocation and expired rotation returns 401", async () => {
  const f = fixture();
  await f.create().logout("test");
  assert.deepEqual(f.calls, ["revoke"]);
  f.dependencies.sessions.rotate = async () => undefined;
  await assert.rejects(
    f.create().rotateSession("expired"),
    (e) => (e as AppError).statusCode === 401,
  );
});

test("DN reuse during sign-in cannot switch the authenticated immutable identity", async () => {
  const f = fixture();
  f.dependencies.directory.resolveAuthenticatedDn = async () => ({
    ...identity,
    directorySubjectId: "22222222-2222-4222-8222-222222222222",
  });
  await assert.rejects(
    f.create().login({ username: "input", password: "test" }),
    (e) => (e as AppError).code === "DIRECTORY_IDENTITY_CHANGED",
  );
  assert.deepEqual(f.calls, ["authenticate"]);
});
