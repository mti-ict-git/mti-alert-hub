import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Eye, MoreHorizontal, Pencil, Plus, XCircle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { notificationsService } from "@/services/notifications.service";
import type { Notification, NotificationStatus } from "@/types";
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
  const [view, setView] = useState<CenterView>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      data.filter(
        (n) =>
          (!q || n.title.toLowerCase().includes(q.toLowerCase())) &&
          (priority === "all" || n.priority === priority) &&
          (status === "all" || n.status === status) &&
          matchesCenterView(n, view),
      ),
    [data, q, priority, status, view],
  );
  const visibleSelectedIds = selectedIds.filter((id) => filtered.some((item) => item.id === id));
  const selectedNotifications = filtered.filter((item) => visibleSelectedIds.includes(item.id));
  const selectableCount = filtered.length;
  const allSelected = selectableCount > 0 && visibleSelectedIds.length === selectableCount;
  const hasSelection = visibleSelectedIds.length > 0;
  const selectedCancellableIds = selectedNotifications
    .filter((item) => CANCELLABLE_STATUSES.includes(item.status))
    .map((item) => item.id);
  const hasSelectedCancellable = selectedCancellableIds.length > 0;

  const cancelMut = useMutation({
    mutationFn: (id: string) => notificationsService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification cancelled");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel communication");
    },
  });
  const bulkCancelMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => notificationsService.cancel(id)));
    },
    onSuccess: async (_, ids) => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      toast.success(`${ids.length} notification${ids.length > 1 ? "s" : ""} cancelled`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel selected communications");
    },
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => notificationsService.duplicate(id),
    onSuccess: (duplicated) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification duplicated");
      nav({ to: "/notifications/$id", params: { id: duplicated.id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate communication");
    },
  });
  const bulkDuplicateMut = useMutation({
    mutationFn: async (items: Notification[]) => Promise.all(items.map((item) => notificationsService.duplicate(item.id))),
    onSuccess: async (duplicated) => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      setSelectedIds([]);
      toast.success(`${duplicated.length} notification${duplicated.length > 1 ? "s" : ""} duplicated as new`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate selected drafts");
    },
  });

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    );
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) {
        return current.filter((id) => !filtered.some((item) => item.id === id));
      }

      return Array.from(new Set([...current, ...filtered.map((item) => item.id)]));
    });
  }

  function clearSelection() {
    setSelectedIds((current) => current.filter((id) => !filtered.some((item) => item.id === id)));
  }

  function openEdit(id: string) {
    nav({ to: "/notifications/$id", params: { id }, search: { mode: "edit" } });
  }

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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={view} onValueChange={(value) => setView(value as CenterView)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="drafts">Drafts</TabsTrigger>
                <TabsTrigger value="live">Scheduled / Live</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="text-sm text-muted-foreground">
              One-time and recurring notifications stay in Notification Center for monitoring,
              cancel, duplicate, and draft editing.
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="Emergency">Critical</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Draft", "Scheduled", "Sending", "Queued", "Active", "Completed", "Cancelled", "Failed"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasSelection && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
              <div className="text-sm font-medium">
                {visibleSelectedIds.length} selected
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkDuplicateMut.isPending}
                onClick={() => bulkDuplicateMut.mutate(selectedNotifications)}
              >
                <Copy className="mr-2 h-4 w-4" /> Duplicate as New
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasSelectedCancellable || bulkCancelMut.isPending}
                onClick={() => bulkCancelMut.mutate(selectedCancellableIds)}
              >
                <XCircle className="mr-2 h-4 w-4" /> Cancel Selected
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <div className="text-xs text-muted-foreground">
                Bulk actions stay lifecycle-aware: duplicate creates new drafts, while cancel stays
                limited to scheduled or in-progress notifications and skips anything else.
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      aria-label="Select all visible notifications"
                    />
                  </TableHead>
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
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No notifications</TableCell></TableRow>
                )}
                {filtered.map((n) => (
                  <TableRow key={n.id} className="cursor-pointer" onClick={() => nav({ to: "/notifications/$id", params: { id: n.id } })}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={visibleSelectedIds.includes(n.id)}
                        onCheckedChange={(checked) => toggleSelection(n.id, checked === true)}
                        aria-label={`Select ${n.title}`}
                      />
                    </TableCell>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ${n.title}`}
                          onClick={() => nav({ to: "/notifications/$id", params: { id: n.id } })}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          <span>View</span>
                        </Button>
                        {n.status === "Draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit draft ${n.title}`}
                            onClick={() => openEdit(n.id)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit Draft</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Duplicate ${n.title}`}
                          disabled={dupMut.isPending}
                          onClick={() => dupMut.mutate(n.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Duplicate</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`More actions for ${n.title}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => nav({ to: "/notifications/$id", params: { id: n.id } })}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={n.status !== "Draft"}
                            onClick={() => openEdit(n.id)}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit Draft
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => dupMut.mutate(n.id)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate as New
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!["Scheduled", "Queued", "Sending", "Active"].includes(n.status)}
                            onClick={() => cancelMut.mutate(n.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Cancel
                          </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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

type CenterView = "all" | "drafts" | "live" | "history";

const LIVE_STATUSES: NotificationStatus[] = ["Scheduled", "Queued", "Sending", "Active"];
const HISTORY_STATUSES: NotificationStatus[] = ["Completed", "Cancelled", "Failed", "Sent"];
const CANCELLABLE_STATUSES: NotificationStatus[] = ["Scheduled", "Queued", "Sending", "Active"];

function matchesCenterView(notification: Notification, view: CenterView) {
  if (view === "drafts") {
    return notification.status === "Draft";
  }

  if (view === "live") {
    return LIVE_STATUSES.includes(notification.status);
  }

  if (view === "history") {
    return HISTORY_STATUSES.includes(notification.status);
  }

  return true;
}
