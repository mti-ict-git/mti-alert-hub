export type RolloutBatchResult = {
  id: string;
  hostname: string;
  success: boolean;
  activeRollouts?: number;
  error?: string;
};

/** Sequential requests preserve per-device server validation and audit transactions.
 * Never retry automatically: a lost response may already have committed an intent.
 */
export async function runDeviceRolloutBatch(
  targets: readonly { id: string; hostname: string }[],
  request: (id: string) => Promise<unknown>,
  progress?: (completed: number) => void,
): Promise<RolloutBatchResult[]> {
  const snapshot = [
    ...new Map(targets.map((t) => [t.id, { id: t.id, hostname: t.hostname }])).values(),
  ];
  const results: RolloutBatchResult[] = [];
  for (const target of snapshot) {
    try {
      const response = await request(target.id);
      const activeRollouts =
        response && typeof response === "object" && "currentlyActiveRollouts" in response
          ? Number(response.currentlyActiveRollouts)
          : undefined;
      results.push({ ...target, success: true, activeRollouts });
    } catch (error) {
      results.push({
        ...target,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No confirmed response. Check rollout history before retrying.",
      });
    }
    progress?.(results.length);
  }
  return results;
}
