import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { DatabaseClient, TransactionClient } from "../src/infrastructure/db/connection.js";
import { UserAccessService } from "../src/modules/access/service/user-access-service.js";
import { PersistentAccessSessionStore } from "../src/modules/access/service/persistent-access-session-store.js";
import { DirectoryUserRepository } from "../src/modules/access/service/directory-user-repository.js";

// Explicit isolated test connection only. Never read the application's .env here.
test(
  "PostgreSQL access transactions, revocation, audit rollback and concurrent last-admin protection",
  { skip: !process.env.USER_ACCESS_TEST_DATABASE_URL },
  async (t) => {
    const pool = new Pool({ connectionString: process.env.USER_ACCESS_TEST_DATABASE_URL, max: 6 });
    const schema = "access_test_" + randomUUID().replaceAll("-", "");
    assert.match(schema, /^access_test_[a-f0-9]{32}$/);
    const rewrite = (sql: string) => sql.replaceAll("public.", schema + ".");
    const query = async <T extends QueryResultRow>(
      client: Pool | PoolClient,
      sql: string,
      params: unknown[] = [],
    ) => (await client.query<T>(rewrite(sql), params)).rows;
    const wrap = (client: Pool | PoolClient) => ({
      query: <T extends QueryResultRow>(sql: string, params?: unknown[]) =>
        query<T>(client, sql, params),
      maybeQuery: async () => {
        throw Error("Not used in this suite");
      },
      tableExists: async () => true,
      ping: async () => {
        await client.query("select 1");
      },
    });
    const db: DatabaseClient = {
      ...wrap(pool),
      async withTransaction<T>(run: (tx: TransactionClient) => Promise<T>) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const result = await run(wrap(client));
          await client.query("commit");
          return result;
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      },
    };
    try {
      await pool.query("create schema " + schema);
      const baseline = await readFile(
        new URL("../migrations/0001_phase1_foundation.up.sql", import.meta.url),
        "utf8",
      );
      await pool.query(
        rewrite(
          baseline.slice(
            baseline.indexOf("create table if not exists public.users"),
            baseline.indexOf("create table if not exists public.sites"),
          ),
        ),
      );
      await pool.query(
        rewrite(`
   create table public.sites(id uuid primary key,status text);
   create table public.areas(id uuid primary key,site_id uuid references public.sites(id),status text);
   create table public.audit_logs(actor_user_id text,actor_username text,action_type text,module_name text,
    entity_type text,entity_id text,description text,ip_address text,metadata_json jsonb,created_at timestamptz);
  `),
      );
      await pool.query(
        rewrite(
          await readFile(
            new URL("../migrations/0019_phase4_users_access.up.sql", import.meta.url),
            "utf8",
          ),
        ),
      );
      const admins = [randomUUID(), randomUUID()],
        pending = randomUUID();
      for (const id of admins) {
        await db.query(
          "insert into public.users(id,username,full_name,status,role_type) values($1,$2,'Admin','Active','CentralAdmin')",
          [id, id],
        );
        await db.query(
          "insert into public.user_scopes(user_id,scope_type,scope_value) values($1,'Global','*')",
          [id],
        );
      }
      const actor = { id: admins[0]!, authorizationVersion: 1 };
      const service = new UserAccessService(db);
      const sessionA = new PersistentAccessSessionStore(db, 60000),
        sessionB = new PersistentAccessSessionStore(db, 60000);
      await t.test("Pending identity is stable and never promoted automatically", async () => {
        const repo = new DirectoryUserRepository(db);
        const identity = {
          directoryId: "test-directory",
          directorySubjectId: pending,
          username: "pending",
          fullName: "Pending",
          email: null,
        };
        const id = await repo.recordAuthenticatedIdentity(identity);
        assert.equal(
          await repo.recordAuthenticatedIdentity({ ...identity, username: "renamed" }),
          id,
        );
        assert.equal((await service.read(actor, id)).status, "Pending");
        await assert.rejects(sessionA.create(id), /Access has not been granted/);
      });
      await t.test(
        "Assignment, stale revision, idempotency and cross-instance session revocation",
        async () => {
          const issued = await sessionA.create(admins[1]!);
          assert.ok(await sessionB.get(issued.sessionToken));
          const payload = {
            roleId: "ManagementViewer",
            scopes: [{ scopeType: "Global", scopeValue: "*" }],
            expectedRevision: 1,
            reason: "Reviewed viewer access",
          };
          const key = randomUUID();
          const result = await service.change(actor, admins[1]!, "assignment", payload, key);
          assert.equal(result.revision, 2);
          assert.equal(await sessionB.get(issued.sessionToken), undefined);
          assert.equal(
            (await service.change(actor, admins[1]!, "assignment", payload, key)).revision,
            2,
          );
          await assert.rejects(
            service.change(
              actor,
              admins[1]!,
              "assignment",
              { ...payload, reason: "Changed payload" },
              key,
            ),
            /different changes/,
          );
          await assert.rejects(
            service.change(actor, admins[1]!, "assignment", payload, randomUUID()),
            /changed by another/,
          );
          await service.change(
            actor,
            admins[1]!,
            "assignment",
            { ...payload, roleId: "CentralAdmin", expectedRevision: 2 },
            randomUUID(),
          );
        },
      );
      await t.test("Audit failure rolls back user version and session revocation", async () => {
        const before = await service.read(actor, admins[1]!);
        const issued = await sessionA.create(admins[1]!);
        await pool.query(
          "alter table " +
            schema +
            ".audit_logs add constraint audit_test_failure check (description <> 'Reject audit test')",
        );
        await assert.rejects(
          service.change(
            actor,
            admins[1]!,
            "revoke",
            { expectedRevision: before.revision, reason: "Reject audit test" },
            randomUUID(),
          ),
        );
        assert.equal((await service.read(actor, admins[1]!)).revision, before.revision);
        assert.ok(await sessionB.get(issued.sessionToken));
      });

      await t.test(
        "Grant is atomic, idempotent, and does not duplicate directory users",
        async () => {
          const identity = {
            directoryId: "test-directory",
            directorySubjectId: randomUUID(),
            username: "granted-viewer",
            fullName: "Granted Viewer",
            email: null,
          };
          const payload = {
            roleId: "ManagementViewer",
            scopes: [{ scopeType: "Global", scopeValue: "*" }],
            reason: "Reviewed initial access",
          };
          const key = randomUUID();
          const created = await service.grant(actor, identity, payload, key);
          assert.equal(created.status, "Active");
          assert.equal(created.roleId, "ManagementViewer");
          assert.equal((await service.grant(actor, identity, payload, key)).id, created.id);
          await assert.rejects(
            service.grant(actor, identity, payload, randomUUID()),
            /already exists/,
          );
          const failedIdentity = {
            ...identity,
            directorySubjectId: randomUUID(),
            username: "rollback-grant",
          };
          await assert.rejects(
            service.grant(
              actor,
              failedIdentity,
              { ...payload, reason: "Reject audit test" },
              randomUUID(),
            ),
          );
          const rows = await db.query("select id from public.users where directory_subject_id=$1", [
            failedIdentity.directorySubjectId,
          ]);
          assert.equal(rows.length, 0);
        },
      );
      await t.test("Concurrent self-demotions leave exactly one active administrator", async () => {
        const second = await service.read(actor, admins[1]!);
        const results = await Promise.allSettled([
          service.change(
            actor,
            admins[0]!,
            "assignment",
            {
              roleId: "ManagementViewer",
              scopes: [{ scopeType: "Global", scopeValue: "*" }],
              expectedRevision: 1,
              reason: "Self demotion test",
            },
            randomUUID(),
          ),
          service.change(
            { id: admins[1]!, authorizationVersion: second.authorizationVersion },
            admins[1]!,
            "assignment",
            {
              roleId: "ManagementViewer",
              scopes: [{ scopeType: "Global", scopeValue: "*" }],
              expectedRevision: second.revision,
              reason: "Self demotion test",
            },
            randomUUID(),
          ),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const [remaining] = await db.query<{ count: string }>(
          "select count(*) from public.users where status='Active' and role_type='CentralAdmin'",
        );
        assert.equal(Number(remaining?.count), 1);
      });
    } finally {
      // Generated identifier only, in this test connection; never application tables.

      await pool.query("drop schema if exists " + schema + " cascade");
      await pool.end();
    }
  },
);
