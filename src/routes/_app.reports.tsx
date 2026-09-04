import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { reportsService } from "@/services/reports.service";
import { notificationsService } from "@/services/notifications.service";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Download, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { buildWellnessProgramSummaryCsv, downloadCsv } from "@/lib/wellness-reporting-export";
import { WellnessAdvancedAnalytics } from "@/components/reports/WellnessAdvancedAnalytics";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  useEffect(() => {
    document.title = "Reports | MTI Alert Hub";
  }, []);
  const { data: deliveryByContentType = [] } = useQuery({
    queryKey: ["report-delivery-by-content-type"],
    queryFn: reportsService.deliveryByContentType,
  });
  const { data: responseByContentType = [] } = useQuery({
    queryKey: ["report-response-by-content-type"],
    queryFn: reportsService.responseByContentType,
  });
  const { data: monitoringByContentType = [] } = useQuery({
    queryKey: ["report-monitoring-by-content-type"],
    queryFn: reportsService.monitoringByContentType,
  });
  const {
    data: wellnessPrograms = [],
    isLoading: isWellnessLoading,
    isError: isWellnessError,
    error: wellnessError,
    isFetching: isWellnessFetching,
    refetch: refetchWellness,
  } = useQuery({
    queryKey: ["report-wellness-programs"],
    queryFn: reportsService.wellnessPrograms,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsService.list,
  });

  const [wellnessFamily, setWellnessFamily] = useState("all");
  const [wellnessStatus, setWellnessStatus] = useState("all");
  const [wellnessSite, setWellnessSite] = useState("all");
  const [wellnessArea, setWellnessArea] = useState("all");
  const [wellnessFrom, setWellnessFrom] = useState("");
  const [wellnessTo, setWellnessTo] = useState("");

  const wellnessFilterOptions = useMemo(() => {
    const families = new Set<string>();
    const statuses = new Set<string>();
    const sites = new Set<string>();
    const areas = new Set<string>();
    wellnessPrograms.forEach((program) => {
      families.add(program.programFamily);
      statuses.add(program.status);
      program.reporting.deviceOutcomes.forEach((outcome) => {
        if (outcome.siteName) sites.add(outcome.siteName);
        if (outcome.areaName) areas.add(outcome.areaName);
      });
    });
    return {
      families: [...families].sort(),
      statuses: [...statuses].sort(),
      sites: [...sites].sort(),
      areas: [...areas].sort(),
    };
  }, [wellnessPrograms]);

  const filteredWellnessPrograms = useMemo(
    () =>
      wellnessPrograms.filter((program) => {
        const updatedAt = program.updatedAt ? new Date(program.updatedAt).getTime() : null;
        const fromMs = wellnessFrom ? new Date(`${wellnessFrom}T00:00:00`).getTime() : null;
        const toMs = wellnessTo ? new Date(`${wellnessTo}T23:59:59.999`).getTime() : null;
        return (
          (wellnessFamily === "all" || program.programFamily === wellnessFamily) &&
          (wellnessStatus === "all" || program.status === wellnessStatus) &&
          (wellnessSite === "all" ||
            program.reporting.deviceOutcomes.some(
              (outcome) => outcome.siteName === wellnessSite,
            )) &&
          (wellnessArea === "all" ||
            program.reporting.deviceOutcomes.some(
              (outcome) => outcome.areaName === wellnessArea,
            )) &&
          (fromMs === null || (updatedAt !== null && updatedAt >= fromMs)) &&
          (toMs === null || (updatedAt !== null && updatedAt <= toMs))
        );
      }),
    [
      wellnessPrograms,
      wellnessArea,
      wellnessFamily,
      wellnessFrom,
      wellnessSite,
      wellnessStatus,
      wellnessTo,
    ],
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Delivery, acknowledgement, and drill performance."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Export PDF — backend required")}>
              <FileDown className="mr-1 h-4 w-4" /> Export PDF
            </Button>
            <Button variant="outline" onClick={() => toast.info("Export Excel — backend required")}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Rollup by Content Type</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={deliveryByContentType}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="delivered" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" fill="var(--emergency)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Rollup by Content Type</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={responseByContentType}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="read" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="responded" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overdue" fill="var(--warning)" radius={[4, 4, 0, 0]}>
                  {responseByContentType.map((item, index) => (
                    <Cell key={index} fill={item.overdue > 0 ? "var(--warning)" : "var(--muted)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active and Pending by Content Type</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={monitoringByContentType}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="active" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="var(--warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Wellness Program Outcomes</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Device-centric OHIH outcomes. Close actions with unclear semantics remain separate
                from confirmed completion.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchWellness()}
                disabled={isWellnessFetching}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isWellnessFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filteredWellnessPrograms.length === 0}
                onClick={() =>
                  downloadCsv(
                    "wellness-program-summary.csv",
                    buildWellnessProgramSummaryCsv(filteredWellnessPrograms),
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" /> Export summary CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
              aria-label="Wellness report filters"
            >
              <Select value={wellnessFamily} onValueChange={setWellnessFamily}>
                <SelectTrigger aria-label="Filter by program family">
                  <SelectValue placeholder="All families" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All families</SelectItem>
                  {wellnessFilterOptions.families.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={wellnessStatus} onValueChange={setWellnessStatus}>
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {wellnessFilterOptions.statuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={wellnessSite} onValueChange={setWellnessSite}>
                <SelectTrigger aria-label="Filter by site">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {wellnessFilterOptions.sites.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={wellnessArea} onValueChange={setWellnessArea}>
                <SelectTrigger aria-label="Filter by area">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {wellnessFilterOptions.areas.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Updated from
                <Input
                  type="date"
                  value={wellnessFrom}
                  onChange={(event) => setWellnessFrom(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Updated through
                <Input
                  type="date"
                  value={wellnessTo}
                  onChange={(event) => setWellnessTo(event.target.value)}
                />
              </label>
            </div>

            {isWellnessError && (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                role="alert"
              >
                Wellness reporting could not be loaded.{" "}
                {wellnessError instanceof Error
                  ? wellnessError.message
                  : "Refresh after the backend is reachable."}
              </div>
            )}

            {!isWellnessError && !isWellnessLoading && (
              <WellnessAdvancedAnalytics
                programs={filteredWellnessPrograms}
                site={wellnessSite}
                area={wellnessArea}
              />
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table aria-label="Wellness program outcome report">
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead>Target Size</TableHead>
                    <TableHead>Displayed</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Deferred</TableHead>
                    <TableHead>Dismissed</TableHead>
                    <TableHead>Timed Out</TableHead>
                    <TableHead>Ambiguous</TableHead>
                    <TableHead>Completion Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWellnessPrograms.map((item) => (
                    <TableRow key={item.communicationId}>
                      <TableCell className="font-medium">
                        <Link
                          className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          to="/wellness-programs/$id"
                          params={{ id: item.communicationId }}
                        >
                          {item.title}
                        </Link>
                      </TableCell>
                      <TableCell>{item.programFamily}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.cadence ?? "—"}
                      </TableCell>
                      <TableCell>{item.targetSize}</TableCell>
                      <TableCell>{item.reporting.summary.displayedCount}</TableCell>
                      <TableCell>{item.reporting.summary.completionCount}</TableCell>
                      <TableCell>{item.reporting.summary.deferredCount}</TableCell>
                      <TableCell>{item.reporting.summary.dismissedCount}</TableCell>
                      <TableCell>{item.reporting.summary.timedOutCount}</TableCell>
                      <TableCell>{item.reporting.summary.ambiguousCloseCount}</TableCell>
                      <TableCell>
                        {item.reporting.summary.completionRate != null
                          ? `${item.reporting.summary.completionRate}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {isWellnessLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Loading wellness reporting…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isWellnessLoading &&
                    !isWellnessError &&
                    filteredWellnessPrograms.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          No wellness reporting data matches the current filters.
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Ack</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.title}</TableCell>
                    <TableCell>
                      <PriorityBadge priority={n.priority} />
                    </TableCell>
                    <TableCell>{n.category}</TableCell>
                    <TableCell>{n.recipientsCount}</TableCell>
                    <TableCell>{n.ackCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={n.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(n.createdAt), "dd MMM HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
