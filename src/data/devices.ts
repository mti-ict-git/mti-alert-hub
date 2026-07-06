import type { Device } from "@/types";
import { employees } from "./employees";

const versions = ["1.4.2", "1.4.3", "1.5.0", "1.5.1"];

export const devices: Device[] = employees
  .filter((e) => e.hasPc)
  .slice(0, 18)
  .map((e, i) => ({
    id: `dev-${i + 1}`,
    deviceId: `DSK-${String(2001 + i).padStart(4, "0")}`,
    hostname: `MTI-PC-${String(101 + i).padStart(3, "0")}`,
    username: e.adUsername,
    employeeId: e.employeeId,
    employeeName: e.name,
    ipAddress: `10.10.${(i % 6) + 1}.${20 + i}`,
    agentVersion: versions[i % versions.length],
    status: i % 4 === 0 ? "Offline" : "Online",
    lastSeen: new Date(Date.now() - i * 1000 * 60 * (i % 4 === 0 ? 240 : 3)).toISOString(),
  }));
