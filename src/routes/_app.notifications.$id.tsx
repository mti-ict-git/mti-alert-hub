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
import { AlertTriangle, MonitorSmartphone, MessageSquare, Users } from "lucide-react";

export const Route = createFileRoute("/_app/notifications/$id")({
  component: NotificationDetailPage,
});

function NotificationDetailPage() {
  const { id } = useParams({ from: "/_app/notifications/$id" });
  const { data: n } = useQuery({ queryKey: ["notification", id], queryFn: () => notificationsService.get(id) });
  const { data: recipients = [] } = useQuery({ queryKey: ["recipients", id], queryFn: () => notificationsService.recipients(id) });
  const { data: logs = [] } = useQuery({ queryKey: ["logs", id], queryFn: () => notificationsService.deliveryLogs(id) });
  const { data: audiencePreview } = useQuery({
    queryKey: ["audience-preview", id],
    queryFn: () => notificationsService.audiencePreview(id),
  });

  if (!n) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const previewRecipients = audiencePreview?.recipients ?? [];
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
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-info"><Users className="h-4 w-4"/><span className="text-xs font-medium uppercase">Recipients</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.totalRecipients ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-success"><MonitorSmartphone className="h-4 w-4"/><span className="text-xs font-medium uppercase">Windows Agent</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.deviceRecipients ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-success"><MessageSquare className="h-4 w-4"/><span className="text-xs font-medium uppercase">WhatsApp</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.whatsappRecipients ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4"/><span className="text-xs font-medium uppercase">Warnings</span></div><div className="mt-2 text-2xl font-semibold">{audiencePreview?.previewWarnings.length ?? 0}</div></CardContent></Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recipients">Recipients ({previewRecipients.length})</TabsTrigger>
            <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
            <TabsTrigger value="ack">Audience Summary</TabsTrigger>
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
                <Info label="Recipients" value={`${audiencePreview?.totalRecipients ?? 0}`} />
              </CardContent>
            </Card>
            {audiencePreview && (
              <Card className="mt-4">
                <CardHeader><CardTitle className="text-base">Channel Plan</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {audiencePreview.channelPlan.map((item) => (
                      <div key={item.channel} className="rounded-md border p-3">
                        <div className="text-sm font-medium">{item.channel}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.strategy}
                          {item.plannedDelaySeconds ? ` · ${item.plannedDelaySeconds}s delay` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                  {audiencePreview.previewWarnings.length > 0 && (
                    <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                      <div className="text-sm font-medium">Preview Warnings</div>
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

          <TabsContent value="recipients" className="mt-4">
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient Type</TableHead><TableHead>Employee No</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Section</TableHead><TableHead>Site</TableHead><TableHead>Area</TableHead><TableHead>Channels</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRecipients.map((recipient) => (
                      <TableRow key={`${recipient.recipientType}-${recipient.deviceId ?? recipient.employeeId ?? recipient.employeeNumber}`}>
                        <TableCell>{recipient.recipientType}</TableCell>
                        <TableCell className="font-mono text-xs">{recipient.employeeNumber ?? "—"}</TableCell>
                        <TableCell>{recipient.fullName ?? "—"}</TableCell>
                        <TableCell>{recipient.departmentName ?? "—"}</TableCell>
                        <TableCell>{recipient.sectionName ?? "—"}</TableCell>
                        <TableCell>{recipient.siteName ?? "—"}</TableCell>
                        <TableCell>{recipient.areaName ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {recipient.availableChannels.join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {previewRecipients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                          No audience preview is available for this draft yet.
                        </TableCell>
                      </TableRow>
                    )}
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
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Delivery logs are not available until delivery orchestration is implemented.
                      </TableCell>
                    </TableRow>
                  )}
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
              </CardContent>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                Response and acknowledgement counts stay `0` until delivery and response tracking endpoints are implemented in later phases.
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
