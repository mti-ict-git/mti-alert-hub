import { z } from "zod";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AuditLogService } from "../../audit/service/audit-log-service.js";

export const directoryIdentitySchema = z
  .object({
    directoryId: z.string().trim().min(1).max(512),
    directorySubjectId: z.string().uuid(),
    username: z.string().trim().min(1).max(256),
    fullName: z.string().trim().min(1).max(256),
    email: z.string().email().nullable(),
  })
  .strict();
export type VerifiedDirectoryIdentity = z.infer<typeof directoryIdentitySchema>;
/** Called only with identity returned by a successful directory authentication/lookup. */
export class DirectoryUserRepository {
  constructor(private readonly db: DatabaseClient) {}
  async recordAuthenticatedIdentity(value: VerifiedDirectoryIdentity): Promise<string> {
    const identity = directoryIdentitySchema.parse(value);
    return this.db.withTransaction(async (tx) => {
      // Avoid duplicate Pending creation and concurrent username collision on first login.
      await tx.query("select pg_advisory_xact_lock($1)", [746220]);
      const [existing] = await tx.query<{ id: string; username: string }>(
        "select id::text,username from public.users where directory_id=$1 and directory_subject_id=$2 for update",
        [identity.directoryId, identity.directorySubjectId],
      );
      const [collision] = await tx.query<{ id: string }>(
        "select id::text from public.users where lower(username)=lower($1) and ($2::uuid is null or id<>$2)",
        [identity.username, existing?.id ?? null],
      );
      if (collision)
        throw new AppError({
          statusCode: 409,
          code: "DIRECTORY_IDENTITY_REVIEW_REQUIRED",
          message:
            "This account requires administrator identity review before access can be granted.",
        });
      if (existing) {
        await tx.query(
          "update public.users set username=$2,full_name=$3,email=$4,updated_at=now() where id=$1",
          [existing.id, identity.username, identity.fullName, identity.email],
        );
        return existing.id;
      }
      const [created] = await tx.query<{ id: string }>(
        `insert into public.users(username,full_name,email,status,role_type,directory_id,directory_subject_id)
    values($1,$2,$3,'Pending',null,$4,$5) returning id::text`,
        [
          identity.username,
          identity.fullName,
          identity.email,
          identity.directoryId,
          identity.directorySubjectId,
        ],
      );
      if (!created) throw new Error("Pending identity could not be recorded.");
      await new AuditLogService(this.db).record(tx, {
        actorUsername: identity.username,
        actionType: "Access.Pending",
        moduleName: "Access",
        entityType: "User",
        entityId: created.id,
        description: "Authenticated directory identity registered without application privileges.",
        metadata: { directorySubjectId: identity.directorySubjectId },
      });
      return created.id;
    });
  }
}
