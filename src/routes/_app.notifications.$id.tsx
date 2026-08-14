import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MarkdownEditor } from "@/components/common/MarkdownEditor";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { devicesService } from "@/services/devices.service";
import { notificationsService } from "@/services/notifications.service";
import { referenceService } from "@/services/reference.service";
import { workflowsService } from "@/services/workflows.service";
import { enabledDeliveryChannels, filterEnabledDeliveryChannels } from "@/config/delivery-channels";
import { MarkdownText } from "@/components/common/MarkdownText";
import { Badge } from "@/components/ui/badge";
import { buildWellnessMonitoringSummary } from "@/lib/wellness-monitoring";
import type {
  AudiencePreview,
  Category,
  Channel,
  Notification,
  Priority,
  Recipient,
  ScheduleExecutionMode,
  TargetType,
  WindowsAgentPresentation,
} from "@/types";
import { format } from "date-fns";
import { AlertTriangle, MonitorSmartphone, MessageSquare, Pencil, Rocket, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

const WINDOWS_AGENT_PRESENTATIONS: WindowsAgentPresentation[] = ["Toast", "Modal", "Fullscreen"];
const MESSAGE_MAX_LENGTH = 320;
const DESKTOP_ONLY_LIVE_PATH =
  enabledDeliveryChannels.length === 1 && enabledDeliveryChannels[0] === "DesktopAgent";

export const Route = createFileRoute("/_app/notifications/$id")({
  validateSearch: (search: Record<string, unknown>): DetailSearch => ({
    mode:
      search.mode === "edit" || search.mode === "publish"
        ? (search.mode as DetailSearch["mode"])
        : undefined,
  }),
  component: NotificationDetailPage,
});

type DetailSearch = {
  mode?: "edit" | "publish";
};

function NotificationDetailPage() {
  const { id } = useParams({ from: "/_app/notifications/$id" });
  const search = useSearch({ from: "/_app/notifications/$id" });
  const navigate = useNavigate({ from: "/_app/notifications/$id" });
  const qc = useQueryClient();
  const { data: n } = useQuery({ queryKey: ["notification", id], queryFn: () => notificationsService.get(id) });
  const { data: deliveryVisibility } = useQuery({
    queryKey: ["delivery-visibility", id],
    queryFn: () => notificationsService.deliveryVisibility(id),
  });
  const { data: responses = [] } = useQuery({
    queryKey: ["notification-responses", id],
    queryFn: () => notificationsService.responses(id),
  });
  const { data: reminderActivity } = useQuery({
    queryKey: ["notification-reminder-activity", id],
    queryFn: () => notificationsService.reminderActivity(id),
    enabled: n?.communicationType === "Reminder",
  });
  const { data: audiencePreview } = useQuery({
    queryKey: ["audience-preview", id],
    queryFn: () => notificationsService.audiencePreview(id),
  });
  const { data: organizationReference } = useQuery({
    queryKey: ["organization-reference"],
    queryFn: referenceService.getOrganizationReference,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employee-reference"],
    queryFn: referenceService.listEmployees,
  });
  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: devicesService.list,
  });
  const { data: workflows = [] } = useQuery({
    queryKey: ["workflow-definitions"],
    queryFn: workflowsService.list,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<EditDraftForm | null>(null);
  const [publishMode, setPublishMode] = useState<"Now" | "Scheduled" | "Recurring">("Now");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [publishTimezone, setPublishTimezone] = useState(getLocalTimeZone());
  const [recurrenceRule, setRecurrenceRule] = useState("FREQ=DAILY;INTERVAL=1");
  const [executionMode, setExecutionMode] = useState<ScheduleExecutionMode>("ServerGenerated");
  const [validUntil, setValidUntil] = useState("");
  const sites = organizationReference?.sites ?? [];
  const areas = organizationReference?.areas ?? [];
  const departments = organizationReference?.departments ?? [];
  const sections = organizationReference?.sections ?? [];
  const updateDraftMutation = useMutation({
    mutationFn: (payload: EditDraftForm) =>
      {
        if (!n) {
          throw new Error("Draft detail is still loading.");
        }

        return notificationsService.update(id, {
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          category: payload.category,
          targetType: payload.targetType,
          targetSite: payload.targetSite || undefined,
          targetArea: payload.targetArea || undefined,
          targetDepartment: payload.targetDepartment || undefined,
          targetSection: payload.targetSection || undefined,
          targetEmployeeId: payload.targetEmployeeId || undefined,
          targetDeviceId: payload.targetDeviceId || undefined,
          channels: payload.channels,
          windowsAgentPresentation: payload.channels.includes("DesktopAgent")
            ? getEffectiveWindowsAgentPresentation(
              payload.priority,
              payload.channels.includes("DesktopAgent"),
              payload.windowsAgentPresentation,
            )
            : null,
          toastAutoDismissSeconds: parseToastAutoDismissSecondsInput(payload.toastAutoDismissSeconds),
          requireAck: payload.requireAck,
          workflowId: payload.requireAck ? payload.workflowId || null : null,
          instruction: getInstructionMode(
            payload.priority,
            payload.channels.includes("DesktopAgent"),
            getEffectiveWindowsAgentPresentation(
              payload.priority,
              payload.channels.includes("DesktopAgent"),
              payload.windowsAgentPresentation,
            ),
          ) === "blocked"
            ? ""
            : payload.instruction,
          reminderSchedule: n.communicationType === "Reminder"
            ? buildDraftReminderScheduleForUpdate({
                scheduledAt: payload.reminderScheduledAt,
                recurrenceRule: payload.reminderRecurrenceRule,
                timezone: payload.reminderTimezone,
                executionMode: payload.reminderExecutionMode,
                validUntil: payload.reminderValidUntil,
              })
            : null,
        });
      },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
        qc.invalidateQueries({ queryKey: ["audience-preview", id] }),
      ]);
      setEditOpen(false);
      toast.success("Draft updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update draft");
    },
  });
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (publishMode === "Scheduled") {
        const scheduledAtIso = normalizeScheduledDateTime(scheduledPublishAt);
        return notificationsService.publish(id, {
          publishMode: "Scheduled",
          scheduledAt: scheduledAtIso,
          timezone: publishTimezone.trim(),
          confirmedPreview: true,
        });
      }

      if (publishMode === "Recurring") {
        return notificationsService.publish(id, {
          publishMode: "Recurring",
          scheduledAt: scheduledPublishAt.trim()
            ? normalizeScheduledDateTime(scheduledPublishAt)
            : null,
          recurrenceRule: recurrenceRule.trim(),
          timezone: publishTimezone.trim(),
          executionMode,
          validUntil: validUntil.trim() ? normalizeScheduledDateTime(validUntil) : null,
          confirmedPreview: true,
        });
      }

      return notificationsService.publish(id, {
        publishMode: "Now",
        confirmedPreview: true,
      });
    },
    onSuccess: async (updated) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
        qc.invalidateQueries({ queryKey: ["audience-preview", id] }),
        qc.invalidateQueries({ queryKey: ["notification-reminder-activity", id] }),
      ]);
      setPublishOpen(false);
      toast.success(
        updated.status === "Scheduled"
          ? "Communication scheduled"
          : "Communication queued for Windows Agent delivery",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to publish communication");
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => notificationsService.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
      ]);
      setCancelOpen(false);
      toast.success("Communication cancelled");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel communication");
    },
  });
  const previewRecipients = audiencePreview?.recipients ?? [];
  const persistedRecipients = deliveryVisibility?.recipients ?? [];
  const logs = deliveryVisibility?.logs ?? [];
  const recipientRows =
    persistedRecipients.length > 0
      ? persistedRecipients
      : previewRecipients.map((recipient, index) => mapPreviewRecipientToRecipient(id, recipient, index));
  const availableSections = useMemo(
    () => sections.filter((item) => !draftForm?.targetDepartment || item.departmentId === draftForm.targetDepartment),
    [draftForm?.targetDepartment, sections],
  );
  const availableAreas = useMemo(
    () => areas.filter((item) => !draftForm?.targetSite || item.siteId === draftForm.targetSite),
    [areas, draftForm?.targetSite],
  );
  const availableDepartments = useMemo(
    () => departments.filter((item) => !draftForm?.targetSite || item.siteId === draftForm.targetSite),
    [departments, draftForm?.targetSite],
  );
  const availableEmployees = useMemo(
    () =>
      employees.filter((item) => {
        if (draftForm?.targetSite && item.siteId !== draftForm.targetSite) {
          return false;
        }

        if (draftForm?.targetArea && item.areaId !== draftForm.targetArea) {
          return false;
        }

        if (draftForm?.targetDepartment && item.departmentId !== draftForm.targetDepartment) {
          return false;
        }

        if (draftForm?.targetSection && item.sectionId !== draftForm.targetSection) {
          return false;
        }

        return true;
      }),
    [
      draftForm?.targetArea,
      draftForm?.targetDepartment,
      draftForm?.targetSection,
      draftForm?.targetSite,
      employees,
    ],
  );
  const ackCounts = {
    Safe: persistedRecipients.filter((r) => r.ackStatus === "Safe").length,
    NeedAssistance: persistedRecipients.filter((r) => r.ackStatus === "NeedAssistance").length,
    NotInArea: persistedRecipients.filter((r) => r.ackStatus === "NotInArea").length,
    Acknowledged: persistedRecipients.filter((r) => r.ackStatus === "Acknowledged").length,
    NoResponse: persistedRecipients.filter((r) => r.ackStatus === "NoResponse").length,
  };
  const recipientCount = recipientRows.length;
  const currentPriority = draftForm?.priority ?? normalizeEditablePriority(n?.priority ?? "Info");
  const draftHasDesktopAgentChannel = draftForm?.channels.includes("DesktopAgent") ?? false;
  const draftEffectivePresentation = draftForm
    ? getEffectiveWindowsAgentPresentation(currentPriority, draftHasDesktopAgentChannel, draftForm.windowsAgentPresentation)
    : "Toast";
  const draftInstructionMode = draftForm
    ? getInstructionMode(currentPriority, draftHasDesktopAgentChannel, draftEffectivePresentation)
    : "optional";
  const draftInstructionRequired = draftInstructionMode === "required";
  const draftInstructionBlocked = draftInstructionMode === "blocked";
  const draftDesktopToastOnlyDelivery =
    (draftForm?.channels.every((channel) => channel === "DesktopAgent") ?? false) &&
    draftHasDesktopAgentChannel &&
    draftEffectivePresentation === "Toast";

  useEffect(() => {
    if (search.mode !== "edit" || !n || n.status !== "Draft" || editOpen) {
      return;
    }

    openEditDialog();
    void navigate({
      to: "/notifications/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }, [editOpen, id, n, navigate, search.mode]);

  useEffect(() => {
    if (search.mode !== "publish" || !n || n.status !== "Draft" || publishOpen) {
      return;
    }

    setPublishOpen(true);
    void navigate({
      to: "/notifications/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }, [id, n, navigate, publishOpen, search.mode]);

  useEffect(() => {
    if (!draftForm || !draftHasDesktopAgentChannel || !n) {
      return;
    }

    if (currentPriority === "Warning" && draftForm.windowsAgentPresentation !== "Modal") {
      setDraftForm({
        ...draftForm,
        windowsAgentPresentation: "Modal",
      });
    }
  }, [currentPriority, draftForm, draftHasDesktopAgentChannel]);

  useEffect(() => {
    if (!draftForm || !draftInstructionBlocked || !draftForm.instruction) {
      return;
    }

    setDraftForm({
      ...draftForm,
      instruction: "",
    });
  }, [draftForm, draftInstructionBlocked]);

  useEffect(() => {
    if (!draftForm || !draftDesktopToastOnlyDelivery || !draftForm.requireAck) {
      return;
    }

    setDraftForm({
      ...draftForm,
      requireAck: false,
      workflowId: "",
    });
  }, [draftDesktopToastOnlyDelivery, draftForm]);

  if (!n) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const wellnessMonitoring = buildWellnessMonitoringSummary(reminderActivity);

  const isDraft = n.status === "Draft";
  const isReminder = n.communicationType === "Reminder";
  const hasDesktopAgentChannel = n.channels.includes("DesktopAgent");
  const eligibleDeviceRecipientCount = audiencePreview?.deviceRecipients ?? 0;
  const isRoutinePriority = n.priority !== "Emergency" && n.priority !== "Critical";
  const agentLocalRoutineGuardrails = {
    hasDesktopAgentChannel,
    hasEligibleDeviceAudience: eligibleDeviceRecipientCount > 0,
    hasValidUntil: Boolean(validUntil.trim()),
    isRoutinePriority,
    usesExplicitDeviceTarget: n.targetType === "Device",
  };
  const agentLocalRoutineInvalid =
    publishMode === "Recurring" &&
    executionMode === "AgentLocalRoutine" &&
    (!agentLocalRoutineGuardrails.hasDesktopAgentChannel ||
      !agentLocalRoutineGuardrails.hasEligibleDeviceAudience ||
      !agentLocalRoutineGuardrails.hasValidUntil ||
      !agentLocalRoutineGuardrails.isRoutinePriority);
  const canCancel = ["Scheduled", "Queued", "Sending", "Active"].includes(n.status);
  const canPublish = isDraft;
  const scheduledPublishInvalid =
    publishMode === "Scheduled" &&
    (!scheduledPublishAt.trim() || !publishTimezone.trim());
  const recurringPublishInvalid =
    publishMode === "Recurring" &&
    (!recurrenceRule.trim() ||
      !publishTimezone.trim() ||
      (validUntil.trim() && !isValidDateTimeInput(validUntil)));
  const wellnessPublishInvalid =
    Boolean(n.wellnessProgram) &&
    (publishMode !== "Recurring" ||
      executionMode !== "AgentLocalRoutine" ||
      !agentLocalRoutineGuardrails.hasValidUntil ||
      !agentLocalRoutineGuardrails.hasDesktopAgentChannel ||
      !agentLocalRoutineGuardrails.isRoutinePriority ||
      !agentLocalRoutineGuardrails.usesExplicitDeviceTarget);

  function openEditDialog() {
    setDraftForm({
      priority: normalizeEditablePriority(n.priority),
      title: n.title,
      message: n.message,
      category: n.category,
      targetType: normalizeEditableTargetType(n.targetType),
      targetSite: n.targetSite ?? "",
      targetArea: n.targetArea ?? "",
      targetDepartment: n.targetDepartment ?? "",
      targetSection: n.targetSection ?? "",
      targetEmployeeId: n.targetEmployeeId ?? "",
      targetDeviceId: n.targetDeviceId ?? "",
      channels: filterEnabledDeliveryChannels(n.channels.filter(isEditableChannel)),
      requireAck: n.requireAck,
      workflowId: n.workflowId ?? "",
      instruction: n.instruction ?? "",
      windowsAgentPresentation: n.windowsAgentPresentation ?? "Toast",
      toastAutoDismissSeconds:
        n.toastAutoDismissSeconds != null ? String(n.toastAutoDismissSeconds) : "",
      reminderScheduledAt: n.reminderSchedule?.scheduledAt ? toDateTimeLocalInput(n.reminderSchedule.scheduledAt) : "",
      reminderRecurrenceRule: n.reminderSchedule?.recurrenceRule ?? "FREQ=DAILY;INTERVAL=1",
      reminderTimezone: n.reminderSchedule?.timezone ?? getLocalTimeZone(),
      reminderExecutionMode: n.reminderSchedule?.executionMode ?? "ServerGenerated",
      reminderValidUntil: n.reminderSchedule?.validUntil ? toDateTimeLocalInput(n.reminderSchedule.validUntil) : "",
    });
    setEditOpen(true);
  }

  function openPublishDialog() {
    setPublishMode(isReminder ? "Recurring" : "Now");
    setScheduledPublishAt(n.reminderSchedule?.scheduledAt ? toDateTimeLocalInput(n.reminderSchedule.scheduledAt) : "");
    setPublishTimezone(n.reminderSchedule?.timezone ?? getLocalTimeZone());
    setRecurrenceRule(n.reminderSchedule?.recurrenceRule ?? "FREQ=DAILY;INTERVAL=1");
    setExecutionMode(n.reminderSchedule?.executionMode ?? "ServerGenerated");
    setValidUntil(n.reminderSchedule?.validUntil ? toDateTimeLocalInput(n.reminderSchedule.validUntil) : "");
    setPublishOpen(true);
  }

  return (
    <div>
      <PageHeader
        title={n.title}
        description={buildNotificationDescription(n)}
        actions={
          <>
            {canPublish && (
              <Button size="sm" onClick={openPublishDialog}>
                <Rocket className="mr-2 h-4 w-4" /> Publish
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
            {isDraft && (
              n.wellnessProgram ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/wellness-programs/new",
                      search: { draftId: n.id },
                    })
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" /> Open Wellness Editor
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit Draft
                </Button>
              )
            )}
            <PriorityBadge priority={n.priority} />
            <StatusBadge status={n.status} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-info"><Users className="h-4 w-4"/><span className="text-xs font-medium uppercase">Recipients</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.totalRecipients ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-success"><MonitorSmartphone className="h-4 w-4"/><span className="text-xs font-medium uppercase">Windows Agent</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.deviceRecipients ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-success"><MessageSquare className="h-4 w-4"/><span className="text-xs font-medium uppercase">WhatsApp</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.whatsappRecipients ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4"/><span className="text-xs font-medium uppercase">Warnings</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.previewWarnings.length ?? 0}</div></CardContent></Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recipients">Recipients ({recipientCount})</TabsTrigger>
            <TabsTrigger value="logs">Delivery Logs ({logs.length})</TabsTrigger>
            <TabsTrigger value="responses">Responses ({responses.length})</TabsTrigger>
            <TabsTrigger value="ack">Audience Summary</TabsTrigger>
            {n.communicationType === "Reminder" && (
              <TabsTrigger value="reminders">
                Reminder Activity ({reminderActivity?.events.length ?? 0})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <Info label="Message" value={n.message} markdown />
                <Info label="Instruction" value={n.instruction || "—"} markdown />
                <Info label="Windows Agent Presentation" value={n.windowsAgentPresentation || "—"} />
                <Info
                  label="Toast Auto Dismiss"
                  value={formatToastAutoDismissSummary(n.windowsAgentPresentation, n.toastAutoDismissSeconds)}
                />
                <Info label="Channels" value={n.channels.join(", ")} />
                <Info label="Content Type" value={n.communicationType} />
                <Info label="Require Ack" value={n.requireAck ? "Yes" : "No"} />
                <Info label="Created By" value={n.createdBy} />
                <Info label="Created At" value={format(new Date(n.createdAt), "dd MMM yyyy HH:mm")} />
                {n.scheduledAt && <Info label="Scheduled At" value={format(new Date(n.scheduledAt), "dd MMM yyyy HH:mm")} />}
                <Info label="Recipients" value={`${recipientCount || audiencePreview?.totalRecipients || 0}`} />
              </CardContent>
            </Card>
            {n.reminderSchedule && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Reminder Schedule</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                  <Info label="Schedule Type" value={n.reminderSchedule.scheduleType} />
                  <Info label="Schedule Version" value={`${n.reminderSchedule.scheduleVersion}`} />
                  <Info label="Recurrence Rule" value={n.reminderSchedule.recurrenceRule || "—"} />
                  <Info label="Timezone" value={n.reminderSchedule.timezone || "—"} />
                  <Info label="Execution Mode" value={n.reminderSchedule.executionMode || "—"} />
                  <Info label="Active Policy" value={n.reminderSchedule.isActive ? "Yes" : "No"} />
                  <Info label="Valid From" value={formatOptionalDate(n.reminderSchedule.validFrom)} />
                  <Info label="Valid Until" value={formatOptionalDate(n.reminderSchedule.validUntil)} />
                </CardContent>
              </Card>
            )}
            {n.wellnessProgram && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Wellness Program</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                  <Info label="Program Type" value={n.wellnessProgram.programType} />
                  <Info label="Theme" value={n.wellnessProgram.theme} />
                  <Info label="Layout" value={n.wellnessProgram.layoutVariant} />
                  <Info
                    label="Countdown Seconds"
                    value={n.wellnessProgram.countdownSeconds != null ? `${n.wellnessProgram.countdownSeconds}` : "—"}
                  />
                  <Info
                    label="Rotation Mode"
                    value={n.wellnessProgram.rotationMode ?? "—"}
                  />
                  <Info
                    label="Hero Asset"
                    value={n.wellnessProgram.heroAssetUrl ?? "—"}
                  />
                  <Info
                    label="Actions"
                    value={n.wellnessProgram.actions.map((action) => action.label).join(", ") || "—"}
                  />
                  <Info
                    label="Step Count"
                    value={`${n.wellnessProgram.steps?.length ?? 0}`}
                  />
                </CardContent>
              </Card>
            )}
            {audiencePreview && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Channel Plan</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {audiencePreview.channelPlan.map((item) => (
                      <div key={item.channel} className="rounded-md border p-3">
                        <div className="text-sm font-medium">{item.channel}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.strategy}
                          {item.plannedDelaySeconds ? ` · ${item.plannedDelaySeconds}s delay` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                  {audiencePreview.previewWarnings.length > 0 && (
                    <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                      <div className="text-sm font-medium">Preview Warnings</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {audiencePreview.previewWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recipients" className="mt-4">
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient Type</TableHead><TableHead>Reference</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Section</TableHead><TableHead>Site</TableHead><TableHead>Area</TableHead><TableHead>Channels</TableHead><TableHead>Status</TableHead><TableHead>Response</TableHead><TableHead>Ack</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientRows.map((recipient) => (
                      <TableRow key={recipient.id}>
                        <TableCell>{recipient.recipientType ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {buildRecipientReference(recipient)}
                        </TableCell>
                        <TableCell>{recipient.name || "—"}</TableCell>
                        <TableCell>{recipient.department || "—"}</TableCell>
                        <TableCell>{recipient.section || "—"}</TableCell>
                        <TableCell>{recipient.site || "—"}</TableCell>
                        <TableCell>{recipient.area || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {recipient.channels?.join(", ") ?? recipient.channel ?? "—"}
                        </TableCell>
                        <TableCell><StatusBadge status={recipient.deliveryStatus} /></TableCell>
                        <TableCell><StatusBadge status={formatResponseState(recipient.responseState)} /></TableCell>
                        <TableCell><StatusBadge status={recipient.ackStatus} /></TableCell>
                      </TableRow>
                    ))}
                    {recipientRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                          No recipient snapshots are available yet for this communication.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Time</TableHead><TableHead>Channel</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(l.time), "HH:mm:ss")}</TableCell>
                      <TableCell>{l.channel}</TableCell>
                      <TableCell>{l.target}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.detail}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No delivery events have been recorded for this communication yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="responses" className="mt-4">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response) => (
                    <TableRow key={response.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(response.respondedAt), "dd MMM HH:mm:ss")}
                      </TableCell>
                      <TableCell>{response.recipientName}</TableCell>
                      <TableCell>{response.channel}</TableCell>
                      <TableCell>
                        <StatusBadge status="Responded" />
                        <div className="mt-1 text-xs text-muted-foreground">{response.responseOptionKey}</div>
                      </TableCell>
                      <TableCell>{response.actorUserIdentifier || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {response.responseNote || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {responses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        {n.requireAck
                          ? "No workflow responses have been recorded for this communication yet."
                          : "This communication does not use a response workflow. Mark As Read and Dismiss activity appears in Delivery Logs instead."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="ack" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Acknowledgement Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {Object.entries(ackCounts).map(([k, v]) => (
                  <div key={k} className="rounded-md border p-3">
                    <div className="text-xs uppercase text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}</div>
                    <div className="mt-1 text-2xl font-semibold">{v}</div>
                  </div>
                ))}
              </CardContent>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                These counts now come from persisted recipient acknowledgement state and remain `0` until a delivery or response event updates the recipient snapshot.
              </CardContent>
            </Card>
          </TabsContent>

          {n.communicationType === "Reminder" && (
            <TabsContent value="reminders" className="mt-4">
              <div className="space-y-4">
                {n.wellnessProgram && (
                  <>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Wellness Activity Summary</CardTitle></CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
                        {[
                          ["Triggered", wellnessMonitoring.counts.triggered],
                          ["Displayed", wellnessMonitoring.counts.displayed],
                          ["Started", wellnessMonitoring.counts.started],
                          ["Snoozed", wellnessMonitoring.counts.snoozed],
                          ["Completed", wellnessMonitoring.counts.completed],
                          ["Timed Out", wellnessMonitoring.counts.timedOut],
                          ["Step Advanced", wellnessMonitoring.counts.stepAdvanced],
                          ["Compliance", wellnessMonitoring.completionRate != null ? `${wellnessMonitoring.completionRate}%` : "—"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-md border p-3">
                            <div className="text-xs uppercase text-muted-foreground">{label}</div>
                            <div className="mt-1 text-2xl font-semibold">{value}</div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-base">Wellness Compliance</CardTitle></CardHeader>
                      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-md border p-4">
                          <div className="text-xs uppercase text-muted-foreground">Observed Policies</div>
                          <div className="mt-1 text-2xl font-semibold">
                            {wellnessMonitoring.activePolicies}/{wellnessMonitoring.totalPolicies}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Active policies against total synchronized policy rows for this wellness program.
                          </p>
                        </div>
                        <div className="rounded-md border p-4">
                          <div className="text-xs uppercase text-muted-foreground">Last Sync</div>
                          <div className="mt-1 text-lg font-semibold">
                            {formatOptionalDate(wellnessMonitoring.lastSyncedAt)}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Latest policy sync observed across device-bound reminder policies.
                          </p>
                        </div>
                        <div className="rounded-md border p-4">
                          <div className="text-xs uppercase text-muted-foreground">Last Activity</div>
                          <div className="mt-1 text-lg font-semibold">
                            {formatOptionalDate(wellnessMonitoring.lastActivityAt)}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Most recent reported wellness interaction from Windows Agent.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                <Card>
                  <CardHeader><CardTitle className="text-base">Reminder Policies</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>Schedule Version</TableHead>
                          <TableHead>Recurrence</TableHead>
                          <TableHead>Timezone</TableHead>
                          <TableHead>Valid Until</TableHead>
                          <TableHead>Last Synced</TableHead>
                          <TableHead>Last Activity</TableHead>
                          <TableHead>Latest Event</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reminderActivity?.policies.map((policy) => {
                          const deviceMonitoring = wellnessMonitoring.deviceItems.find(
                            (item) => item.policyId === policy.policyId,
                          );

                          return (
                            <TableRow key={policy.policyId}>
                              <TableCell>{policy.deviceIdentifier ?? policy.hostname ?? policy.deviceId}</TableCell>
                              <TableCell>{policy.scheduleVersion}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{policy.recurrenceRule}</TableCell>
                              <TableCell>{policy.timezone}</TableCell>
                              <TableCell>{formatOptionalDate(policy.validUntil)}</TableCell>
                              <TableCell>{formatOptionalDate(policy.lastSyncedAt)}</TableCell>
                              <TableCell>{formatOptionalDate(deviceMonitoring?.lastActivityAt)}</TableCell>
                              <TableCell>
                                {deviceMonitoring?.lastEventType ? (
                                  <StatusBadge status={deviceMonitoring.lastEventType} />
                                ) : "—"}
                              </TableCell>
                              <TableCell><StatusBadge status={policy.isActive ? "Active" : "Cancelled"} /></TableCell>
                            </TableRow>
                          );
                        })}
                        {(reminderActivity?.policies.length ?? 0) === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                              No reminder policies have been materialized for this communication yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Reminder Events</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Device</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Active User</TableHead>
                          <TableHead>Metadata</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reminderActivity?.events.map((event) => (
                          <TableRow key={event.eventId}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {format(new Date(event.occurredAt), "dd MMM HH:mm:ss")}
                            </TableCell>
                            <TableCell>{event.deviceIdentifier ?? event.hostname ?? event.deviceId}</TableCell>
                            <TableCell><StatusBadge status={event.eventType} /></TableCell>
                            <TableCell>{event.activeUserIdentifier || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {event.metadata ? JSON.stringify(event.metadata) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(reminderActivity?.events.length ?? 0) === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                              No reminder events have been reported by Windows Agent yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {n.wellnessProgram && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Recent Wellness Timeline</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {wellnessMonitoring.recentEvents.map((event) => (
                        <div key={event.eventId} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={event.eventType} />
                              <span className="text-sm font-medium">
                                {event.deviceIdentifier ?? event.hostname ?? event.deviceId}
                              </span>
                              {event.activeUserIdentifier && (
                                <Badge variant="outline">{event.activeUserIdentifier}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(event.occurredAt), "dd MMM yyyy HH:mm:ss")}
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Policy {event.policyId}
                          </div>
                          {event.metadata && (
                            <div className="mt-2 rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                              {JSON.stringify(event.metadata)}
                            </div>
                          )}
                        </div>
                      ))}
                      {wellnessMonitoring.recentEvents.length === 0 && (
                        <div className="py-4 text-sm text-muted-foreground">
                          No recent wellness events have been reported yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Draft</DialogTitle>
            <DialogDescription>
              Update the standard notification fields that are already supported by the current backend slice.
            </DialogDescription>
          </DialogHeader>
          {draftForm && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={draftForm.title}
                  onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  maxLength={MESSAGE_MAX_LENGTH}
                  value={draftForm.message}
                  onChange={(event) => setDraftForm({ ...draftForm, message: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Keep the Windows Agent message concise. Maximum {MESSAGE_MAX_LENGTH} characters. {draftForm.message.trim().length}/{MESSAGE_MAX_LENGTH}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={draftForm.priority}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, priority: value as EditablePriority })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EDITABLE_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={draftForm.category}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, category: value as Category })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["IT", "OHSE", "Security", "Operation", "HR", "General"] as Category[]).map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Type</Label>
                  <RadioGroup
                    value={draftForm.targetType}
                    onValueChange={(value) =>
                      setDraftForm({
                        ...draftForm,
                        targetType: value as EditableTargetType,
                        targetSite: value === "Site" || value === "Area" ? draftForm.targetSite : "",
                        targetArea: value === "Area" ? draftForm.targetArea : "",
                        targetDepartment: value === "Department" || value === "Section"
                          ? draftForm.targetDepartment
                          : "",
                        targetSection: value === "Section" ? draftForm.targetSection : "",
                        targetEmployeeId: value === "Employee" ? draftForm.targetEmployeeId : "",
                        targetDeviceId: value === "Device" ? draftForm.targetDeviceId : "",
                      })
                    }
                    className="grid grid-cols-2 gap-2"
                  >
                    {EDITABLE_TARGET_TYPES.map((targetType) => (
                      <Label
                        key={targetType}
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                      >
                        <RadioGroupItem value={targetType} />
                        {targetType}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Site</Label>
                  <Select
                    value={draftForm.targetSite}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, targetSite: value, targetArea: "" })
                    }
                    disabled={draftForm.targetType !== "Site" && draftForm.targetType !== "Area"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.code} - {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Area</Label>
                  <Select
                    value={draftForm.targetArea}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetArea: value })}
                    disabled={draftForm.targetType !== "Area"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                    <SelectContent>
                      {availableAreas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Target Department</Label>
                  <Select
                    value={draftForm.targetDepartment}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, targetDepartment: value, targetSection: "" })
                    }
                    disabled={draftForm.targetType !== "Department" && draftForm.targetType !== "Section"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {availableDepartments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Section</Label>
                  <Select
                    value={draftForm.targetSection}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetSection: value })}
                    disabled={draftForm.targetType !== "Section" || !draftForm.targetDepartment}
                  >
                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      {availableSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Employee</Label>
                  <Select
                    value={draftForm.targetEmployeeId}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetEmployeeId: value })}
                    disabled={draftForm.targetType !== "Employee"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {availableEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.employeeNumber} - {employee.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Device</Label>
                  <Select
                    value={draftForm.targetDeviceId}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetDeviceId: value })}
                    disabled={draftForm.targetType !== "Device"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.id} value={device.deviceId}>
                          {device.deviceId} - {device.hostname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Channels</Label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {EDITABLE_CHANNELS.map((channel) => (
                    <Label
                      key={channel.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <Checkbox
                        checked={draftForm.channels.includes(channel.key)}
                        onCheckedChange={() =>
                          setDraftForm({
                            ...draftForm,
                            channels: draftForm.channels.includes(channel.key)
                              ? draftForm.channels.filter((value) => value !== channel.key)
                              : [...draftForm.channels, channel.key],
                          })
                        }
                      />
                      {channel.label}
                    </Label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current go-live scope exposes: {EDITABLE_CHANNELS.map((channel) => channel.label).join(", ")}.
                </p>
              </div>

              {draftForm.channels.includes("DesktopAgent") && (
                <div className="space-y-2">
                  <Label>Windows Agent Presentation</Label>
                  <Select
                    value={draftEffectivePresentation}
                    onValueChange={(value) =>
                      setDraftForm({
                        ...draftForm,
                        windowsAgentPresentation: value as WindowsAgentPresentation,
                      })
                    }
                    disabled={currentPriority === "Warning"}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WINDOWS_AGENT_PRESENTATIONS.filter((presentation) =>
                        currentPriority === "Warning" ? presentation === "Modal" : true,
                      ).map((presentation) => (
                        <SelectItem key={presentation} value={presentation}>
                          {presentation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {currentPriority === "Warning"
                      ? "Warning notifications on Windows Agent always use Modal so recipients must act on an explicit surface."
                      : "This controls whether Windows Agent renders the draft as a toast, modal, or fullscreen surface."}
                  </p>
                </div>
              )}

              {draftForm.channels.includes("DesktopAgent") && draftEffectivePresentation === "Toast" && (
                <div className="space-y-2">
                  <Label>Toast Auto Dismiss Seconds</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={draftForm.toastAutoDismissSeconds}
                    onChange={(event) =>
                      setDraftForm({
                        ...draftForm,
                        toastAutoDismissSeconds: event.target.value,
                      })
                    }
                    placeholder="Default 5"
                    className="max-w-[12rem]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional server-side override for Windows Agent toast duration. Leave empty to use the agent default of 5 seconds.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Instruction
                  {draftInstructionRequired ? " *" : ""}
                </Label>
                <MarkdownEditor
                  rows={5}
                  value={draftForm.instruction}
                  onChange={(nextInstruction) =>
                    setDraftForm({ ...draftForm, instruction: nextInstruction })
                  }
                  disabled={draftInstructionBlocked}
                  previewEmptyText="Instruction preview will appear here."
                  placeholder={draftInstructionBlocked ? "Instruction is disabled for Info toast notifications." : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  {draftInstructionBlocked
                    ? "Info notifications shown as Toast do not include a separate instruction block."
                    : draftInstructionRequired
                      ? "Warning notifications on Windows Agent require instruction text."
                      : "Use the toolbar to format instruction text while keeping markdown-compatible output."}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Require Acknowledgement</Label>
                  <p className="text-xs text-muted-foreground">
                    {draftDesktopToastOnlyDelivery
                      ? "Desktop-only toast notifications auto-dismiss and cannot collect acknowledgement directly."
                      : "Recipients must confirm they received the notification."}
                  </p>
                </div>
                <Checkbox
                  checked={draftForm.requireAck}
                  onCheckedChange={(checked) => {
                    const nextChecked = Boolean(checked);
                    setDraftForm({
                      ...draftForm,
                      requireAck: nextChecked,
                      workflowId:
                        nextChecked && !draftForm.workflowId
                          ? workflows[0]?.id ?? ""
                          : nextChecked
                            ? draftForm.workflowId
                            : "",
                    });
                  }}
                  disabled={draftDesktopToastOnlyDelivery}
                />
              </div>

              {n.communicationType === "Reminder" && (
                <div className="space-y-4 rounded-md border p-4">
                  <div>
                    <div className="text-sm font-medium">Reminder Recurrence</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Edit the recurring reminder definition here so publish becomes a final confirmation step.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>First Occurrence</Label>
                      <Input
                        type="datetime-local"
                        value={draftForm.reminderScheduledAt}
                        onChange={(event) =>
                          setDraftForm({ ...draftForm, reminderScheduledAt: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valid Until</Label>
                      <Input
                        type="datetime-local"
                        value={draftForm.reminderValidUntil}
                        onChange={(event) =>
                          setDraftForm({ ...draftForm, reminderValidUntil: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Input
                        value={draftForm.reminderTimezone}
                        onChange={(event) =>
                          setDraftForm({ ...draftForm, reminderTimezone: event.target.value })
                        }
                        placeholder="e.g. Asia/Jakarta"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Execution Mode</Label>
                      <Select
                        value={draftForm.reminderExecutionMode}
                        onValueChange={(value) =>
                          setDraftForm({
                            ...draftForm,
                            reminderExecutionMode: value as ScheduleExecutionMode,
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ServerGenerated">ServerGenerated</SelectItem>
                          <SelectItem value="AgentLocalRoutine">AgentLocalRoutine</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Recurrence Rule</Label>
                    <Input
                      value={draftForm.reminderRecurrenceRule}
                      onChange={(event) =>
                        setDraftForm({ ...draftForm, reminderRecurrenceRule: event.target.value })
                      }
                      placeholder="e.g. FREQ=DAILY;INTERVAL=1"
                    />
                  </div>
                </div>
              )}

              {draftForm.requireAck && (
                <div className="space-y-2">
                  <Label>Response Workflow</Label>
                  <Select
                    value={draftForm.workflowId}
                    onValueChange={(value) => setDraftForm({ ...draftForm, workflowId: value })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select workflow" /></SelectTrigger>
                    <SelectContent>
                      {workflows.map((workflow) => (
                        <SelectItem key={workflow.id} value={workflow.id}>
                          {workflow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the reusable workflow definition for this draft.
                  </p>
                </div>
              )}

            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => draftForm && updateDraftMutation.mutate(draftForm)}
              disabled={
                !draftForm ||
                !draftForm.title.trim() ||
                !draftForm.message.trim() ||
                draftForm.channels.length === 0 ||
                (draftForm.requireAck && !draftForm.workflowId) ||
                !hasRequiredTargetSelection(draftForm) ||
                (draftInstructionRequired && !draftForm.instruction.trim()) ||
                (n.communicationType === "Reminder" && !isValidDraftReminderForm(draftForm)) ||
                updateDraftMutation.isPending
              }
            >
              {updateDraftMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Communication</DialogTitle>
            <DialogDescription>
              This confirms the latest audience preview and sends the draft into the live delivery flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Publish Mode</Label>
              <RadioGroup
                value={publishMode}
                onValueChange={(value) => setPublishMode(value as "Now" | "Scheduled" | "Recurring")}
                className="grid grid-cols-1 gap-2"
              >
                <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="Now" />
                  Publish now and queue delivery immediately
                </Label>
                <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="Scheduled" />
                  Schedule for a specific future time
                </Label>
                {n.communicationType === "Reminder" && (
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem value="Recurring" />
                    Publish a recurring reminder with explicit execution mode
                  </Label>
                )}
              </RadioGroup>
            </div>

            {publishMode === "Scheduled" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Scheduled At</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledPublishAt}
                    onChange={(event) => setScheduledPublishAt(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The backend requires a future timestamp with timezone context.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={publishTimezone}
                    onChange={(event) => setPublishTimezone(event.target.value)}
                    placeholder="e.g. Asia/Jakarta"
                  />
                </div>
              </div>
            )}

            {publishMode === "Recurring" && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  These recurrence values are prefilled from the reminder draft authoring step. Use
                  <span className="font-medium text-foreground"> Edit Draft </span>
                  if you want the draft itself to keep the updated recurring definition.
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Occurrence</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledPublishAt}
                      onChange={(event) => setScheduledPublishAt(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Leave empty to allow the backend to start immediately.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input
                      type="datetime-local"
                      value={validUntil}
                      onChange={(event) => setValidUntil(event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input
                      value={publishTimezone}
                      onChange={(event) => setPublishTimezone(event.target.value)}
                      placeholder="e.g. Asia/Jakarta"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Execution Mode</Label>
                    <Select
                      value={executionMode}
                      onValueChange={(value) => setExecutionMode(value as ScheduleExecutionMode)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ServerGenerated">ServerGenerated</SelectItem>
                        <SelectItem value="AgentLocalRoutine">AgentLocalRoutine</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      `AgentLocalRoutine` keeps the server as source of truth, but Windows Agent executes
                      the reminder locally from a synchronized policy.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Recurrence Rule</Label>
                  <Input
                    value={recurrenceRule}
                    onChange={(event) => setRecurrenceRule(event.target.value)}
                    placeholder="e.g. FREQ=DAILY;INTERVAL=1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use an RFC5545-style recurrence rule. Example: `FREQ=DAILY;INTERVAL=1`.
                  </p>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">Reminder Publish Summary</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div>Execution mode: {executionMode}</div>
                    <div>Eligible device recipients: {eligibleDeviceRecipientCount}</div>
                    <div>Timezone: {publishTimezone || "—"}</div>
                    <div>Valid until: {validUntil || "Required for AgentLocalRoutine"}</div>
                    <div>Priority: {n.priority}</div>
                    <div>Target type: {n.targetType}</div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {executionMode === "AgentLocalRoutine"
                      ? "Windows Agent will execute this reminder locally from a synchronized policy while the validity window remains active."
                      : "The server will remain responsible for triggering each recurring reminder occurrence."}
                  </p>
                </div>

                {n.wellnessProgram && (
                  <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3 text-sm">
                    <div className="font-medium">Wellness Publish Contract</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <div>Program: {n.wellnessProgram.programType}</div>
                      <div>Theme: {n.wellnessProgram.theme}</div>
                      <div>Layout: {n.wellnessProgram.layoutVariant}</div>
                      <div>Target: {n.targetType}</div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Wellness drafts must publish as `Recurring + AgentLocalRoutine`, stay
                      device-bound, and keep a bounded validity window.
                    </p>
                  </div>
                )}

                {executionMode === "AgentLocalRoutine" && (
                  <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                    <div className="font-medium">AgentLocalRoutine Guardrails</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      <li>{agentLocalRoutineGuardrails.hasDesktopAgentChannel ? "OK" : "Missing"}: Desktop Agent channel must remain enabled.</li>
                      <li>{agentLocalRoutineGuardrails.hasEligibleDeviceAudience ? "OK" : "Missing"}: audience preview must resolve to at least one eligible Windows Agent device.</li>
                      <li>{agentLocalRoutineGuardrails.hasValidUntil ? "OK" : "Missing"}: validity window is required so the local policy remains bounded.</li>
                      <li>{agentLocalRoutineGuardrails.isRoutinePriority ? "OK" : "Missing"}: routine reminders should not use Emergency or Critical priority.</li>
                      <li>{agentLocalRoutineGuardrails.usesExplicitDeviceTarget ? "Good practice" : "Recommended"}: target a specific Device when the routine should be bound to a known Windows Agent endpoint.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{n.title}</div>
              <p className="mt-1 text-muted-foreground">{n.message}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {n.wellnessProgram
                  ? "By continuing, the operator confirms the latest audience preview and publishes the wellness draft through the bounded local routine path."
                  : publishMode === "Recurring"
                    ? "By continuing, the operator confirms the latest audience preview and publishes a recurring reminder with explicit execution semantics."
                    : "By continuing, the operator confirms the latest audience preview and allows the backend to create delivery jobs for the selected channels."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={
                publishMutation.isPending ||
                scheduledPublishInvalid ||
                recurringPublishInvalid ||
                agentLocalRoutineInvalid ||
                wellnessPublishInvalid
              }
            >
              {publishMutation.isPending
                ? "Publishing..."
                : publishMode === "Recurring"
                  ? "Publish Recurring Reminder"
                : publishMode === "Scheduled"
                  ? "Schedule"
                  : "Publish Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Communication</DialogTitle>
            <DialogDescription>
              This stops future delivery for the current communication and marks pending Windows Agent jobs as cancelled in backend tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{n.title}</div>
            <p className="mt-1 text-muted-foreground">
              Current status: {n.status}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mapPreviewRecipientToRecipient(
  notificationId: string,
  recipient: AudiencePreview["recipients"][number],
  index: number,
) {
  const channels = recipient.availableChannels.map(mapPreviewChannelToChannel);

  return {
    id: `${notificationId}-preview-${index}`,
    notificationId,
    employeeId: recipient.employeeNumber ?? recipient.employeeId ?? "—",
    name: recipient.fullName ?? "—",
    department: recipient.departmentName ?? "—",
    section: recipient.sectionName ?? "—",
    site: recipient.siteName ?? "—",
    area: recipient.areaName ?? "—",
    channel: channels[0] ?? "DesktopAgent",
    channels,
    recipientType: recipient.recipientType,
    deliveryStatus: "Pending" as const,
    ackStatus: "NoResponse" as const,
    responseState: "NotRequired" as const,
  };
}

function Info({
  label,
  value,
  markdown = false,
}: {
  label: string;
  value: string;
  markdown?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">
        {markdown && value !== "—" ? <MarkdownText value={value} /> : value}
      </div>
    </div>
  );
}

type EditableTargetType = "All" | "Site" | "Area" | "Department" | "Section" | "Employee" | "Device";
type EditablePriority = "Info" | "Warning" | "Critical";

type EditDraftForm = {
  priority: EditablePriority;
  title: string;
  message: string;
  category: Category;
  targetType: EditableTargetType;
  targetSite: string;
  targetArea: string;
  targetDepartment: string;
  targetSection: string;
  targetEmployeeId: string;
  targetDeviceId: string;
  channels: Channel[];
  windowsAgentPresentation: WindowsAgentPresentation;
  toastAutoDismissSeconds: string;
  requireAck: boolean;
  workflowId: string;
  instruction: string;
  reminderScheduledAt: string;
  reminderRecurrenceRule: string;
  reminderTimezone: string;
  reminderExecutionMode: ScheduleExecutionMode;
  reminderValidUntil: string;
};

const EDITABLE_PRIORITIES: EditablePriority[] = ["Info", "Warning", "Critical"];
const EDITABLE_TARGET_TYPES: EditableTargetType[] = [
  "All",
  "Site",
  "Area",
  "Department",
  "Section",
  "Employee",
  "Device",
].filter((targetType) => !(DESKTOP_ONLY_LIVE_PATH && targetType === "Employee")) as EditableTargetType[];
const EDITABLE_CHANNEL_OPTIONS: Array<{ key: Channel; label: string }> = [
  { key: "DesktopAgent", label: "Desktop Agent" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Email", label: "Email" },
  { key: "DigitalSignage", label: "Digital Signage" },
];
const EDITABLE_CHANNELS = EDITABLE_CHANNEL_OPTIONS.filter((channel) =>
  enabledDeliveryChannels.includes(channel.key),
);

function normalizeEditableTargetType(targetType: Notification["targetType"]): EditableTargetType {
  if (
    typeof targetType === "string" &&
    EDITABLE_TARGET_TYPES.includes(targetType as EditableTargetType)
  ) {
    return targetType;
  }

  return "All";
}

function isEditableChannel(channel: Notification["channels"][number]): channel is Channel {
  return EDITABLE_CHANNEL_OPTIONS.some((candidate) => candidate.key === channel);
}

function normalizeEditablePriority(priority: Notification["priority"]): EditablePriority {
  return priority === "Emergency" ? "Critical" : priority;
}

function getEffectiveWindowsAgentPresentation(
  priority: Notification["priority"],
  hasDesktopAgentChannel: boolean,
  selectedPresentation: WindowsAgentPresentation,
): WindowsAgentPresentation {
  if (!hasDesktopAgentChannel) {
    return selectedPresentation;
  }

  if (priority === "Warning") {
    return "Modal";
  }

  return selectedPresentation;
}

function getInstructionMode(
  priority: Notification["priority"],
  hasDesktopAgentChannel: boolean,
  presentation: WindowsAgentPresentation,
) {
  if (!hasDesktopAgentChannel) {
    return "optional" as const;
  }

  if (priority === "Warning") {
    return "required" as const;
  }

  if (priority === "Info" && presentation === "Toast") {
    return "blocked" as const;
  }

  return "optional" as const;
}

function parseToastAutoDismissSecondsInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 60 ? parsed : null;
}

function formatToastAutoDismissSummary(
  presentation: Notification["windowsAgentPresentation"],
  toastAutoDismissSeconds: Notification["toastAutoDismissSeconds"],
) {
  if (presentation !== "Toast") {
    return "—";
  }

  return `${toastAutoDismissSeconds ?? 5}s${toastAutoDismissSeconds == null ? " (default)" : ""}`;
}

function hasRequiredTargetSelection(form: EditDraftForm) {
  if (form.targetType === "All") {
    return true;
  }

  if (form.targetType === "Site") {
    return Boolean(form.targetSite);
  }

  if (form.targetType === "Area") {
    return Boolean(form.targetArea);
  }

  if (form.targetType === "Department") {
    return Boolean(form.targetDepartment);
  }

  if (form.targetType === "Section") {
    return Boolean(form.targetSection);
  }

  if (form.targetType === "Employee") {
    return Boolean(form.targetEmployeeId);
  }

  if (form.targetType === "Device") {
    return Boolean(form.targetDeviceId);
  }

  return false;
}

function isValidDraftReminderForm(form: EditDraftForm) {
  if (!form.reminderTimezone.trim() || !form.reminderRecurrenceRule.trim()) {
    return false;
  }

  if (form.reminderScheduledAt && !isValidDateTimeInput(form.reminderScheduledAt)) {
    return false;
  }

  if (form.reminderValidUntil && !isValidDateTimeInput(form.reminderValidUntil)) {
    return false;
  }

  if (form.reminderExecutionMode === "AgentLocalRoutine" && !form.reminderValidUntil.trim()) {
    return false;
  }

  if (form.reminderScheduledAt && form.reminderValidUntil) {
    return new Date(form.reminderValidUntil).getTime() > new Date(form.reminderScheduledAt).getTime();
  }

  return true;
}

function buildDraftReminderScheduleForUpdate(input: {
  scheduledAt: string;
  recurrenceRule: string;
  timezone: string;
  executionMode: ScheduleExecutionMode;
  validUntil: string;
}) {
  return {
    scheduleType: "Recurring" as const,
    scheduledAt: input.scheduledAt ? normalizeScheduledDateTime(input.scheduledAt) : null,
    recurrenceRule: input.recurrenceRule.trim(),
    timezone: input.timezone.trim(),
    executionMode: input.executionMode,
    scheduleVersion: 0,
    validFrom: input.scheduledAt ? normalizeScheduledDateTime(input.scheduledAt) : null,
    validUntil: input.validUntil ? normalizeScheduledDateTime(input.validUntil) : null,
    isActive: false,
  };
}

function buildNotificationDescription(notification: Notification) {
  const parts = [notification.category, notification.targetType];

  if (notification.targetSite) {
    parts.push(notification.targetSite);
  } else if (notification.targetArea) {
    parts.push(notification.targetArea);
  } else if (notification.targetDepartment) {
    parts.push(notification.targetDepartment);
  } else if (notification.targetSection) {
    parts.push(notification.targetSection);
  } else if (notification.targetEmployeeId) {
    parts.push(notification.targetEmployeeId);
  } else if (notification.targetDeviceId) {
    parts.push(notification.targetDeviceId);
  }

  return parts.join(" · ");
}

function normalizeScheduledDateTime(value: string) {
  const scheduledDate = new Date(value);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Scheduled publish requires a valid date and time.");
  }

  return scheduledDate.toISOString();
}

function isValidDateTimeInput(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function toDateTimeLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatOptionalDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "dd MMM yyyy HH:mm");
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function buildRecipientReference(recipient: Recipient) {
  if (recipient.recipientType === "Device") {
    return recipient.deviceIdentifier ?? recipient.hostname ?? recipient.deviceId ?? "—";
  }

  if (recipient.recipientType === "ContactEndpoint") {
    return recipient.channelEndpoint ?? "—";
  }

  return recipient.employeeId || "—";
}

function formatResponseState(state: Recipient["responseState"]) {
  switch (state) {
    case "AwaitingResponse":
      return "Pending";
    case "Overdue":
      return "Overdue";
    case "Responded":
      return "Responded";
    case "NotRequired":
    default:
      return "NotRequired";
  }
}

function mapPreviewChannelToChannel(channel: "WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage") {
  return channel === "WindowsAgent" ? "DesktopAgent" : channel;
}
