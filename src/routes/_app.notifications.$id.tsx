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
import { notificationsService } from "@/services/notifications.service";
import { referenceService } from "@/services/reference.service";
import type { Category, Channel, Notification, TargetType } from "@/types";
import { format } from "date-fns";
import { AlertTriangle, MonitorSmartphone, MessageSquare, Pencil, Rocket, Users, XCircle } from "lucide-react";
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
  const { data: organizationReference } = useQuery({
    queryKey: ["organization-reference"],
    queryFn: referenceService.getOrganizationReference,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employee-reference"],
    queryFn: referenceService.listEmployees,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<EditDraftForm | null>(null);
  const [publishMode, setPublishMode] = useState<"Now" | "Scheduled">("Now");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [publishTimezone, setPublishTimezone] = useState(getLocalTimeZone());
  const sites = organizationReference?.sites ?? [];
  const areas = organizationReference?.areas ?? [];
  const departments = organizationReference?.departments ?? [];
  const sections = organizationReference?.sections ?? [];
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
          targetArea: payload.targetArea || undefined,
          targetDepartment: payload.targetDepartment || undefined,
          targetSection: payload.targetSection || undefined,
          targetEmployeeId: payload.targetEmployeeId || undefined,
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
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (publishMode === "Scheduled") {
        const scheduledAtIso = normalizeScheduledDateTime(scheduledPublishAt);
        return notificationsService.publish(id, {
          publishMode: "Scheduled",
          scheduledAt: scheduledAtIso,
          timezone: publishTimezone.trim(),
          confirmedPreview: true,
        });
      }

      return notificationsService.publish(id, {
        publishMode: "Now",
        confirmedPreview: true,
      });
    },
    onSuccess: async (updated) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
        qc.invalidateQueries({ queryKey: ["audience-preview", id] }),
      ]);
      setPublishOpen(false);
      toast.success(
        updated.status === "Scheduled"
          ? "Communication scheduled"
          : "Communication queued for Windows Agent delivery",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to publish communication");
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => notificationsService.cancel(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["notification", id] }),
      ]);
      setCancelOpen(false);
      toast.success("Communication cancelled");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to cancel communication");
    },
  });
  const previewRecipients = audiencePreview?.recipients ?? [];
  const availableSections = useMemo(
    () => sections.filter((item) => !draftForm?.targetDepartment || item.departmentId === draftForm.targetDepartment),
    [draftForm?.targetDepartment, sections],
  );
  const availableAreas = useMemo(
    () => areas.filter((item) => !draftForm?.targetSite || item.siteId === draftForm.targetSite),
    [areas, draftForm?.targetSite],
  );
  const availableDepartments = useMemo(
    () => departments.filter((item) => !draftForm?.targetSite || item.siteId === draftForm.targetSite),
    [departments, draftForm?.targetSite],
  );
  const availableEmployees = useMemo(
    () =>
      employees.filter((item) => {
        if (draftForm?.targetSite && item.siteId !== draftForm.targetSite) {
          return false;
        }

        if (draftForm?.targetArea && item.areaId !== draftForm.targetArea) {
          return false;
        }

        if (draftForm?.targetDepartment && item.departmentId !== draftForm.targetDepartment) {
          return false;
        }

        if (draftForm?.targetSection && item.sectionId !== draftForm.targetSection) {
          return false;
        }

        return true;
      }),
    [
      draftForm?.targetArea,
      draftForm?.targetDepartment,
      draftForm?.targetSection,
      draftForm?.targetSite,
      employees,
    ],
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
  const canCancel = ["Scheduled", "Queued", "Sending", "Active"].includes(n.status);
  const canPublish = isDraft;
  const scheduledPublishInvalid =
    publishMode === "Scheduled" &&
    (!scheduledPublishAt.trim() || !publishTimezone.trim());

  function openEditDialog() {
    setDraftForm({
      title: n.title,
      message: n.message,
      category: n.category,
      targetType: normalizeEditableTargetType(n.targetType),
      targetSite: n.targetSite ?? "",
      targetArea: n.targetArea ?? "",
      targetDepartment: n.targetDepartment ?? "",
      targetSection: n.targetSection ?? "",
      targetEmployeeId: n.targetEmployeeId ?? "",
      channels: n.channels.filter(isEditableChannel),
      requireAck: n.requireAck,
      instruction: n.instruction ?? "",
    });
    setEditOpen(true);
  }

  function openPublishDialog() {
    setPublishMode("Now");
    setScheduledPublishAt("");
    setPublishTimezone(getLocalTimeZone());
    setPublishOpen(true);
  }

  return (
    <div>
      <PageHeader
        title={n.title}
        description={buildNotificationDescription(n)}
        actions={
          <>
            {canPublish && (
              <Button size="sm" onClick={openPublishDialog}>
                <Rocket className="mr-2 h-4 w-4" /> Publish
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
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
                        targetSite: value === "Site" || value === "Area" ? draftForm.targetSite : "",
                        targetArea: value === "Area" ? draftForm.targetArea : "",
                        targetDepartment: value === "Department" || value === "Section"
                          ? draftForm.targetDepartment
                          : "",
                        targetSection: value === "Section" ? draftForm.targetSection : "",
                        targetEmployeeId: value === "Employee" ? draftForm.targetEmployeeId : "",
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Site</Label>
                  <Select
                    value={draftForm.targetSite}
                    onValueChange={(value) =>
                      setDraftForm({ ...draftForm, targetSite: value, targetArea: "" })
                    }
                    disabled={draftForm.targetType !== "Site" && draftForm.targetType !== "Area"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.code} - {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Area</Label>
                  <Select
                    value={draftForm.targetArea}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetArea: value })}
                    disabled={draftForm.targetType !== "Area"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                    <SelectContent>
                      {availableAreas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                      {availableDepartments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
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
                        <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Employee</Label>
                  <Select
                    value={draftForm.targetEmployeeId}
                    onValueChange={(value) => setDraftForm({ ...draftForm, targetEmployeeId: value })}
                    disabled={draftForm.targetType !== "Employee"}
                  >
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {availableEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.employeeNumber} - {employee.fullName}
                        </SelectItem>
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
                !hasRequiredTargetSelection(draftForm) ||
                updateDraftMutation.isPending
              }
            >
              {updateDraftMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Communication</DialogTitle>
            <DialogDescription>
              This confirms the latest audience preview and sends the draft into the live delivery flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Publish Mode</Label>
              <RadioGroup
                value={publishMode}
                onValueChange={(value) => setPublishMode(value as "Now" | "Scheduled")}
                className="grid grid-cols-1 gap-2"
              >
                <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="Now" />
                  Publish now and queue delivery immediately
                </Label>
                <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="Scheduled" />
                  Schedule for a specific future time
                </Label>
              </RadioGroup>
            </div>

            {publishMode === "Scheduled" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Scheduled At</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledPublishAt}
                    onChange={(event) => setScheduledPublishAt(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The backend requires a future timestamp with timezone context.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={publishTimezone}
                    onChange={(event) => setPublishTimezone(event.target.value)}
                    placeholder="e.g. Asia/Jakarta"
                  />
                </div>
              </div>
            )}

            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{n.title}</div>
              <p className="mt-1 text-muted-foreground">{n.message}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                By continuing, the operator confirms the latest audience preview and allows the backend to create delivery jobs for the selected channels.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || scheduledPublishInvalid}
            >
              {publishMutation.isPending
                ? "Publishing..."
                : publishMode === "Scheduled"
                  ? "Schedule"
                  : "Publish Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Communication</DialogTitle>
            <DialogDescription>
              This stops future delivery for the current communication and marks pending Windows Agent jobs as cancelled in backend tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{n.title}</div>
            <p className="mt-1 text-muted-foreground">
              Current status: {n.status}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancel"}
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

type EditableTargetType = "All" | "Site" | "Area" | "Department" | "Section" | "Employee";

type EditDraftForm = {
  title: string;
  message: string;
  category: Category;
  targetType: EditableTargetType;
  targetSite: string;
  targetArea: string;
  targetDepartment: string;
  targetSection: string;
  targetEmployeeId: string;
  channels: Channel[];
  requireAck: boolean;
  instruction: string;
};

const EDITABLE_TARGET_TYPES: EditableTargetType[] = [
  "All",
  "Site",
  "Area",
  "Department",
  "Section",
  "Employee",
];
const EDITABLE_CHANNELS: Array<{ key: Channel; label: string }> = [
  { key: "DesktopAgent", label: "Desktop Agent" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Email", label: "Email" },
  { key: "DigitalSignage", label: "Digital Signage" },
];

function normalizeEditableTargetType(targetType: Notification["targetType"]): EditableTargetType {
  if (
    targetType === "Site" ||
    targetType === "Area" ||
    targetType === "Department" ||
    targetType === "Section" ||
    targetType === "Employee"
  ) {
    return targetType;
  }

  return "All";
}

function isEditableChannel(channel: Notification["channels"][number]): channel is Channel {
  return EDITABLE_CHANNELS.some((candidate) => candidate.key === channel);
}

function hasRequiredTargetSelection(form: EditDraftForm) {
  if (form.targetType === "All") {
    return true;
  }

  if (form.targetType === "Site") {
    return Boolean(form.targetSite);
  }

  if (form.targetType === "Area") {
    return Boolean(form.targetArea);
  }

  if (form.targetType === "Department") {
    return Boolean(form.targetDepartment);
  }

  if (form.targetType === "Section") {
    return Boolean(form.targetSection);
  }

  if (form.targetType === "Employee") {
    return Boolean(form.targetEmployeeId);
  }

  return false;
}

function buildNotificationDescription(notification: Notification) {
  const parts = [notification.category, notification.targetType];

  if (notification.targetSite) {
    parts.push(notification.targetSite);
  } else if (notification.targetArea) {
    parts.push(notification.targetArea);
  } else if (notification.targetDepartment) {
    parts.push(notification.targetDepartment);
  } else if (notification.targetSection) {
    parts.push(notification.targetSection);
  } else if (notification.targetEmployeeId) {
    parts.push(notification.targetEmployeeId);
  }

  return parts.join(" · ");
}

function normalizeScheduledDateTime(value: string) {
  const scheduledDate = new Date(value);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Scheduled publish requires a valid date and time.");
  }

  return scheduledDate.toISOString();
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
