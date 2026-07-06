// TODO(backend): GET/POST /api/settings
import { mockDelay } from "@/lib/mock-delay";

export interface AppSettings {
  general: { companyName: string; timezone: string; language: string };
  desktopAgent: { currentVersion: string; heartbeatSec: number; autoUpdate: boolean };
  whatsapp: { gatewayUrl: string; webhookUrl: string; defaultTemplate: string; retryAttempts: number };
}

const store: AppSettings = {
  general: { companyName: "PT MTI", timezone: "Asia/Makassar", language: "en-US" },
  desktopAgent: { currentVersion: "1.5.1", heartbeatSec: 30, autoUpdate: true },
  whatsapp: {
    gatewayUrl: "https://wa-gateway.mti.co.id",
    webhookUrl: "https://mti-alert.mti.co.id/api/whatsapp/webhook",
    defaultTemplate: "mti_alert_v1",
    retryAttempts: 3,
  },
};

export const settingsService = {
  async get(): Promise<AppSettings> {
    await mockDelay();
    return structuredClone(store);
  },
  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    await mockDelay();
    Object.assign(store, patch);
    return structuredClone(store);
  },
};
