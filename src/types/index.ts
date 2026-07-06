// Shared domain types for MTI Alert.
// TODO(backend): keep these in sync with the Node/Express API schemas.

export type Priority = "Info" | "Warning" | "Emergency";
export type Category = "IT" | "OHSE" | "Security" | "Operation" | "HR" | "General";
export type Channel = "DesktopAgent" | "WhatsApp" | "Email" | "DigitalSignage";
export type TargetType = "All" | "Site" | "Department" | "Section" | "Individual" | "Custom";
export type NotificationStatus = "Draft" | "Scheduled" | "Sending" | "Sent" | "Cancelled" | "Failed";
export type DeliveryStatus = "Pending" | "Delivered" | "Failed" | "Read";
export type AckStatus = "Safe" | "NeedAssistance" | "NotInArea" | "Acknowledged" | "NoResponse";
export type DeviceStatus = "Online" | "Offline";
export type EmployeeStatus = "Active" | "Inactive";

export interface User {
  id: string;
  username: string;
  name: string;
  role: "Admin" | "Operator" | "Viewer";
  email: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  section: string;
  position: string;
  site: string;
  phone: string;
  email: string;
  adUsername: string;
  hasPc: boolean;
  fieldOfficer: boolean;
  status: EmployeeStatus;
}

export interface Device {
  id: string;
  deviceId: string;
  hostname: string;
  username: string;
  employeeId: string;
  employeeName: string;
  ipAddress: string;
  agentVersion: string;
  status: DeviceStatus;
  lastSeen: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  category: Category;
  targetType: TargetType;
  targetSite?: string;
  targetDepartment?: string;
  targetSection?: string;
  channels: Channel[];
  requireAck: boolean;
  scheduledAt?: string | null;
  instruction?: string;
  status: NotificationStatus;
  createdBy: string;
  createdAt: string;
  recipientsCount: number;
  ackCount: number;
}

export interface Recipient {
  id: string;
  notificationId: string;
  employeeId: string;
  name: string;
  department: string;
  section: string;
  site: string;
  channel: Channel;
  deliveryStatus: DeliveryStatus;
  ackStatus: AckStatus;
  response?: string;
  responseTime?: string;
}

export interface DeliveryLog {
  id: string;
  notificationId: string;
  time: string;
  channel: Channel;
  target: string;
  status: DeliveryStatus;
  detail: string;
}

export interface WhatsAppMessage {
  id: string;
  time: string;
  phone: string;
  employeeName: string;
  type: "Outgoing" | "Incoming";
  content: string;
  status: DeliveryStatus;
}

export interface Template {
  id: string;
  name: string;
  category: Category;
  priority: Priority;
  defaultMessage: string;
  defaultInstruction: string;
  defaultChannels: Channel[];
  requireAck: boolean;
}

export interface AuditLog {
  id: string;
  time: string;
  user: string;
  action: string;
  module: string;
  description: string;
  ipAddress: string;
}

export interface ActivityItem {
  id: string;
  time: string;
  type: "sent" | "ack" | "device" | "whatsapp";
  text: string;
}
