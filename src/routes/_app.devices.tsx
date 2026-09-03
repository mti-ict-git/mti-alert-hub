import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Loader2, Package, Rocket, Send, ShieldAlert, X } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { devicesService } from "@/services/devices.service";
import { referenceService } from "@/services/reference.service";
import type {
  ApprovePendingDeviceResponse,
  Device,
  DeviceRolloutAction,
  DeviceRolloutPackage,
  DeviceRolloutPreviewResponse,
  DeviceRolloutRequest,
  PendingDeviceEnrollment,
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

type PendingApprovalFormState = {
  siteId: string;
  areaId: string;
  locationLabel: string;
  ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
};

const NO_AREA_VALUE = "__none__";

function DevicesPage() {
  const qc = useQueryClient();
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [rolloutDevice, setRolloutDevice] = useState<Device | null>(null);
  const [rolloutOpen, setRolloutOpen] = useState(false);
  const [previewResult, setPreviewResult] = useState<DeviceRolloutPreviewResponse | null>(null);
  const [form, setForm] = useState<RolloutFormState>(() => createDefaultRolloutForm());
  const [pendingSelection, setPendingSelection] = useState<PendingDeviceEnrollment | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<PendingApprovalFormState>(
    () => createDefaultPendingApprovalForm(),
  );

  const { data: devices = [] } = useQuery({
    queryKey: ["devices"],
    queryFn: devicesService.list,
    refetchInterval: 8000,
  });

  const { data: pendingDevices = [] } = useQuery({
    queryKey: ["devices", "pending"],
    queryFn: devicesService.listPending,
    refetchInterval: 8000,
  });

  const { data: organizationReference } = useQuery({
    queryKey: ["reference", "organization"],
    queryFn: referenceService.getOrganizationReference,
    staleTime: 5 * 60 * 1000,
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

  const approvePendingMutation = useMutation({
    mutationFn: async () => {
      if (!pendingSelection) {
        throw new Error("Select a pending device first.");
      }

      return devicesService.approvePending(pendingSelection.id, {
        siteId: pendingForm.siteId,
        areaId: pendingForm.areaId === NO_AREA_VALUE ? null : pendingForm.areaId || null,
        locationLabel: pendingForm.locationLabel.trim() || null,
        ownershipMode: pendingForm.ownershipMode,
      });
    },
    onSuccess: async (result: ApprovePendingDeviceResponse) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["devices"] }),
        qc.invalidateQueries({ queryKey: ["devices", "pending"] }),
      ]);
      toast.success(`Pending device ${result.device.hostname} approved`);
      setPendingOpen(false);
      setPendingSelection(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to approve pending device.");
    },
  });

  const rejectPendingMutation = useMutation({
    mutationFn: async (request: PendingDeviceEnrollment) => {
      return devicesService.rejectPending(request.id, {});
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["devices", "pending"] });
      toast.success(`Pending device ${result.request.hostname} rejected`);
      if (pendingSelection?.id === result.request.id) {
        setPendingOpen(false);
        setPendingSelection(null);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to reject pending device.");
    },
  });

  const online = devices.filter((device) => device.status === "Online").length;
  const pendingCount = pendingDevices.length;
  const readyPackages = rolloutPackages.filter(
    (item) => item.signatureStatus === "Valid" && item.version && item.sha256 && item.signature,
  );

  const selectedPackage = useMemo(
    () => rolloutPackages.find((item) => item.packageUrl === form.selectedPackageUrl) ?? null,
    [form.selectedPackageUrl, rolloutPackages],
  );
  const availableAreas = useMemo(() => {
    if (!organizationReference || !pendingForm.siteId) {
      return [];
    }

    return organizationReference.areas.filter((area) => area.siteId === pendingForm.siteId);
  }, [organizationReference, pendingForm.siteId]);

  return (
    <div>
      <PageHeader
        title="Desktop Agents"
        description={`${online} of ${devices.length} approved agents online, with ${pendingCount} pending device approval request${pendingCount === 1 ? "" : "s"}.`}
      />

      <Tabs defaultValue="approved" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approved">Approved Devices</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval ({pendingCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="approved">
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
                      <TableHead>Current User</TableHead>
                      <TableHead>Department</TableHead>
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
                        <TableCell className="text-sm">
                          <div className="space-y-1">
                            <div>{device.primaryEmployeeName ?? "-"}</div>
                            {device.primaryEmployeeName && (
                              <div className="text-xs text-muted-foreground">Assigned owner</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-1">
                            <div>
                              {device.currentDisplayName ??
                                device.currentUsername ??
                                device.lastActiveUserIdentifier ??
                                "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {device.currentEmployeeNumber
                                ? `${device.currentUserType ?? "Unknown"} • ${device.currentEmployeeNumber}`
                                : (device.currentUserType ?? "Unknown")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-1">
                            <div>{device.currentDepartment ?? "-"}</div>
                            <div className="text-xs text-muted-foreground">
                              {device.currentTitle ?? device.currentMobile ?? "-"}
                            </div>
                          </div>
                        </TableCell>
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
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4" />
                Pending Device Approval
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Device Identifier</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Active User</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>First Seen</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead className="w-[220px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDevices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                          No pending device approval requests.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingDevices.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <StatusBadge status={request.requestStatus} />
                          </TableCell>
                          <TableCell className="font-medium">{request.hostname}</TableCell>
                          <TableCell className="font-mono text-xs">{request.deviceIdentifier}</TableCell>
                          <TableCell className="text-xs">{request.agentVersion ?? "-"}</TableCell>
                          <TableCell className="text-sm">{request.activeUserIdentifier ?? "-"}</TableCell>
                          <TableCell className="text-sm">{request.requestCount}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.firstSeenAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.lastSeenAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPendingSelection(request);
                                  setPendingForm(createPendingApprovalFormFromRequest(request, organizationReference?.sites[0]?.id ?? ""));
                                  setPendingOpen(true);
                                }}
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={rejectPendingMutation.isPending}
                                onClick={() => rejectPendingMutation.mutate(request)}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                      <p className="text-xs text-muted-foreground">
                        Manage package uploads from {"Settings > Desktop Agent"}. This rollout dialog only
                        applies packages that are already registered globally.
                      </p>
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
                applyMutation.isPending
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
                applyMutation.isPending
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

      <Dialog
        open={pendingOpen}
        onOpenChange={(nextOpen) => {
          setPendingOpen(nextOpen);
          if (!nextOpen) {
            setPendingSelection(null);
            approvePendingMutation.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve Pending Device</DialogTitle>
            <DialogDescription>
              Approving this request moves the device into the trusted `public.devices` baseline. The existing
              agent will retry automatically and should connect on the next session attempt.
            </DialogDescription>
          </DialogHeader>

          {pendingSelection ? (
            <div className="space-y-5">
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pending Request</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <InfoRow label="Hostname" value={pendingSelection.hostname} />
                  <InfoRow label="Version" value={pendingSelection.agentVersion ?? "-"} />
                  <InfoRow label="Device Identifier" value={pendingSelection.deviceIdentifier} mono />
                  <InfoRow label="Last Seen" value={formatDistanceToNow(new Date(pendingSelection.lastSeenAt), { addSuffix: true })} />
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Site">
                  <Select
                    value={pendingForm.siteId}
                    onValueChange={(value) => {
                      setPendingForm((current) => ({ ...current, siteId: value, areaId: NO_AREA_VALUE }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {(organizationReference?.sites ?? []).map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Area">
                  <Select
                    value={pendingForm.areaId}
                    onValueChange={(value) => setPendingForm((current) => ({ ...current, areaId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_AREA_VALUE}>No area</SelectItem>
                      {availableAreas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Location Label">
                  <Input
                    value={pendingForm.locationLabel}
                    onChange={(event) =>
                      setPendingForm((current) => ({ ...current, locationLabel: event.target.value }))
                    }
                    placeholder="Example: Office Floor 2"
                  />
                </Field>

                <Field label="Ownership">
                  <Select
                    value={pendingForm.ownershipMode}
                    onValueChange={(value) =>
                      setPendingForm((current) => ({
                        ...current,
                        ownershipMode: value as PendingApprovalFormState["ownershipMode"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LocationOwned">Location Owned</SelectItem>
                      <SelectItem value="EmployeeAssigned">Employee Assigned</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingOpen(false)}
              disabled={approvePendingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => approvePendingMutation.mutate()}
              disabled={!pendingSelection || !pendingForm.siteId || approvePendingMutation.isPending}
            >
              {approvePendingMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Approve Device
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

function createDefaultPendingApprovalForm(): PendingApprovalFormState {
  return {
    siteId: "",
    areaId: NO_AREA_VALUE,
    locationLabel: "",
    ownershipMode: "LocationOwned",
  };
}

function createPendingApprovalFormFromRequest(
  request: PendingDeviceEnrollment,
  fallbackSiteId: string,
): PendingApprovalFormState {
  return {
    siteId: fallbackSiteId,
    areaId: NO_AREA_VALUE,
    locationLabel: request.hostname,
    ownershipMode: "LocationOwned",
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
