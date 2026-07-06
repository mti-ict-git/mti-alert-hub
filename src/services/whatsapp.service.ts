// TODO(backend): GET /api/whatsapp/*  + webhook status endpoint.
import type { WhatsAppMessage } from "@/types";
import { mockDelay } from "@/lib/mock-delay";
import { whatsappMessages as seed } from "@/data/misc";

export const whatsappService = {
  async status() {
    await mockDelay();
    return {
      connected: true,
      sentToday: 128,
      failed: 4,
      incoming: 37,
      gatewayUrl: "https://wa-gateway.mti.co.id",
      lastHeartbeat: new Date().toISOString(),
    };
  },
  async messages(): Promise<WhatsAppMessage[]> {
    await mockDelay();
    return [...seed];
  },
};
