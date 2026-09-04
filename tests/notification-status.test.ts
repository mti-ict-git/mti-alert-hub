import assert from "node:assert/strict";
import test from "node:test";
import { isCancellableNotificationStatus } from "../src/lib/notification-status";
import type { NotificationStatus } from "../src/types";

test("only live notification states can be cancelled", () => {
  const expected: Record<NotificationStatus, boolean> = {
    Draft: false,
    Scheduled: true,
    Queued: true,
    Sending: true,
    Active: true,
    Sent: false,
    Completed: false,
    Cancelled: false,
    Failed: false,
  };

  for (const [status, cancellable] of Object.entries(expected)) {
    assert.equal(
      isCancellableNotificationStatus(status as NotificationStatus),
      cancellable,
      status,
    );
  }
});
