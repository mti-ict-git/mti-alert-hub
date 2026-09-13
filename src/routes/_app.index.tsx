import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  FlaskConical,
  BellRing,
  CircleAlert,
  Plus,
  ArrowUpRight,
  MonitorSmartphone,
  MessageCircle,
  Siren,
  HandHelping,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardService } from "@/services/dashboard.service";
import { notificationsService } from "@/services/notifications.service";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/common/PriorityBadge";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const {
    data: overview,
    isPending: overviewLoading,
    isError: overviewError,
    refetch: reloadOverview,
  } = useQuery({ queryKey: ["dashboard-overview"], queryFn: dashboardService.overview });
  const {
    data: notifications = [],
    isPending: notificationsLoading,
    isError: notificationsError,
    refetch: reloadNotifications,
  } = useQuery({ queryKey: ["notifications"], queryFn: notificationsService.list });

  const overviewStats = overview ?? {
    activeCommunications: "—",
    recipientsPending: "—",
    deliveredCount: "—",
    respondedCount: "—",
    failedCount: "—",
    overdueResponses: "—",
  };

  const byPriority = ["Emergency", "Warning", "Info"].map((p) => ({
    name: p,
    count: notifications.filter((n) => n.priority === p).length,
  }));

  const ackData = [
    { name: "Safe", value: 62 },
    { name: "Need Assistance", value: 8 },
    { name: "Not In Area", value: 6 },
    { name: "Acknowledged", value: 14 },
    { name: "No Response", value: 10 },
  ];
  const ackColors = [
    "var(--success)",
    "var(--emergency)",
    "var(--warning)",
    "var(--info)",
    "var(--muted-foreground)",
  ];

  const channelData = [
    { name: "Desktop", value: 820 },
    { name: "WhatsApp", value: 640 },
    { name: "Email", value: 410 },
    { name: "Signage", value: 180 },
  ];

  const activity = [
    { type: "sent", text: "Fire Alarm at Acid Plant — sent to 42 recipients", ago: "2h" },
    { type: "ack", text: "12 recipients acknowledged Emergency Drill", ago: "3h" },
    { type: "device", text: "MTI-PC-118 came online", ago: "3h" },
    { type: "whatsapp", text: "Field officer replied '2 = Need Assistance'", ago: "4h" },
    { type: "sent", text: "Power Shutdown at Chloride — scheduled", ago: "6h" },
    { type: "device", text: "MTI-PC-104 went offline", ago: "7h" },
  ];

  return (
    <div>
      <PageHeader
        title="Control Room"
        description="Monitor emergency communications, delivery, and recipient responses."
        actions={
          <Button asChild>
            <Link to="/notifications/new">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Create Notification
            </Link>
          </Button>
        }
      />

      <div
        className="mb-4 flex min-h-6 flex-wrap items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        {overviewLoading || notificationsLoading ? "Loading operational overview…" : null}
        {overviewError || notificationsError ? (
          <>
            Some operational data could not be loaded.{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void reloadOverview();
                void reloadNotifications();
              }}
            >
              Retry
            </Button>
          </>
        ) : null}
      </div>
      {overview &&
        !overviewError &&
        (overview.overdueResponses > 0 || overview.failedCount > 0) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <p>
              <strong>{overview.overdueResponses}</strong> overdue responses ·{" "}
              <strong>{overview.failedCount}</strong> failed deliveries
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/notifications">
                Review notifications <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      <h2 className="mb-3 text-sm font-semibold">Operational summary</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Active Communications"
          value={overviewStats.activeCommunications}
          icon={Siren}
          tone="emergency"
          hint="Scheduled, queued, sending, active"
        />
        <StatCard
          label="Recipients Pending"
          value={overviewStats.recipientsPending}
          icon={BellRing}
          tone="info"
        />
        <StatCard
          label="Overdue Responses"
          value={overviewStats.overdueResponses}
          icon={HandHelping}
          tone="warning"
        />
        <StatCard
          label="Failed"
          value={overviewStats.failedCount}
          icon={CircleAlert}
          tone="warning"
        />
        <StatCard
          label="Delivered"
          value={overviewStats.deliveredCount}
          icon={MonitorSmartphone}
          tone="success"
        />
        <StatCard
          label="Responded"
          value={overviewStats.respondedCount}
          icon={MessageCircle}
          tone="info"
          hint="Unique responding recipients"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification by Priority</CardTitle>
            <p className="text-xs text-muted-foreground">
              {notificationsLoading
                ? "Loading notification totals…"
                : notificationsError
                  ? "Notification totals unavailable"
                  : `${notifications.length} notifications in the current overview`}
            </p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
                />
                <Bar isAnimationActive={false} dataKey="count" radius={[4, 4, 0, 0]}>
                  {byPriority.map((d) => (
                    <Cell
                      key={d.name}
                      fill={
                        d.name === "Emergency"
                          ? "var(--emergency)"
                          : d.name === "Warning"
                            ? "var(--warning)"
                            : "var(--info)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acknowledgement Status</CardTitle>
            <p className="flex items-center gap-2 rounded border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Illustrative data · not live response totals
            </p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={ackData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {ackData.map((_, i) => (
                    <Cell key={i} fill={ackColors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Channel Usage</CardTitle>
            <p className="flex items-center gap-2 rounded border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Illustrative data · not live delivery totals
            </p>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Recent Notifications</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/notifications">
                View all
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="min-h-32 divide-y">
              {!notifications.length && (
                <li className="py-10 text-center text-sm text-muted-foreground">
                  {notificationsLoading
                    ? "Loading notifications…"
                    : notificationsError
                      ? "Notifications are unavailable. Use Retry above."
                      : "No notifications yet."}
                </li>
              )}
              {notifications.slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={n.priority} />
                      <Link
                        to="/notifications/$id"
                        params={{ id: n.id }}
                        className="truncate rounded-sm font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {n.title}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {n.category} · {n.targetType}
                      {n.targetSite
                        ? ` · ${n.targetSite}`
                        : n.targetArea
                          ? ` · ${n.targetArea}`
                          : ""}{" "}
                      · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>
                      {n.ackCount}/{n.recipientsCount} ack
                    </div>
                    <div>{n.channels.length} channels</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity Feed</CardTitle>
            <p className="flex items-center gap-2 rounded border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Illustrative activity · not a live event stream
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-muted p-1.5 text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.text}</p>
                    <p className="text-xs text-muted-foreground">{a.ago} ago</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
