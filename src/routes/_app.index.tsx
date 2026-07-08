import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BellRing,
  CheckCircle2,
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
import { notificationsService } from "@/services/notifications.service";
import { devicesService } from "@/services/devices.service";
import { employeesService } from "@/services/employees.service";
import { formatDistanceToNow } from "date-fns";
import { PriorityBadge } from "@/components/common/PriorityBadge";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: notifications = [] } = useQuery({ queryKey: ["notifications"], queryFn: notificationsService.list });
  const { data: devices = [] } = useQuery({ queryKey: ["devices"], queryFn: devicesService.list });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: employeesService.list });

  const today = new Date().toDateString();
  const notifToday = notifications.filter((n) => new Date(n.createdAt).toDateString() === today).length;
  const activeEmergency = notifications.filter(
    (n) => n.priority === "Emergency" && (n.status === "Sent" || n.status === "Sending"),
  ).length;
  const onlineDevices = devices.filter((d) => d.status === "Online").length;
  const whatsAppRecipients = employees.filter(
    (e) => e.status === "Active" && e.preferredChannels.includes("WhatsApp"),
  ).length;
  const totalRcp = notifications.reduce((s, n) => s + n.recipientsCount, 0);
  const totalAck = notifications.reduce((s, n) => s + n.ackCount, 0);
  const ackRate = totalRcp ? Math.round((totalAck / totalRcp) * 100) : 0;
  const needAssistance = 4; // aggregated from mock recipients

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
  const ackColors = ["var(--success)", "var(--emergency)", "var(--warning)", "var(--info)", "var(--muted-foreground)"];

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
      <PageHeader title="Control Room" description="Live overview of emergency and operational notifications." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active Emergency" value={activeEmergency} icon={Siren} tone="emergency" hint="Currently open" />
        <StatCard label="Notifications Today" value={notifToday} icon={BellRing} tone="info" />
        <StatCard label="Desktop Agents Online" value={`${onlineDevices}/${devices.length}`} icon={MonitorSmartphone} tone="success" />
        <StatCard label="WhatsApp Recipients" value={whatsAppRecipients} icon={MessageCircle} tone="info" hint="Field officers" />
        <StatCard label="Acknowledgement Rate" value={`${ackRate}%`} icon={CheckCircle2} tone="success" />
        <StatCard label="Need Assistance" value={needAssistance} icon={HandHelping} tone="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Notification by Priority</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byPriority.map((d) => (
                    <Cell key={d.name} fill={d.name === "Emergency" ? "var(--emergency)" : d.name === "Warning" ? "var(--warning)" : "var(--info)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Acknowledgement Status</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ackData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {ackData.map((_, i) => <Cell key={i} fill={ackColors[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Delivery Channel Usage</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={70} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent Notifications</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {notifications.slice(0, 6).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={n.priority} />
                      <span className="truncate font-medium">{n.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {n.category} · {n.targetType}
                      {n.targetSite
                        ? ` · ${n.targetSite}`
                        : n.targetArea
                          ? ` · ${n.targetArea}`
                          : ""} · {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{n.ackCount}/{n.recipientsCount} ack</div>
                    <div>{n.channels.length} channels</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activity Feed</CardTitle></CardHeader>
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
