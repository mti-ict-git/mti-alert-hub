import {
  DirectoryUserRepository,
  type VerifiedDirectoryIdentity,
} from "./directory-user-repository.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import { createHash } from "node:crypto";
import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AuditLogService } from "../../audit/service/audit-log-service.js";
import {
  assignmentSchema,
  grantSchema,
  accessRole,
  type AccessGrant,
  type AccessRole,
} from "../model/permission-catalog.js";

export type AccessActor = { id: string; authorizationVersion: number; ipAddress?: string };
export type AccessUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: string;
  roleId: AccessRole | null;
  revision: number;
  authorizationVersion: number;
  lastLoginAt: string | null;
  scopes: AccessGrant[];
  legacyScopes?: { scopeType: string; scopeValue: string }[];
};
type UserRow = Omit<AccessUser, "scopes">;
const columns = `id::text, username, full_name as "fullName", email, status, role_type as "roleId",
 revision, authorization_version as "authorizationVersion", last_login_at::text as "lastLoginAt"`;
const lockKey = 746219;
function fail(code: string, message: string, statusCode = 409): never {
  throw new AppError({ statusCode, code, message });
}

export class UserAccessService {
  private readonly audit: AuditLogService;
  constructor(private readonly db: DatabaseClient) {
    this.audit = new AuditLogService(db);
  }

  private async authorize(tx: TransactionClient, actor: AccessActor) {
    const [user] = await tx.query<UserRow>(
      `select ${columns} from public.users where id=$1 for update`,
      [actor.id],
    );
    if (
      !user ||
      user.status !== "Active" ||
      user.authorizationVersion !== actor.authorizationVersion
    )
      fail("ACCESS_CHANGED", "Your access has changed. Sign in again.", 401);
    if (user.roleId !== "CentralAdmin")
      fail("FORBIDDEN", "Only administrators may manage user access.", 403);
    const grants = await tx.query<{ scope_type: string; scope_value: string }>(
      "select scope_type,scope_value from public.user_scopes where user_id=$1",
      [actor.id],
    );
    if (!grants.some((g) => g.scope_type === "Global" && g.scope_value === "*"))
      fail("FORBIDDEN", "Global administration is required.", 403);
    return user;
  }

  async detail(id: string, reader: TransactionClient = this.db): Promise<AccessUser> {
    const [user] = await reader.query<UserRow>(`select ${columns} from public.users where id=$1`, [
      id,
    ]);
    if (!user) fail("NOT_FOUND", "User was not found.", 404);
    const scopes = await reader.query<{ scopeType: string; scopeValue: string }>(
      'select scope_type as "scopeType",scope_value as "scopeValue" from public.user_scopes where user_id=$1 order by scope_type,scope_value',
      [id],
    );
    // Legacy grants must be reviewed, not silently converted to Global.
    return {
      ...user,
      scopes: scopes.filter((s) => grantSchema.safeParse(s).success) as AccessGrant[],
      legacyScopes: scopes.filter((s) => !grantSchema.safeParse(s).success),
    };
  }

  async list(
    actor: AccessActor,
    query: {
      page: number;
      pageSize: number;
      search?: string;
      status?: string;
      roleId?: string;
      siteId?: string;
    },
  ) {
    return this.db.withTransaction(async (tx) => {
      await this.authorize(tx, actor);
      const params: unknown[] = [];
      const where: string[] = [];
      if (query.search) {
        params.push("%" + query.search.replace(/[\\%_]/g, "\\$&") + "%");
        where.push(`(username ilike $${params.length} or full_name ilike $${params.length})`);
      }
      if (query.status) {
        params.push(query.status);
        where.push(`status=$${params.length}`);
      }
      if (query.roleId) {
        params.push(query.roleId);
        where.push(`role_type=$${params.length}`);
      }
      if (query.siteId) {
        params.push(query.siteId);
        where.push(`exists(select 1 from public.user_scopes s where s.user_id=users.id and
    ((s.scope_type='Global' and s.scope_value='*') or (s.scope_type='Site' and s.scope_value=$${params.length}) or
    (s.scope_type='Area' and exists(select 1 from public.areas a where a.id::text=s.scope_value and a.site_id::text=$${params.length}))))`);
      }
      const filter = where.length ? " where " + where.join(" and ") : "";
      const [count] = await tx.query<{ total: number }>(
        "select count(*)::int as total from public.users" + filter,
        params,
      );
      params.push(query.pageSize, (query.page - 1) * query.pageSize);
      const rows = await tx.query<{ id: string }>(
        `select id::text from public.users${filter} order by updated_at desc,id limit $${params.length - 1} offset $${params.length}`,
        params,
      );
      const items = [];
      for (const row of rows) items.push(await this.detail(row.id, tx));
      return { items, page: query.page, pageSize: query.pageSize, total: count?.total ?? 0 };
    });
  }

  async read(actor: AccessActor, id: string) {
    return this.db.withTransaction(async (tx) => {
      await this.authorize(tx, actor);
      return this.detail(id, tx);
    });
  }

  private async normalizeScopes(tx: TransactionClient, scopes: AccessGrant[]) {
    const result: AccessGrant[] = [];
    const siteIds = new Set(scopes.filter((s) => s.scopeType === "Site").map((s) => s.scopeValue));
    for (const grant of scopes) {
      if (grant.scopeType === "Global") {
        result.push(grant);
        continue;
      }
      if (grant.scopeType === "Site") {
        const [site] = await tx.query<{ id: string }>(
          "select id from public.sites where id=$1 and status='Active' for share",
          [grant.scopeValue],
        );
        if (!site) fail("INVALID_SCOPE", "Select an active site.", 422);
      } else {
        const [area] = await tx.query<{ site_id: string }>(
          "select a.site_id::text from public.areas a join public.sites s on s.id=a.site_id where a.id=$1 and a.status='Active' and s.status='Active' for share of a,s",
          [grant.scopeValue],
        );
        if (!area) fail("INVALID_SCOPE", "Select an area in an active site.", 422);
        if (siteIds.has(area.site_id)) continue;
      }
      result.push(grant);
    }
    return result;
  }

  async grant(
    actor: AccessActor,
    identity: VerifiedDirectoryIdentity,
    payload: unknown,
    key: string,
  ) {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(key))
      fail("INVALID_IDEMPOTENCY_KEY", "Provide a valid Idempotency-Key.", 422);
    const data = validateWithSchema(
      z
        .object({
          roleId: accessRole,
          scopes: z.array(grantSchema).min(1).max(500),
          reason: z.string().trim().min(5).max(500),
        })
        .strict(),
      payload,
    );
    const assignment = validateWithSchema(assignmentSchema, { ...data, expectedRevision: 1 });
    const operation = "create:" + identity.directoryId + ":" + identity.directorySubjectId;
    const hash = createHash("sha256").update(JSON.stringify(assignment)).digest("hex");
    return this.db.withTransaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock($1)", [lockKey]);
      await this.authorize(tx, actor);
      const [saved] = await tx.query<{ request_hash: string; result_json: AccessUser }>(
        "select request_hash,result_json from public.access_idempotency where actor_id=$1 and operation=$2 and key=$3 and expires_at>now()",
        [actor.id, operation, key],
      );
      if (saved) {
        if (saved.request_hash !== hash)
          fail("IDEMPOTENCY_CONFLICT", "This key was already used for different changes.");
        return saved.result_json;
      }
      const [existing] = await tx.query<{ id: string }>(
        "select id::text from public.users where directory_id=$1 and directory_subject_id=$2",
        [identity.directoryId, identity.directorySubjectId],
      );
      if (existing)
        throw new AppError({
          statusCode: 409,
          code: "USER_ALREADY_EXISTS",
          message: "This user already exists. Open their access record.",
          details: { id: existing.id },
        });
      // Both Pending identity creation and activation roll back together if any step fails.
      const transactional = {
        ...this.db,
        ...tx,
        withTransaction: async <T>(run: (client: TransactionClient) => Promise<T>) => run(tx),
      };
      const id = await new DirectoryUserRepository(transactional).recordAuthenticatedIdentity(
        identity,
      );
      const result = await new UserAccessService(transactional).change(
        actor,
        id,
        "assignment",
        assignment,
        key,
      );
      await tx.query(
        `insert into public.access_idempotency(actor_id,operation,key,request_hash,result_json,expires_at)
       values($1,$2,$3,$4,$5::jsonb,now()+interval '24 hours')
       on conflict(actor_id,operation,key) do update set request_hash=excluded.request_hash,result_json=excluded.result_json,expires_at=excluded.expires_at`,
        [actor.id, operation, key, hash, JSON.stringify(result)],
      );
      return result;
    });
  }

  async findDirectoryUsers(actor: AccessActor, identities: VerifiedDirectoryIdentity[]) {
    return this.db.withTransaction(async (tx) => {
      await this.authorize(tx, actor);
      const result = [];
      for (const identity of identities) {
        const [existing] = await tx.query<{ id: string; status: string }>(
          "select id::text,status from public.users where directory_id=$1 and directory_subject_id=$2",
          [identity.directoryId, identity.directorySubjectId],
        );
        result.push({
          ...identity,
          existingUserId: existing?.id ?? null,
          existingStatus: existing?.status ?? null,
        });
      }
      return result;
    });
  }

  async change(
    actor: AccessActor,
    id: string,
    operation: "assignment" | "status" | "revoke",
    payload: unknown,
    key: string,
  ) {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(key))
      fail("INVALID_IDEMPOTENCY_KEY", "Provide a valid Idempotency-Key.", 422);
    const input =
      operation === "assignment"
        ? validateWithSchema(assignmentSchema, payload)
        : statusInput(payload, operation);
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const op = operation + ":" + id;
    return this.db.withTransaction(async (tx) => {
      // Shared lock serializes every administrator-count mutation before any user row lock.
      await tx.query("select pg_advisory_xact_lock($1)", [lockKey]);
      const admin = await this.authorize(tx, actor);
      const [saved] = await tx.query<{ request_hash: string; result_json: AccessUser }>(
        "select request_hash,result_json from public.access_idempotency where actor_id=$1 and operation=$2 and key=$3 and expires_at>now()",
        [actor.id, op, key],
      );
      if (saved) {
        if (saved.request_hash !== hash)
          fail("IDEMPOTENCY_CONFLICT", "This key was already used for different changes.");
        return saved.result_json;
      }
      await tx.query("select id from public.users where id=$1 for update", [id]);
      const before = await this.detail(id, tx);
      if (before.revision !== input.expectedRevision)
        fail(
          "STALE_REVISION",
          "Access was changed by another administrator. Reload before saving.",
        );
      let role = before.roleId,
        scopes = before.scopes,
        status = before.status;
      if (operation === "assignment") {
        const assigned = validateWithSchema(assignmentSchema, input);
        role = assigned.roleId;
        scopes = await this.normalizeScopes(tx, assigned.scopes);
        if (status === "Pending") status = "Active";
      } else if (operation === "status") {
        status = validateWithSchema(
          z.object({ status: z.enum(["Active", "Disabled"]) }),
          input,
        ).status;
        if (status === "Active") {
          if (before.legacyScopes?.length)
            fail(
              "LEGACY_SCOPE_REVIEW_REQUIRED",
              "Replace legacy scope grants before enabling access.",
              422,
            );
          if (!accessRole.safeParse(role).success)
            fail("INVALID_ASSIGNMENT", "Assign a role before enabling access.", 422);
          validateWithSchema(assignmentSchema, {
            roleId: role,
            scopes,
            expectedRevision: before.revision,
            reason: input.reason,
          });
          scopes = await this.normalizeScopes(tx, scopes);
        }
      }
      if (
        before.status === "Active" &&
        before.roleId === "CentralAdmin" &&
        (status !== "Active" || role !== "CentralAdmin")
      ) {
        const [other] = await tx.query<{ total: number }>(
          `select count(*)::int as total from public.users u where u.id<>$1
      and u.status='Active' and u.role_type='CentralAdmin' and exists(select 1 from public.user_scopes s where s.user_id=u.id and s.scope_type='Global' and s.scope_value='*')`,
          [id],
        );
        if (!other?.total)
          fail("LAST_ADMIN", "Keep at least one active Administrator with Global access.");
      }
      await tx.query(
        "update public.users set role_type=$2,status=$3,revision=revision+1,authorization_version=authorization_version+1,updated_at=now() where id=$1",
        [id, role, status],
      );
      if (operation === "assignment") {
        await tx.query("delete from public.user_scopes where user_id=$1", [id]);
        for (const s of scopes)
          await tx.query(
            "insert into public.user_scopes(user_id,scope_type,scope_value) values($1,$2,$3)",
            [id, s.scopeType, s.scopeValue],
          );
      }
      await tx.query(
        "update public.admin_sessions set revoked_at=now() where user_id=$1 and revoked_at is null",
        [id],
      );
      const after = await this.detail(id, tx);
      await this.audit.record(tx, {
        actorUserId: actor.id,
        actorUsername: admin.username,
        actionType: "Access." + operation,
        moduleName: "Access",
        entityType: "User",
        entityId: id,
        description: input.reason,
        ipAddress: actor.ipAddress,
        metadata: { before, after },
      });
      await tx.query(
        `insert into public.access_idempotency(actor_id,operation,key,request_hash,result_json,expires_at)
    values($1,$2,$3,$4,$5::jsonb,now()+interval '24 hours')
    on conflict(actor_id,operation,key) do update set request_hash=excluded.request_hash,result_json=excluded.result_json,expires_at=excluded.expires_at`,
        [actor.id, op, key, hash, JSON.stringify(after)],
      );
      return after;
    });
  }
}

import { z } from "zod";
function statusInput(payload: unknown, operation: string) {
  const fields = {
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(5).max(500),
  };
  return operation === "status"
    ? validateWithSchema(
        z.object({ ...fields, status: z.enum(["Active", "Disabled"]) }).strict(),
        payload,
      )
    : validateWithSchema(z.object(fields).strict(), payload);
}
