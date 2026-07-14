import type { Channel } from "@/types";

const allowedChannelValues: Channel[] = [
  "DesktopAgent",
  "WhatsApp",
  "Email",
  "DigitalSignage",
];

const rawConfiguredChannels =
  (import.meta as unknown as { env: { VITE_ENABLED_DELIVERY_CHANNELS?: string } }).env
    .VITE_ENABLED_DELIVERY_CHANNELS ?? "DesktopAgent";

export const enabledDeliveryChannels: Channel[] = rawConfiguredChannels
  .split(",")
  .map((value) => normalizeConfiguredChannel(value))
  .filter((value): value is Channel => Boolean(value))
  .filter((value, index, array) => array.indexOf(value) === index);

export function filterEnabledDeliveryChannels(channels: Channel[]) {
  const filtered = channels.filter((channel) => enabledDeliveryChannels.includes(channel));
  return filtered.length > 0 ? filtered : [...enabledDeliveryChannels];
}

function normalizeConfiguredChannel(value: string): Channel | null {
  const trimmed = value.trim();
  if (trimmed === "WindowsAgent") {
    return "DesktopAgent";
  }

  return allowedChannelValues.includes(trimmed as Channel) ? (trimmed as Channel) : null;
}
