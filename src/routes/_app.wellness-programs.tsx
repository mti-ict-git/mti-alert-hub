import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity, Copy, Eye, HeartPulse, Leaf, Pencil, Plus, RefreshCw, Rocket, ShieldCheck, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notificationsService } from "@/services/notifications.service";
import type { NotificationStatus, WellnessProgramListItem, WellnessTheme } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/wellness-programs")({
  component: WellnessProgramsPage,
});

function WellnessProgramsPage() {
  const isChildRouteActive = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId === "/_app/wellness-programs/new" ||
          match.routeId === "/_app/wellness-programs/$id",
      ),
  });

  if (isChildRouteActive) {
    return <Outlet />;
  }

  return <WellnessProgramsIndexPage />;
}

function WellnessProgramsIndexPage() {

  const qc = useQueryClient();
  const nav = useNavigate();
  const {
    data = [],
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["wellness-programs"],
    queryFn: notificationsService.listWellnessPrograms,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const [query, setQuery] = useState("");
  const [view, setView] = useState<WellnessView>("all");
  const [theme, setTheme] = useState<"all" | WellnessTheme>("all");
  const [programType, setProgramType] = useState<"all" | WellnessProgramListItem["notification"]["wellnessProgram"]["programType"]>("all");
  const [status, setStatus] = useState<"all" | NotificationStatus>("all");

  const filtered = useMemo(
    () =>
      data.filter((item) => {
        const notification = item.notification;
        const wellnessProgram = notification.wellnessProgram;
        if (!wellnessProgram) {
          return false;
        }

        return (
          (!query || notification.title.toLowerCase().includes(query.toLowerCase())) &&
          (theme === "all" || wellnessProgram.theme === theme) &&
          (programType === "all" || wellnessProgram.programType === programType) &&
          (status === "all" || notification.status === status) &&
          matchesWellnessView(notification.status, view)
        );
      }),
    [data, programType, query, status, theme, view],
  );

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => notificationsService.duplicate(id),
    onSuccess: async (duplicated) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["wellness-programs"] }),
      ]);
      toast.success("Wellness draft duplicated");
      if (duplicated) {
        nav({
          to: "/wellness-programs/new",
          search: { draftId: duplicated.id },
        });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate wellness draft");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => notificationsService.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["wellness-programs"] }),
      ]);
      toast.success("Wellness program deactivated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate wellness program");
    },
  });

  const draftCount = data.filter((item) => item.notification.status === "Draft").length;
  const liveCount = data.filter((item) => LIVE_STATUSES.includes(item.notification.status)).length;
  const guidedCount = data.filter(
    (item) => item.notification.wellnessProgram?.programType === "GuidedRoutine",
  ).length;
  const totalTriggered = data.reduce((sum, item) => sum + (item.monitoring?.counts.triggered ?? 0), 0);
  const totalCompleted = data.reduce((sum, item) => sum + (item.monitoring?.counts.completed ?? 0), 0);
  const totalTimedOut = data.reduce((sum, item) => sum + (item.monitoring?.counts.timedOut ?? 0), 0);
  const totalActivePolicies = data.reduce((sum, item) => sum + (item.monitoring?.activePolicies ?? 0), 0);
  const completionRate = totalTriggered > 0
    ? Math.round((totalCompleted / totalTriggered) * 100)
    : null;

  return (
    <div>
      <PageHeader
        title="Wellness Programs"
        description="Dedicated list for blue and green recurring wellness drafts and live routines, separate from Notification Center."
        actions={
          <>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              {isFetching ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/notifications">Open Notification Center</Link>
            </Button>
            <Button asChild>
              <Link to="/wellness-programs/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Wellness Program
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={HeartPulse}
          title="Total Programs"
          value={data.length}
          description="All reminder drafts and published routines carrying a wellness payload."
        />
        <SummaryCard
          icon={Leaf}
          title="Draft vs Live"
          value={`${draftCount} / ${liveCount}`}
          description="Drafts ready for review and currently scheduled or active wellness runs."
        />
        <SummaryCard
          icon={Rocket}
          title="Guided Routines"
          value={guidedCount}
          description="Narrowed Office Stretching-style flows with ordered guided steps."
        />
        <SummaryCard
          icon={Activity}
          title="Observed Activity"
          value={`${totalTriggered}/${totalCompleted}/${totalTimedOut}`}
          description="Triggered, completed, and timed out wellness occurrences captured from agent activity."
        />
        <SummaryCard
          icon={ShieldCheck}
          title="Compliance"
          value={completionRate != null ? `${completionRate}%` : "—"}
          description={`Completion rate across observed routines. Active policies: ${totalActivePolicies}.`}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(nextValue) => setView(nextValue as WellnessView)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="drafts">Drafts</TabsTrigger>
                <TabsTrigger value="live">Scheduled / Live</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="text-sm text-muted-foreground">
              This page only shows reminder communications that carry structured `wellnessProgram`
              payloads.
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Last synced {formatOptionalDateTime(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)}
            </span>
            <span>Auto refresh every 15 seconds</span>
          </div>

          {isError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Failed to load wellness programs: {error instanceof Error ? error.message : "Unknown error"}.
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search wellness title..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-xs"
            />
            <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Theme" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All themes</SelectItem>
                <SelectItem value="Blue">Blue</SelectItem>
                <SelectItem value="Green">Green</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={programType}
              onValueChange={(value) => setProgramType(value as typeof programType)}
            >
              <SelectTrigger className="w-44"><SelectValue placeholder="Program Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="SimpleReminder">SimpleReminder</SelectItem>
                <SelectItem value="GuidedRoutine">GuidedRoutine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((itemStatus) => (
                  <SelectItem key={itemStatus} value={itemStatus}>
                    {itemStatus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Recurrence</TableHead>
                  <TableHead>Monitoring</TableHead>
                  <TableHead>Device Signal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[340px]">Quick Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Loading wellness programs...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && !isError && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No wellness programs found for the current filters.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && isError && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Wellness programs could not be loaded. Use Refresh after the backend is reachable.
                    </TableCell>
                  </TableRow>
                )}

                {filtered.map((item) => {
                  const notification = item.notification;
                  const wellnessProgram = notification.wellnessProgram!;
                  const isDraft = notification.status === "Draft";
                  const canDeactivate = CANCELLABLE_STATUSES.includes(notification.status);
                  const monitoring = item.monitoring;

                  return (
                    <TableRow
                      key={notification.id}
                      className="cursor-pointer"
                      onClick={() => nav({ to: "/wellness-programs/$id", params: { id: notification.id } })}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{notification.title}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{wellnessProgram.programType}</Badge>
                            <Badge variant="outline">{wellnessProgram.layoutVariant}</Badge>
                            <span>{notification.targetType}</span>
                            {notification.targetDeviceId && <span>· {notification.targetDeviceId}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <PriorityBadge priority={notification.priority} />
                            {wellnessProgram.steps && wellnessProgram.steps.length > 0 && (
                              <Badge variant="outline">{wellnessProgram.steps.length} steps</Badge>
                            )}
                            <Badge variant="outline">{wellnessProgram.actions.length} actions</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent",
                            wellnessProgram.theme === "Blue"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-emerald-100 text-emerald-800",
                          )}
                        >
                          {wellnessProgram.theme}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{getRecurrenceSummary(notification)}</div>
                        <div className="mt-1 text-xs">
                          {notification.reminderSchedule?.executionMode ?? "Execution mode not set"}
                          {notification.reminderSchedule?.validUntil
                            ? ` · until ${format(new Date(notification.reminderSchedule.validUntil), "dd MMM yyyy HH:mm")}`
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">Triggered {monitoring?.counts.triggered ?? 0}</Badge>
                          <Badge variant="outline">Started {monitoring?.counts.started ?? 0}</Badge>
                          <Badge variant="outline">Snoozed {monitoring?.counts.snoozed ?? 0}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline">Completed {monitoring?.counts.completed ?? 0}</Badge>
                          <Badge variant="outline">Timed Out {monitoring?.counts.timedOut ?? 0}</Badge>
                        </div>
                        <div className="mt-2 text-xs">
                          Compliance {monitoring?.completionRate != null ? `${monitoring.completionRate}%` : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div>Policies {monitoring?.activePolicies ?? 0}/{monitoring?.totalPolicies ?? 0}</div>
                        <div className="mt-1 text-xs">
                          Last sync {formatOptionalDateTime(monitoring?.lastSyncedAt)}
                        </div>
                        <div className="mt-1 text-xs">
                          Last activity {formatOptionalDateTime(monitoring?.lastActivityAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={notification.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(item.lastUpdatedAt), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              nav({ to: "/wellness-programs/$id", params: { id: notification.id } })
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          {isDraft && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                nav({
                                  to: "/wellness-programs/new",
                                  search: { draftId: notification.id },
                                })
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          )}
                          {isDraft && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                nav({
                                  to: "/wellness-programs/$id",
                                  params: { id: notification.id },
                                  search: { mode: "publish" },
                                })
                              }
                            >
                              <Rocket className="mr-2 h-4 w-4" />
                              Publish
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={duplicateMutation.isPending}
                            onClick={() => duplicateMutation.mutate(notification.id)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canDeactivate || deactivateMutation.isPending}
                            onClick={() => deactivateMutation.mutate(notification.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof HeartPulse;
  title: string;
  value: number | string;
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

type WellnessView = "all" | "drafts" | "live" | "history";

const LIVE_STATUSES: NotificationStatus[] = ["Scheduled", "Queued", "Sending", "Active"];
const HISTORY_STATUSES: NotificationStatus[] = ["Completed", "Cancelled", "Failed", "Sent"];
const CANCELLABLE_STATUSES: NotificationStatus[] = ["Scheduled", "Queued", "Sending", "Active"];
const ALL_STATUSES: NotificationStatus[] = [
  "Draft",
  "Scheduled",
  "Sending",
  "Sent",
  "Queued",
  "Active",
  "Completed",
  "Cancelled",
  "Failed",
];

function matchesWellnessView(status: NotificationStatus, view: WellnessView) {
  if (view === "drafts") {
    return status === "Draft";
  }

  if (view === "live") {
    return LIVE_STATUSES.includes(status);
  }

  if (view === "history") {
    return HISTORY_STATUSES.includes(status);
  }

  return true;
}

function getRecurrenceSummary(item: WellnessProgramListItem["notification"]) {
  const schedule = item.reminderSchedule;
  if (!schedule || schedule.scheduleType !== "Recurring") {
    return "Recurring schedule not configured yet";
  }

  const firstOccurrence = schedule.scheduledAt
    ? `Starts ${format(new Date(schedule.scheduledAt), "dd MMM yyyy HH:mm")}`
    : "Start time not set";

  return `${firstOccurrence} · ${schedule.recurrenceRule ?? "No RRULE"}`;
}

function formatOptionalDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "dd MMM yyyy HH:mm");
}
