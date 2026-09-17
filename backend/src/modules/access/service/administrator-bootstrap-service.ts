import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import {
  directoryIdentitySchema,
  type VerifiedDirectoryIdentity,
} from "./directory-user-repository.js";
import { AuditLogService } from "../../audit/service/audit-log-service.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import { z } from "zod";

/** Server-operator entry point only. Never register as a public or self-service route. */
export class AdministratorBootstrapService {
  constructor(private readonly db: DatabaseClient) {}
  async apply(identityInput: VerifiedDirectoryIdentity, operator: string, reason: string) {
    const identity = validateWithSchema(directoryIdentitySchema, identityInput);
    validateWithSchema(z.string().trim().min(1).max(256), operator);
    validateWithSchema(z.string().trim().min(5).max(500), reason);
    return this.db.withTransaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock($1)", [746219]);
      await tx.query("select pg_advisory_xact_lock($1)", [746220]);
      const rows = await tx.query<{
        id: string;
        username: string;
        directory_id: string | null;
        directory_subject_id: string | null;
        role_type: string | null;
        status: string;
      }>(
        "select id::text,username,directory_id,directory_subject_id::text,role_type,status from public.users where lower(username)=lower($1) or (directory_id=$2 and directory_subject_id=$3) for update",
        [identity.username, identity.directoryId, identity.directorySubjectId],
      );
      if (
        rows.length > 1 ||
        rows.some(
          (r) =>
            r.directory_subject_id &&
            (r.directory_subject_id !== identity.directorySubjectId ||
              r.directory_id !== identity.directoryId),
        )
      ) {
        throw new AppError({
          statusCode: 409,
          code: "DIRECTORY_IDENTITY_REVIEW_REQUIRED",
          message: "Bootstrap identity conflicts with an existing verified user.",
        });
      }
      const before = rows[0] ?? null;
      const [user] = await tx.query<{ id: string; revision: number }>(
        before
          ? "update public.users set username=$2,full_name=$3,email=$4,directory_id=$5,directory_subject_id=$6,status='Active',role_type='CentralAdmin',assignment_source='OperatorBootstrap',authorization_version=authorization_version+1,revision=revision+1,updated_at=now() where id=$1 returning id::text,revision"
          : "insert into public.users(id,username,full_name,email,directory_id,directory_subject_id,status,role_type,assignment_source) values(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,'Active','CentralAdmin','OperatorBootstrap') returning id::text,revision",
        [
          before?.id ?? null,
          identity.username,
          identity.fullName,
          identity.email,
          identity.directoryId,
          identity.directorySubjectId,
        ],
      );
      if (!user) throw Error("Bootstrap user could not be saved.");
      const previousScopes = await tx.query(
        "select scope_type,scope_value from public.user_scopes where user_id=$1",
        [user.id],
      );
      await tx.query("delete from public.user_scopes where user_id=$1", [user.id]);
      await tx.query(
        "insert into public.user_scopes(user_id,scope_type,scope_value) values($1,'Global','*')",
        [user.id],
      );
      await tx.query(
        "update public.admin_sessions set revoked_at=now() where user_id=$1 and revoked_at is null",
        [user.id],
      );
      await new AuditLogService(this.db).record(tx, {
        actorUsername: operator,
        actionType: "Access.OperatorBootstrap",
        moduleName: "Access",
        entityType: "User",
        entityId: user.id,
        description: reason,
        metadata: {
          before,
          previousScopes,
          directorySubjectId: identity.directorySubjectId,
          roleId: "CentralAdmin",
          scopes: [{ scopeType: "Global", scopeValue: "*" }],
        },
      });
      return {
        id: user.id,
        username: identity.username,
        roleId: "CentralAdmin",
        scope: "Global",
        revision: user.revision,
      };
    });
  }
}
