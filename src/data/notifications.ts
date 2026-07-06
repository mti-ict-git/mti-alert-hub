import type {
  AckStatus,
  Channel,
  DeliveryLog,
  DeliveryStatus,
  Notification,
  Recipient,
} from "@/types";
import { employees } from "./employees";

interface Seed {
  title: string;
  message: string;
  priority: Notification["priority"];
  category: Notification["category"];
  targetType: Notification["targetType"];
  targetSite?: string;
  targetDepartment?: string;
  channels: Channel[];
  status: Notification["status"];
  instruction?: string;
  requireAck: boolean;
  scheduledAt?: string | null;
  hoursAgo: number;
}

const seeds: Seed[] = [
  {
    title: "Fire Alarm at Acid Plant",
    message: "Fire detected in Acid Plant Unit 3. Evacuate immediately.",
    priority: "Emergency",
    category: "OHSE",
    targetType: "Site",
    targetSite: "Acid Plant",
    channels: ["DesktopAgent", "WhatsApp", "Email", "DigitalSignage"],
    status: "Sent",
    instruction: "Evacuate to Assembly Point A. Reply 1=Safe, 2=Need Assistance, 3=Not in Area.",
    requireAck: true,
    hoursAgo: 2,
  },
  {
    title: "Power Shutdown at Chloride",
    message: "Scheduled power shutdown 22:00–02:00 for maintenance.",
    priority: "Warning",
    category: "Operation",
    targetType: "Site",
    targetSite: "Chloride",
    channels: ["DesktopAgent", "WhatsApp", "Email"],
    status: "Sent",
    instruction: "Save your work and shutdown equipment before 21:45.",
    requireAck: true,
    hoursAgo: 6,
  },
  {
    title: "Network Maintenance",
    message: "Internal network will be intermittent from 20:00 to 21:00.",
    priority: "Info",
    category: "IT",
    targetType: "All",
    channels: ["DesktopAgent", "Email"],
    status: "Sent",
    requireAck: false,
    hoursAgo: 14,
  },
  {
    title: "Emergency Drill",
    message: "Quarterly evacuation drill will be conducted at 10:00 today.",
    priority: "Warning",
    category: "OHSE",
    targetType: "All",
    channels: ["DesktopAgent", "WhatsApp", "DigitalSignage"],
    status: "Sent",
    instruction: "Proceed to nearest Assembly Point when alarm sounds.",
    requireAck: true,
    hoursAgo: 30,
  },
  {
    title: "Heavy Rain Warning",
    message: "BMKG issued heavy rain and lightning warning for the next 3 hours.",
    priority: "Warning",
    category: "OHSE",
    targetType: "Site",
    targetSite: "Pyrite",
    channels: ["WhatsApp", "DesktopAgent"],
    status: "Sent",
    instruction: "Suspend outdoor activities. Stay indoors until further notice.",
    requireAck: true,
    hoursAgo: 48,
  },
  {
    title: "Gas Leak Alert – Makarti",
    message: "Suspected gas leak reported near Tank Farm B.",
    priority: "Emergency",
    category: "OHSE",
    targetType: "Site",
    targetSite: "Makarti",
    channels: ["DesktopAgent", "WhatsApp", "Email", "DigitalSignage"],
    status: "Sent",
    instruction: "Evacuate a 200m radius. Await OHSE clearance.",
    requireAck: true,
    hoursAgo: 72,
  },
  {
    title: "New Payroll Portal Available",
    message: "The new self-service payroll portal is now live.",
    priority: "Info",
    category: "HR",
    targetType: "All",
    channels: ["Email", "DesktopAgent"],
    status: "Sent",
    requireAck: false,
    hoursAgo: 96,
  },
  {
    title: "Security Patrol Reminder",
    message: "Reminder to complete midnight patrol log in the security app.",
    priority: "Info",
    category: "Security",
    targetType: "Department",
    targetDepartment: "Security",
    channels: ["WhatsApp"],
    status: "Scheduled",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    requireAck: false,
    hoursAgo: 0,
  },
  {
    title: "System Update – Desktop Agent 1.5.1",
    message: "Agent 1.5.1 will auto-install tonight at 23:00.",
    priority: "Info",
    category: "IT",
    targetType: "All",
    channels: ["DesktopAgent"],
    status: "Scheduled",
    scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
    requireAck: false,
    hoursAgo: 0,
  },
  {
    title: "Cafeteria Closed Tomorrow",
    message: "Main cafeteria closed for renovation. Use the temporary tent.",
    priority: "Info",
    category: "General",
    targetType: "All",
    channels: ["DesktopAgent", "DigitalSignage"],
    status: "Sent",
    requireAck: false,
    hoursAgo: 20,
  },
];

const priorityAckRate: Record<Notification["priority"], number> = {
  Info: 0.55,
  Warning: 0.78,
  Emergency: 0.92,
};

export const notifications: Notification[] = seeds.map((s, i) => {
  const rate = priorityAckRate[s.priority];
  const recipientsCount =
    s.targetType === "All"
      ? employees.length
      : s.targetSite
      ? employees.filter((e) => e.site === s.targetSite).length
      : s.targetDepartment
      ? employees.filter((e) => e.department === s.targetDepartment).length
      : employees.length;
  return {
    id: `ntf-${i + 1}`,
    title: s.title,
    message: s.message,
    priority: s.priority,
    category: s.category,
    targetType: s.targetType,
    targetSite: s.targetSite,
    targetDepartment: s.targetDepartment,
    channels: s.channels,
    requireAck: s.requireAck,
    scheduledAt: s.scheduledAt ?? null,
    instruction: s.instruction,
    status: s.status,
    createdBy: i % 2 === 0 ? "admin.ohse" : "ops.center",
    createdAt: new Date(Date.now() - s.hoursAgo * 3600 * 1000).toISOString(),
    recipientsCount,
    ackCount: s.status === "Sent" ? Math.floor(recipientsCount * rate) : 0,
  };
});

const deliveryStatuses: DeliveryStatus[] = ["Delivered", "Delivered", "Delivered", "Read", "Failed", "Pending"];
const ackStatuses: AckStatus[] = ["Safe", "Safe", "Safe", "NeedAssistance", "NotInArea", "Acknowledged", "NoResponse"];

export function recipientsFor(notif: Notification): Recipient[] {
  const pool =
    notif.targetType === "All"
      ? employees
      : notif.targetSite
      ? employees.filter((e) => e.site === notif.targetSite)
      : notif.targetDepartment
      ? employees.filter((e) => e.department === notif.targetDepartment)
      : employees;
  return pool.slice(0, 30).map((e, i) => {
    const channel = notif.channels[i % notif.channels.length];
    const dStatus = notif.status === "Sent" ? deliveryStatuses[i % deliveryStatuses.length] : "Pending";
    const aStatus = notif.status === "Sent" ? ackStatuses[i % ackStatuses.length] : "NoResponse";
    return {
      id: `rcp-${notif.id}-${i}`,
      notificationId: notif.id,
      employeeId: e.employeeId,
      name: e.name,
      department: e.department,
      section: e.section,
      site: e.site,
      channel,
      deliveryStatus: dStatus,
      ackStatus: aStatus,
      response:
        aStatus === "Safe"
          ? "1"
          : aStatus === "NeedAssistance"
          ? "2"
          : aStatus === "NotInArea"
          ? "3"
          : undefined,
      responseTime:
        aStatus !== "NoResponse"
          ? new Date(new Date(notif.createdAt).getTime() + (i + 1) * 90_000).toISOString()
          : undefined,
    };
  });
}

export function deliveryLogsFor(notif: Notification): DeliveryLog[] {
  const rcps = recipientsFor(notif);
  return rcps.slice(0, 20).map((r, i) => ({
    id: `log-${notif.id}-${i}`,
    notificationId: notif.id,
    time: new Date(new Date(notif.createdAt).getTime() + i * 15_000).toISOString(),
    channel: r.channel,
    target: r.name,
    status: r.deliveryStatus,
    detail:
      r.deliveryStatus === "Failed"
        ? "Timeout after 3 retries"
        : r.deliveryStatus === "Read"
        ? "Read receipt received"
        : "Delivered to gateway",
  }));
}
