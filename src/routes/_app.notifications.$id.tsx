import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { notificationsService } from "@/services/notifications.service";
import { format } from "date-fns";
import { CheckCircle2, HandHelping, MapPinOff, MessageSquare, XCircle } from "lucide-react";

export const Route = createFileRoute("/_app/notifications/$id")({
  component: NotificationDetailPage,
});

function NotificationDetailPage() {
  const { id } = useParams({ from: "/_app/notifications/$id" });
  const { data: n } = useQuery({ queryKey: ["notification", id], queryFn: () => notificationsService.get(id) });
  const { data: recipients = [] } = useQuery({ queryKey: ["recipients", id], queryFn: () => notificationsService.recipients(id) });
  const { data: logs = [] } = useQuery({ queryKey: ["logs", id], queryFn: () => notificationsService.deliveryLogs(id) });

  if (!n) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const ackCounts = {
    Safe: recipients.filter((r) => r.ackStatus === "Safe").length,
    NeedAssistance: recipients.filter((r) => r.ackStatus === "NeedAssistance").length,
    NotInArea: recipients.filter((r) => r.ackStatus === "NotInArea").length,
    Acknowledged: recipients.filter((r) => r.ackStatus === "Acknowledged").length,
    NoResponse: recipients.filter((r) => r.ackStatus === "NoResponse").length,
  };

  return (
    <div>
      <PageHeader
        title={n.title}
        description={`${n.category} · ${n.targetType}${n.targetSite ? ` · ${n.targetSite}` : ""}`}
        actions={<><PriorityBadge priority={n.priority} /><StatusBadge status={n.status} /></>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4"/><span className="text-xs font-medium uppercase">Safe</span></div><div className="mt-2 text-2xl font-semibold">{ackCounts.Safe}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-emergency"><HandHelping className="h-4 w-4"/><span className="text-xs font-medium uppercase">Need Assistance</span></div><div className="mt-2 text-2xl font-semibold">{ackCounts.NeedAssistance}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-warning"><MapPinOff className="h-4 w-4"/><span className="text-xs font-medium uppercase">Not In Area</span></div><div className="mt-2 text-2xl font-semibold">{ackCounts.NotInArea}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-info"><MessageSquare className="h-4 w-4"/><span className="text-xs font-medium uppercase">Acknowledged</span></div><div className="mt-2 text-2xl font-semibold">{ackCounts.Acknowledged}</div></CardContent></Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recipients">Recipients ({recipients.length})</TabsTrigger>
            <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
            <TabsTrigger value="ack">Acknowledgement</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <Info label="Message" value={n.message} />
                <Info label="Instruction" value={n.instruction || "—"} />
                <Info label="Channels" value={n.channels.join(", ")} />
                <Info label="Require Ack" value={n.requireAck ? "Yes" : "No"} />
                <Info label="Created By" value={n.createdBy} />
                <Info label="Created At" value={format(new Date(n.createdAt), "dd MMM yyyy HH:mm")} />
                {n.scheduledAt && <Info label="Scheduled At" value={format(new Date(n.scheduledAt), "dd MMM yyyy HH:mm")} />}
                <Info label="Recipients" value={`${n.recipientsCount}`} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipients" className="mt-4">
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Section</TableHead><TableHead>Site</TableHead><TableHead>Channel</TableHead><TableHead>Delivery</TableHead><TableHead>Ack</TableHead><TableHead>Response</TableHead><TableHead>Response Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.employeeId}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.department}</TableCell>
                        <TableCell>{r.section}</TableCell>
                        <TableCell>{r.site}</TableCell>
                        <TableCell>{r.channel}</TableCell>
                        <TableCell><StatusBadge status={r.deliveryStatus} /></TableCell>
                        <TableCell><StatusBadge status={r.ackStatus} /></TableCell>
                        <TableCell>{r.response ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {r.responseTime ? format(new Date(r.responseTime), "HH:mm:ss") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
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
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase text-muted-foreground">No Response</div>
                  <div className="mt-1 text-2xl font-semibold flex items-center gap-1"><XCircle className="h-5 w-5 text-muted-foreground" />{ackCounts.NoResponse}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
