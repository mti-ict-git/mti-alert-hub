import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock3, Footprints, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  buildDailyPerformance,
  buildGuidedRoutineDepth,
  buildHourlyPerformance,
  buildLocationComparison,
  buildProgramComparison,
  buildWeeklyPerformance,
  findStrongestWindow,
  type WellnessComparisonDimension,
  type WellnessMetricRow,
  type WellnessTimeBucket,
} from "@/lib/wellness-analytics";
import type { WellnessProgramRollup } from "@/types";

type Props = {
  programs: WellnessProgramRollup[];
  site: string;
  area: string;
};

export function WellnessAdvancedAnalytics({ programs, site, area }: Props) {
  const [comparisonDimension, setComparisonDimension] =
    useState<WellnessComparisonDimension>("family");
  const [locationDimension, setLocationDimension] = useState<"site" | "area">("site");
  const [trendGranularity, setTrendGranularity] = useState<"daily" | "weekly">("daily");
  const filters = useMemo(() => ({ site, area }), [site, area]);

  const comparison = useMemo(
    () => buildProgramComparison(programs, comparisonDimension, filters),
    [comparisonDimension, filters, programs],
  );
  const locations = useMemo(
    () => buildLocationComparison(programs, locationDimension, filters),
    [filters, locationDimension, programs],
  );
  const hourly = useMemo(() => buildHourlyPerformance(programs, filters), [filters, programs]);
  const trend = useMemo(
    () =>
      trendGranularity === "daily"
        ? buildDailyPerformance(programs, filters)
        : buildWeeklyPerformance(programs, filters),
    [filters, programs, trendGranularity],
  );
  const guided = useMemo(() => buildGuidedRoutineDepth(programs, filters), [filters, programs]);
  const strongestCompletion = findStrongestWindow(hourly, "completionRate");
  const strongestDefer = findStrongestWindow(hourly, "deferRate");
  const hasOccurrences = hourly.some((item) => item.displayed > 0);

  if (!hasOccurrences) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Advanced analytics will appear after the selected programs report reminder occurrences.
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-6" aria-labelledby="wellness-effectiveness-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-6">
        <div>
          <h3 id="wellness-effectiveness-heading" className="text-base font-semibold">
            Effectiveness analytics
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparisons use displayed reminder occurrences in each device&apos;s configured
            timezone.
          </p>
        </div>
        <p className="max-w-xl text-xs text-muted-foreground">
          Active-user identifiers are excluded. Site and area filters scope these analytics to the
          matching device occurrences.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          icon={TrendingUp}
          label="Highest completion window"
          value={formatWindow(strongestCompletion, "completionRate")}
          detail={
            strongestCompletion ? formatSample(strongestCompletion) : "No completed occurrences"
          }
        />
        <InsightCard
          icon={Clock3}
          label="Highest defer window"
          value={formatWindow(strongestDefer, "deferRate")}
          detail={strongestDefer ? formatSample(strongestDefer) : "No deferred occurrences"}
        />
        <InsightCard
          icon={Footprints}
          label="Guided starts completed"
          value={formatRate(guided.completedAfterStart, guided.started)}
          detail={`${guided.completedAfterStart} completed from ${guided.started} starts`}
        />
        <InsightCard
          icon={Activity}
          label="Started, not completed"
          value={formatPercent(guided.startAbandonmentRate)}
          detail={`${guided.startedButNotCompleted} guided occurrences; not treated as partial completion`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Program comparison</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Completion and defer rates share the displayed-occurrence denominator.
              </p>
            </div>
            <Select
              value={comparisonDimension}
              onValueChange={(value) =>
                setComparisonDimension(value as WellnessComparisonDimension)
              }
            >
              <SelectTrigger className="w-44" aria-label="Compare wellness programs by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="family">Program family</SelectItem>
                <SelectItem value="cadence">Cadence</SelectItem>
                <SelectItem value="distribution">Distribution mode</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <MetricTable rows={comparison} label="Program effectiveness comparison" />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Location comparison</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Device-centric rollup without active-user identity.
              </p>
            </div>
            <Select
              value={locationDimension}
              onValueChange={(value) => setLocationDimension(value as "site" | "area")}
            >
              <SelectTrigger className="w-36" aria-label="Compare wellness outcomes by location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="area">Area</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <MetricTable rows={locations} label="Location effectiveness comparison" />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Hourly performance</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Local device hour; empty hours remain visible so scheduling gaps are explicit.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RateChart data={hourly} ariaLabel="Hourly wellness completion and defer rates" />
          <TimeTable
            rows={hourly.filter((item) => item.displayed > 0)}
            label="Hourly performance data"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Outcome trend</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Daily shows the latest 14 days; weekly uses Monday-based local calendar weeks.
              </p>
            </div>
            <Select
              value={trendGranularity}
              onValueChange={(value) => setTrendGranularity(value as "daily" | "weekly")}
            >
              <SelectTrigger className="w-32" aria-label="Wellness trend granularity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            <RateChart data={trend} ariaLabel={`${trendGranularity} wellness outcome rates`} />
            <TimeTable rows={trend} label={`${trendGranularity} wellness outcome data`} />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Guided routine depth</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Step advances are progress evidence, not confirmed completion.
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <DepthRow label="Guided programs" value={guided.programs} />
              <DepthRow label="Displayed" value={guided.displayed} />
              <DepthRow label="Started" value={guided.started} />
              <DepthRow label="Step advanced events" value={guided.stepAdvanced} />
              <DepthRow label="Completed" value={guided.completed} />
              <DepthRow label="Started, not completed" value={guided.startedButNotCompleted} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MetricTable({ rows, label }: { rows: WellnessMetricRow[]; label: string }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table aria-label={label}>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead className="text-right">Programs</TableHead>
            <TableHead className="text-right">Displayed</TableHead>
            <TableHead className="text-right">Complete</TableHead>
            <TableHead className="text-right">Defer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="min-w-40 font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">{row.programCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.displayed}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(row.completionRate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(row.deferRate)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">
                No occurrence data is available for this comparison.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RateChart({ data, ariaLabel }: { data: WellnessTimeBucket[]; ariaLabel: string }) {
  return (
    <div className="h-64" aria-label={ariaLabel}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" fontSize={10} stroke="var(--muted-foreground)" />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            fontSize={11}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            formatter={(value) => [`${value ?? 0}%`]}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            name="Completion rate"
            dataKey="completionRate"
            fill="var(--success)"
            radius={[3, 3, 0, 0]}
          />
          <Bar name="Defer rate" dataKey="deferRate" fill="var(--warning)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TimeTable({ rows, label }: { rows: WellnessTimeBucket[]; label: string }) {
  return (
    <div className="max-h-56 overflow-auto rounded-md border">
      <Table aria-label={label}>
        <TableHeader>
          <TableRow>
            <TableHead>Window</TableHead>
            <TableHead className="text-right">Displayed</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead className="text-right">Deferred</TableHead>
            <TableHead className="text-right">Completion</TableHead>
            <TableHead className="text-right">Defer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">{row.displayed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
              <TableCell className="text-right tabular-nums">{row.deferred}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(row.completionRate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPercent(row.deferRate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DepthRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatPercent(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function formatRate(numerator: number, denominator: number) {
  return formatPercent(denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null);
}

function formatWindow(row: WellnessTimeBucket | null, metric: "completionRate" | "deferRate") {
  return row ? `${row.label} · ${formatPercent(row[metric])}` : "—";
}

function formatSample(row: WellnessTimeBucket | null) {
  return row ? `${row.displayed} displayed occurrences` : "";
}
