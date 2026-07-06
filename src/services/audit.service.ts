// TODO(backend): GET /api/audit-logs with pagination & filters.
import type { AuditLog } from "@/types";
import { mockDelay } from "@/lib/mock-delay";
import { auditLogs as seed } from "@/data/misc";

export const auditService = {
  async list(): Promise<AuditLog[]> {
    await mockDelay();
    return [...seed];
  },
};
