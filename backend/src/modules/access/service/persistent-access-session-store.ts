import { createHash, randomBytes } from "node:crypto";
import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import {
  accessRole,
  grantSchema,
  rolePermissions,
  type AccessGrant,
  type AccessRole,
} from "../model/permission-catalog.js";

export type AccessSession = {
  sessionToken: string;
  expiresAt: string;
  user: { id: string; username: string; fullName: string; email: string | null };
  accessProfile: { roleType: AccessRole; scopes: AccessGrant[] };
  authorizationVersion: number;
  permissions: readonly string[];
};
type SessionRow = {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  status: string;
  role_type: string;
  authorization_version: number;
  expires_at: string;
};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export class PersistentAccessSessionStore {
  constructor(
    private readonly db: DatabaseClient,
    private readonly ttlMs: number,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("Session TTL must be positive.");
  }
  private async hydrate(
    tx: TransactionClient,
    row: SessionRow,
    token: string,
  ): Promise<AccessSession | undefined> {
    const role = accessRole.safeParse(row.role_type);
    if (row.status !== "Active" || !role.success) return undefined;
    const records = await tx.query<{ scopeType: string; scopeValue: string }>(
      'select scope_type as "scopeType",scope_value as "scopeValue" from public.user_scopes where user_id=$1',
      [row.id],
    );
    const scopes = grantSchema.array().safeParse(records);
    if (!scopes.success || !scopes.data.length) return undefined;
    const global = scopes.data.some((s) => s.scopeType === "Global");
    if ((global && scopes.data.length !== 1) || (role.data === "CentralAdmin" && !global))
      return undefined;
    return {
      sessionToken: token,
      expiresAt: row.expires_at,
      user: { id: row.id, username: row.username, fullName: row.full_name, email: row.email },
      accessProfile: { roleType: role.data, scopes: scopes.data },
      authorizationVersion: row.authorization_version,
      permissions: rolePermissions[role.data],
    };
  }
  async create(userId: string): Promise<AccessSession> {
    return this.db.withTransaction(async (tx) => {
      const [row] = await tx.query<SessionRow>(
        "select *, (now()+($2::bigint * interval '1 millisecond'))::text as expires_at from public.users where id=$1 for update",
        [userId, this.ttlMs],
      );
      const token = randomBytes(32).toString("base64url");
      const session = row ? await this.hydrate(tx, row, token) : undefined;
      if (!session)
        throw new AppError({
          statusCode: 403,
          code: row?.status === "Disabled" ? "ACCESS_DISABLED" : "ACCESS_PENDING",
          message:
            row?.status === "Disabled"
              ? "Your access has been disabled. Contact your administrator."
              : "Access has not been granted. Contact your MTI Connect administrator.",
        });
      await tx.query(
        "insert into public.admin_sessions(token_digest,user_id,authorization_version,expires_at) values($1,$2,$3,$4)",
        [digest(token), userId, session.authorizationVersion, session.expiresAt],
      );
      await tx.query("update public.users set last_login_at=now() where id=$1", [userId]);
      return session;
    });
  }
  async get(token: string | undefined): Promise<AccessSession | undefined> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
    // Same transaction holds a share lock so assignment and grant updates cannot produce a mixed snapshot.
    return this.db.withTransaction(async (tx) => {
      const [row] = await tx.query<SessionRow>(
        `select u.*,s.expires_at::text from public.admin_sessions s
    join public.users u on u.id=s.user_id where s.token_digest=$1 and s.revoked_at is null and s.expires_at>now()
    and s.authorization_version=u.authorization_version for share of u,s`,
        [digest(token)],
      );
      return row ? this.hydrate(tx, row, token) : undefined;
    });
  }
  async revoke(token: string) {
    await this.db.query(
      "update public.admin_sessions set revoked_at=now() where token_digest=$1 and revoked_at is null",
      [digest(token)],
    );
  }
  async rotate(token: string): Promise<AccessSession> {
    return this.db.withTransaction(async (tx) => {
      // Lock user before session to match access mutations and avoid reversed-lock deadlocks.
      const [identity] = await tx.query<{ user_id: string }>(
        "select user_id from public.admin_sessions where token_digest=$1",
        [digest(token)],
      );
      if (!identity)
        throw new AppError({ statusCode: 401, code: "UNAUTHORIZED", message: "Sign in again." });
      await tx.query("select id from public.users where id=$1 for update", [identity.user_id]);
      const [row] = await tx.query<SessionRow>(
        `select u.*, (now()+($2::bigint * interval '1 millisecond'))::text as expires_at
    from public.admin_sessions s join public.users u on u.id=s.user_id where s.token_digest=$1 and s.revoked_at is null
    and s.expires_at>now() and s.authorization_version=u.authorization_version for update of s`,
        [digest(token), this.ttlMs],
      );
      const next = randomBytes(32).toString("base64url");
      const session = row ? await this.hydrate(tx, row, next) : undefined;
      if (!session)
        throw new AppError({
          statusCode: 401,
          code: "UNAUTHORIZED",
          message: "Your access has changed. Sign in again.",
        });
      await tx.query("update public.admin_sessions set revoked_at=now() where token_digest=$1", [
        digest(token),
      ]);
      await tx.query(
        "insert into public.admin_sessions(token_digest,user_id,authorization_version,expires_at) values($1,$2,$3,$4)",
        [digest(next), row!.id, session.authorizationVersion, session.expiresAt],
      );
      return session;
    });
  }
}
