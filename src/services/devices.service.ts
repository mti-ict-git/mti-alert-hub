// TODO(backend): GET /api/devices with websocket updates for status.
import type { Device } from "@/types";
import { mockDelay } from "@/lib/mock-delay";
import { devices as seed } from "@/data/devices";

const store: Device[] = [...seed];

export const devicesService = {
  async list(): Promise<Device[]> {
    await mockDelay();
    // Simulate a mild status flap for realism
    store.forEach((d, i) => {
      if (Math.random() < 0.05) {
        d.status = d.status === "Online" ? "Offline" : "Online";
        d.lastSeen = new Date().toISOString();
      } else if (d.status === "Online" && i % 2 === 0) {
        d.lastSeen = new Date().toISOString();
      }
    });
    return [...store];
  },
  async sendTest(id: string): Promise<void> {
    await mockDelay(300);
    // TODO(backend): POST /api/devices/:id/test-notification
    return;
  },
};
