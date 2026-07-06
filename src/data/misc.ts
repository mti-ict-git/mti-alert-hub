import type { AuditLog, Template, WhatsAppMessage } from "@/types";
import { employees } from "./employees";

export const templates: Template[] = [
  {
    id: "tpl-1",
    name: "Fire Emergency",
    category: "OHSE",
    priority: "Emergency",
    defaultMessage: "Fire alarm activated. Evacuate immediately.",
    defaultInstruction: "Proceed to nearest Assembly Point. Reply 1=Safe, 2=Need Assistance, 3=Not in Area.",
    defaultChannels: ["DesktopAgent", "WhatsApp", "Email", "DigitalSignage"],
    requireAck: true,
  },
  {
    id: "tpl-2",
    name: "Power Shutdown",
    category: "Operation",
    priority: "Warning",
    defaultMessage: "Scheduled power shutdown notification.",
    defaultInstruction: "Save your work and safely shutdown equipment.",
    defaultChannels: ["DesktopAgent", "WhatsApp", "Email"],
    requireAck: true,
  },
  {
    id: "tpl-3",
    name: "Network Maintenance",
    category: "IT",
    priority: "Info",
    defaultMessage: "Network maintenance window.",
    defaultInstruction: "Expect intermittent connectivity.",
    defaultChannels: ["DesktopAgent", "Email"],
    requireAck: false,
  },
  {
    id: "tpl-4",
    name: "Emergency Drill",
    category: "OHSE",
    priority: "Warning",
    defaultMessage: "Emergency evacuation drill scheduled.",
    defaultInstruction: "Follow marshal instructions to Assembly Point.",
    defaultChannels: ["DesktopAgent", "WhatsApp", "DigitalSignage"],
    requireAck: true,
  },
  {
    id: "tpl-5",
    name: "Weather Warning",
    category: "OHSE",
    priority: "Warning",
    defaultMessage: "Severe weather warning issued.",
    defaultInstruction: "Suspend outdoor operations. Shelter in place.",
    defaultChannels: ["WhatsApp", "DesktopAgent"],
    requireAck: true,
  },
  {
    id: "tpl-6",
    name: "General Announcement",
    category: "General",
    priority: "Info",
    defaultMessage: "General company announcement.",
    defaultInstruction: "",
    defaultChannels: ["DesktopAgent", "Email"],
    requireAck: false,
  },
];

export const whatsappMessages: WhatsAppMessage[] = Array.from({ length: 28 }).map((_, i) => {
  const e = employees[i % employees.length];
  const incoming = i % 3 === 0;
  return {
    id: `wa-${i + 1}`,
    time: new Date(Date.now() - i * 1000 * 60 * 12).toISOString(),
    phone: e.phone,
    employeeName: e.name,
    type: incoming ? "Incoming" : "Outgoing",
    content: incoming
      ? ["1", "2", "3", "Safe", "Need help at Unit 4"][i % 5]
      : "🚨 MTI ALERT — Fire Alarm at Acid Plant. Evacuate to Assembly Point A. Reply 1=Safe, 2=Need Assistance, 3=Not in Area.",
    status: i % 9 === 0 ? "Failed" : "Delivered",
  };
});

const actions = ["Login", "Create Notification", "Cancel Notification", "Update Employee", "Send Test", "Logout", "Update Settings"];
const modules = ["Auth", "Notifications", "Employees", "Devices", "Settings", "WhatsApp"];

export const auditLogs: AuditLog[] = Array.from({ length: 60 }).map((_, i) => ({
  id: `al-${i + 1}`,
  time: new Date(Date.now() - i * 1000 * 60 * 37).toISOString(),
  user: i % 2 === 0 ? "admin.ohse" : "ops.center",
  action: actions[i % actions.length],
  module: modules[i % modules.length],
  description: `${actions[i % actions.length]} performed via web console`,
  ipAddress: `10.10.${(i % 5) + 1}.${50 + (i % 20)}`,
}));
