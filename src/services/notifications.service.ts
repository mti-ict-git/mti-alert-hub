// TODO(backend): replace with GET/POST /api/notifications endpoints.
import type { DeliveryLog, Notification, Recipient } from "@/types";
import { mockDelay, genId } from "@/lib/mock-delay";
import { deliveryLogsFor, notifications as seed, recipientsFor } from "@/data/notifications";

const store: Notification[] = [...seed];

export const notificationsService = {
  async list(): Promise<Notification[]> {
    await mockDelay();
    return [...store].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async get(id: string): Promise<Notification | undefined> {
    await mockDelay();
    return store.find((n) => n.id === id);
  },
  async recipients(id: string): Promise<Recipient[]> {
    await mockDelay();
    const n = store.find((x) => x.id === id);
    return n ? recipientsFor(n) : [];
  },
  async deliveryLogs(id: string): Promise<DeliveryLog[]> {
    await mockDelay();
    const n = store.find((x) => x.id === id);
    return n ? deliveryLogsFor(n) : [];
  },
  async create(input: Omit<Notification, "id" | "createdAt" | "createdBy" | "recipientsCount" | "ackCount" | "status"> & { scheduleLater?: boolean }): Promise<Notification> {
    await mockDelay(500);
    const n: Notification = {
      ...input,
      id: `ntf-${genId()}`,
      createdAt: new Date().toISOString(),
      createdBy: "admin.ohse",
      recipientsCount: 25,
      ackCount: 0,
      status: input.scheduleLater ? "Scheduled" : "Sending",
    };
    store.unshift(n);
    // Simulate delivery completing shortly after
    if (!input.scheduleLater) {
      setTimeout(() => {
        n.status = "Sent";
        n.ackCount = Math.floor(n.recipientsCount * 0.7);
      }, 1500);
    }
    return n;
  },
  async cancel(id: string): Promise<void> {
    await mockDelay();
    const n = store.find((x) => x.id === id);
    if (n && n.status === "Scheduled") n.status = "Cancelled";
  },
  async duplicate(id: string): Promise<Notification | undefined> {
    await mockDelay();
    const src = store.find((x) => x.id === id);
    if (!src) return;
    const copy: Notification = {
      ...src,
      id: `ntf-${genId()}`,
      title: `${src.title} (Copy)`,
      status: "Draft",
      createdAt: new Date().toISOString(),
      ackCount: 0,
    };
    store.unshift(copy);
    return copy;
  },
};
