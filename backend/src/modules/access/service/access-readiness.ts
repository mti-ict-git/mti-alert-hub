import type { DatabaseClient } from "../../../infrastructure/db/connection.js";

/** Read-only cutover check. Never promotes accounts or guesses ownership of legacy jobs. */
export async function checkAccessReadiness(db: DatabaseClient) {
  for (const table of [
    "admin_sessions",
    "access_idempotency",
    "communication_access",
    "communication_preview_receipts",
  ]) {
    if (!(await db.tableExists(table)))
      throw Error(
        "Users & Access requires migrations through 0020 before startup. Missing table: " + table,
      );
  }
  const [admin] = await db.query<{
    count: number;
  }>(`select count(*)::int as count from public.users u
    where u.status='Active' and u.role_type='CentralAdmin' and u.directory_id is not null and u.directory_subject_id is not null
    and exists(select 1 from public.user_scopes s where s.user_id=u.id and s.scope_type='Global' and s.scope_value='*')
    and not exists(select 1 from public.user_scopes s where s.user_id=u.id and s.scope_type<>'Global')`);
  if (!admin?.count)
    throw Error(
      "No verified Active Global Administrator. Run the audited administrator bootstrap before cutover.",
    );
  const [inventory] = await db.query<{
    legacyCommunications: number;
    legacyRollouts: number;
  }>(`select
    (select count(*)::int from public.communications c where c.status in ('Scheduled','Queued','Sending','Active') and not exists(select 1 from public.communication_access a where a.communication_id=c.id and a.authorization_state='Authorized')) as "legacyCommunications",
    (select count(*)::int from public.agent_rollout_intents where is_active and authorization_state<>'Authorized') as "legacyRollouts"`);
  return { ready: true, verifiedAdministrators: admin.count, ...inventory };
}
