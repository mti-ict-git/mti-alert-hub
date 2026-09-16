import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { DatabaseClient, TransactionClient } from "../src/infrastructure/db/connection.js";
import { PersistentAccessSessionStore } from "../src/modules/access/service/persistent-access-session-store.js";

// Small shared storage fixture tests two independent session stores and makes token/version predicates explicit.
// PostgreSQL constraints/locking are covered separately by the opt-in integration suite.
function fixture() {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    username: "operator",
    full_name: "Operator",
    email: null,
    status: "Active",
    role_type: "ManagementViewer",
    authorization_version: 1,
    expires_at: new Date(Date.now() + 60000).toISOString(),
  };
  const sessions = new Map<string, { version: number; revoked: boolean }>();
  const grants = [{ scopeType: "Global", scopeValue: "*" }];
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith("insert into public.admin_sessions")) {
      sessions.set(String(params[0]), { version: Number(params[2]), revoked: false });
      return [];
    }
    if (sql.startsWith("update public.admin_sessions")) {
      const session = sessions.get(String(params[0]));
      if (session) session.revoked = true;
      return [];
    }
    if (sql.includes("from public.user_scopes")) return grants;
    if (sql.includes("join public.users")) {
      const session = sessions.get(String(params[0]));
      return session && !session.revoked && session.version === user.authorization_version
        ? [user]
        : [];
    }
    if (sql.includes("from public.users")) return [user];
    return [];
  };
  const tx = { query } as TransactionClient;
  const db = {
    query,
    withTransaction: async <T>(fn: (t: TransactionClient) => Promise<T>) => fn(tx),
  } as DatabaseClient;
  return { user, sessions, grants, db };
}
test("Two stores share hashed sessions; role change invalidates previously issued token", async () => {
  const f = fixture(),
    a = new PersistentAccessSessionStore(f.db, 60000),
    b = new PersistentAccessSessionStore(f.db, 60000);
  const issued = await a.create(f.user.id);
  assert.ok(!f.sessions.has(issued.sessionToken));
  assert.ok(f.sessions.has(createHash("sha256").update(issued.sessionToken).digest("hex")));
  assert.equal((await b.get(issued.sessionToken))?.user.id, f.user.id);
  assert.ok(issued.permissions.includes("reports.export"));
  f.user.authorization_version++;
  assert.equal(await a.get(issued.sessionToken), undefined);
  assert.equal(await b.get(issued.sessionToken), undefined);
});
test("Pending, Disabled and legacy role never receive a privileged session", async () => {
  for (const patch of [
    { status: "Pending" },
    { status: "Disabled" },
    { role_type: "LocalOperator" },
  ]) {
    const f = fixture();
    Object.assign(f.user, patch);
    await assert.rejects(new PersistentAccessSessionStore(f.db, 60000).create(f.user.id));
    assert.equal(f.sessions.size, 0);
  }
});
test("Empty/legacy scope fails closed; logout is visible across stores", async () => {
  const f = fixture(),
    a = new PersistentAccessSessionStore(f.db, 60000),
    b = new PersistentAccessSessionStore(f.db, 60000);
  const issued = await a.create(f.user.id);
  await b.revoke(issued.sessionToken);
  assert.equal(await a.get(issued.sessionToken), undefined);
  f.grants.length = 0;
  await assert.rejects(a.create(f.user.id));
  f.grants.push({ scopeType: "Department", scopeValue: "legacy" });
  await assert.rejects(a.create(f.user.id));
});
test("Malformed tokens are rejected before querying the database", async () => {
  const store = new PersistentAccessSessionStore(
    {
      withTransaction: () => {
        throw Error("must not query");
      },
    } as unknown as DatabaseClient,
    60000,
  );
  assert.equal(await store.get(undefined), undefined);
  assert.equal(await store.get("short"), undefined);
});
