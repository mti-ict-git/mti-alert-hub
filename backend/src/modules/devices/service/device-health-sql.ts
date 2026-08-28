import type { DeviceHealthThresholds } from "../../../app/config/env.js";

export function buildDeviceHealthStatusSql(thresholds: DeviceHealthThresholds) {
  const latestRealtimeSeenSql = `
    (
      select max(coalesce(drc.last_seen_at, drc.connected_at))
      from public.device_realtime_connections drc
      where drc.device_id = d.id
        and drc.status = 'Connected'
    )
  `;

  const freshnessAtSql = `
    greatest(
      coalesce(d.last_heartbeat_at, 'epoch'::timestamptz),
      coalesce(d.last_connection_at, 'epoch'::timestamptz),
      coalesce(${latestRealtimeSeenSql}, 'epoch'::timestamptz)
    )
  `;

  const statusSql = `
    case
      when ${freshnessAtSql} >= now() - make_interval(secs => ${thresholds.onlineSeconds})
        then 'Online'
      when ${freshnessAtSql} >= now() - make_interval(secs => ${thresholds.staleSeconds})
        then 'Stale'
      else 'Offline'
    end
  `;

  return statusSql;
}

