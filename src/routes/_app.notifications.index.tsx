import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Eye, MoreHorizontal, Plus, XCircle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { notificationsService } from "@/services/notifications.service";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications/")({
  component: NotificationCenter,
});

function NotificationCenter() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["notifications"], queryFn: notificationsService.list });
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(
    () =>
      data.filter(
        (n) =>
          (!q || n.title.toLowerCase().includes(q.toLowerCase())) &&
          (priority === "all" || n.priority === priority) &&
          (status === "all" || n.status === status),
      ),
    [data, q, priority, status],
  );

  const cancelMut = useMutation({
    mutationFn: (id: string) => notificationsService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification cancelled");
    },
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => notificationsService.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification duplicated");
    },
  });

  return (
    <div>
      <PageHeader
        title="Notification Center"
        description="All notifications sent from MTI Alert."
        actions={
          <Button asChild>
            <Link to="/notifications/new"><Plus className="mr-1 h-4 w-4" /> New Notification</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Draft", "Scheduled", "Sending", "Sent", "Cancelled", "Failed"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No notifications</TableCell></TableRow>
                )}
                {filtered.map((n) => (
                  <TableRow key={n.id} className="cursor-pointer" onClick={() => nav({ to: "/notifications/$id", params: { id: n.id } })}>
                    <TableCell className="font-medium">{n.title}</TableCell>
                    <TableCell><PriorityBadge priority={n.priority} /></TableCell>
                    <TableCell>{n.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {n.targetType}{n.targetSite ? ` · ${n.targetSite}` : ""}{n.targetDepartment ? ` · ${n.targetDepartment}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">{n.channels.length}</TableCell>
                    <TableCell><StatusBadge status={n.status} /></TableCell>
                    <TableCell className="text-sm">{n.createdBy}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(n.createdAt), "dd MMM HH:mm")}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => nav({ to: "/notifications/$id", params: { id: n.id } })}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => dupMut.mutate(n.id)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={n.status !== "Scheduled"}
                            onClick={() => cancelMut.mutate(n.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
