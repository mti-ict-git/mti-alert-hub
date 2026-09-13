export type DeviceApprovalTarget = { id: string; hostname: string };
export type DeviceApprovalResult = DeviceApprovalTarget & { approved: boolean; error?: string };

/** Each request retains its backend transaction and audit trail. Never retry successes. */
export async function approveDeviceRequests(
  targets: readonly DeviceApprovalTarget[],
  approve: (id: string) => Promise<unknown>,
  onProgress?: (completed: number, total: number) => void,
): Promise<DeviceApprovalResult[]> {
  const unique = [...new Map(targets.map((target) => [target.id, { ...target }])).values()];
  const results: DeviceApprovalResult[] = [];
  for (const target of unique) {
    try {
      await approve(target.id);
      results.push({ ...target, approved: true });
    } catch (error) {
      results.push({
        ...target,
        approved: false,
        error:
          error instanceof Error
            ? error.message
            : "Approval could not be confirmed. Refresh device data before retrying.",
      });
    }
    onProgress?.(results.length, unique.length);
  }
  return results;
}
