import { AuditLogService } from "../../audit/service/audit-log-service.js";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { rolePermissions, type Permission } from "../model/permission-catalog.js";

function roles(permission: Permission) {
  return Object.entries(rolePermissions)
    .filter(([, p]) => p.includes(permission))
    .map(([r]) => `'${r}'`)
    .join(",");
}
/** Only fixed internal column expressions may be passed; no request strings. */
export function jobActorSql(
  user: string,
  version: string,
  site: string,
  area: string,
  permission: Permission,
) {
  return `exists(select 1 from public.users job_actor where job_actor.id=${user} and job_actor.status='Active'
 and job_actor.authorization_version=${version} and job_actor.role_type in (${roles(permission)})
 and exists(select 1 from public.user_scopes job_scope where job_scope.user_id=job_actor.id and (
   (job_scope.scope_type='Global' and job_scope.scope_value='*') or
   (job_scope.scope_type='Site' and job_scope.scope_value=${site}::text and exists(select 1 from public.sites active_site where active_site.id=${site} and active_site.status='Active')) or
   (job_scope.scope_type='Area' and job_scope.scope_value=${area}::text and exists(select 1 from public.areas active_area join public.sites active_site on active_site.id=active_area.site_id where active_area.id=${area} and active_area.site_id=${site} and active_area.status='Active' and active_site.status='Active')))))`;
}
export function communicationJobSql(communication = "c", device = "auth_device") {
  const permission = jobActorSql(
    "job_access.publisher_user_id",
    "job_access.publisher_authorization_version",
    `${device}.site_id`,
    `${device}.area_id`,
    "notifications.publish",
  );
  return `exists(select 1 from public.communication_access job_access join public.users publisher on publisher.id=job_access.publisher_user_id
 where job_access.communication_id=${communication}.id and job_access.authorization_state='Authorized'
 and ${permission}
 and not exists(select 1 from public.communication_recipients pending_target
   left join public.devices target_device on target_device.id=pending_target.device_id
   left join public.employees target_employee on target_employee.id=pending_target.employee_id
   where pending_target.communication_id=${communication}.id
   and not (${jobActorSql("job_access.publisher_user_id", "job_access.publisher_authorization_version", "coalesce(target_device.site_id,target_employee.site_id)", "coalesce(target_device.area_id,target_employee.area_id)", "notifications.publish")}))
 and (${communication}.wellness_program_json is null or publisher.role_type in (${roles("wellness.publish")}))
 and ((${communication}.priority <> 'Critical' and not exists(select 1 from public.communication_templates emergency_template where emergency_template.id=${communication}.template_id and emergency_template.critical_behavior_mode is not null)) or publisher.role_type in (${roles("notifications.emergency")})))`;
}
export class JobAuthorizationService {
  constructor(private readonly db: DatabaseClient) {}
  async deactivateUnauthorizedPolicies(deviceId: string) {
    return this.db.withTransaction(async (tx) => {
      const changed: Array<{ id: string; kind: string }> = [];
      // updated_at advances so an offline agent receives the deactivation on its next sync.
      changed.push(
        ...(await tx.query<{ id: string; kind: string }>(
          `update public.agent_reminder_policies arp set is_active=false,updated_at=now()
    from public.communications c,public.devices auth_device
    where arp.communication_id=c.id and arp.device_id=auth_device.id and auth_device.id=$1
    and arp.is_active=true and not (${communicationJobSql()}) returning arp.id::text as id, 'ReminderPolicy' as kind`,
          [deviceId],
        )),
      );
      changed.push(
        ...(await tx.query<{ id: string; kind: string }>(
          `update public.communication_access access_record set authorization_state='BlockedAuthorization',updated_at=now()
    from public.communications c where access_record.communication_id=c.id and access_record.authorization_state='Authorized'
    and exists(select 1 from public.communication_recipients target_recipient join public.devices auth_device on auth_device.id=target_recipient.device_id
      where target_recipient.communication_id=c.id and auth_device.id=$1 and not (${communicationJobSql()})) returning access_record.communication_id::text as id, 'Communication' as kind`,
          [deviceId],
        )),
      );
      changed.push(
        ...(await tx.query<{ id: string; kind: string }>(
          `update public.agent_rollout_intents ari set authorization_state='BlockedAuthorization',updated_at=now()
    from public.devices auth_device where ari.device_id=auth_device.id and ari.device_id=$1 and ari.is_active=true
    and ari.authorization_state='Authorized' and not (${jobActorSql("ari.initiated_by_user_id", "ari.initiator_authorization_version", "auth_device.site_id", "auth_device.area_id", "rollouts.apply")}) returning ari.id::text as id, 'RolloutIntent' as kind`,
          [deviceId],
        )),
      );
      const audit = new AuditLogService(this.db);
      for (const row of changed)
        await audit.record(tx, {
          actionType: "AuthorizationBlocked",
          moduleName: "Access",
          entityType: row.kind,
          entityId: row.id,
          description:
            "Queued work blocked because the initiating authorization is no longer valid.",
          metadata: { deviceId, recovery: "Review and publish a new communication or rollout." },
        });
    });
  }
}
