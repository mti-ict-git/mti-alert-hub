import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { MarkdownEditor } from "@/components/common/MarkdownEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppPreview } from "@/components/notifications/WhatsAppPreview";
import { DesktopPreview } from "@/components/notifications/DesktopPreview";
import { devicesService } from "@/services/devices.service";
import { notificationsService } from "@/services/notifications.service";
import { referenceService } from "@/services/reference.service";
import { templatesService } from "@/services/templates.service";
import { workflowsService } from "@/services/workflows.service";
import { enabledDeliveryChannels, filterEnabledDeliveryChannels } from "@/config/delivery-channels";
import type {
  Category,
  Channel,
  CommunicationType,
  Priority,
  ScheduleExecutionMode,
  TargetType,
  Template,
  WindowsAgentPresentation,
} from "@/types";
import { cn } from "@/lib/utils";
import { Siren } from "lucide-react";
import { toast } from "sonner";

const ALL_CHANNELS: { key: Channel; label: string }[] = [
  { key: "DesktopAgent", label: "Desktop Agent" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Email", label: "Email" },
  { key: "DigitalSignage", label: "Digital Signage" },
];
const CHANNELS = ALL_CHANNELS.filter((channel) => enabledDeliveryChannels.includes(channel.key));
const WINDOWS_AGENT_PRESENTATIONS: WindowsAgentPresentation[] = ["Toast", "Modal", "Fullscreen"];
const MESSAGE_MAX_LENGTH = 320;
const DESKTOP_ONLY_LIVE_PATH =
  enabledDeliveryChannels.length === 1 && enabledDeliveryChannels[0] === "DesktopAgent";
const TARGET_TYPES: TargetType[] = [
  "All",
  "Site",
  "Area",
  "Department",
  "Section",
  "Employee",
  "Device",
].filter((targetType) => !(DESKTOP_ONLY_LIVE_PATH && targetType === "Employee")) as TargetType[];

interface Search { template?: string }

export const Route = createFileRoute("/_app/notifications/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({ template: typeof s.template === "string" ? s.template : undefined }),
  component: CreateNotificationPage,
});

function CreateNotificationPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_app/notifications/new" });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: templatesService.list });
  const { data: workflows = [] } = useQuery({
    queryKey: ["workflow-definitions"],
    queryFn: workflowsService.list,
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
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === search.template),
    [search.template, templates],
  );

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [communicationType, setCommunicationType] = useState<CommunicationType>("Alert");
  const [priority, setPriority] = useState<Priority>("Info");
  const [category, setCategory] = useState<Category>("General");
  const [targetType, setTargetType] = useState<TargetType>("All");
  const [site, setSite] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [channels, setChannels] = useState<Channel[]>([...enabledDeliveryChannels]);
  const [windowsAgentPresentation, setWindowsAgentPresentation] =
    useState<WindowsAgentPresentation>("Toast");
  const [toastAutoDismissSeconds, setToastAutoDismissSeconds] = useState("");
  const [requireAck, setRequireAck] = useState(false);
  const [workflowId, setWorkflowId] = useState("");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [reminderScheduledAt, setReminderScheduledAt] = useState("");
  const [reminderTimezone, setReminderTimezone] = useState(getLocalTimeZone());
  const [reminderRecurrenceRule, setReminderRecurrenceRule] = useState("FREQ=DAILY;INTERVAL=1");
  const [reminderExecutionMode, setReminderExecutionMode] =
    useState<ScheduleExecutionMode>("ServerGenerated");
  const [reminderValidUntil, setReminderValidUntil] = useState("");
  const [instruction, setInstruction] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sites = organizationReference?.sites ?? [];
  const areas = organizationReference?.areas ?? [];
  const departments = organizationReference?.departments ?? [];
  const sections = organizationReference?.sections ?? [];

  // Prefill from template
  useEffect(() => {
    if (!search.template || templates.length === 0) return;
    const t = templates.find((x) => x.id === search.template);
    if (!t) return;
    setTitle(t.name);
    setMessage(t.defaultMessage);
    setCommunicationType(t.communicationType);
    setInstruction(t.defaultInstruction);
    setPriority(t.priority);
    setCategory(t.category);
    setChannels(filterEnabledDeliveryChannels(t.defaultChannels));
    setToastAutoDismissSeconds("");
    setRequireAck(t.requireAck);
    setWorkflowId(t.defaultWorkflowId ?? "");
  }, [search.template, templates]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    const allowedTargetTypes = getAllowedAuthoringTargetTypes(selectedTemplate);
    if (!allowedTargetTypes.includes(targetType)) {
      const nextTargetType = allowedTargetTypes[0] ?? "All";
      setTargetType(nextTargetType);
      resetTargetSelections(nextTargetType);
    }
  }, [selectedTemplate, targetType]);

  // Critical authoring uses stronger defaults.
  useEffect(() => {
    if (priority === "Emergency" || priority === "Critical") {
      setChannels([...enabledDeliveryChannels]);
      setRequireAck(true);
      setWorkflowId((current) => current || selectedTemplate?.defaultWorkflowId || workflows[0]?.id || "");
    }
  }, [priority, selectedTemplate?.defaultWorkflowId, workflows]);

  const isEmergency = priority === "Emergency" || priority === "Critical";
  const isReminder = communicationType === "Reminder";
  const hasDesktopAgentChannel = channels.includes("DesktopAgent");
  const effectiveWindowsAgentPresentation = getEffectiveWindowsAgentPresentation(
    priority,
    hasDesktopAgentChannel,
    windowsAgentPresentation,
  );
  const instructionMode = getInstructionMode(priority, hasDesktopAgentChannel, effectiveWindowsAgentPresentation);
  const instructionRequired = instructionMode === "required";
  const instructionBlocked = instructionMode === "blocked";
  const desktopToastOnlyDelivery =
    hasDesktopAgentChannel &&
    channels.every((channel) => channel === "DesktopAgent") &&
    effectiveWindowsAgentPresentation === "Toast";

  useEffect(() => {
    if (!hasDesktopAgentChannel) {
      return;
    }

    if (priority === "Warning" && windowsAgentPresentation !== "Modal") {
      setWindowsAgentPresentation("Modal");
    }
  }, [hasDesktopAgentChannel, priority, windowsAgentPresentation]);

  useEffect(() => {
    if (instructionBlocked && instruction) {
      setInstruction("");
    }
  }, [instruction, instructionBlocked]);

  useEffect(() => {
    if (!desktopToastOnlyDelivery || !requireAck) {
      return;
    }

    setRequireAck(false);
    setWorkflowId("");
  }, [desktopToastOnlyDelivery, requireAck]);
  const availableAreas = useMemo(
    () => areas.filter((item) => !site || item.siteId === site),
    [areas, site],
  );
  const availableDepartments = useMemo(
    () => departments.filter((item) => !site || item.siteId === site),
    [departments, site],
  );
  const availableSections = useMemo(
    () => sections.filter((item) => !department || item.departmentId === department),
    [department, sections],
  );
  const availableEmployees = useMemo(
    () =>
      employees.filter((item) => {
        if (site && item.siteId !== site) {
          return false;
        }

        if (area && item.areaId !== area) {
          return false;
        }

        if (department && item.departmentId !== department) {
          return false;
        }

        if (section && item.sectionId !== section) {
          return false;
        }

        return true;
      }),
    [area, department, employees, section, site],
  );
  const allowedTargetTypes = useMemo(
    () => (selectedTemplate ? getAllowedAuthoringTargetTypes(selectedTemplate) : TARGET_TYPES),
    [selectedTemplate],
  );
  const workflowSelectLocked = Boolean(selectedTemplate?.lockedFields?.includes("workflowId"));

  const toggleChannel = (c: Channel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  function resetTargetSelections(nextTargetType: TargetType) {
    if (nextTargetType !== "Site") {
      setSite("");
    }

    if (nextTargetType !== "Area") {
      setArea("");
    }

    if (nextTargetType !== "Department" && nextTargetType !== "Section") {
      setDepartment("");
    }

    if (nextTargetType !== "Section") {
      setSection("");
    }

    if (nextTargetType !== "Employee") {
      setEmployeeId("");
    }

    if (nextTargetType !== "Device") {
      setDeviceId("");
    }
  }

  const createMut = useMutation({
    mutationFn: notificationsService.create,
    onSuccess: async (n) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification", n.id] });
      try {
        const preview = await notificationsService.audiencePreview(n.id);
        toast.success(
          `${scheduleLater ? "Draft tersimpan" : "Draft created"} · ${preview.totalRecipients} recipients resolved`,
        );
      } catch {
        toast.success(scheduleLater ? "Draft tersimpan" : "Draft created");
      }
      nav({ to: "/notifications/$id", params: { id: n.id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create draft");
    },
  });

  function submit() {
    createMut.mutate({
      title,
      message,
      communicationType: communicationType,
      priority,
      category,
      templateId: search.template,
      targetType,
      targetSite: site || undefined,
      targetArea: area || undefined,
      targetDepartment: department || undefined,
      targetSection: section || undefined,
      targetEmployeeId: employeeId || undefined,
      targetDeviceId: deviceId || undefined,
      channels,
      windowsAgentPresentation: hasDesktopAgentChannel ? effectiveWindowsAgentPresentation : null,
      toastAutoDismissSeconds: parseToastAutoDismissSecondsInput(toastAutoDismissSeconds),
      requireAck,
      workflowId: requireAck ? workflowId || null : null,
      instruction: instructionBlocked ? "" : instruction,
      scheduledAt: scheduleLater && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      scheduleLater,
      reminderSchedule: isReminder
        ? buildDraftReminderSchedule({
            scheduledAt: reminderScheduledAt,
            timezone: reminderTimezone,
            recurrenceRule: reminderRecurrenceRule,
            executionMode: reminderExecutionMode,
            validUntil: reminderValidUntil,
          })
        : null,
    });
  }

  const hasRequiredTargetSelection =
    targetType === "All" ||
    (targetType === "Site" && Boolean(site)) ||
    (targetType === "Area" && Boolean(area)) ||
    (targetType === "Department" && Boolean(department)) ||
    (targetType === "Section" && Boolean(section)) ||
    (targetType === "Employee" && Boolean(employeeId)) ||
    (targetType === "Device" && Boolean(deviceId));
  const canSubmit =
    title &&
    message &&
    message.trim().length <= MESSAGE_MAX_LENGTH &&
    channels.length > 0 &&
    hasRequiredTargetSelection &&
    (!requireAck || Boolean(workflowId)) &&
    (!instructionRequired || Boolean(instruction.trim())) &&
    (!isReminder || isValidReminderDraftAuthoring({
      timezone: reminderTimezone,
      recurrenceRule: reminderRecurrenceRule,
      executionMode: reminderExecutionMode,
      validUntil: reminderValidUntil,
      scheduledAt: reminderScheduledAt,
    }));

  return (
    <div>
      <PageHeader title="Create Notification" description="Compose an emergency or operational notification." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className={cn("lg:col-span-2", isEmergency && "border-emergency border-2")}>
          {isEmergency && (
            <div className="flex items-center gap-2 rounded-t-xl bg-emergency px-4 py-2 text-emergency-foreground emergency-pulse">
              <Siren className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Critical Notification Draft</span>
            </div>
          )}
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fire Alarm at Acid Plant" />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={4}
                maxLength={MESSAGE_MAX_LENGTH}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the situation clearly and concisely."
              />
              <p className="text-xs text-muted-foreground">
                Keep the Windows Agent message concise. Maximum {MESSAGE_MAX_LENGTH} characters. {message.trim().length}/{MESSAGE_MAX_LENGTH}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                  value={communicationType}
                  onValueChange={(value) => setCommunicationType(value as CommunicationType)}
                  disabled={Boolean(selectedTemplate)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(
                      ["Alert", "Reminder", "OperationalNotice", "News", "Article", "KnowledgeUpdate"] as CommunicationType[]
                    ).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedTemplate
                    ? `Template fixes the communication type as ${selectedTemplate.communicationType}.`
                    : "Reminder drafts can later be published as recurring schedules with server or local execution."}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Info">Info</SelectItem>
                    <SelectItem value="Warning">Warning</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["IT", "OHSE", "Security", "Operation", "HR", "General"] as Category[]).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isReminder && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="text-sm font-medium">Hybrid Reminder Draft</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reminder drafts are authored as recurring routines from the start. Set the
                  cadence, first occurrence, timezone, execution mode, and validity window here,
                  then use publish only as the final confirmation step.
                </p>
              </div>
            )}

            {isReminder && (
              <div className="space-y-4 rounded-md border p-4">
                <div>
                  <div className="text-sm font-medium">Reminder Recurrence</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This draft stores the recurring reminder definition before publish so operators
                    can reason about repeated execution earlier in the workflow.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Occurrence</Label>
                    <Input
                      type="datetime-local"
                      value={reminderScheduledAt}
                      onChange={(event) => setReminderScheduledAt(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Leave empty to let the recurring reminder start as soon as it is published.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input
                      type="datetime-local"
                      value={reminderValidUntil}
                      onChange={(event) => setReminderValidUntil(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required later for `AgentLocalRoutine`, optional for `ServerGenerated`.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input
                      value={reminderTimezone}
                      onChange={(event) => setReminderTimezone(event.target.value)}
                      placeholder="e.g. Asia/Jakarta"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Execution Mode</Label>
                    <Select
                      value={reminderExecutionMode}
                      onValueChange={(value) => setReminderExecutionMode(value as ScheduleExecutionMode)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ServerGenerated">ServerGenerated</SelectItem>
                        <SelectItem value="AgentLocalRoutine">AgentLocalRoutine</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      `ServerGenerated` keeps each occurrence server-triggered. `AgentLocalRoutine`
                      distributes a bounded local policy to Windows Agent.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Recurrence Rule</Label>
                  <Input
                    value={reminderRecurrenceRule}
                    onChange={(event) => setReminderRecurrenceRule(event.target.value)}
                    placeholder="e.g. FREQ=DAILY;INTERVAL=1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use an RFC5545-style recurrence rule. Example: `FREQ=DAILY;INTERVAL=1`.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Target Type</Label>
              <RadioGroup
                value={targetType}
                onValueChange={(value) => {
                  const nextTargetType = value as TargetType;
                  setTargetType(nextTargetType);
                  resetTargetSelections(nextTargetType);
                }}
                className="grid grid-cols-2 gap-2 md:grid-cols-3"
              >
                {allowedTargetTypes.map((t) => (
                  <Label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem value={t} /> {t}
                  </Label>
                ))}
              </RadioGroup>
              {selectedTemplate?.allowedTargetTypes?.length ? (
                <p className="text-xs text-muted-foreground">
                  Template policy allows: {allowedTargetTypes.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Site</Label>
                <Select
                  value={site}
                  onValueChange={(value) => {
                    setSite(value);
                    setArea("");
                  }}
                  disabled={targetType !== "Site" && targetType !== "Area"}
                >
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Area</Label>
                <Select
                  value={area}
                  onValueChange={setArea}
                  disabled={targetType !== "Area"}
                >
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {availableAreas.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Target Department</Label>
                <Select
                  value={department}
                  onValueChange={(value) => {
                    setDepartment(value);
                    setSection("");
                  }}
                  disabled={targetType !== "Department" && targetType !== "Section"}
                >
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {availableDepartments.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Section</Label>
                <Select
                  value={section}
                  onValueChange={setSection}
                  disabled={targetType !== "Section" || !department}
                >
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {availableSections.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Employee</Label>
                <Select
                  value={employeeId}
                  onValueChange={setEmployeeId}
                  disabled={targetType !== "Employee"}
                >
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.employeeNumber} - {item.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Device</Label>
                <Select
                  value={deviceId}
                  onValueChange={setDeviceId}
                  disabled={targetType !== "Device"}
                >
                  <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                  <SelectContent>
                    {devices.map((item) => (
                      <SelectItem key={item.id} value={item.deviceId}>
                        {item.deviceId} - {item.hostname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {CHANNELS.map((c) => (
                  <Label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <Checkbox checked={channels.includes(c.key)} onCheckedChange={() => toggleChannel(c.key)} disabled={isEmergency} />
                    {c.label}
                  </Label>
                ))}
              </div>
              {isEmergency && (
                <p className="text-xs text-emergency">Critical priority auto-enables all channels in the current release scope.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Current go-live scope exposes: {CHANNELS.map((channel) => channel.label).join(", ")}.
              </p>
            </div>

            {hasDesktopAgentChannel && (
              <div className="space-y-2">
                <Label>Windows Agent Presentation</Label>
                <Select
                  value={effectiveWindowsAgentPresentation}
                  onValueChange={(value) => setWindowsAgentPresentation(value as WindowsAgentPresentation)}
                  disabled={priority === "Warning"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WINDOWS_AGENT_PRESENTATIONS.filter((presentation) =>
                      priority === "Warning" ? presentation === "Modal" : true,
                    ).map((presentation) => (
                      <SelectItem key={presentation} value={presentation}>
                        {presentation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {priority === "Warning"
                    ? "Warning notifications on Windows Agent always use Modal so recipients must act on an explicit surface."
                    : "Choose how this communication should appear on Windows Agent instead of relying on implicit priority rules."}
                </p>
              </div>
            )}

            {hasDesktopAgentChannel && effectiveWindowsAgentPresentation === "Toast" && (
              <div className="space-y-2">
                <Label>Toast Auto Dismiss Seconds</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={toastAutoDismissSeconds}
                  onChange={(event) => setToastAutoDismissSeconds(event.target.value)}
                  placeholder="Default 5"
                  className="max-w-[12rem]"
                />
                <p className="text-xs text-muted-foreground">
                  Optional server-side override for Windows Agent toast duration. Leave empty to use the agent default of 5 seconds.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Require Acknowledgement</Label>
                <p className="text-xs text-muted-foreground">
                  {desktopToastOnlyDelivery
                    ? "Desktop-only toast notifications auto-dismiss and cannot collect acknowledgement directly."
                    : "Recipients must confirm they received the notification."}
                </p>
              </div>
              <Switch
                checked={requireAck}
                onCheckedChange={(checked) => {
                  setRequireAck(checked);
                  if (checked && !workflowId) {
                    setWorkflowId(selectedTemplate?.defaultWorkflowId ?? workflows[0]?.id ?? "");
                  }
                }}
                disabled={desktopToastOnlyDelivery}
              />
            </div>

            {!isReminder && (
              <div className="space-y-2 rounded-md border p-3">
                <Label>Schedule</Label>
                <RadioGroup value={scheduleLater ? "later" : "now"} onValueChange={(v) => setScheduleLater(v === "later")} className="flex gap-4">
                  <Label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="now" /> Send Now
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="later" /> Schedule Later
                  </Label>
                </RadioGroup>
                {scheduleLater && (
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="max-w-xs" />
                )}
                <p className="text-xs text-muted-foreground">
                  This step still creates a draft only. Use the detail page to publish `Now` or `Scheduled` through the live backend flow.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Instruction
                {instructionRequired ? " *" : ""}
              </Label>
              <MarkdownEditor
                value={instruction}
                onChange={setInstruction}
                rows={5}
                previewEmptyText="Instruction preview will appear here."
                placeholder={instructionBlocked ? "Instruction is disabled for Info toast notifications." : "What should recipients do?"}
                disabled={instructionBlocked}
              />
              <p className="text-xs text-muted-foreground">
                {instructionBlocked
                  ? "Info notifications shown as Toast do not include a separate instruction block."
                  : instructionRequired
                    ? "Warning notifications on Windows Agent require instruction text."
                    : "Use the toolbar to format instruction text while keeping markdown-compatible output."}
              </p>
            </div>

            {requireAck && (
              <div className="space-y-2">
                <Label>Response Workflow</Label>
                <Select
                  value={workflowId}
                  onValueChange={setWorkflowId}
                  disabled={workflowSelectLocked}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {workflowSelectLocked
                    ? "This template locks the workflow selection."
                    : "Choose the reusable workflow definition that recipients must complete."}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => nav({ to: "/notifications" })}>Cancel</Button>
              <Button disabled={!canSubmit} onClick={() => setConfirmOpen(true)} className={cn(isEmergency && "bg-emergency hover:bg-emergency/90 text-emergency-foreground")}>
                {scheduleLater ? "Save Draft" : isEmergency ? "Create Critical Draft" : "Create Draft"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Previews</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {channels.includes("WhatsApp") && (
                <WhatsAppPreview
                  title={title}
                  priority={priority}
                  site={site}
                  instruction={instructionBlocked ? "" : instruction}
                />
              )}
              {channels.includes("DesktopAgent") && (
                <div className="space-y-2">
                  <DesktopPreview
                    title={title}
                    message={message}
                    priority={priority}
                    instruction={instructionBlocked ? "" : instruction}
                    presentation={effectiveWindowsAgentPresentation}
                    toastAutoDismissSeconds={parseToastAutoDismissSecondsInput(toastAutoDismissSeconds)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {`Windows Agent presentation: ${effectiveWindowsAgentPresentation}${effectiveWindowsAgentPresentation === "Toast"
                      ? ` · auto-dismiss ${parseToastAutoDismissSecondsInput(toastAutoDismissSeconds) ?? 5}s`
                      : ""}`}
                  </p>
                </div>
              )}
              {channels.length === 0 && <p className="text-sm text-muted-foreground">Select at least one channel to see previews.</p>}
              {!channels.includes("WhatsApp") && !channels.includes("DesktopAgent") && channels.length > 0 && (
                <p className="text-sm text-muted-foreground">No visual preview for the selected channels.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEmergency ? "Confirm Critical Draft" : isReminder ? "Confirm Reminder Draft" : "Confirm Draft Creation"}
            </DialogTitle>
            <DialogDescription>
              {isEmergency
                ? "This will create a critical communication draft with stronger defaults for later publishing."
                : isReminder
                  ? "This will create a recurring reminder draft with its execution settings stored before publish."
                  : `You are about to create a communication draft using ${channels.length} channel(s).`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{title}</div>
            <p className="mt-1 text-muted-foreground">{message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Type: {communicationType} · Channels: {channels.join(", ")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              className={cn(isEmergency && "bg-emergency hover:bg-emergency/90 text-emergency-foreground")}
              onClick={() => { setConfirmOpen(false); submit(); }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAllowedAuthoringTargetTypes(template: Template): TargetType[] {
  const allowedTargetTypes = template.allowedTargetTypes?.filter((targetType): targetType is TargetType =>
    TARGET_TYPES.includes(targetType),
  );

  return allowedTargetTypes && allowedTargetTypes.length > 0 ? allowedTargetTypes : TARGET_TYPES;
}

function getEffectiveWindowsAgentPresentation(
  priority: Priority,
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
  priority: Priority,
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

function buildDraftReminderSchedule(input: {
  scheduledAt: string;
  timezone: string;
  recurrenceRule: string;
  executionMode: ScheduleExecutionMode;
  validUntil: string;
}) {
  return {
    scheduleType: "Recurring" as const,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    recurrenceRule: input.recurrenceRule.trim(),
    timezone: input.timezone.trim(),
    executionMode: input.executionMode,
    scheduleVersion: 0,
    validFrom: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    validUntil: input.validUntil ? new Date(input.validUntil).toISOString() : null,
    isActive: false,
  };
}

function isValidReminderDraftAuthoring(input: {
  timezone: string;
  recurrenceRule: string;
  executionMode: ScheduleExecutionMode;
  validUntil: string;
  scheduledAt: string;
}) {
  if (!input.timezone.trim() || !input.recurrenceRule.trim()) {
    return false;
  }

  if (input.scheduledAt && Number.isNaN(new Date(input.scheduledAt).getTime())) {
    return false;
  }

  if (input.validUntil && Number.isNaN(new Date(input.validUntil).getTime())) {
    return false;
  }

  if (
    input.executionMode === "AgentLocalRoutine" &&
    !input.validUntil.trim()
  ) {
    return false;
  }

  if (input.scheduledAt && input.validUntil) {
    return new Date(input.validUntil).getTime() > new Date(input.scheduledAt).getTime();
  }

  return true;
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
