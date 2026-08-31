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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildWellnessMonitoringSummary } from "@/lib/wellness-monitoring";
import { notificationsService } from "@/services/notifications.service";
import type {
  AudiencePreview,
  Notification,
  NotificationStatus,
  Recipient,
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
  const [timezone, setTimezone] = useState(getLocalTimeZone());
  const [recurrenceRule, setRecurrenceRule] = useState("FREQ=DAILY;INTERVAL=1");
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
        recurrenceRule: recurrenceRule.trim(),
        timezone: timezone.trim(),
        executionMode: "AgentLocalRoutine",
        validUntil: normalizeScheduledDateTime(validUntil),
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
  const recipientCount = recipients.length;
  const eligibleDeviceRecipientCount = audiencePreview?.deviceRecipients ?? 0;
  const hasDesktopAgentChannel = notification.channels.includes("DesktopAgent");
  const isRoutinePriority = notification.priority !== "Emergency" && notification.priority !== "Critical";
  const canPublish = notification.status === "Draft";
  const canCancel = CANCELLABLE_STATUSES.includes(notification.status);
  const publishInvalid =
    !recurrenceRule.trim() ||
    !timezone.trim() ||
    !validUntil.trim() ||
    !isValidDateTimeInput(validUntil) ||
    (scheduledAt.trim() && !isValidDateTimeInput(scheduledAt)) ||
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
            : "Bounded validity window must be confirmed before publish."}
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
              <Info label="Target Device" value={notification.targetDeviceId || "—"} />
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
              <Info label="Recurrence Rule" value={notification.reminderSchedule?.recurrenceRule || "—"} />
              <Info label="Timezone" value={notification.reminderSchedule?.timezone || "—"} />
              <Info label="Execution Mode" value={notification.reminderSchedule?.executionMode || "—"} />
              <Info label="Valid Until" value={formatOptionalDate(notification.reminderSchedule?.validUntil)} />
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
                    const deviceMonitoring = monitoring.deviceItems.find((item) => item.policyId === policy.policyId);

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
                          {deviceMonitoring?.lastEventType ? <StatusBadge status={deviceMonitoring.lastEventType} /> : "—"}
                        </TableCell>
                        <TableCell><StatusBadge status={policy.isActive ? "Active" : "Cancelled"} /></TableCell>
                      </TableRow>
                    );
                  })}
                  {(reminderActivity?.policies.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
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
                      <TableHead>Status</TableHead>
                      <TableHead>Ack</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((recipient) => (
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
                        <TableCell><StatusBadge status={recipient.deliveryStatus} /></TableCell>
                        <TableCell><StatusBadge status={recipient.ackStatus} /></TableCell>
                      </TableRow>
                    ))}
                    {recipients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>First Occurrence</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Leave empty to allow the backend to activate the recurring policy immediately.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="datetime-local"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required so the local policy remains bounded on the device.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="e.g. Asia/Jakarta"
                />
              </div>
              <div className="space-y-2">
                <Label>Recurrence Rule</Label>
                <Input
                  value={recurrenceRule}
                  onChange={(event) => setRecurrenceRule(event.target.value)}
                  placeholder="e.g. FREQ=DAILY;INTERVAL=1"
                />
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">Guardrails</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>{hasDesktopAgentChannel ? "OK" : "Missing"}: Desktop Agent channel remains enabled.</li>
                <li>{notification.targetType === "Device" ? "OK" : "Missing"}: targeting stays device-bound.</li>
                <li>{eligibleDeviceRecipientCount > 0 ? "OK" : "Missing"}: latest preview resolves at least one Windows Agent device.</li>
                <li>{isRoutinePriority ? "OK" : "Missing"}: priority is not Emergency or Critical.</li>
                <li>{validUntil.trim() ? "OK" : "Missing"}: validity window is present.</li>
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
    setTimezone(item.reminderSchedule?.timezone ?? getLocalTimeZone());
    setRecurrenceRule(item.reminderSchedule?.recurrenceRule ?? "FREQ=DAILY;INTERVAL=1");
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
  const target = notification.targetDeviceId || notification.targetType;
  return [
    "Dedicated wellness detail",
    notification.wellnessProgram?.programType,
    notification.wellnessProgram?.theme,
    target,
  ].filter(Boolean).join(" · ");
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

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const CANCELLABLE_STATUSES: NotificationStatus[] = ["Scheduled", "Queued", "Sending", "Active"];
