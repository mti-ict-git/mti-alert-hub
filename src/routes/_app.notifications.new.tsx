import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { WhatsAppPreview } from "@/components/notifications/WhatsAppPreview";
import { DesktopPreview } from "@/components/notifications/DesktopPreview";
import { notificationsService } from "@/services/notifications.service";
import { referenceService } from "@/services/reference.service";
import { templatesService } from "@/services/templates.service";
import type { Category, Channel, Priority, TargetType, Template } from "@/types";
import { cn } from "@/lib/utils";
import { Siren } from "lucide-react";
import { toast } from "sonner";

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "DesktopAgent", label: "Desktop Agent" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Email", label: "Email" },
  { key: "DigitalSignage", label: "Digital Signage" },
];

const TARGET_TYPES: TargetType[] = ["All", "Site", "Area", "Department", "Section", "Employee"];

interface Search { template?: string }

export const Route = createFileRoute("/_app/notifications/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({ template: typeof s.template === "string" ? s.template : undefined }),
  component: CreateNotificationPage,
});

function CreateNotificationPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_app/notifications/new" });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: templatesService.list });
  const { data: organizationReference } = useQuery({
    queryKey: ["organization-reference"],
    queryFn: referenceService.getOrganizationReference,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employee-reference"],
    queryFn: referenceService.listEmployees,
  });
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === search.template),
    [search.template, templates],
  );

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>("Info");
  const [category, setCategory] = useState<Category>("General");
  const [targetType, setTargetType] = useState<TargetType>("All");
  const [site, setSite] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [channels, setChannels] = useState<Channel[]>(["DesktopAgent"]);
  const [requireAck, setRequireAck] = useState(false);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sites = organizationReference?.sites ?? [];
  const areas = organizationReference?.areas ?? [];
  const departments = organizationReference?.departments ?? [];
  const sections = organizationReference?.sections ?? [];

  // Prefill from template
  useEffect(() => {
    if (!search.template || templates.length === 0) return;
    const t = templates.find((x) => x.id === search.template);
    if (!t) return;
    setTitle(t.name);
    setMessage(t.defaultMessage);
    setInstruction(t.defaultInstruction);
    setPriority(t.priority);
    setCategory(t.category);
    setChannels(t.defaultChannels);
    setRequireAck(t.requireAck);
  }, [search.template, templates]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    const allowedTargetTypes = getAllowedAuthoringTargetTypes(selectedTemplate);
    if (!allowedTargetTypes.includes(targetType)) {
      const nextTargetType = allowedTargetTypes[0] ?? "All";
      setTargetType(nextTargetType);
      resetTargetSelections(nextTargetType);
    }
  }, [selectedTemplate, targetType]);

  // Critical authoring uses stronger defaults.
  useEffect(() => {
    if (priority === "Emergency" || priority === "Critical") {
      setChannels(["DesktopAgent", "WhatsApp", "Email", "DigitalSignage"]);
      setRequireAck(true);
    }
  }, [priority]);

  const isEmergency = priority === "Emergency" || priority === "Critical";
  const availableAreas = useMemo(
    () => areas.filter((item) => !site || item.siteId === site),
    [areas, site],
  );
  const availableDepartments = useMemo(
    () => departments.filter((item) => !site || item.siteId === site),
    [departments, site],
  );
  const availableSections = useMemo(
    () => sections.filter((item) => !department || item.departmentId === department),
    [department, sections],
  );
  const availableEmployees = useMemo(
    () =>
      employees.filter((item) => {
        if (site && item.siteId !== site) {
          return false;
        }

        if (area && item.areaId !== area) {
          return false;
        }

        if (department && item.departmentId !== department) {
          return false;
        }

        if (section && item.sectionId !== section) {
          return false;
        }

        return true;
      }),
    [area, department, employees, section, site],
  );
  const allowedTargetTypes = useMemo(
    () => (selectedTemplate ? getAllowedAuthoringTargetTypes(selectedTemplate) : TARGET_TYPES),
    [selectedTemplate],
  );

  const toggleChannel = (c: Channel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  function resetTargetSelections(nextTargetType: TargetType) {
    if (nextTargetType !== "Site") {
      setSite("");
    }

    if (nextTargetType !== "Area") {
      setArea("");
    }

    if (nextTargetType !== "Department" && nextTargetType !== "Section") {
      setDepartment("");
    }

    if (nextTargetType !== "Section") {
      setSection("");
    }

    if (nextTargetType !== "Employee") {
      setEmployeeId("");
    }
  }

  const createMut = useMutation({
    mutationFn: notificationsService.create,
    onSuccess: async (n) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification", n.id] });
      try {
        const preview = await notificationsService.audiencePreview(n.id);
        toast.success(
          `${scheduleLater ? "Draft tersimpan" : "Draft created"} · ${preview.totalRecipients} recipients resolved`,
        );
      } catch {
        toast.success(scheduleLater ? "Draft tersimpan" : "Draft created");
      }
      nav({ to: "/notifications/$id", params: { id: n.id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create draft");
    },
  });

  function submit() {
    createMut.mutate({
      title,
      message,
      communicationType: selectedTemplate?.communicationType,
      priority,
      category,
      templateId: search.template,
      targetType,
      targetSite: site || undefined,
      targetArea: area || undefined,
      targetDepartment: department || undefined,
      targetSection: section || undefined,
      targetEmployeeId: employeeId || undefined,
      channels,
      requireAck,
      instruction,
      scheduledAt: scheduleLater && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      scheduleLater,
    });
  }

  const hasRequiredTargetSelection =
    targetType === "All" ||
    (targetType === "Site" && Boolean(site)) ||
    (targetType === "Area" && Boolean(area)) ||
    (targetType === "Department" && Boolean(department)) ||
    (targetType === "Section" && Boolean(section)) ||
    (targetType === "Employee" && Boolean(employeeId));
  const canSubmit = title && message && channels.length > 0 && hasRequiredTargetSelection;

  return (
    <div>
      <PageHeader title="Create Notification" description="Compose an emergency or operational notification." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className={cn("lg:col-span-2", isEmergency && "border-emergency border-2")}>
          {isEmergency && (
            <div className="flex items-center gap-2 rounded-t-xl bg-emergency px-4 py-2 text-emergency-foreground emergency-pulse">
              <Siren className="h-4 w-4" />
              <span className="text-sm font-semibold uppercase tracking-wider">Critical Notification Draft</span>
            </div>
          )}
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fire Alarm at Acid Plant" />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the situation clearly and concisely." />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Info">Info</SelectItem>
                    <SelectItem value="Warning">Warning</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["IT", "OHSE", "Security", "Operation", "HR", "General"] as Category[]).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Type</Label>
              <RadioGroup
                value={targetType}
                onValueChange={(value) => {
                  const nextTargetType = value as TargetType;
                  setTargetType(nextTargetType);
                  resetTargetSelections(nextTargetType);
                }}
                className="grid grid-cols-2 gap-2 md:grid-cols-3"
              >
                {allowedTargetTypes.map((t) => (
                  <Label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <RadioGroupItem value={t} /> {t}
                  </Label>
                ))}
              </RadioGroup>
              {selectedTemplate?.allowedTargetTypes?.length ? (
                <p className="text-xs text-muted-foreground">
                  Template policy allows: {allowedTargetTypes.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Site</Label>
                <Select
                  value={site}
                  onValueChange={(value) => {
                    setSite(value);
                    setArea("");
                  }}
                  disabled={targetType !== "Site" && targetType !== "Area"}
                >
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {sites.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Area</Label>
                <Select
                  value={area}
                  onValueChange={setArea}
                  disabled={targetType !== "Area"}
                >
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {availableAreas.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
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
                  value={department}
                  onValueChange={(value) => {
                    setDepartment(value);
                    setSection("");
                  }}
                  disabled={targetType !== "Department" && targetType !== "Section"}
                >
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {availableDepartments.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Section</Label>
                <Select
                  value={section}
                  onValueChange={setSection}
                  disabled={targetType !== "Section" || !department}
                >
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {availableSections.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Employee</Label>
                <Select
                  value={employeeId}
                  onValueChange={setEmployeeId}
                  disabled={targetType !== "Employee"}
                >
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.employeeNumber} - {item.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {CHANNELS.map((c) => (
                  <Label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <Checkbox checked={channels.includes(c.key)} onCheckedChange={() => toggleChannel(c.key)} disabled={isEmergency} />
                    {c.label}
                  </Label>
                ))}
              </div>
              {isEmergency && (
                <p className="text-xs text-emergency">Critical priority auto-enables all channels.</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Require Acknowledgement</Label>
                <p className="text-xs text-muted-foreground">Recipients must confirm they received the notification.</p>
              </div>
              <Switch checked={requireAck} onCheckedChange={setRequireAck} />
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <Label>Schedule</Label>
              <RadioGroup value={scheduleLater ? "later" : "now"} onValueChange={(v) => setScheduleLater(v === "later")} className="flex gap-4">
                <Label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="now" /> Send Now
                </Label>
                <Label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="later" /> Schedule Later
                </Label>
              </RadioGroup>
              {scheduleLater && (
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="max-w-xs" />
              )}
              <p className="text-xs text-muted-foreground">
                Publish scheduling belum aktif di backend Phase 1, jadi form ini saat ini menyimpan draft authoring.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Instruction</Label>
              <Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="What should recipients do?" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => nav({ to: "/notifications" })}>Cancel</Button>
              <Button disabled={!canSubmit} onClick={() => setConfirmOpen(true)} className={cn(isEmergency && "bg-emergency hover:bg-emergency/90 text-emergency-foreground")}>
                {scheduleLater ? "Save Draft" : isEmergency ? "Create Critical Draft" : "Create Draft"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Previews</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {channels.includes("WhatsApp") && (
                <WhatsAppPreview title={title} priority={priority} site={site} instruction={instruction} />
              )}
              {channels.includes("DesktopAgent") && (
                <DesktopPreview title={title} message={message} priority={priority} instruction={instruction} />
              )}
              {channels.length === 0 && <p className="text-sm text-muted-foreground">Select at least one channel to see previews.</p>}
              {!channels.includes("WhatsApp") && !channels.includes("DesktopAgent") && channels.length > 0 && (
                <p className="text-sm text-muted-foreground">No visual preview for the selected channels.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEmergency ? "Confirm Critical Draft" : "Confirm Draft Creation"}</DialogTitle>
            <DialogDescription>
              {isEmergency
                ? "This will create a critical communication draft with stronger defaults for later publishing."
                : `You are about to create a communication draft using ${channels.length} channel(s).`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{title}</div>
            <p className="mt-1 text-muted-foreground">{message}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              className={cn(isEmergency && "bg-emergency hover:bg-emergency/90 text-emergency-foreground")}
              onClick={() => { setConfirmOpen(false); submit(); }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAllowedAuthoringTargetTypes(template: Template): TargetType[] {
  const allowedTargetTypes = template.allowedTargetTypes?.filter((targetType): targetType is TargetType =>
    TARGET_TYPES.includes(targetType),
  );

  return allowedTargetTypes && allowedTargetTypes.length > 0 ? allowedTargetTypes : TARGET_TYPES;
}
