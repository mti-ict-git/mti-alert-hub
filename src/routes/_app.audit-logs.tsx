import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditService } from "@/services/audit.service";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/audit-logs")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const { data = [] } = useQuery({ queryKey: ["audit"], queryFn: auditService.list });
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");

  const modules = Array.from(new Set(data.map((d) => d.module)));
  const filtered = useMemo(
    () =>
      data.filter(
        (l) =>
          (mod === "all" || l.module === mod) &&
          (!q || l.description.toLowerCase().includes(q.toLowerCase()) || l.user.includes(q)),
      ),
    [data, q, mod],
  );

  return (
    <div>
      <PageHeader title="Audit Logs" description="System activity trail." />
      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input placeholder="Search description or user…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <Select value={mod} onValueChange={setMod}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Module</TableHead><TableHead>Description</TableHead><TableHead>IP Address</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(l.time), "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{l.user}</TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell>{l.module}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.description}</TableCell>
                    <TableCell className="font-mono text-xs">{l.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
