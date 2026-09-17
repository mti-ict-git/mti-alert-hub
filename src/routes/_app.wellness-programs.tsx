import { PermissionAction } from "@/components/access/PermissionAction";
import { FilterChips } from "@/components/common/FilterChips";
import { ListPagination } from "@/components/common/ListPagination";
import { useListPagination } from "@/hooks/useListPagination";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Copy,
  Eye,
  HeartPulse,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  MoreHorizontal,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/common/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notificationsService } from "@/services/notifications.service";
import type { NotificationStatus, WellnessProgramListItem, WellnessTheme } from "@/types";
import { isCancellableNotificationStatus } from "@/lib/notification-status";
import { formatWellnessRecurrenceSummary } from "@/lib/wellness-authoring";
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

  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<WellnessView>("all");
  const [theme, setTheme] = useState<"all" | WellnessTheme>("all");
  const [programType, setProgramType] = useState<
    "all" | WellnessProgramListItem["notification"]["wellnessProgram"]["programType"]
  >("all");
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
  const totalTriggered = data.reduce(
    (sum, item) => sum + (item.monitoring?.counts.triggered ?? 0),
    0,
  );
  const totalCompleted = data.reduce(
    (sum, item) => sum + (item.monitoring?.counts.completed ?? 0),
    0,
  );
  const completionRate =
    totalTriggered > 0 ? Math.round((totalCompleted / totalTriggered) * 100) : null;

  const pagination = useListPagination(
    filtered,
    JSON.stringify([query, theme, programType, status, view]),
  );
  return (
    <div>
      <PageHeader
        title="Wellness Programs"
        description="Manage recurring wellness programs and review their completion."
        actions={
          <>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              {isFetching ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/notifications">Open Notification Center</Link>
            </Button>
            <PermissionAction permission="wellness.manage">
              <Button asChild>
                <Link to="/wellness-programs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Wellness Program
                </Link>
              </Button>
            </PermissionAction>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={HeartPulse}
          title="Scheduled / Live"
          value={liveCount}
          description={`${data.length} programs in total`}
        />
        <SummaryCard
          icon={Pencil}
          title="Drafts"
          value={draftCount}
          description="Programs awaiting publication"
        />
        <SummaryCard
          icon={ShieldCheck}
          title="Completion"
          value={completionRate != null ? `${completionRate}%` : "—"}
          description={`${totalCompleted} completed / ${totalTriggered} triggered`}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(nextValue) => setView(nextValue as WellnessView)}>
              <TabsList aria-label="Request views">
                <TabsTrigger value="all">
                  All
                  <span className="ml-2 rounded bg-muted px-1.5 text-xs tabular-nums">
                    {
                      data.filter((item) => matchesWellnessView(item.notification.status, "all"))
                        .length
                    }
                  </span>
                </TabsTrigger>
                <TabsTrigger value="drafts">
                  Drafts
                  <span className="ml-2 rounded bg-muted px-1.5 text-xs tabular-nums">
                    {
                      data.filter((item) => matchesWellnessView(item.notification.status, "drafts"))
                        .length
                    }
                  </span>
                </TabsTrigger>
                <TabsTrigger value="live">
                  Scheduled / Live
                  <span className="ml-2 rounded bg-muted px-1.5 text-xs tabular-nums">
                    {
                      data.filter((item) => matchesWellnessView(item.notification.status, "live"))
                        .length
                    }
                  </span>
                </TabsTrigger>
                <TabsTrigger value="history">
                  History
                  <span className="ml-2 rounded bg-muted px-1.5 text-xs tabular-nums">
                    {
                      data.filter((item) =>
                        matchesWellnessView(item.notification.status, "history"),
                      ).length
                    }
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Failed to load wellness programs:{" "}
              {error instanceof Error ? error.message : "Unknown error"}.
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Search wellness title..."
              value={query}
              onValueChange={setQuery}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              aria-expanded={showFilters}
              aria-controls="wellness-extra-filters"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal aria-hidden="true" /> Filters
              {[theme, programType, status].filter((value) => value !== "all").length > 0 &&
                ` (${[theme, programType, status].filter((value) => value !== "all").length})`}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              Updated {dataUpdatedAt ? format(new Date(dataUpdatedAt), "HH:mm") : "—"} · Auto
              refresh 15s
            </span>
          </div>
          {showFilters && (
            <div id="wellness-extra-filters" className="mb-4 flex flex-wrap gap-2">
              <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
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
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Program Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="SimpleReminder">SimpleReminder</SelectItem>
                  <SelectItem value="GuidedRoutine">GuidedRoutine</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
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
          )}

          <FilterChips
            count={filtered.length}
            busy={isFetching}
            filters={[
              {
                label: "Search",
                value: query,
                active: query !== "",
                onRemove: () => setQuery(""),
              },
              {
                label: "Theme",
                value: theme,
                active: theme !== "all",
                onRemove: () => setTheme("all"),
              },
              {
                label: "Type",
                value: programType,
                active: programType !== "all" && programType !== "",
                onRemove: () => setProgramType("all"),
              },
              {
                label: "Status",
                value: status,
                active: status !== "all",
                onRemove: () => setStatus("all"),
              },
            ]}
          />
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Program</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Loading wellness programs...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && !isError && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No wellness programs found for the current filters.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && isError && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      Wellness programs could not be loaded. Use Refresh after the backend is
                      reachable.
                    </TableCell>
                  </TableRow>
                )}

                {pagination.items.map((item) => {
                  const notification = item.notification;
                  const wellnessProgram = notification.wellnessProgram!;
                  const isDraft = notification.status === "Draft";
                  const canDeactivate = isCancellableNotificationStatus(notification.status);
                  const monitoring = item.monitoring;

                  return (
                    <TableRow
                      key={notification.id}
                      className="cursor-pointer"
                      onClick={() =>
                        nav({ to: "/wellness-programs/$id", params: { id: notification.id } })
                      }
                    >
                      <TableCell className="py-4">
                        <Link
                          to="/wellness-programs/$id"
                          params={{ id: notification.id }}
                          className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {notification.title}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {wellnessProgram.programType === "GuidedRoutine"
                            ? "Guided routine"
                            : "Simple reminder"}{" "}
                          · {wellnessProgram.theme}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{getRecurrenceSummary(notification)}</div>
                        {notification.reminderSchedule?.validUntil && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Until {formatOptionalDateTime(notification.reminderSchedule.validUntil)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={notification.status} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium tabular-nums">
                          {monitoring?.completionRate != null
                            ? `${monitoring.completionRate}%`
                            : "—"}
                        </span>
                        <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                          {monitoring
                            ? `${monitoring.counts.completed} completed / ${monitoring.counts.triggered} triggered`
                            : "No activity data"}
                        </p>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`More actions for ${notification.title}`}
                              >
                                <MoreHorizontal aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {["Draft", "Scheduled", "Active"].includes(notification.status) && (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    nav({
                                      to: "/wellness-programs/new",
                                      search: { draftId: notification.id },
                                    })
                                  }
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {isDraft && (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    nav({
                                      to: "/wellness-programs/$id",
                                      params: { id: notification.id },
                                      search: { mode: "publish" },
                                    })
                                  }
                                >
                                  <Rocket className="mr-2 h-4 w-4" />
                                  Publish
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                disabled={duplicateMutation.isPending}
                                onSelect={() => duplicateMutation.mutate(notification.id)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canDeactivate || deactivateMutation.isPending}
                                onSelect={() => {
                                  if (window.confirm(`Deactivate "${notification.title}"?`))
                                    deactivateMutation.mutate(notification.id);
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>{" "}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ListPagination {...pagination.controls} />
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

  return formatWellnessRecurrenceSummary(schedule.recurrenceRule);
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
