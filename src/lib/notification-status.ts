import type { NotificationStatus } from "@/types";

export const CANCELLABLE_NOTIFICATION_STATUSES = new Set<NotificationStatus>([
  "Scheduled",
  "Queued",
  "Sending",
  "Active",
]);

export function isCancellableNotificationStatus(status: NotificationStatus) {
  return CANCELLABLE_NOTIFICATION_STATUSES.has(status);
}
