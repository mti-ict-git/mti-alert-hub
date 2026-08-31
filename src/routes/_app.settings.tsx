import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { settingsService, type AppSettings } from "@/services/settings.service";
import { devicesService } from "@/services/devices.service";
import { Download, Loader2, Package, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [s, setS] = useState<AppSettings | null>(null);
  useEffect(() => { settingsService.get().then(setS); }, []);

  const {
    data: rolloutPackages = [],
    isLoading: packagesLoading,
    isFetching: packagesFetching,
  } = useQuery({
    queryKey: ["device-rollout-packages"],
    queryFn: devicesService.listRolloutPackages,
    refetchInterval: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => devicesService.uploadRolloutPackage(file),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["device-rollout-packages"] });
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

  if (!s) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const save = async () => { await settingsService.update(s); toast.success("Settings saved"); };
  const latestPublishedPackage = rolloutPackages.find((item) => Boolean(item.version)) ?? rolloutPackages[0] ?? null;

  return (
    <div>
      <PageHeader title="Settings" description="Configure MTI Alert channels, agents, and permissions." actions={<Button onClick={save}>Save Changes</Button>} />

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="agent">Desktop Agent</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Gateway</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card><CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
            <Field label="Company Name"><Input value={s.general.companyName} onChange={(e) => setS({ ...s, general: { ...s.general, companyName: e.target.value } })} /></Field>
            <Field label="Timezone"><Input value={s.general.timezone} onChange={(e) => setS({ ...s, general: { ...s.general, timezone: e.target.value } })} /></Field>
            <Field label="Language"><Input value={s.general.language} onChange={(e) => setS({ ...s, general: { ...s.general, language: e.target.value } })} /></Field>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <Card><CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
            {["Desktop Agent", "WhatsApp", "Email", "Digital Signage", "Telegram (planned)", "SMS (planned)"].map((c) => (
              <div key={c} className="flex items-center justify-between rounded-md border p-3">
                <div><div className="font-medium">{c}</div><div className="text-xs text-muted-foreground">{c.includes("planned") ? "Not yet configured" : "Enabled"}</div></div>
                <Switch defaultChecked={!c.includes("planned")} disabled={c.includes("planned")} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="agent" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <div className="md:col-span-2 flex items-center justify-between rounded-md border p-4">
                  <div>
                    <div className="font-medium">Agent Installer</div>
                    <div className="text-xs text-muted-foreground">
                      Manage the global Windows Agent package registry here before triggering device-level rollouts.
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => toast.info("Download — backend required")}>
                    <Download className="mr-1 h-4 w-4" /> Download Installer
                  </Button>
                </div>
                <Field label="Current Version">
                  <Input
                    value={s.desktopAgent.currentVersion}
                    onChange={(e) => setS({ ...s, desktopAgent: { ...s.desktopAgent, currentVersion: e.target.value } })}
                  />
                </Field>
                <Field label="Heartbeat Interval (seconds)">
                  <Input
                    type="number"
                    value={s.desktopAgent.heartbeatSec}
                    onChange={(e) => setS({ ...s, desktopAgent: { ...s.desktopAgent, heartbeatSec: Number(e.target.value) } })}
                  />
                </Field>
                <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label>Auto-update Agents</Label>
                    <p className="text-xs text-muted-foreground">Push new versions automatically to online devices.</p>
                  </div>
                  <Switch
                    checked={s.desktopAgent.autoUpdate}
                    onCheckedChange={(v) => setS({ ...s, desktopAgent: { ...s.desktopAgent, autoUpdate: v } })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Package className="h-4 w-4" />
                      Package Registry
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Upload signed MSI packages once here. Device rollout dialogs will reuse this global package list.
                    </div>
                  </div>
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
                      disabled={packagesFetching}
                      onClick={() => qc.invalidateQueries({ queryKey: ["device-rollout-packages"] })}
                    >
                      {packagesFetching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                    <Button type="button" disabled={uploadMutation.isPending} onClick={() => uploadInputRef.current?.click()}>
                      {uploadMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload MSI
                    </Button>
                  </div>
                </div>

                {latestPublishedPackage && (
                  <div className="rounded-md border bg-muted/30 p-4">
                    <div className="mb-3 text-sm font-medium">Latest Published Package</div>
                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <InfoRow label="Version" value={latestPublishedPackage.version ?? "-"} />
                      <InfoRow label="File" value={latestPublishedPackage.fileName} />
                      <InfoRow label="Signature" value={latestPublishedPackage.signatureStatus ?? "-"} />
                      <InfoRow
                        label="Updated"
                        value={new Date(latestPublishedPackage.lastModifiedAt).toLocaleString()}
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-md border">
                  <div className="grid grid-cols-[minmax(0,2fr)_110px_120px_160px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <div>Package</div>
                    <div>Version</div>
                    <div>Signature</div>
                    <div>Updated</div>
                  </div>
                  {packagesLoading ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">Loading published MSI packages...</div>
                  ) : rolloutPackages.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      No MSI packages are published yet. Upload a signed package here before creating device rollouts.
                    </div>
                  ) : (
                    rolloutPackages.map((pkg) => (
                      <div
                        key={pkg.packageUrl}
                        className="grid grid-cols-[minmax(0,2fr)_110px_120px_160px] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{pkg.fileName}</div>
                          <div className="truncate text-xs text-muted-foreground">{pkg.packageUrl}</div>
                        </div>
                        <div>{pkg.version ?? "-"}</div>
                        <div>{pkg.signatureStatus ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(pkg.lastModifiedAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <Card><CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
            <Field label="Gateway URL"><Input value={s.whatsapp.gatewayUrl} onChange={(e) => setS({ ...s, whatsapp: { ...s.whatsapp, gatewayUrl: e.target.value } })} /></Field>
            <Field label="Webhook URL"><Input value={s.whatsapp.webhookUrl} onChange={(e) => setS({ ...s, whatsapp: { ...s.whatsapp, webhookUrl: e.target.value } })} /></Field>
            <Field label="Default Template"><Input value={s.whatsapp.defaultTemplate} onChange={(e) => setS({ ...s, whatsapp: { ...s.whatsapp, defaultTemplate: e.target.value } })} /></Field>
            <Field label="Retry Attempts"><Input type="number" value={s.whatsapp.retryAttempts} onChange={(e) => setS({ ...s, whatsapp: { ...s.whatsapp, retryAttempts: Number(e.target.value) } })} /></Field>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card><CardContent className="p-6">
            <div className="space-y-2">
              {[
                { role: "Admin", desc: "Full access, manage users and settings" },
                { role: "Operator", desc: "Create and send notifications" },
                { role: "Viewer", desc: "Read-only dashboards and reports" },
              ].map((r) => (
                <div key={r.role} className="flex items-center justify-between rounded-md border p-3">
                  <div><div className="font-medium">{r.role}</div><div className="text-xs text-muted-foreground">{r.desc}</div></div>
                  <Button size="sm" variant="outline">Edit permissions</Button>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">See the full <a className="text-primary underline" href="/audit-logs">Audit Logs</a> page for filtering and export.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
