import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Eye, HeartPulse, Pencil, RefreshCw, Rocket, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MarkdownText } from "@/components/common/MarkdownText";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { WellnessScheduleFields } from "@/components/wellness/WellnessScheduleFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildWellnessRecurrenceRule,
  formatWellnessRecurrenceSummary,
  parseWellnessRecurrenceRule,
  type WellnessRecurrenceUnit,
} from "@/lib/wellness-authoring";
import { buildWellnessMonitoringSummary } from "@/lib/wellness-monitoring";
import { notificationsService } from "@/services/notifications.service";
import type {
  AudiencePreview,
  Notification,
  NotificationStatus,
  ReminderActivity,
  ReminderEventRecord,
  ReminderPolicySummary,
  Recipient,
  WellnessDistributionMode,
} from "@/types";
import { cn } from "@/lib/utils";

type DetailSearch = {
  mode?: "publish";
};

export const Route = createFileRoute("/_app/wellness-programs/$id")({
  validateSearch: (search: Record<string, unknown>): DetailSearch => ({
    mode: search.mode === "publish" ? "publish" : undefined,
  }),
  component: WellnessProgramDetailPage,
});

function WellnessProgramDetailPage() {
  const { id } = useParams({ from: "/_app/wellness-programs/$id" });
  const search = useSearch({ from: "/_app/wellness-programs/$id" });
  const navigate = useNavigate({ from: "/_app/wellness-programs/$id" });
  const qc = useQueryClient();
  const {
    data: notification,
    isLoading,
    isFetching: isNotificationFetching,
    refetch: refetchNotification,
  } = useQuery({
    queryKey: ["notification", id],
    queryFn: () => notificationsService.get(id),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const {
    data: audiencePreview,
    isFetching: isAudienceFetching,
    refetch: refetchAudiencePreview,
  } = useQuery({
    queryKey: ["audience-preview", id],
    queryFn: () => notificationsService.audiencePreview(id),
    enabled: Boolean(notification?.wellnessProgram),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const {
    data: deliveryVisibility,
    isFetching: isDeliveryFetching,
    refetch: refetchDeliveryVisibility,
  } = useQuery({
    queryKey: ["delivery-visibility", id],
    queryFn: () => notificationsService.deliveryVisibility(id),
    enabled: Boolean(notification?.wellnessProgram),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const {
    data: reminderActivity,
    isFetching: isReminderActivityFetching,
    refetch: refetchReminderActivity,
  } = useQuery({
    queryKey: ["notification-reminder-activity", id],
    queryFn: () => notificationsService.reminderActivity(id),
    enabled: Boolean(notification?.wellnessProgram),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const [publishOpen, setPublishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [neverExpires, setNeverExpires] = useState(true);
  const [timezone, setTimezone] = useState(getLocalTimeZone());
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUnit, setRecurrenceUnit] = useState<WellnessRecurrenceUnit>("Day");
  const [distributionMode, setDistributionMode] = useState<WellnessDistributionMode>("Staggered");
  const [staggerWindowMinutes, setStaggerWindowMinutes] = useState("30");
  const isRefreshing =
    isNotificationFetching ||
    isAudienceFetching ||
    isDeliveryFetching ||
    isReminderActivityFetching;

  const publishMutation = useMutation({
    mutationFn: () =>
      notificationsService.publish(id, {
        publishMode: "Recurring",
        scheduledAt: scheduledAt.trim() ? normalizeScheduledDateTime(scheduledAt) : null,
        recurrenceRule: buildWellnessRecurrenceRule({
          interval: Number.parseInt(recurrenceInterval || "1", 10) || 1,
          unit: recurrenceUnit,
        }),
        timezone: timezone.trim(),
        executionMode: "AgentLocalRoutine",
        distributionMode,
        staggerWindowMinutes:
          distributionMode === "Staggered"
            ? Number.parseInt(staggerWindowMinutes || "30", 10) || 30
            : null,
        validUntil: neverExpires ? null : normalizeScheduledDateTime(validUntil),
        confirmedPreview: true,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["wellness-programs"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
        qc.invalidateQueries({ queryKey: ["audience-preview", id] }),
        qc.invalidateQueries({ queryKey: ["notification-reminder-activity", id] }),
      ]);
      setPublishOpen(false);
      toast.success("Wellness program published");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to publish wellness program");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => notificationsService.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["wellness-programs"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
        qc.invalidateQueries({ queryKey: ["notification-reminder-activity", id] }),
      ]);
      setCancelOpen(false);
      toast.success("Wellness program deactivated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate wellness program");
    },
  });

  useEffect(() => {
    if (!notification?.wellnessProgram || search.mode !== "publish" || publishOpen || notification.status !== "Draft") {
      return;
    }

    openPublishDialog(notification);
    void navigate({
      to: "/wellness-programs/$id",
      params: { id },
      search: {},
      replace: true,
    });
  }, [id, navigate, notification, publishOpen, search.mode]);

  const recipients = useMemo(() => {
    if (deliveryVisibility?.recipients.length) {
      return deliveryVisibility.recipients;
    }

    return (audiencePreview?.recipients ?? []).map((recipient, index) =>
      mapPreviewRecipientToRecipient(id, recipient, index),
    );
  }, [audiencePreview?.recipients, deliveryVisibility?.recipients, id]);

  if (isLoading || !notification) {
    return <div className="p-6 text-muted-foreground">Loading wellness program...</div>;
  }

  if (!notification.wellnessProgram) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={notification.title}
          description="This communication does not carry a structured wellness payload, so it stays on the standard Notification Center detail flow."
          actions={
            <Button asChild variant="outline">
              <Link to="/notifications/$id" params={{ id: notification.id }}>
                Open Notification Detail
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            The current record is reminder-backed, but it is not classified as a dedicated
            `Wellness Program`. Use the standard notification detail route for generic reminder handling.
          </CardContent>
        </Card>
      </div>
    );
  }

  const wellness = notification.wellnessProgram;
  const monitoring = buildWellnessMonitoringSummary(reminderActivity);
  const policyScheduleInsights = useMemo(
    () => buildPolicyScheduleInsights(reminderActivity),
    [reminderActivity],
  );
  const policyScheduleInsightByPolicyId = useMemo(
    () => new Map(policyScheduleInsights.map((item) => [item.policyId, item])),
    [policyScheduleInsights],
  );
  const recipientCount = recipients.length;
  const eligibleDeviceRecipientCount = audiencePreview?.deviceRecipients ?? 0;
  const hasDesktopAgentChannel = notification.channels.includes("DesktopAgent");
  const isRoutinePriority = notification.priority !== "Emergency" && notification.priority !== "Critical";
  const nextRunWindowSummary = summarizeNextRunWindow(policyScheduleInsights);
  const canPublish = notification.status === "Draft";
  const canCancel = CANCELLABLE_STATUSES.includes(notification.status);
  const recurrenceSummary = formatWellnessRecurrenceSummary(
    buildWellnessRecurrenceRule({
      interval: Number.parseInt(recurrenceInterval || "1", 10) || 1,
      unit: recurrenceUnit,
    }),
  );
  const publishInvalid =
    !timezone.trim() ||
    !Number.isFinite(Number.parseInt(recurrenceInterval || "", 10)) ||
    Number.parseInt(recurrenceInterval || "", 10) < 1 ||
    (distributionMode === "Staggered" &&
      (!Number.isFinite(Number.parseInt(staggerWindowMinutes || "", 10)) ||
        Number.parseInt(staggerWindowMinutes || "", 10) < 5 ||
        Number.parseInt(staggerWindowMinutes || "", 10) > 720)) ||
    (!neverExpires && (!validUntil.trim() || !isValidDateTimeInput(validUntil))) ||
    (scheduledAt.trim() && !isValidDateTimeInput(scheduledAt)) ||
    (!neverExpires &&
      scheduledAt.trim() &&
      isValidDateTimeInput(validUntil) &&
      new Date(validUntil).getTime() <= new Date(scheduledAt).getTime()) ||
    !hasDesktopAgentChannel ||
    notification.targetType !== "Device" ||
    !isRoutinePriority ||
    eligibleDeviceRecipientCount === 0;

  return (
    <div>
      <PageHeader
        title={notification.title}
        description={buildWellnessDescription(notification)}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void Promise.all([
                  refetchNotification(),
                  refetchAudiencePreview(),
                  refetchDeliveryVisibility(),
                  refetchReminderActivity(),
                ])
              }
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/wellness-programs">Back To Wellness Programs</Link>
            </Button>
            {canPublish && (
              <Button size="sm" onClick={() => openPublishDialog(notification)}>
                <Rocket className="mr-2 h-4 w-4" />
                Publish Wellness Program
              </Button>
            )}
            {notification.status === "Draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    to: "/wellness-programs/new",
                    search: { draftId: notification.id },
                  })
                }
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Wellness Draft
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            )}
            <PriorityBadge priority={notification.priority} />
            <StatusBadge status={notification.status} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={HeartPulse}
          title="Program Shape"
          value={`${wellness.programType} / ${wellness.layoutVariant}`}
          description={`Theme ${wellness.theme} with ${wellness.actions.length} configured CTA actions.`}
        />
        <SummaryCard
          icon={Eye}
          title="Audience"
          value={`${eligibleDeviceRecipientCount}`}
          description={`Eligible Windows Agent device recipients from the latest preview. Total recipients: ${audiencePreview?.totalRecipients ?? recipientCount}.`}
        />
        <SummaryCard
          icon={ShieldCheck}
          title="Policies"
          value={`${monitoring.activePolicies}/${monitoring.totalPolicies}`}
          description="Active versus total synchronized reminder policies currently observed for this routine."
        />
        <SummaryCard
          icon={Activity}
          title="Completion"
          value={monitoring.completionRate != null ? `${monitoring.completionRate}%` : "—"}
          description={`Triggered ${monitoring.counts.triggered}, completed ${monitoring.counts.completed}, timed out ${monitoring.counts.timedOut}.`}
        />
        <SummaryCard
          icon={Rocket}
          title="Execution"
          value={notification.reminderSchedule?.executionMode ?? "Draft"}
          description={notification.reminderSchedule?.validUntil
            ? `Valid until ${formatOptionalDate(notification.reminderSchedule.validUntil)}`
            : "No expiry is set. The routine stays active until an operator deactivates it."}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Wellness Activity</TabsTrigger>
          <TabsTrigger value="recipients">Recipients ({recipientCount})</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs ({deliveryVisibility?.logs.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Program Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <Info label="Program Type" value={wellness.programType} />
              <Info label="Theme" value={wellness.theme} />
              <Info label="Layout Variant" value={wellness.layoutVariant} />
              <Info label="Rotation Mode" value={wellness.rotationMode ?? "—"} />
              <Info label="Countdown Seconds" value={wellness.countdownSeconds != null ? `${wellness.countdownSeconds}` : "—"} />
              <Info label="Hero Asset" value={wellness.heroAssetUrl ?? "—"} />
              <Info label="Actions" value={wellness.actions.map((action) => action.label).join(", ") || "—"} />
              <Info label="Step Count" value={`${wellness.steps?.length ?? 0}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operator Copy</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <Info label="Message" value={notification.message} markdown />
              <Info label="Instruction" value={notification.instruction || "—"} markdown />
              <Info label="Channels" value={notification.channels.join(", ")} />
              <Info label="Windows Agent Presentation" value={notification.windowsAgentPresentation || "—"} />
              <Info label="Target Type" value={notification.targetType} />
              <Info
                label="Target Devices"
                value={formatTargetDeviceSummary(notification)}
              />
              <Info label="Created By" value={notification.createdBy} />
              <Info label="Created At" value={format(new Date(notification.createdAt), "dd MMM yyyy HH:mm")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution Contract</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <Info label="Schedule Type" value={notification.reminderSchedule?.scheduleType ?? "Recurring"} />
              <Info label="First Occurrence" value={formatOptionalDate(notification.reminderSchedule?.scheduledAt)} />
              <Info
                label="Recurrence"
                value={formatWellnessRecurrenceSummary(notification.reminderSchedule?.recurrenceRule)}
              />
              <Info label="Timezone" value={notification.reminderSchedule?.timezone || "—"} />
              <Info label="Execution Mode" value={notification.reminderSchedule?.executionMode || "—"} />
              <Info
                label="Expires"
                value={notification.reminderSchedule?.validUntil
                  ? formatOptionalDate(notification.reminderSchedule.validUntil)
                  : "Never expires unless stopped from the server"}
              />
              <Info
                label="Distribution"
                value={notification.reminderSchedule?.distributionMode ?? "Synchronized"}
              />
              <Info label="Next Run Window" value={nextRunWindowSummary} />
            </CardContent>
          </Card>

          {audiencePreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audience Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info label="Total Recipients" value={`${audiencePreview.totalRecipients}`} />
                  <Info label="Device Recipients" value={`${audiencePreview.deviceRecipients}`} />
                  <Info label="WhatsApp Recipients" value={`${audiencePreview.whatsappRecipients}`} />
                  <Info label="Warnings" value={`${audiencePreview.previewWarnings.length}`} />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {audiencePreview.channelPlan.map((item) => (
                    <div key={item.channel} className="rounded-md border p-3">
                      <div className="font-medium">{item.channel}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.strategy}
                        {item.plannedDelaySeconds ? ` · ${item.plannedDelaySeconds}s delay` : ""}
                      </div>
                    </div>
                  ))}
                </div>
                {audiencePreview.previewWarnings.length > 0 && (
                  <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                    <div className="font-medium">Preview Warnings</div>
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

        <TabsContent value="activity" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wellness Activity Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4 xl:grid-cols-8">
              {[
                ["Triggered", monitoring.counts.triggered],
                ["Displayed", monitoring.counts.displayed],
                ["Started", monitoring.counts.started],
                ["Snoozed", monitoring.counts.snoozed],
                ["Completed", monitoring.counts.completed],
                ["Timed Out", monitoring.counts.timedOut],
                ["Step Advanced", monitoring.counts.stepAdvanced],
                ["Compliance", monitoring.completionRate != null ? `${monitoring.completionRate}%` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border p-3">
                  <div className="text-xs uppercase text-muted-foreground">{label}</div>
                  <div className="mt-1 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reminder Policies</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Schedule Version</TableHead>
                      <TableHead>Valid From</TableHead>
                    <TableHead>Recurrence</TableHead>
                    <TableHead>Timezone</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead>Schedule State</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Last Synced</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Latest Event</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminderActivity?.policies.map((policy) => {
                    const deviceMonitoring = monitoring.deviceItems.find((item) => item.policyId === policy.policyId);
                    const scheduleInsight = policyScheduleInsightByPolicyId.get(policy.policyId);

                    return (
                      <TableRow key={policy.policyId}>
                        <TableCell>{policy.deviceIdentifier ?? policy.hostname ?? policy.deviceId}</TableCell>
                        <TableCell>{policy.scheduleVersion}</TableCell>
                        <TableCell>{formatOptionalDate(policy.validFrom)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatWellnessRecurrenceSummary(policy.recurrenceRule)}
                        </TableCell>
                        <TableCell>{policy.timezone}</TableCell>
                        <TableCell>{formatScheduleInsightDate(scheduleInsight?.nextRunAt)}</TableCell>
                        <TableCell>{renderScheduleStateLabel(scheduleInsight?.scheduleState ?? "Unknown")}</TableCell>
                        <TableCell>{formatOptionalDate(policy.validUntil)}</TableCell>
                        <TableCell>{formatOptionalDate(policy.lastSyncedAt)}</TableCell>
                        <TableCell>{formatOptionalDate(deviceMonitoring?.lastActivityAt)}</TableCell>
                        <TableCell>
                          {deviceMonitoring?.lastEventType ? <StatusBadge status={deviceMonitoring.lastEventType} /> : "—"}
                        </TableCell>
                        <TableCell><StatusBadge status={policy.isActive ? "Active" : "Cancelled"} /></TableCell>
                      </TableRow>
                    );
                  })}
                  {(reminderActivity?.policies.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                        No reminder policies have been materialized for this wellness program yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Wellness Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {monitoring.recentEvents.map((event) => (
                <div key={event.eventId} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={event.eventType} />
                      <span className="text-sm font-medium">
                        {event.deviceIdentifier ?? event.hostname ?? event.deviceId}
                      </span>
                      {event.activeUserIdentifier && <Badge variant="outline">{event.activeUserIdentifier}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.occurredAt), "dd MMM yyyy HH:mm:ss")}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Policy {event.policyId}</div>
                  {event.metadata && (
                    <div className="mt-2 rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                      {JSON.stringify(event.metadata)}
                    </div>
                  )}
                </div>
              ))}
              {monitoring.recentEvents.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No recent wellness events have been reported yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead>Schedule State</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ack</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((recipient) => {
                      const scheduleInsight = findRecipientScheduleInsight(recipient, policyScheduleInsights);

                      return (
                        <TableRow key={recipient.id}>
                          <TableCell>{recipient.recipientType ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{buildRecipientReference(recipient)}</TableCell>
                          <TableCell>{recipient.name || "—"}</TableCell>
                          <TableCell>{recipient.department || "—"}</TableCell>
                          <TableCell>{recipient.section || "—"}</TableCell>
                          <TableCell>{recipient.site || "—"}</TableCell>
                          <TableCell>{recipient.area || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {recipient.channels?.join(", ") ?? recipient.channel ?? "—"}
                          </TableCell>
                          <TableCell>{formatOptionalDate(scheduleInsight?.lastActivityAt)}</TableCell>
                          <TableCell>{formatScheduleInsightDate(scheduleInsight?.nextRunAt)}</TableCell>
                          <TableCell>
                            {renderScheduleStateLabel(resolveRecipientScheduleState(notification.status, scheduleInsight))}
                          </TableCell>
                          <TableCell><StatusBadge status={recipient.deliveryStatus} /></TableCell>
                          <TableCell><StatusBadge status={recipient.ackStatus} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {recipients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={13} className="py-8 text-center text-sm text-muted-foreground">
                          No recipient snapshots are available yet for this wellness program.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(deliveryVisibility?.logs ?? []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(log.time), "HH:mm:ss")}
                      </TableCell>
                      <TableCell>{log.channel}</TableCell>
                      <TableCell>{log.target}</TableCell>
                      <TableCell><StatusBadge status={log.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.detail}</TableCell>
                    </TableRow>
                  ))}
                  {(deliveryVisibility?.logs.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No delivery events have been recorded for this wellness program yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Wellness Program</DialogTitle>
            <DialogDescription>
              Confirm the dedicated wellness contract before this draft becomes an active local routine on Windows Agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3 text-sm">
              <div className="font-medium">Locked Wellness Publish Path</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <div>Publish mode: Recurring</div>
                <div>Execution mode: AgentLocalRoutine</div>
                <div>Program: {wellness.programType}</div>
                <div>Layout: {wellness.layoutVariant}</div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Wellness drafts do not use the generic publish modes. They publish through the bounded recurring local-routine path only.
              </p>
            </div>

            <WellnessScheduleFields
              scheduledAt={scheduledAt}
              onScheduledAtChange={setScheduledAt}
              validUntil={validUntil}
              onValidUntilChange={setValidUntil}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              recurrenceInterval={recurrenceInterval}
              onRecurrenceIntervalChange={setRecurrenceInterval}
              recurrenceUnit={recurrenceUnit}
              onRecurrenceUnitChange={setRecurrenceUnit}
              neverExpires={neverExpires}
              onNeverExpiresChange={setNeverExpires}
              distributionMode={distributionMode}
              onDistributionModeChange={setDistributionMode}
              staggerWindowMinutes={staggerWindowMinutes}
              onStaggerWindowMinutesChange={setStaggerWindowMinutes}
            />

            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">Guardrails</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>{hasDesktopAgentChannel ? "OK" : "Missing"}: Desktop Agent channel remains enabled.</li>
                <li>{notification.targetType === "Device" ? "OK" : "Missing"}: targeting stays device-bound.</li>
                <li>{eligibleDeviceRecipientCount > 0 ? "OK" : "Missing"}: latest preview resolves at least one Windows Agent device.</li>
                <li>{isRoutinePriority ? "OK" : "Missing"}: priority is not Emergency or Critical.</li>
                <li>{neverExpires || validUntil.trim() ? "OK" : "Missing"}: expiry policy is defined.</li>
                <li>{recurrenceSummary}: operator-friendly cadence will be converted to RRULE on publish.</li>
                <li>
                  {distributionMode === "Staggered"
                    ? `Staggered within ${staggerWindowMinutes || "30"} minutes to avoid simultaneous prompts.`
                    : "Synchronized schedule across the selected devices."}
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Close
            </Button>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending || publishInvalid}>
              {publishMutation.isPending ? "Publishing..." : "Publish Wellness Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Wellness Program</DialogTitle>
            <DialogDescription>
              This stops future recurring execution for the current wellness program and cancels pending local routine work.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{notification.title}</div>
            <p className="mt-1 text-muted-foreground">Current status: {notification.status}</p>
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
              {cancelMutation.isPending ? "Deactivating..." : "Confirm Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function openPublishDialog(item: Notification) {
    setScheduledAt(item.reminderSchedule?.scheduledAt ? toDateTimeLocalInput(item.reminderSchedule.scheduledAt) : "");
    setValidUntil(item.reminderSchedule?.validUntil ? toDateTimeLocalInput(item.reminderSchedule.validUntil) : "");
    setNeverExpires(!item.reminderSchedule?.validUntil);
    setTimezone(item.reminderSchedule?.timezone ?? getLocalTimeZone());
    const recurrence = parseWellnessRecurrenceRule(item.reminderSchedule?.recurrenceRule);
    setRecurrenceInterval(recurrence?.interval.toString() ?? "1");
    setRecurrenceUnit(recurrence?.unit ?? "Day");
    setDistributionMode(item.reminderSchedule?.distributionMode ?? "Staggered");
    setStaggerWindowMinutes((item.reminderSchedule?.staggerWindowMinutes ?? 30).toString());
    setPublishOpen(true);
  }
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof HeartPulse;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-xl bg-sky-100 p-3 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
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

function mapPreviewChannelToChannel(channel: "WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage") {
  return channel === "WindowsAgent" ? "DesktopAgent" : channel;
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

function buildWellnessDescription(notification: Notification) {
  const target = formatTargetDeviceSummary(notification);
  return [
    "Dedicated wellness detail",
    notification.wellnessProgram?.programType,
    notification.wellnessProgram?.theme,
    target,
  ].filter(Boolean).join(" · ");
}

function formatTargetDeviceSummary(notification: Notification) {
  if (notification.targetDeviceIds?.length) {
    if (notification.targetDeviceIds.length === 1) {
      return notification.targetDeviceIds[0];
    }

    const preview = notification.targetDeviceIds.slice(0, 3).join(", ");
    return `${preview}${notification.targetDeviceIds.length > 3 ? ` + ${notification.targetDeviceIds.length - 3} more` : ""}`;
  }

  return notification.targetDeviceId || "—";
}

function normalizeScheduledDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid date and time is required.");
  }

  return date.toISOString();
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

type PolicyScheduleState =
  | "Inactive"
  | "Expired"
  | "Waiting for first run"
  | "Scheduled"
  | "Snoozed"
  | "Due now"
  | "No schedule"
  | "Not materialized"
  | "Pending publish"
  | "Unknown";

type PolicyScheduleInsight = {
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  lastActivityAt?: string | null;
  lastEventType?: ReminderEventRecord["eventType"] | null;
  nextRunAt?: string | null;
  scheduleState: PolicyScheduleState;
};

function buildPolicyScheduleInsights(reminderActivity?: ReminderActivity | null): PolicyScheduleInsight[] {
  const policies = reminderActivity?.policies ?? [];
  const events = reminderActivity?.events ?? [];
  const eventsByPolicyId = new Map<string, ReminderEventRecord[]>();

  for (const event of events) {
    const bucket = eventsByPolicyId.get(event.policyId);
    if (bucket) {
      bucket.push(event);
      continue;
    }

    eventsByPolicyId.set(event.policyId, [event]);
  }

  const now = new Date();

  return policies.map((policy) => {
    const policyEvents = [...(eventsByPolicyId.get(policy.policyId) ?? [])].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    );
    const lastTriggeredOccurrenceUtc = getLastTriggeredOccurrenceUtc(policyEvents);
    const snoozedUntilUtc = getPendingSnoozedUntilUtc(policy, policyEvents, lastTriggeredOccurrenceUtc);
    const nextRun = getNextPolicyOccurrenceUtc(policy, now, lastTriggeredOccurrenceUtc, snoozedUntilUtc);
    const validFrom = parseIsoDate(policy.validFrom);
    const validUntil = parseIsoDate(policy.validUntil);

    let scheduleState: PolicyScheduleState;
    if (!policy.isActive) {
      scheduleState = "Inactive";
    } else if (snoozedUntilUtc && nextRun && sameInstant(nextRun, snoozedUntilUtc)) {
      scheduleState = "Snoozed";
    } else if (!nextRun) {
      scheduleState = validUntil && validUntil.getTime() < now.getTime() ? "Expired" : "No schedule";
    } else if (nextRun.getTime() <= now.getTime()) {
      scheduleState = "Due now";
    } else if (!lastTriggeredOccurrenceUtc && validFrom && sameInstant(nextRun, validFrom)) {
      scheduleState = "Waiting for first run";
    } else {
      scheduleState = "Scheduled";
    }

    return {
      policyId: policy.policyId,
      deviceId: policy.deviceId,
      deviceIdentifier: policy.deviceIdentifier ?? null,
      hostname: policy.hostname ?? null,
      validFrom: policy.validFrom ?? null,
      validUntil: policy.validUntil ?? null,
      lastActivityAt: policyEvents[0]?.occurredAt ?? null,
      lastEventType: policyEvents[0]?.eventType ?? null,
      nextRunAt: nextRun?.toISOString() ?? null,
      scheduleState,
    };
  });
}

function getNextPolicyOccurrenceUtc(
  policy: ReminderPolicySummary,
  now: Date,
  lastTriggeredOccurrenceUtc: Date | null,
  snoozedUntilUtc: Date | null,
) {
  const validFrom = parseIsoDate(policy.validFrom);
  if (!validFrom) {
    return null;
  }

  const validUntil = parseIsoDate(policy.validUntil) ?? new Date(MAX_VALID_UNTIL_ISO);
  if (validUntil.getTime() < validFrom.getTime()) {
    return null;
  }

  if (
    snoozedUntilUtc &&
    snoozedUntilUtc.getTime() >= validFrom.getTime() &&
    snoozedUntilUtc.getTime() <= validUntil.getTime() &&
    (!lastTriggeredOccurrenceUtc || snoozedUntilUtc.getTime() > lastTriggeredOccurrenceUtc.getTime())
  ) {
    return snoozedUntilUtc;
  }

  let baseline = new Date(now.getTime() - 60_000);
  if (lastTriggeredOccurrenceUtc && lastTriggeredOccurrenceUtc.getTime() > baseline.getTime()) {
    baseline = lastTriggeredOccurrenceUtc;
  }

  const anchorFloor = new Date(validFrom.getTime() - 60_000);
  if (baseline.getTime() < anchorFloor.getTime()) {
    baseline = anchorFloor;
  }

  const recurrence = parseWellnessRecurrenceRule(policy.recurrenceRule);
  if (!recurrence) {
    return null;
  }

  switch (recurrence.unit) {
    case "Minute":
      return getIntervalOccurrenceUtc(validFrom, baseline, validUntil, recurrence.interval, 60_000);
    case "Hour":
      return getIntervalOccurrenceUtc(validFrom, baseline, validUntil, recurrence.interval, 3_600_000);
    case "Day":
      return getDailyOccurrenceUtc(policy, validFrom, baseline, validUntil, recurrence.interval);
    default:
      return null;
  }
}

function getIntervalOccurrenceUtc(
  anchorUtc: Date,
  baselineUtc: Date,
  validUntilUtc: Date,
  interval: number,
  unitMs: number,
) {
  const stepMs = Math.max(1, interval) * unitMs;
  const steps = Math.max(
    0,
    Math.floor((baselineUtc.getTime() - anchorUtc.getTime()) / stepMs) + 1,
  );
  const candidate = new Date(anchorUtc.getTime() + steps * stepMs);
  return candidate.getTime() <= validUntilUtc.getTime() ? candidate : null;
}

function getDailyOccurrenceUtc(
  policy: ReminderPolicySummary,
  validFromUtc: Date,
  baselineUtc: Date,
  validUntilUtc: Date,
  interval: number,
) {
  const timeZone = resolveTimeZone(policy.timezone);
  const parts = parseRecurrenceRuleParts(policy.recurrenceRule);
  const validFromLocal = getZonedDateParts(validFromUtc, timeZone);
  const baselineLocal = getZonedDateParts(baselineUtc, timeZone);
  const hour = parseInteger(parts.get("BYHOUR")) ?? validFromLocal.hour;
  const minute = parseInteger(parts.get("BYMINUTE")) ?? validFromLocal.minute;

  let candidate = {
    year: baselineLocal.year,
    month: baselineLocal.month,
    day: baselineLocal.day,
    hour,
    minute,
    second: 0,
  };

  if (compareLocalDateTime(candidate, baselineLocal) <= 0) {
    candidate = addDaysToLocalDateTime(candidate, interval);
  }

  const validFromDate = {
    year: validFromLocal.year,
    month: validFromLocal.month,
    day: validFromLocal.day,
  };
  while (compareLocalDate(candidate, validFromDate) < 0) {
    candidate = addDaysToLocalDateTime(candidate, interval);
  }

  const candidateUtc = zonedDateTimeToUtc(candidate, timeZone);
  return candidateUtc.getTime() <= validUntilUtc.getTime() ? candidateUtc : null;
}

function getLastTriggeredOccurrenceUtc(events: ReminderEventRecord[]) {
  const triggeredEvent = events.find((event) => event.eventType === "Triggered");
  return parseIsoDate(readEventMetadataString(triggeredEvent, "occurrenceUtc") ?? triggeredEvent?.occurredAt);
}

function getPendingSnoozedUntilUtc(
  policy: ReminderPolicySummary,
  events: ReminderEventRecord[],
  lastTriggeredOccurrenceUtc: Date | null,
) {
  const validFrom = parseIsoDate(policy.validFrom);
  const validUntil = parseIsoDate(policy.validUntil) ?? new Date(MAX_VALID_UNTIL_ISO);
  if (!validFrom) {
    return null;
  }

  const snoozedEvent = events.find((event) => event.eventType === "Snoozed");
  const snoozedUntilUtc = parseIsoDate(readEventMetadataString(snoozedEvent, "snoozedUntilUtc"));
  if (!snoozedUntilUtc) {
    return null;
  }

  if (snoozedUntilUtc.getTime() < validFrom.getTime() || snoozedUntilUtc.getTime() > validUntil.getTime()) {
    return null;
  }

  if (lastTriggeredOccurrenceUtc && snoozedUntilUtc.getTime() <= lastTriggeredOccurrenceUtc.getTime()) {
    return null;
  }

  return snoozedUntilUtc;
}

function findRecipientScheduleInsight(
  recipient: Recipient,
  insights: PolicyScheduleInsight[],
) {
  if (recipient.recipientType !== "Device") {
    return null;
  }

  return insights.find((item) =>
    (recipient.deviceId && item.deviceId === recipient.deviceId) ||
    (recipient.deviceIdentifier && item.deviceIdentifier === recipient.deviceIdentifier) ||
    (recipient.hostname && item.hostname === recipient.hostname),
  ) ?? null;
}

function resolveRecipientScheduleState(
  notificationStatus: NotificationStatus,
  insight: PolicyScheduleInsight | null,
): PolicyScheduleState {
  if (insight) {
    return insight.scheduleState;
  }

  return notificationStatus === "Draft" ? "Pending publish" : "Not materialized";
}

function summarizeNextRunWindow(insights: PolicyScheduleInsight[]) {
  const runs = insights
    .map((item) => parseIsoDate(item.nextRunAt))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => left.getTime() - right.getTime());

  if (runs.length === 0) {
    return "—";
  }

  if (runs.length === 1 || sameInstant(runs[0], runs[runs.length - 1])) {
    return formatOptionalDate(runs[0].toISOString());
  }

  return `${formatOptionalDate(runs[0].toISOString())} - ${formatOptionalDate(runs[runs.length - 1].toISOString())}`;
}

function formatScheduleInsightDate(value?: string | null) {
  return value ? formatOptionalDate(value) : "—";
}

function renderScheduleStateLabel(state: PolicyScheduleState) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        state === "Scheduled" && "border-sky-200 bg-sky-50 text-sky-700",
        state === "Waiting for first run" && "border-slate-200 bg-slate-50 text-slate-700",
        state === "Snoozed" && "border-amber-200 bg-amber-50 text-amber-700",
        state === "Due now" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        (state === "Inactive" || state === "Expired") && "border-rose-200 bg-rose-50 text-rose-700",
        (state === "No schedule" || state === "Not materialized" || state === "Pending publish" || state === "Unknown") &&
          "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {state}
    </span>
  );
}

function readEventMetadataString(
  event: ReminderEventRecord | undefined,
  key: string,
) {
  const value = event?.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function parseIsoDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameInstant(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function parseRecurrenceRuleParts(recurrenceRule: string) {
  return new Map(
    recurrenceRule
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, value] = part.split("=");
        return [key?.toUpperCase() ?? "", value ?? ""];
      }),
  );
}

function parseInteger(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveTimeZone(timeZone: string) {
  if (!timeZone.trim()) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  value: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string,
) {
  const localGuess = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
  let candidate = new Date(localGuess - getTimeZoneOffsetMs(new Date(localGuess), timeZone));
  const correctedOffset = getTimeZoneOffsetMs(candidate, timeZone);
  candidate = new Date(localGuess - correctedOffset);
  return candidate;
}

function addDaysToLocalDateTime(
  value: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  days: number,
) {
  const shifted = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: value.hour,
    minute: value.minute,
    second: value.second,
  };
}

function compareLocalDateTime(
  left: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  right: { year: number; month: number; day: number; hour: number; minute: number; second: number },
) {
  return (
    Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute, left.second) -
    Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute, right.second)
  );
}

function compareLocalDate(
  left: { year: number; month: number; day: number },
  right: { year: number; month: number; day: number },
) {
  return Date.UTC(left.year, left.month - 1, left.day) - Date.UTC(right.year, right.month - 1, right.day);
}


function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const MAX_VALID_UNTIL_ISO = "9999-12-31T23:59:59.999Z";
