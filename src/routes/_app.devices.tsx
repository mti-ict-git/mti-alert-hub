import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Package, Rocket, Send, Upload } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { devicesService } from "@/services/devices.service";
import type {
  Device,
  DeviceRolloutAction,
  DeviceRolloutApplyResponse,
  DeviceRolloutPackage,
  DeviceRolloutPreviewResponse,
  DeviceRolloutRequest,
} from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/devices")({
  component: DevicesPage,
});

type RolloutFormState = {
  action: DeviceRolloutAction;
  selectedPackageUrl: string;
  version: string;
  packageUrl: string;
  sha256: string;
  signature: string;
  rolloutChannel: string;
  mandatory: boolean;
  deadlineAt: string;
  notes: string;
  releaseNotes: string;
};

function DevicesPage() {
  const qc = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [rolloutDevice, setRolloutDevice] = useState<Device | null>(null);
  const [rolloutOpen, setRolloutOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<DeviceRolloutPreviewResponse | null>(null);
  const [form, setForm] = useState<RolloutFormState>(() => createDefaultRolloutForm());

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: devicesService.list,
    refetchInterval: 8000,
  });

  const { data: rolloutPackages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ["device-rollout-packages"],
    queryFn: devicesService.listRolloutPackages,
    refetchInterval: 30000,
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!rolloutDevice) {
        throw new Error("Select a target device first.");
      }

      return devicesService.previewRollout(rolloutDevice.id, mapFormToRequest(form));
    },
    onSuccess: (result) => {
      setPreviewResult(result);
      toast.success(`Preview ready for ${result.target.hostname}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to preview rollout.");
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!rolloutDevice) {
        throw new Error("Select a target device first.");
      }

      return devicesService.applyRollout(rolloutDevice.id, mapFormToRequest(form));
    },
    onSuccess: async (result) => {
      setPreviewResult(null);
      await qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success(
        `Rollout ${result.rolloutIntent.targetVersion} created for ${result.target.hostname}`,
      );
      setRolloutOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create rollout.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => devicesService.uploadRolloutPackage(file),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["device-rollout-packages"] });
      setForm(createRolloutFormFromPackage(result.package));
      setPreviewResult(null);
      toast.success(
        result.alreadyExists
          ? `Package ${result.package.fileName} already exists and is ready to use.`
          : `Uploaded ${result.package.fileName} successfully.`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload MSI package.");
    },
  });

  const online = devices.filter((device) => device.status === "Online").length;
  const readyPackages = rolloutPackages.filter(
    (item) => item.signatureStatus === "Valid" && item.version && item.sha256 && item.signature,
  );

  const selectedPackage = useMemo(
    () => rolloutPackages.find((item) => item.packageUrl === form.selectedPackageUrl) ?? null,
    [form.selectedPackageUrl, rolloutPackages],
  );

  return (
    <div>
      <PageHeader
        title="Desktop Agents"
        description={`${online} of ${devices.length} agents online. Rollout testing can now be launched directly from this console.`}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Ownership</TableHead>
                  <TableHead>Assigned Employee</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="w-[220px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            device.status === "Online" ? "bg-success animate-pulse" : "bg-muted-foreground"
                          }`}
                        />
                        <StatusBadge status={device.status} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                    <TableCell className="font-medium">{device.hostname}</TableCell>
                    <TableCell className="text-sm">{device.siteName ?? device.siteId}</TableCell>
                    <TableCell className="text-sm">{device.areaName ?? "-"}</TableCell>
                    <TableCell className="text-sm">{device.locationLabel ?? "-"}</TableCell>
                    <TableCell className="text-sm">{device.ownershipMode}</TableCell>
                    <TableCell className="text-sm">{device.primaryEmployeeName ?? "-"}</TableCell>
                    <TableCell className="text-xs">{device.agentVersion ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {device.lastSeen
                        ? formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={device.status !== "Online" || testingDeviceId !== null}
                          onClick={async () => {
                            try {
                              setTestingDeviceId(device.id);
                              const result = await devicesService.sendTest(device.id);
                              await Promise.all([
                                qc.invalidateQueries({ queryKey: ["notifications"] }),
                                qc.invalidateQueries({ queryKey: ["devices"] }),
                              ]);
                              toast.success(`Test notification queued for ${result.hostname}`);
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to send device test notification.",
                              );
                            } finally {
                              setTestingDeviceId(null);
                            }
                          }}
                        >
                          {testingDeviceId === device.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3 w-3" />
                          )}
                          Test
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setRolloutDevice(device);
                            setPreviewResult(null);
                            setForm(createRolloutFormFromPackage(readyPackages[0] ?? rolloutPackages[0] ?? null));
                            setRolloutOpen(true);
                          }}
                        >
                          <Rocket className="mr-1 h-3 w-3" />
                          Rollout
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={rolloutOpen}
        onOpenChange={(nextOpen) => {
          setRolloutOpen(nextOpen);
          if (!nextOpen) {
            setPreviewResult(null);
            previewMutation.reset();
            applyMutation.reset();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Trigger Device Rollout</DialogTitle>
            <DialogDescription>
              Push a versioned MSI rollout to a single Windows Agent from the admin console. This uses
              the same backend rollout path we already validated on the endpoint.
            </DialogDescription>
          </DialogHeader>

          {rolloutDevice && (
            <div className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
              <div className="space-y-5">
                <Card className="border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Target Device</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoRow label="Hostname" value={rolloutDevice.hostname} />
                    <InfoRow label="Current Version" value={rolloutDevice.agentVersion ?? "-"} />
                    <InfoRow label="Device ID" value={rolloutDevice.deviceId} mono />
                    <InfoRow label="Status" value={rolloutDevice.status} badge />
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-4 w-4" />
                      Package Source
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="package-select">Published local MSI</Label>
                      <Select
                        value={form.selectedPackageUrl}
                        onValueChange={(value) => {
                          const nextPackage = rolloutPackages.find((item) => item.packageUrl === value) ?? null;
                          setForm(createRolloutFormFromPackage(nextPackage));
                          setPreviewResult(null);
                        }}
                      >
                        <SelectTrigger id="package-select">
                          <SelectValue
                            placeholder={
                              packagesLoading ? "Loading local packages..." : "Select a published MSI package"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {rolloutPackages.map((pkg) => (
                            <SelectItem key={pkg.packageUrl} value={pkg.packageUrl}>
                              {pkg.fileName} {pkg.version ? `- ${pkg.version}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Packages are discovered from `backend/local-packages` and inspected from the backend
                        server before this dialog renders them.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          ref={uploadInputRef}
                          type="file"
                          accept=".msi,application/x-msi"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = "";
                            if (!file) {
                              return;
                            }

                            uploadMutation.mutate(file);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadMutation.isPending}
                          onClick={() => uploadInputRef.current?.click()}
                        >
                          {uploadMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload MSI
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Upload runs from the operator browser to the backend package store.
                        </p>
                      </div>
                    </div>

                    {selectedPackage && (
                      <div className="rounded-xl border bg-background/90 p-3 text-xs text-muted-foreground">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <InfoRow label="Version" value={selectedPackage.version ?? "-"} />
                          <InfoRow label="Signature" value={selectedPackage.signatureStatus ?? "-"} badge />
                          <InfoRow label="Thumbprint" value={selectedPackage.signature ?? "-"} mono />
                          <InfoRow
                            label="Last Modified"
                            value={new Date(selectedPackage.lastModifiedAt).toLocaleString()}
                          />
                        </div>
                        {!selectedPackage.signature && (
                          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-warning-foreground">
                            Signature thumbprint could not be auto-read from the backend runtime. Fill the
                            signer thumbprint manually before preview/apply.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Action">
                    <Select
                      value={form.action}
                      onValueChange={(value) => setForm((current) => ({ ...current, action: value as DeviceRolloutAction }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Upgrade">Upgrade</SelectItem>
                        <SelectItem value="Repair">Repair</SelectItem>
                        <SelectItem value="Uninstall">Uninstall</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Rollout Channel">
                    <Input
                      value={form.rolloutChannel}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, rolloutChannel: event.target.value }))
                      }
                      placeholder="pilot"
                    />
                  </Field>
                  <Field label="Target Version">
                    <Input
                      value={form.version}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, version: event.target.value }))
                      }
                      placeholder="1.0.5"
                    />
                  </Field>
                  <Field label="Deadline (optional)">
                    <Input
                      type="datetime-local"
                      value={form.deadlineAt}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, deadlineAt: event.target.value }))
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4">
                  <Field label="Package URL">
                    <Input
                      value={form.packageUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, packageUrl: event.target.value }))
                      }
                      placeholder="http://127.0.0.1:4019/agent/packages/local/MTI.Alert.Agent.Setup.1.0.5.msi"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="SHA256">
                      <Input
                        value={form.sha256}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, sha256: event.target.value.toUpperCase() }))
                        }
                        placeholder="Package SHA256"
                        className="font-mono text-xs"
                      />
                    </Field>
                    <Field label="Signature Thumbprint">
                      <Input
                        value={form.signature}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, signature: event.target.value.toUpperCase() }))
                        }
                        placeholder="Signer certificate thumbprint"
                        className="font-mono text-xs"
                      />
                    </Field>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Operator Notes">
                    <Textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder="Pilot rollout 1.0.5 from frontend"
                      rows={4}
                    />
                  </Field>
                  <Field label="Release Notes">
                    <Textarea
                      value={form.releaseNotes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, releaseNotes: event.target.value }))
                      }
                      placeholder="Optional release notes shown in package metadata."
                      rows={4}
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-4">
                  <div>
                    <p className="text-sm font-medium">Mandatory rollout</p>
                    <p className="text-xs text-muted-foreground">
                      Mark this rollout as non-optional for the target endpoint.
                    </p>
                  </div>
                  <Switch
                    checked={form.mandatory}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, mandatory: checked }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Card className="bg-muted/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <InfoRow label="Action" value={form.action} />
                    <InfoRow label="Version" value={form.version || "-"} />
                    <InfoRow label="Channel" value={form.rolloutChannel || "-"} />
                    <InfoRow label="Mandatory" value={form.mandatory ? "Yes" : "No"} />
                    <InfoRow label="Package URL" value={form.packageUrl || "-"} mono />
                    <InfoRow label="SHA256" value={form.sha256 || "-"} mono />
                    <InfoRow label="Signature" value={form.signature || "-"} mono />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Backend Dry Run</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {previewResult ? (
                      <>
                        <InfoRow label="Mode" value={previewResult.mode} badge />
                        <InfoRow label="Current Active Rollouts" value={`${previewResult.currentlyActiveRollouts}`} />
                        <InfoRow label="Target Host" value={previewResult.target.hostname} />
                        <InfoRow label="Target Version" value={previewResult.rollout.targetVersion} />
                        <InfoRow label="Package Type" value={previewResult.package.packageType} />
                        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                          Dry run confirmed that the backend can resolve the target device and would create
                          the rollout intent with the package metadata above.
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Run preview first so the backend validates the target device and rollout metadata before
                        you apply it.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={
                !isRolloutFormValid(form) ||
                previewMutation.isPending ||
                applyMutation.isPending ||
                uploadMutation.isPending
              }
            >
              {previewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Preview Rollout
            </Button>
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={
                !isRolloutFormValid(form) ||
                previewMutation.isPending ||
                applyMutation.isPending ||
                uploadMutation.isPending
              }
            >
              {applyMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              Apply Rollout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mapFormToRequest(form: RolloutFormState): DeviceRolloutRequest {
  return {
    action: form.action,
    version: form.version.trim(),
    packageUrl: form.packageUrl.trim(),
    sha256: form.sha256.trim(),
    signature: form.signature.trim(),
    rolloutChannel: form.rolloutChannel.trim() || "pilot",
    mandatory: form.mandatory,
    deadlineAt: normalizeDeadline(form.deadlineAt),
    notes: form.notes.trim() || null,
    releaseNotes: form.releaseNotes.trim() || null,
  };
}

function createDefaultRolloutForm(): RolloutFormState {
  return {
    action: "Upgrade",
    selectedPackageUrl: "",
    version: "",
    packageUrl: "",
    sha256: "",
    signature: "",
    rolloutChannel: "pilot",
    mandatory: false,
    deadlineAt: "",
    notes: "Pilot rollout from frontend",
    releaseNotes: "",
  };
}

function createRolloutFormFromPackage(pkg: DeviceRolloutPackage | null): RolloutFormState {
  if (!pkg) {
    return createDefaultRolloutForm();
  }

  return {
    action: "Upgrade",
    selectedPackageUrl: pkg.packageUrl,
    version: pkg.version ?? "",
    packageUrl: pkg.packageUrl,
    sha256: pkg.sha256 ?? "",
    signature: pkg.signature ?? "",
    rolloutChannel: "pilot",
    mandatory: false,
    deadlineAt: "",
    notes: `Pilot rollout ${pkg.version ?? ""} from frontend`.trim(),
    releaseNotes: "",
  };
}

function isRolloutFormValid(form: RolloutFormState) {
  return Boolean(
    form.version.trim() &&
      form.packageUrl.trim() &&
      form.sha256.trim() &&
      form.signature.trim() &&
      form.rolloutChannel.trim(),
  );
}

function normalizeDeadline(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function InfoRow({
  label,
  value,
  mono = false,
  badge = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      {badge ? (
        <StatusBadge status={value} className="w-fit" />
      ) : (
        <p className={mono ? "break-all font-mono text-xs" : "text-sm"}>{value}</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
