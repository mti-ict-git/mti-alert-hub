import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DEPARTMENTS, SECTIONS, SITES } from "@/data/reference";
import { notificationsService } from "@/services/notifications.service";
import type { Category, Channel, Notification, TargetType } from "@/types";
import { format } from "date-fns";
import { AlertTriangle, MonitorSmartphone, MessageSquare, Pencil, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications/$id")({
  component: NotificationDetailPage,
});

function NotificationDetailPage() {
  const { id } = useParams({ from: "/_app/notifications/$id" });
  const qc = useQueryClient();
  const { data: n } = useQuery({ queryKey: ["notification", id], queryFn: () => notificationsService.get(id) });
  const { data: recipients = [] } = useQuery({ queryKey: ["recipients", id], queryFn: () => notificationsService.recipients(id) });
  const { data: logs = [] } = useQuery({ queryKey: ["logs", id], queryFn: () => notificationsService.deliveryLogs(id) });
  const { data: audiencePreview } = useQuery({
    queryKey: ["audience-preview", id],
    queryFn: () => notificationsService.audiencePreview(id),
  });
  const [editOpen, setEditOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<EditDraftForm | null>(null);
  const updateDraftMutation = useMutation({
    mutationFn: (payload: EditDraftForm) =>
      {
        if (!n) {
          throw new Error("Draft detail is still loading.");
        }

        return notificationsService.update(id, {
          title: payload.title,
          message: payload.message,
          category: payload.category,
          targetType: payload.targetType,
          targetSite: payload.targetSite || undefined,
          targetDepartment: payload.targetDepartment || undefined,
          targetSection: payload.targetSection || undefined,
          channels: payload.channels,
          requireAck: payload.requireAck,
          instruction: payload.instruction,
          priority: n.priority,
        });
      },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
        qc.invalidateQueries({ queryKey: ["audience-preview", id] }),
      ]);
      setEditOpen(false);
      toast.success("Draft updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update draft");
    },
  });
  const previewRecipients = audiencePreview?.recipients ?? [];
  const availableSections = useMemo(
    () => (draftForm?.targetDepartment ? SECTIONS[draftForm.targetDepartment] ?? [] : []),
    [draftForm?.targetDepartment],
  );
  const ackCounts = {
    Safe: recipients.filter((r) => r.ackStatus === "Safe").length,
    NeedAssistance: recipients.filter((r) => r.ackStatus === "NeedAssistance").length,
    NotInArea: recipients.filter((r) => r.ackStatus === "NotInArea").length,
    Acknowledged: recipients.filter((r) => r.ackStatus === "Acknowledged").length,
    NoResponse: recipients.filter((r) => r.ackStatus === "NoResponse").length,
  };

  if (!n) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const isDraft = n.status === "Draft";

  function openEditDialog() {
    setDraftForm({
      title: n.title,
      message: n.message,
      category: n.category,
      targetType: normalizeEditableTargetType(n.targetType),
      targetSite: n.targetSite ?? "",
      targetDepartment: n.targetDepartment ?? "",
      targetSection: n.targetSection ?? "",
      channels: n.channels.filter(isEditableChannel),
      requireAck: n.requireAck,
      instruction: n.instruction ?? "",
    });
    setEditOpen(true);
  }

  return (
    <div>
      <PageHeader
        title={n.title}
        description={`${n.category} · ${n.targetType}${n.targetSite ? ` · ${n.targetSite}` : ""}`}
        actions={
          <>
            {isDraft && (
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Draft
              </Button>
            )}
            <PriorityBadge priority={n.priority} />
            <StatusBadge status={n.status} />
          </>
        }
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Draft</DialogTitle>
            <DialogDescription>
              Update the draft fields that are already supported by the Phase 1 backend.
            </DialogDescription>
          </DialogHeader>
          {draftForm && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={draftForm.title}
                  onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  value={draftForm.message}
                  onChange={(event) => setDraftForm({ ...draftForm, message: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={draftForm.category}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, category: value as Category })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["IT", "OHSE", "Security", "Operation", "HR", "General"] as Category[]).map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Type</Label>
                  <RadioGroup
                    value={draftForm.targetType}
                    onValueChange={(value) =>
                      setDraftForm({
                        ...draftForm,
                        targetType: value as EditableTargetType,
                        targetSite: value === "Site" ? draftForm.targetSite : "",
                        targetDepartment: value === "Department" || value === "Section"
                          ? draftForm.targetDepartment
                          : "",
                        targetSection: value === "Section" ? draftForm.targetSection : "",
                      })
                    }
                    className="grid grid-cols-2 gap-2"
                  >
                    {EDITABLE_TARGET_TYPES.map((targetType) => (
                      <Label
                        key={targetType}
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                      >
                        <RadioGroupItem value={targetType} />
                        {targetType}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Target Site</Label>
                  <Select
                    value={draftForm.targetSite}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetSite: value })}
                    disabled={draftForm.targetType !== "Site"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      {SITES.map((site) => <SelectItem key={site} value={site}>{site}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Department</Label>
                  <Select
                    value={draftForm.targetDepartment}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, targetDepartment: value, targetSection: "" })
                    }
                    disabled={draftForm.targetType !== "Department" && draftForm.targetType !== "Section"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((department) => (
                        <SelectItem key={department} value={department}>{department}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Section</Label>
                  <Select
                    value={draftForm.targetSection}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetSection: value })}
                    disabled={draftForm.targetType !== "Section" || !draftForm.targetDepartment}
                  >
                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      {availableSections.map((section) => (
                        <SelectItem key={section} value={section}>{section}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Channels</Label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {EDITABLE_CHANNELS.map((channel) => (
                    <Label
                      key={channel.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <Checkbox
                        checked={draftForm.channels.includes(channel.key)}
                        onCheckedChange={() =>
                          setDraftForm({
                            ...draftForm,
                            channels: draftForm.channels.includes(channel.key)
                              ? draftForm.channels.filter((value) => value !== channel.key)
                              : [...draftForm.channels, channel.key],
                          })
                        }
                      />
                      {channel.label}
                    </Label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Instruction</Label>
                <Textarea
                  rows={3}
                  value={draftForm.instruction}
                  onChange={(event) =>
                    setDraftForm({ ...draftForm, instruction: event.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Require Acknowledgement</Label>
                  <p className="text-xs text-muted-foreground">
                    This updates the workflow requirement that is already supported by the current draft API.
                  </p>
                </div>
                <Checkbox
                  checked={draftForm.requireAck}
                  onCheckedChange={(checked) =>
                    setDraftForm({ ...draftForm, requireAck: checked === true })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => draftForm && updateDraftMutation.mutate(draftForm)}
              disabled={
                !draftForm ||
                !draftForm.title.trim() ||
                !draftForm.message.trim() ||
                draftForm.channels.length === 0 ||
                updateDraftMutation.isPending
              }
            >
              {updateDraftMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

type EditableTargetType = "All" | "Site" | "Department" | "Section";

type EditDraftForm = {
  title: string;
  message: string;
  category: Category;
  targetType: EditableTargetType;
  targetSite: string;
  targetDepartment: string;
  targetSection: string;
  channels: Channel[];
  requireAck: boolean;
  instruction: string;
};

const EDITABLE_TARGET_TYPES: EditableTargetType[] = ["All", "Site", "Department", "Section"];
const EDITABLE_CHANNELS: Array<{ key: Channel; label: string }> = [
  { key: "DesktopAgent", label: "Desktop Agent" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Email", label: "Email" },
  { key: "DigitalSignage", label: "Digital Signage" },
];

function normalizeEditableTargetType(targetType: Notification["targetType"]): EditableTargetType {
  if (targetType === "Site" || targetType === "Department" || targetType === "Section") {
    return targetType;
  }

  return "All";
}

function isEditableChannel(channel: Notification["channels"][number]): channel is Channel {
  return EDITABLE_CHANNELS.some((candidate) => candidate.key === channel);
}
