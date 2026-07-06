// TODO(backend): GET /api/reports/* aggregations.
import { mockDelay } from "@/lib/mock-delay";
import { DEPARTMENTS, SITES } from "@/data/reference";

export const reportsService = {
  async responseTimeByDept() {
    await mockDelay();
    return DEPARTMENTS.map((d, i) => ({ name: d, seconds: 45 + ((i * 37) % 180) }));
  },
  async ackRateBySite() {
    await mockDelay();
    return SITES.map((s, i) => ({ name: s, rate: 60 + ((i * 13) % 35) }));
  },
  async deliveryByChannel() {
    await mockDelay();
    return [
      { channel: "Desktop", delivered: 820, failed: 12 },
      { channel: "WhatsApp", delivered: 640, failed: 34 },
      { channel: "Email", delivered: 410, failed: 8 },
      { channel: "Signage", delivered: 180, failed: 2 },
    ];
  },
};
