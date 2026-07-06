import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { whatsappService } from "@/services/whatsapp.service";
import { CheckCircle2, MessageCircle, MessageSquare, XCircle } from "lucide-react";
import { format } from "date-fns";
import { WhatsAppPreview } from "@/components/notifications/WhatsAppPreview";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const { data: status } = useQuery({ queryKey: ["wa-status"], queryFn: whatsappService.status });
  const { data: messages = [] } = useQuery({ queryKey: ["wa-messages"], queryFn: whatsappService.messages });

  return (
    <div>
      <PageHeader title="WhatsApp Gateway" description="Outbound and inbound WhatsApp traffic for field officers." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted-foreground">Gateway Status</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${status?.connected ? "bg-success animate-pulse" : "bg-emergency"}`} />
              <span className="text-lg font-semibold">{status?.connected ? "Connected" : "Disconnected"}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground truncate">{status?.gatewayUrl}</div>
          </CardContent>
        </Card>
        <StatCard label="Messages Sent Today" value={status?.sentToday ?? "—"} icon={MessageCircle} tone="info" />
        <StatCard label="Failed Messages" value={status?.failed ?? "—"} icon={XCircle} tone="emergency" />
        <StatCard label="Incoming Replies" value={status?.incoming ?? "—"} icon={MessageSquare} tone="success" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Message Log</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Phone</TableHead><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Content</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {messages.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(m.time), "dd MMM HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{m.phone}</TableCell>
                      <TableCell>{m.employeeName}</TableCell>
                      <TableCell>
                        <span className={`text-xs ${m.type === "Incoming" ? "text-success" : "text-muted-foreground"}`}>{m.type}</span>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-sm">{m.content}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {m.status === "Delivered" ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-emergency" />}
                          <StatusBadge status={m.status} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Template Preview</CardTitle></CardHeader>
          <CardContent>
            <WhatsAppPreview title="Fire Alarm" priority="Emergency" site="Acid Plant" instruction="Evacuate to Assembly Point A" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
