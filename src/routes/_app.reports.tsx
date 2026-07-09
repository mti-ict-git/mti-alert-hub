import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { reportsService } from "@/services/reports.service";
import { notificationsService } from "@/services/notifications.service";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
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
  const { data: notifications = [] } = useQuery({ queryKey: ["notifications"], queryFn: notificationsService.list });

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Delivery, acknowledgement, and drill performance."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Export PDF — backend required")}><FileDown className="mr-1 h-4 w-4" /> Export PDF</Button>
            <Button variant="outline" onClick={() => toast.info("Export Excel — backend required")}><FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery Rollup by Content Type</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={deliveryByContentType}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="delivered" fill="var(--success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" fill="var(--emergency)" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Response Rollup by Content Type</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={responseByContentType}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="read" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="responded" fill="var(--success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overdue" fill="var(--warning)" radius={[4, 4, 0, 0]}>
                {responseByContentType.map((item, index) => (
                  <Cell key={index} fill={item.overdue > 0 ? "var(--warning)" : "var(--muted)"} />
                ))}
              </Bar>
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Active and Pending by Content Type</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={monitoringByContentType}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="active" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" fill="var(--warning)" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Notification History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Category</TableHead><TableHead>Recipients</TableHead><TableHead>Ack</TableHead><TableHead>Status</TableHead><TableHead>Created At</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {notifications.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.title}</TableCell>
                    <TableCell><PriorityBadge priority={n.priority} /></TableCell>
                    <TableCell>{n.category}</TableCell>
                    <TableCell>{n.recipientsCount}</TableCell>
                    <TableCell>{n.ackCount}</TableCell>
                    <TableCell><StatusBadge status={n.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(n.createdAt), "dd MMM HH:mm")}</TableCell>
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
