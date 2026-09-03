// Shared domain types for MTI Alert.
// TODO(backend): keep these in sync with the Node/Express API schemas.

export type Priority = "Info" | "Warning" | "Emergency" | "Critical";
export type Category = "IT" | "OHSE" | "Security" | "Operation" | "HR" | "General";
export type Channel = "DesktopAgent" | "WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage";
export type CommunicationType =
  | "Alert"
  | "Reminder"
  | "OperationalNotice"
  | "News"
  | "Article"
  | "KnowledgeUpdate";
export type TargetType =
  | "All"
  | "Site"
  | "Area"
  | "Department"
  | "Section"
  | "Employee"
  | "Group"
  | "Device"
  | "Individual"
  | "Custom";
export type NotificationStatus =
  | "Draft"
  | "Scheduled"
  | "Sending"
  | "Sent"
  | "Queued"
  | "Active"
  | "Completed"
  | "Cancelled"
  | "Failed";
export type DeliveryStatus =
  | "Pending"
  | "Sent"
  | "Delivered"
  | "Displayed"
  | "Read"
  | "Overdue"
  | "Responded"
  | "Failed";
export type AckStatus = "Safe" | "NeedAssistance" | "NotInArea" | "Acknowledged" | "NoResponse";
export type DeviceStatus = "Online" | "Offline" | "Stale";
export type EmployeeStatus = "Active" | "Inactive";
export type ScheduleExecutionMode = "ServerGenerated" | "AgentLocalRoutine";
export type CommunicationScheduleType = "Immediate" | "Scheduled" | "Recurring";
export type WindowsAgentPresentation = "Toast" | "Modal" | "Fullscreen";
export type WellnessProgramType = "SimpleReminder" | "GuidedRoutine";
export type WellnessTheme = "Blue" | "Green";
export type WellnessLayoutVariant =
  | "ReminderCard"
  | "CountdownCard"
  | "OverviewCard"
  | "GuidedRoutine"
  | "CompletionCard";
export type WellnessRotationMode = "Fixed" | "Sequential" | "Random";
export type WellnessActionKind = "GotIt" | "Done" | "Start" | "Next" | "Close" | "RemindMeLater";
export type WellnessActionStyle = "Primary" | "Secondary" | "Ghost";

export interface WellnessAction {
  actionKey: string;
  kind: WellnessActionKind;
  label: string;
  style?: WellnessActionStyle | null;
  snoozeMinutes?: number | null;
}

export interface WellnessStep {
  stepKey: string;
  title: string;
  description?: string | null;
  assetUrl?: string | null;
  durationSeconds?: number | null;
  sortOrder: number;
}

export interface WellnessLocalization {
  locale: string;
  title?: string | null;
  body?: string | null;
  instruction?: string | null;
}

export interface WellnessProgram {
  programType: WellnessProgramType;
  theme: WellnessTheme;
  layoutVariant: WellnessLayoutVariant;
  heroAssetUrl?: string | null;
  countdownSeconds?: number | null;
  rotationMode?: WellnessRotationMode | null;
  actions: WellnessAction[];
  steps?: WellnessStep[];
  localizations?: WellnessLocalization[];
}

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
  siteId?: string | null;
  siteName?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  phone?: string | null;
  email?: string | null;
  preferredChannels: Channel[];
  status: EmployeeStatus;
}

export interface Device {
  id: string;
  deviceId: string;
  hostname: string;
  siteId: string;
  siteName?: string | null;
  areaId?: string | null;
  areaName?: string | null;
  locationLabel?: string | null;
  ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
  primaryEmployeeId?: string | null;
  primaryEmployeeName?: string | null;
  lastActiveUserIdentifier?: string | null;
  currentUserType?: "Employee" | "NonEmployee" | "Unknown";
  currentUsername?: string | null;
  currentDisplayName?: string | null;
  currentEmployeeNumber?: string | null;
  currentDepartment?: string | null;
  currentTitle?: string | null;
  currentMobile?: string | null;
  currentEmail?: string | null;
  lastDirectoryLookupAt?: string | null;
  agentVersion?: string | null;
  status: DeviceStatus;
  lastSeen?: string | null;
}

export type DeviceEnrollmentRequestStatus = "Pending" | "Approved" | "Rejected";

export interface PendingDeviceEnrollment {
  id: string;
  deviceIdentifier: string;
  hostname: string;
  agentVersion?: string | null;
  employeeNumber?: string | null;
  activeUserIdentifier?: string | null;
  requestStatus: DeviceEnrollmentRequestStatus;
  requestCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  decidedByUsername?: string | null;
  decisionReason?: string | null;
  approvedDeviceId?: string | null;
}

export interface ApprovePendingDeviceRequest {
  siteId: string;
  areaId?: string | null;
  locationLabel?: string | null;
  ownershipMode?: "LocationOwned" | "EmployeeAssigned" | "Mixed" | null;
}

export interface RejectPendingDeviceRequest {
  reason?: string | null;
}

export interface ApprovePendingDeviceResponse {
  ok: true;
  request: PendingDeviceEnrollment;
  device: {
    id: string;
    hostname: string;
    deviceIdentifier?: string | null;
    siteId: string;
    areaId?: string | null;
    locationLabel?: string | null;
    ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
    agentVersion?: string | null;
    status: DeviceStatus;
    createdAt: string;
  };
}

export interface RejectPendingDeviceResponse {
  ok: true;
  request: PendingDeviceEnrollment;
}

export type DeviceRolloutAction = "Upgrade" | "Repair" | "Uninstall";

export interface DeviceRolloutPackage {
  fileName: string;
  fileSizeBytes: number;
  lastModifiedAt: string;
  version?: string | null;
  packageUrl: string;
  sha256?: string | null;
  signature?: string | null;
  signatureStatus?: string | null;
  signatureStatusMessage?: string | null;
  signerSubject?: string | null;
  signerIssuer?: string | null;
  rolloutCommand?: string | null;
}

export interface DeviceRolloutUploadResponse {
  package: DeviceRolloutPackage;
  alreadyExists: boolean;
  replacedExisting: boolean;
}

export interface DeviceRolloutDeleteResponse {
  ok: true;
  fileName: string;
}

export interface DeviceRolloutRequest {
  version: string;
  packageUrl: string;
  sha256: string;
  signature: string;
  rolloutChannel?: string | null;
  action?: DeviceRolloutAction;
  mandatory?: boolean;
  notes?: string | null;
  releaseNotes?: string | null;
  deadlineAt?: string | null;
  apply?: boolean;
}

export interface DeviceRolloutPreviewResponse {
  ok: true;
  mode: "dry-run";
  target: {
    id: string;
    hostname: string;
    deviceIdentifier?: string | null;
    agentVersion?: string | null;
    status: DeviceStatus;
  };
  rollout: {
    action: DeviceRolloutAction;
    targetVersion: string;
    rolloutChannel?: string | null;
    mandatory: boolean;
    deadlineAt?: string | null;
    notes?: string | null;
  };
  package: {
    packageType: "MSI";
    packageUrl: string;
    sha256: string;
    signature: string;
    releaseNotes?: string | null;
  };
  currentlyActiveRollouts: number;
}

export interface DeviceRolloutApplyResponse {
  ok: true;
  mode: "applied";
  target: {
    id: string;
    hostname: string;
    deviceIdentifier?: string | null;
    agentVersion?: string | null;
    status: DeviceStatus;
    updatedAt?: string | null;
  };
  deactivatedPreviousRollouts: number;
  releasePackage: {
    id: string;
    version: string;
    packageUrl: string;
  };
  rolloutIntent: {
    id: string;
    action: DeviceRolloutAction;
    targetVersion: string;
    createdAt: string;
  };
}

export interface Notification {
  id: string;
  communicationType: CommunicationType;
  title: string;
  message: string;
  priority: Priority;
  category: Category;
  targetType: TargetType;
  targetSite?: string;
  targetArea?: string;
  targetDepartment?: string;
  targetSection?: string;
  targetEmployeeId?: string;
  targetDeviceId?: string;
  templateId?: string | null;
  workflowId?: string | null;
  channels: Channel[];
  windowsAgentPresentation?: WindowsAgentPresentation | null;
  toastAutoDismissSeconds?: number | null;
  requireAck: boolean;
  scheduledAt?: string | null;
  instruction?: string;
  wellnessProgram?: WellnessProgram | null;
  status: NotificationStatus;
  reminderSchedule?: ReminderSchedule | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
  recipientsCount: number;
  ackCount: number;
}

export interface ReminderSchedule {
  scheduleType: CommunicationScheduleType;
  scheduledAt?: string | null;
  recurrenceRule?: string | null;
  timezone?: string | null;
  executionMode?: ScheduleExecutionMode | null;
  scheduleVersion: number;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
}

export interface Recipient {
  id: string;
  notificationId: string;
  employeeId: string;
  deviceId?: string | null;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  channelEndpoint?: string | null;
  name: string;
  department: string;
  section: string;
  site: string;
  area?: string;
  channel: Channel;
  channels?: Channel[];
  recipientType?: "Device" | "Employee" | "ContactEndpoint";
  deliveryStatus: DeliveryStatus;
  ackStatus: AckStatus;
  responseState?: "NotRequired" | "AwaitingResponse" | "Overdue" | "Responded";
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

export interface ResponseRecord {
  id: string;
  notificationId: string;
  recipientId: string;
  recipientName: string;
  channel: Channel;
  responseOptionKey: string;
  actorUserIdentifier?: string | null;
  responseNote?: string | null;
  respondedAt: string;
}

export interface AudiencePreviewRecipient {
  recipientType: "Employee" | "Device";
  deviceId?: string | null;
  employeeId?: string | null;
  employeeNumber?: string | null;
  fullName?: string | null;
  siteName?: string | null;
  areaName?: string | null;
  departmentName?: string | null;
  sectionName?: string | null;
  availableChannels: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
}

export interface ChannelPlanItem {
  channel: "WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage";
  strategy: "Mandatory" | "Optional" | "DelayedFollowUp";
  plannedDelaySeconds?: number | null;
}

export interface AudiencePreview {
  totalRecipients: number;
  deviceRecipients: number;
  whatsappRecipients: number;
  previewWarnings: string[];
  channelPlan: ChannelPlanItem[];
  recipients: AudiencePreviewRecipient[];
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
  communicationType:
    | "Alert"
    | "Reminder"
    | "OperationalNotice"
    | "News"
    | "Article"
    | "KnowledgeUpdate";
  category: Category;
  priority: Priority;
  defaultMessage: string;
  defaultInstruction: string;
  defaultChannels: Channel[];
  requireAck: boolean;
  defaultWorkflowId?: string | null;
  allowedTargetTypes?: TargetType[];
  lockedFields?: string[];
  editableFields?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  allowFreeText: boolean;
  requireFreeText: boolean;
  escalationTimeoutMinutes?: number | null;
  escalationMode?: "RecipientOnly" | null;
  responseImpliesAck: boolean;
  options: Array<{
    key: string;
    label: string;
  }>;
}

export interface ReminderPolicySummary {
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  scheduleVersion: number;
  recurrenceRule: string;
  timezone: string;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
}

export interface ReminderEventRecord {
  eventId: string;
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  eventType:
    | "Triggered"
    | "Displayed"
    | "Read"
    | "Dismissed"
    | "Snoozed"
    | "Responded"
    | "Started"
    | "StepAdvanced"
    | "Completed"
    | "TimedOut";
  occurredAt: string;
  reportedAt: string;
  activeUserIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ReminderActivity {
  policies: ReminderPolicySummary[];
  events: ReminderEventRecord[];
}

export interface WellnessMonitoringCounts {
  triggered: number;
  displayed: number;
  started: number;
  snoozed: number;
  completed: number;
  timedOut: number;
  stepAdvanced: number;
}

export interface WellnessDeviceMonitoring {
  policyId: string;
  deviceId: string;
  deviceLabel: string;
  isActive: boolean;
  scheduleVersion: number;
  lastSyncedAt?: string | null;
  lastActivityAt?: string | null;
  lastEventType?: ReminderEventRecord["eventType"] | null;
}

export interface WellnessMonitoringSummary {
  counts: WellnessMonitoringCounts;
  totalPolicies: number;
  activePolicies: number;
  lastSyncedAt?: string | null;
  lastActivityAt?: string | null;
  completionRate?: number | null;
  deviceItems: WellnessDeviceMonitoring[];
  recentEvents: ReminderEventRecord[];
}

export interface WellnessProgramListItem {
  notification: Notification;
  lastUpdatedAt: string;
  monitoring?: WellnessMonitoringSummary | null;
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
