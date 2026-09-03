import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { DesktopPreview } from "@/components/notifications/DesktopPreview";
import { WellnessDeviceAudiencePicker } from "@/components/wellness/WellnessDeviceAudiencePicker";
import { WellnessScheduleFields } from "@/components/wellness/WellnessScheduleFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildWellnessRecurrenceRule,
  formatWellnessRecurrenceSummary,
  parseWellnessRecurrenceRule,
  type WellnessRecurrenceUnit,
  type WellnessRotationMode,
} from "@/lib/wellness-authoring";
import {
  buildWellnessProgramFromSelection,
  getWellnessFamily,
  inferWellnessFamily,
  inferWellnessVariantKeys,
  listWellnessFamilies,
  listWellnessTemplatesByFamily,
  type WellnessFamily,
  type WellnessTemplateKey,
} from "@/lib/wellness-template-catalog";
import { devicesService } from "@/services/devices.service";
import { notificationsService } from "@/services/notifications.service";
import type { WellnessDistributionMode } from "@/types";

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
  const families = listWellnessFamilies();
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

  const [family, setFamily] = useState<WellnessFamily | "">("");
  const [selectedVariantKeys, setSelectedVariantKeys] = useState<WellnessTemplateKey[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [neverExpires, setNeverExpires] = useState(true);
  const [timezone, setTimezone] = useState(getLocalTimeZone());
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUnit, setRecurrenceUnit] = useState<WellnessRecurrenceUnit>("Day");
  const [rotationMode, setRotationMode] = useState<WellnessRotationMode>("Fixed");
  const [distributionMode, setDistributionMode] = useState<WellnessDistributionMode>("Staggered");
  const [staggerWindowMinutes, setStaggerWindowMinutes] = useState("30");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [initializedDraftId, setInitializedDraftId] = useState<string | null>(null);

  const isEditMode = Boolean(editingDraftId);
  const hasValidEditableDraft = !editingDraftId || Boolean(editingDraft?.wellnessProgram);
  const selectedFamily = family ? getWellnessFamily(family) : null;
  const familyTemplates = family ? listWellnessTemplatesByFamily(family) : [];
  const previewVariantTemplate = familyTemplates.find((template) => selectedVariantKeys.includes(template.key)) ?? familyTemplates[0] ?? null;
  const previewWellnessProgram = selectedFamily
    ? buildWellnessProgramFromSelection({
        family,
        variantKeys: selectedVariantKeys,
        rotationMode,
      })
    : null;
  const selectedDevices = useMemo(
    () => devices.filter((device) => selectedDeviceIds.includes(device.deviceId)),
    [devices, selectedDeviceIds],
  );

  useEffect(() => {
    if (!editingDraftId || !editingDraft || !editingDraft.wellnessProgram) {
      return;
    }

    if (initializedDraftId === editingDraftId) {
      return;
    }

    const inferredFamily = inferWellnessFamily(editingDraft);
    const inferredVariantKeys = inferWellnessVariantKeys(editingDraft);
    setFamily(inferredFamily ?? "");
    setSelectedVariantKeys(inferredVariantKeys);
    setSelectedDeviceIds(
      editingDraft.targetDeviceIds?.length
        ? editingDraft.targetDeviceIds
        : editingDraft.targetDeviceId
          ? [editingDraft.targetDeviceId]
          : [],
    );
    setScheduledAt(editingDraft.reminderSchedule?.scheduledAt ? toDateTimeLocalInput(editingDraft.reminderSchedule.scheduledAt) : "");
    setValidUntil(
      editingDraft.reminderSchedule?.validUntil
        ? toDateTimeLocalInput(editingDraft.reminderSchedule.validUntil)
        : "",
    );
    setNeverExpires(!editingDraft.reminderSchedule?.validUntil);
    setTimezone(editingDraft.reminderSchedule?.timezone ?? getLocalTimeZone());
    const recurrence = parseWellnessRecurrenceRule(editingDraft.reminderSchedule?.recurrenceRule);
    setRecurrenceInterval(recurrence?.interval.toString() ?? "1");
    setRecurrenceUnit(recurrence?.unit ?? "Day");
    setRotationMode(editingDraft.wellnessProgram.rotationMode ?? "Fixed");
    setDistributionMode(editingDraft.reminderSchedule?.distributionMode ?? "Staggered");
    setStaggerWindowMinutes((editingDraft.reminderSchedule?.staggerWindowMinutes ?? 30).toString());
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
    neverExpires,
    timezone,
    recurrenceInterval,
    distributionMode,
    staggerWindowMinutes,
  });
  const canSubmit =
    hasValidEditableDraft &&
    Boolean(selectedFamily) &&
    selectedVariantKeys.length > 0 &&
    selectedDeviceIds.length > 0 &&
    hasValidSchedule;

  function handleFamilyChange(nextFamily: WellnessFamily) {
    const next = getWellnessFamily(nextFamily);
    setFamily(nextFamily);
    setSelectedVariantKeys([next.variantKeys[0]]);
    setRecurrenceInterval(next.recommendedInterval.toString());
    setRecurrenceUnit(next.recommendedUnit);
    setRotationMode("Fixed");
  }

  function toggleVariant(variantKey: WellnessTemplateKey, checked: boolean) {
    if (checked) {
      setSelectedVariantKeys((current) => [...new Set([...current, variantKey])]);
      return;
    }

    setSelectedVariantKeys((current) => current.filter((item) => item !== variantKey));
    setRotationMode("Fixed");
  }

  function submit() {
    if (!selectedFamily || !previewWellnessProgram) {
      return;
    }

    createMutation.mutate({
      title: selectedFamily.title,
      message: selectedFamily.message,
      instruction: selectedFamily.instruction,
      communicationType: "Reminder",
      priority: "Info",
      category: "OHSE",
      targetType: "Device",
      targetDeviceId: selectedDeviceIds[0],
      targetDeviceIds: selectedDeviceIds,
      channels: ["DesktopAgent"],
      windowsAgentPresentation: "Toast",
      toastAutoDismissSeconds: null,
      requireAck: false,
      workflowId: null,
      reminderSchedule: buildWellnessReminderSchedule({
        scheduledAt,
        validUntil,
        neverExpires,
        timezone,
        recurrenceInterval,
        recurrenceUnit,
        distributionMode,
        staggerWindowMinutes,
      }),
      wellnessProgram: previewWellnessProgram,
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

  if (isEditMode && editingDraft && !family) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This draft uses a legacy custom wellness shape that does not map cleanly to the new
          family-driven catalog. Create or duplicate a new draft to continue with the safer authoring flow.
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
            ? "Update the dedicated wellness draft using family-first authoring, clearer variant control, and staggered device distribution."
            : "Choose the wellness family first, select one or more visual variants, and assign the cadence to approved devices."
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5 p-6">
            <div className="rounded-md border border-sky-200 bg-sky-50/70 p-4">
              <div className="text-sm font-medium">Family-Driven Wellness Authoring</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Operators choose the wellness family first, then decide which approved visual variants
                are eligible. Rotation only matters when more than one variant is selected.
              </p>
            </div>

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <div className="text-sm font-medium">Program Family</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Separate micro-break eye care from office stretching so cadence, visuals, and rollout
                  behavior stay intentional.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Family</Label>
                <Select value={family} onValueChange={(value) => handleFamilyChange(value as WellnessFamily)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wellness family" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFamily && (
                <div className="rounded-md border bg-muted/20 p-4">
                  <div className="text-sm font-medium">{selectedFamily.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedFamily.description}</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <TemplateReadOnlyField label="Title" value={selectedFamily.title} />
                    <TemplateReadOnlyField label="Summary" value={selectedFamily.message} />
                    <TemplateReadOnlyField label="Instruction" value={selectedFamily.instruction} />
                  </div>
                </div>
              )}
            </div>

            {selectedFamily && (
              <div className="space-y-4 rounded-md border p-4">
                <div>
                  <div className="text-sm font-medium">Visual Variants</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick one or more approved shells for this family. One variant means fixed delivery.
                    Multiple variants unlock sequential or shuffled rotation.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {familyTemplates.map((template) => {
                    const checked = selectedVariantKeys.includes(template.key);
                    return (
                      <label
                        key={template.key}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                          checked ? "border-sky-300 bg-sky-50/60" : "hover:bg-muted/20"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleVariant(template.key, value === true)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{template.key}</span>
                            <Badge variant="outline">{template.label.replace(`${template.key} - `, "")}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="space-y-3 rounded-xl border p-4">
                  <div>
                    <div className="text-sm font-medium">Variant Rotation</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rotation decides how the selected variants are used over time.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Rotation Mode</Label>
                    <Select
                      value={selectedVariantKeys.length > 1 ? rotationMode : "Fixed"}
                      onValueChange={(value) => setRotationMode(value as WellnessRotationMode)}
                      disabled={selectedVariantKeys.length < 2}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fixed">Fixed</SelectItem>
                        <SelectItem value="Sequential">Sequential</SelectItem>
                        <SelectItem value="Random">Shuffle</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedVariantKeys.length < 2
                        ? "Select at least two variants to enable rotation."
                        : rotationMode === "Sequential"
                          ? "Occurrences rotate through the selected variants in order."
                          : rotationMode === "Random"
                            ? "Occurrences shuffle the selected variants deterministically."
                            : "Use the first selected variant every time."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 rounded-md border p-4">
              <div>
                <div className="text-sm font-medium">Schedule And Assignment</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Wellness programs still publish through the local Windows Agent routine path, with
                  per-device reminder policies materialized from this schedule.
                </p>
              </div>

              <WellnessScheduleFields
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                validUntil={validUntil}
                onValidUntilChange={setValidUntil}
                timezone={timezone}
                onTimezoneChange={setTimezone}
                recurrenceInterval={recurrenceInterval}
                onRecurrenceIntervalChange={setRecurrenceInterval}
                recurrenceUnit={recurrenceUnit}
                onRecurrenceUnitChange={setRecurrenceUnit}
                neverExpires={neverExpires}
                onNeverExpiresChange={setNeverExpires}
                distributionMode={distributionMode}
                onDistributionModeChange={setDistributionMode}
                staggerWindowMinutes={staggerWindowMinutes}
                onStaggerWindowMinutesChange={setStaggerWindowMinutes}
                showExecutionMode
              />

              <WellnessDeviceAudiencePicker
                devices={devices}
                selectedDeviceIds={selectedDeviceIds}
                onChange={setSelectedDeviceIds}
              />
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
                title={selectedFamily?.title ?? ""}
                message={selectedFamily?.message ?? ""}
                priority="Info"
                instruction={selectedFamily?.instruction ?? ""}
                presentation="Toast"
                wellnessProgram={previewWellnessProgram}
              />
              <p className="text-xs text-muted-foreground">
                Preview shows the currently selected family copy. Runtime layout may rotate across the
                checked variants according to the selected rotation mode.
              </p>
              {previewVariantTemplate && (
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  Current preview anchor: <span className="font-medium text-foreground">{previewVariantTemplate.label}</span>
                </div>
              )}
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
                ? "This updates the dedicated wellness draft under the separate `Wellness Programs` module."
                : "This creates a dedicated wellness program draft under the separate `Wellness Programs` module."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{selectedFamily?.label ?? "No family selected"}</div>
            <p className="mt-1 text-muted-foreground">
              {selectedFamily?.message ?? "Select a wellness family first."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Variants: {selectedVariantKeys.join(", ") || "Not selected"} · Cadence:{" "}
              {formatWellnessRecurrenceSummary(
                buildWellnessRecurrenceRule({
                  interval: Number.parseInt(recurrenceInterval || "1", 10) || 1,
                  unit: recurrenceUnit,
                }),
              )}{" "}
              · Distribution: {distributionMode}
            </p>
            {selectedDevices.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedDevices.slice(0, 4).map((device) => `${device.deviceId} (${device.hostname})`).join(", ")}
                {selectedDevices.length > 4 ? ` + ${selectedDevices.length - 4} more` : ""}
              </p>
            )}
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
  neverExpires: boolean;
  timezone: string;
  recurrenceInterval: string;
  recurrenceUnit: WellnessRecurrenceUnit;
  distributionMode: WellnessDistributionMode;
  staggerWindowMinutes: string;
}) {
  return {
    scheduleType: "Recurring" as const,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    recurrenceRule: buildWellnessRecurrenceRule({
      interval: Number.parseInt(input.recurrenceInterval || "1", 10) || 1,
      unit: input.recurrenceUnit,
    }),
    timezone: input.timezone.trim(),
    executionMode: "AgentLocalRoutine" as const,
    distributionMode: input.distributionMode,
    staggerWindowMinutes:
      input.distributionMode === "Staggered"
        ? Number.parseInt(input.staggerWindowMinutes || "30", 10) || 30
        : null,
    scheduleVersion: 0,
    validFrom: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
    validUntil:
      input.neverExpires || !input.validUntil
        ? null
        : new Date(input.validUntil).toISOString(),
    isActive: false,
  };
}

function isValidWellnessSchedule(input: {
  scheduledAt: string;
  validUntil: string;
  neverExpires: boolean;
  timezone: string;
  recurrenceInterval: string;
  distributionMode: WellnessDistributionMode;
  staggerWindowMinutes: string;
}) {
  if (!input.timezone.trim()) {
    return false;
  }

  const recurrenceInterval = Number.parseInt(input.recurrenceInterval || "", 10);
  if (!Number.isFinite(recurrenceInterval) || recurrenceInterval < 1) {
    return false;
  }

  if (input.distributionMode === "Staggered") {
    const staggerWindow = Number.parseInt(input.staggerWindowMinutes || "", 10);
    if (!Number.isFinite(staggerWindow) || staggerWindow < 5 || staggerWindow > 720) {
      return false;
    }
  }

  if (input.scheduledAt && Number.isNaN(new Date(input.scheduledAt).getTime())) {
    return false;
  }

  if (input.neverExpires) {
    return true;
  }

  if (!input.validUntil.trim() || Number.isNaN(new Date(input.validUntil).getTime())) {
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

function toDateTimeLocalInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
