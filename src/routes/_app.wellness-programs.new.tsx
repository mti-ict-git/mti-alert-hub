import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DesktopPreview } from "@/components/notifications/DesktopPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { devicesService } from "@/services/devices.service";
import { notificationsService } from "@/services/notifications.service";
import {
  getWellnessTemplate,
  inferWellnessTemplateKey,
  listWellnessTemplates,
  type WellnessTemplateKey,
} from "@/lib/wellness-template-catalog";

export const Route = createFileRoute("/_app/wellness-programs/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    draftId: typeof search.draftId === "string" ? search.draftId : undefined,
  }),
  component: CreateWellnessProgramPage,
});

function CreateWellnessProgramPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_app/wellness-programs/new" });
  const queryClient = useQueryClient();
  const templates = listWellnessTemplates();
  const editingDraftId = search.draftId?.trim() || undefined;
  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: devicesService.list,
  });
  const { data: editingDraft, isLoading: isEditingDraftLoading } = useQuery({
    queryKey: ["notification", editingDraftId],
    queryFn: () => notificationsService.get(editingDraftId!),
    enabled: Boolean(editingDraftId),
  });

  const [templateKey, setTemplateKey] = useState<WellnessTemplateKey | "">("");
  const [deviceId, setDeviceId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [timezone, setTimezone] = useState(getLocalTimeZone());
  const [recurrenceRule, setRecurrenceRule] = useState("FREQ=DAILY;INTERVAL=1");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [initializedDraftId, setInitializedDraftId] = useState<string | null>(null);
  const isEditMode = Boolean(editingDraftId);
  const hasValidEditableDraft = !editingDraftId || Boolean(editingDraft?.wellnessProgram);
  const selectedTemplate = templateKey ? getWellnessTemplate(templateKey) : null;

  useEffect(() => {
    if (!editingDraftId || !editingDraft || !editingDraft.wellnessProgram) {
      return;
    }

    if (initializedDraftId === editingDraftId) {
      return;
    }

    setTemplateKey(inferWellnessTemplateKey(editingDraft) ?? "");
    setDeviceId(editingDraft.targetDeviceId ?? "");
    setScheduledAt(editingDraft.reminderSchedule?.scheduledAt ? toDateTimeLocalInput(editingDraft.reminderSchedule.scheduledAt) : "");
    setValidUntil(editingDraft.reminderSchedule?.validUntil ? toDateTimeLocalInput(editingDraft.reminderSchedule.validUntil) : "");
    setTimezone(editingDraft.reminderSchedule?.timezone ?? getLocalTimeZone());
    setRecurrenceRule(editingDraft.reminderSchedule?.recurrenceRule ?? "FREQ=DAILY;INTERVAL=1");
    setInitializedDraftId(editingDraftId);
  }, [editingDraft, editingDraftId, initializedDraftId]);

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof notificationsService.create>[0]) =>
      isEditMode && editingDraftId
        ? notificationsService.update(editingDraftId, payload)
        : notificationsService.create(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["wellness-programs"] }),
        ...(editingDraftId ? [queryClient.invalidateQueries({ queryKey: ["notification", editingDraftId] })] : []),
      ]);
      toast.success(isEditMode ? "Wellness draft updated" : "Wellness program draft created");
      navigate({ to: "/wellness-programs" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : isEditMode
        ? "Failed to update wellness program draft"
        : "Failed to create wellness program draft");
    },
  });

  const hasValidSchedule = isValidWellnessSchedule({
    scheduledAt,
    validUntil,
    timezone,
    recurrenceRule,
  });
  const canSubmit =
    hasValidEditableDraft &&
    Boolean(selectedTemplate) &&
    Boolean(deviceId) &&
    hasValidSchedule;

  function submit() {
    if (!selectedTemplate) {
      return;
    }

    createMutation.mutate({
      title: selectedTemplate.title,
      message: selectedTemplate.message,
      instruction: selectedTemplate.instruction,
      communicationType: "Reminder",
      priority: "Info",
      category: "OHSE",
      targetType: "Device",
      targetDeviceId: deviceId,
      channels: ["DesktopAgent"],
      windowsAgentPresentation: "Toast",
      toastAutoDismissSeconds: null,
      requireAck: false,
      workflowId: null,
      reminderSchedule: buildWellnessReminderSchedule({
        scheduledAt,
        validUntil,
        timezone,
        recurrenceRule,
      }),
      wellnessProgram: selectedTemplate.wellnessProgram,
    });
  }

  if (isEditMode && isEditingDraftLoading) {
    return <div className="p-6 text-muted-foreground">Loading wellness draft...</div>;
  }

  if (isEditMode && !hasValidEditableDraft) {
    return (
      <div className="space-y-4 p-6">
        <div className="text-sm text-muted-foreground">
          This draft is not a wellness program, or it could not be loaded from the reminder-backed contract.
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/wellness-programs" })}>
          Back To Wellness Programs
        </Button>
      </div>
    );
  }

  if (isEditMode && editingDraft && !templateKey) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This draft uses a legacy custom wellness shape that does not map cleanly to the locked
          template catalog. Create or duplicate a new template-driven draft to continue testing the
          stable agent path.
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/wellness-programs" })}>
          Back To Wellness Programs
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEditMode ? "Edit Wellness Program" : "Create Wellness Program"}
        description={
          isEditMode
            ? "Update the dedicated wellness draft using the locked template catalog so the agent surface stays predictable."
            : "Pick one locked wellness template so the agent surface stays predictable during testing."
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5 p-6">
            <div className="rounded-md border border-sky-200 bg-sky-50/70 p-4">
              <div className="text-sm font-medium">Template-Driven Wellness Authoring</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Wellness Programs now use a locked template catalog so layout, CTA placement, and
                copy length remain safe for the Windows Agent popup. Operators choose the template,
                target, and schedule here instead of editing freeform card content.
              </p>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <div className="text-sm font-medium">Wellness Template</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose the approved template family first. Copy, layout, actions, and step
                  structure are locked to keep the WPF popup stable.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={templateKey} onValueChange={(value) => setTemplateKey(value as WellnessTemplateKey)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wellness template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="text-sm font-medium">{selectedTemplate.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <TemplateReadOnlyField label="Title" value={selectedTemplate.title} />
                    <TemplateReadOnlyField label="Summary" value={selectedTemplate.message} />
                    <TemplateReadOnlyField label="Instruction" value={selectedTemplate.instruction} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <TemplateMetaRow
                      label="Layout"
                      value={`${selectedTemplate.wellnessProgram.programType} · ${selectedTemplate.wellnessProgram.layoutVariant}`}
                    />
                    <TemplateMetaRow
                      label="Actions"
                      value={selectedTemplate.wellnessProgram.actions.map((action) => action.label).join(" · ")}
                    />
                    <TemplateMetaRow
                      label="Theme"
                      value={`${selectedTemplate.family} · ${selectedTemplate.wellnessProgram.theme}`}
                    />
                    <TemplateMetaRow
                      label="Step Count"
                      value={`${selectedTemplate.wellnessProgram.steps?.length ?? 0} step(s)`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <div className="text-sm font-medium">Schedule And Assignment</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  MVP wellness programs stay on the local Windows Agent routine path, so execution mode
                  remains `AgentLocalRoutine` and the first controlled assignment is device-bound.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Occurrence</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Leave empty to let the routine start as soon as it is published.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required so the synchronized local policy remains bounded.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="e.g. Asia/Jakarta"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Execution Mode</Label>
                  <Input value="AgentLocalRoutine" disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recurrence Rule</Label>
                <Input
                  value={recurrenceRule}
                  onChange={(event) => setRecurrenceRule(event.target.value)}
                  placeholder="e.g. FREQ=DAILY;INTERVAL=1"
                />
                <p className="text-xs text-muted-foreground">
                  Use an RFC5545-style recurrence rule. Example: `FREQ=DAILY;INTERVAL=1`.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Target Device</Label>
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.deviceId}>
                        {device.deviceId} - {device.hostname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate({ to: "/wellness-programs" })}>
                Cancel
              </Button>
              <Button disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
                {isEditMode ? "Save Wellness Draft" : "Create Wellness Draft"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desktop Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DesktopPreview
                title={selectedTemplate?.title ?? ""}
                message={selectedTemplate?.message ?? ""}
                priority="Info"
                instruction={selectedTemplate?.instruction ?? ""}
                presentation="Toast"
                wellnessProgram={selectedTemplate?.wellnessProgram ?? null}
              />
              <p className="text-xs text-muted-foreground">
                Desktop Agent preview now follows the selected locked template. Operators only set
                schedule and assignment in this MVP slice.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Confirm Wellness Update" : "Confirm Wellness Draft"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "This updates the dedicated wellness draft under the separate `Wellness Programs` module while still using the existing reminder policy backend contract."
                : "This creates a dedicated wellness program draft under the separate `Wellness Programs` module while still using the existing reminder policy backend contract."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{selectedTemplate?.title ?? "No template selected"}</div>
            <p className="mt-1 text-muted-foreground">{selectedTemplate?.message ?? "Select a template first."}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Template: {selectedTemplate?.label ?? "Not selected"} · Device: {deviceId || "Not selected"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                submit();
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : isEditMode ? "Confirm Update" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildWellnessReminderSchedule(input: {
  scheduledAt: string;
  validUntil: string;
  timezone: string;
  recurrenceRule: string;
}) {
  return {
    scheduleType: "Recurring" as const,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    recurrenceRule: input.recurrenceRule.trim(),
    timezone: input.timezone.trim(),
    executionMode: "AgentLocalRoutine" as const,
    scheduleVersion: 0,
    validFrom: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    validUntil: input.validUntil ? new Date(input.validUntil).toISOString() : null,
    isActive: false,
  };
}

function isValidWellnessSchedule(input: {
  scheduledAt: string;
  validUntil: string;
  timezone: string;
  recurrenceRule: string;
}) {
  if (!input.timezone.trim() || !input.recurrenceRule.trim() || !input.validUntil.trim()) {
    return false;
  }

  if (input.scheduledAt && Number.isNaN(new Date(input.scheduledAt).getTime())) {
    return false;
  }

  if (Number.isNaN(new Date(input.validUntil).getTime())) {
    return false;
  }

  if (input.scheduledAt) {
    return new Date(input.validUntil).getTime() > new Date(input.scheduledAt).getTime();
  }

  return true;
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function TemplateReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="rounded-md border bg-background px-3 py-2 text-sm">{value}</div>
    </div>
  );
}

function TemplateMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function toDateTimeLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
