import { can } from "@/lib/access";
import { UsersAccessSettings, type AccessSearch } from "@/components/access/UsersAccessSettings";
import { useAuth } from "@/hooks/useAuth";
import { SitesAreasSettings } from "@/components/settings/SitesAreasSettings";
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
import { Download, Github, Loader2, Package, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } & AccessSearch => ({
    accessTab: search.accessTab === "roles" ? "roles" : "users",
    accessSearch: typeof search.accessSearch === "string" ? search.accessSearch : undefined,
    accessStatus: ["Pending", "Active", "Disabled"].includes(String(search.accessStatus))
      ? String(search.accessStatus)
      : undefined,
    accessRole: typeof search.accessRole === "string" ? search.accessRole : undefined,
    accessSite: typeof search.accessSite === "string" ? search.accessSite : undefined,
    accessPage: Math.max(1, Math.floor(Number(search.accessPage) || 1)),
    accessPageSize: [10, 25, 50, 100].includes(Number(search.accessPageSize))
      ? Number(search.accessPageSize)
      : 25,
    tab:
      typeof search.tab === "string" &&
      ["general", "locations", "channels", "agent", "whatsapp", "roles", "audit"].includes(
        search.tab,
      )
        ? search.tab
        : undefined,
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const accessSearch = Route.useSearch();
  const { tab: requestedTab } = accessSearch;
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManageSettings = can(user, "settings.manage");
  const allowedTabs = canManageSettings
    ? ["general", "locations", "channels", "agent", "whatsapp", "roles", "audit"]
    : can(user, "packages.read")
      ? ["agent"]
      : ["roles"];
  const tab = requestedTab && allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0];
  const canSyncGitHub = can(user, "packages.import");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [s, setS] = useState<AppSettings | null>(null);
  useEffect(() => {
    settingsService.get().then(setS);
  }, []);

  const {
    data: rolloutPackages = [],
    isLoading: packagesLoading,
    isFetching: packagesFetching,
  } = useQuery({
    queryKey: ["device-rollout-packages"],
    queryFn: devicesService.listRolloutPackages,
    enabled: can(user, "packages.read"),
    refetchInterval: 30000,
  });

  const { data: githubSync, error: githubStatusError } = useQuery({
    queryKey: ["github-package-sync"],
    queryFn: devicesService.getGitHubSyncStatus,
    enabled: tab === "agent" && canSyncGitHub,
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.state ?? "") ? 2000 : 15000,
    retry: false,
  });
  const githubBusy = githubSync?.state === "queued" || githubSync?.state === "running";
  const lastSyncResult = useRef<string | null>(null);
  useEffect(() => {
    if (!githubSync?.id || !["completed", "failed"].includes(githubSync.state)) return;
    if (lastSyncResult.current === githubSync.id) return;
    lastSyncResult.current = githubSync.id;
    void qc.invalidateQueries({ queryKey: ["device-rollout-packages"] });
  }, [githubSync, qc]);

  const githubMutation = useMutation({
    mutationFn: devicesService.syncFromGitHub,
    onSuccess: (result) => {
      qc.setQueryData(["github-package-sync"], result);
      void qc.invalidateQueries({ queryKey: ["github-package-sync"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to start GitHub import."),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => devicesService.uploadRolloutPackage(file),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["device-rollout-packages"] });
      toast.success(
        result.alreadyExists
          ? `Package ${result.package.fileName} already exists and is ready to use.`
          : result.replacedExisting
            ? `Replaced ${result.package.fileName} with the latest build successfully.`
            : `Uploaded ${result.package.fileName} successfully.`,
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload MSI package.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileName: string) => devicesService.deleteRolloutPackage(fileName),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["device-rollout-packages"] });
      toast.success(`Removed ${result.fileName} from the package registry.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove MSI package.");
    },
  });

  if (!s) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const save = async () => {
    await settingsService.update(s);
    toast.success("Settings saved");
  };
  const latestPublishedPackage =
    rolloutPackages.find((item) => Boolean(item.version)) ?? rolloutPackages[0] ?? null;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure MTI Connect locations, channels, agents, and permissions."
        actions={
          canManageSettings && tab !== "locations" && tab !== "roles" ? (
            <Button onClick={save}>Save Changes</Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          void navigate({ search: { tab: value }, replace: true });
        }}
      >
        <TabsList className="flex-wrap">
          {allowedTabs.includes("general") && <TabsTrigger value="general">General</TabsTrigger>}
          {allowedTabs.includes("locations") && (
            <TabsTrigger value="locations">Sites & Areas</TabsTrigger>
          )}
          {allowedTabs.includes("channels") && <TabsTrigger value="channels">Channels</TabsTrigger>}
          {allowedTabs.includes("agent") && <TabsTrigger value="agent">Desktop Agent</TabsTrigger>}
          {allowedTabs.includes("whatsapp") && (
            <TabsTrigger value="whatsapp">WhatsApp Gateway</TabsTrigger>
          )}
          {allowedTabs.includes("roles") && (
            <TabsTrigger value="roles">Users &amp; Access</TabsTrigger>
          )}
          {allowedTabs.includes("audit") && <TabsTrigger value="audit">Audit Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="locations" className="mt-4">
          <SitesAreasSettings />
        </TabsContent>
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <Field label="Company Name">
                <Input
                  aria-label="Company Name"
                  value={s.general.companyName}
                  onChange={(e) =>
                    setS({ ...s, general: { ...s.general, companyName: e.target.value } })
                  }
                />
              </Field>
              <Field label="Timezone">
                <Input
                  aria-label="Timezone"
                  value={s.general.timezone}
                  onChange={(e) =>
                    setS({ ...s, general: { ...s.general, timezone: e.target.value } })
                  }
                />
              </Field>
              <Field label="Language">
                <Input
                  aria-label="Language"
                  value={s.general.language}
                  onChange={(e) =>
                    setS({ ...s, general: { ...s.general, language: e.target.value } })
                  }
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
              {[
                "Desktop Agent",
                "WhatsApp",
                "Email",
                "Digital Signage",
                "Telegram (planned)",
                "SMS (planned)",
              ].map((c) => (
                <div key={c} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">{c}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.includes("planned") ? "Not yet configured" : "Enabled"}
                    </div>
                  </div>
                  <Switch
                    defaultChecked={!c.includes("planned")}
                    disabled={c.includes("planned")}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="mt-4">
          <div className="space-y-4">
            {can(user, "settings.manage") && (
              <Card>
                <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                  <div className="md:col-span-2 flex items-center justify-between rounded-md border p-4">
                    <div>
                      <div className="font-medium">Agent Installer</div>
                      <div className="text-xs text-muted-foreground">
                        Manage the global Windows Agent package registry here before triggering
                        device-level rollouts.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => toast.info("Download — backend required")}
                    >
                      <Download className="mr-1 h-4 w-4" /> Download Installer
                    </Button>
                  </div>
                  <Field label="Current Version">
                    <Input
                      aria-label="Current Version"
                      value={s.desktopAgent.currentVersion}
                      onChange={(e) =>
                        setS({
                          ...s,
                          desktopAgent: { ...s.desktopAgent, currentVersion: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="Heartbeat Interval (seconds)">
                    <Input
                      aria-label="Heartbeat Interval (seconds)"
                      type="number"
                      value={s.desktopAgent.heartbeatSec}
                      onChange={(e) =>
                        setS({
                          ...s,
                          desktopAgent: { ...s.desktopAgent, heartbeatSec: Number(e.target.value) },
                        })
                      }
                    />
                  </Field>
                  <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label>Auto-update Agents</Label>
                      <p className="text-xs text-muted-foreground">
                        Push new versions automatically to online devices.
                      </p>
                    </div>
                    <Switch
                      checked={s.desktopAgent.autoUpdate}
                      onCheckedChange={(v) =>
                        setS({ ...s, desktopAgent: { ...s.desktopAgent, autoUpdate: v } })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Package className="h-4 w-4" />
                      Package Registry
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Upload signed MSI packages once here. Device rollout dialogs will reuse this
                      global package list.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                      onClick={() => {
                        void qc.invalidateQueries({ queryKey: ["device-rollout-packages"] });
                        void qc.invalidateQueries({ queryKey: ["github-package-sync"] });
                      }}
                    >
                      {packagesFetching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                    {canSyncGitHub && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          githubBusy || githubMutation.isPending || uploadMutation.isPending
                        }
                        onClick={() => githubMutation.mutate()}
                      >
                        {githubBusy || githubMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Github className="mr-2 h-4 w-4" />
                        )}
                        {githubBusy || githubMutation.isPending
                          ? "Getting from GitHub…"
                          : "Get from GitHub"}
                      </Button>
                    )}
                    <Button
                      type="button"
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
                  </div>
                </div>

                {canSyncGitHub && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-md border bg-muted/30 p-3 text-sm"
                  >
                    <p
                      className={
                        githubSync?.state === "failed" || githubStatusError
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {githubStatusError
                        ? "Unable to check GitHub import status. Refresh to retry."
                        : (githubSync?.message ?? "Checking GitHub import availability…")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get published packages from GitHub and verify their signature before adding
                      them here. Device rollout is a separate action.
                    </p>
                  </div>
                )}

                {latestPublishedPackage && (
                  <div className="rounded-md border bg-muted/30 p-4">
                    <div className="mb-3 text-sm font-medium">Latest Published Package</div>
                    <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <InfoRow label="Version" value={latestPublishedPackage.version ?? "-"} />
                      <InfoRow label="File" value={latestPublishedPackage.fileName} />
                      <InfoRow
                        label="Signature"
                        value={latestPublishedPackage.signatureStatus ?? "-"}
                      />
                      <InfoRow
                        label="Updated"
                        value={new Date(latestPublishedPackage.lastModifiedAt).toLocaleString()}
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-md border">
                  <div className="grid grid-cols-[minmax(0,2fr)_110px_120px_160px_110px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <div>Package</div>
                    <div>Version</div>
                    <div>Signature</div>
                    <div>Updated</div>
                    <div className="text-right">Action</div>
                  </div>
                  {packagesLoading ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Loading published MSI packages...
                    </div>
                  ) : rolloutPackages.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      No MSI packages are published yet. Upload a signed package here before
                      creating device rollouts.
                    </div>
                  ) : (
                    rolloutPackages.map((pkg) => (
                      <div
                        key={pkg.packageUrl}
                        className="grid grid-cols-[minmax(0,2fr)_110px_120px_160px_110px] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{pkg.fileName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {pkg.packageUrl}
                          </div>
                        </div>
                        <div>{pkg.version ?? "-"}</div>
                        <div>{pkg.signatureStatus ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(pkg.lastModifiedAt).toLocaleString()}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!can(user, "packages.delete") || deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(pkg.fileName)}
                          >
                            {deleteMutation.isPending &&
                            deleteMutation.variables === pkg.fileName ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Remove
                          </Button>
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
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <Field label="Gateway URL">
                <Input
                  aria-label="Gateway URL"
                  value={s.whatsapp.gatewayUrl}
                  onChange={(e) =>
                    setS({ ...s, whatsapp: { ...s.whatsapp, gatewayUrl: e.target.value } })
                  }
                />
              </Field>
              <Field label="Webhook URL">
                <Input
                  aria-label="Webhook URL"
                  value={s.whatsapp.webhookUrl}
                  onChange={(e) =>
                    setS({ ...s, whatsapp: { ...s.whatsapp, webhookUrl: e.target.value } })
                  }
                />
              </Field>
              <Field label="Default Template">
                <Input
                  aria-label="Default Template"
                  value={s.whatsapp.defaultTemplate}
                  onChange={(e) =>
                    setS({ ...s, whatsapp: { ...s.whatsapp, defaultTemplate: e.target.value } })
                  }
                />
              </Field>
              <Field label="Retry Attempts">
                <Input
                  aria-label="Retry Attempts"
                  type="number"
                  value={s.whatsapp.retryAttempts}
                  onChange={(e) =>
                    setS({
                      ...s,
                      whatsapp: { ...s.whatsapp, retryAttempts: Number(e.target.value) },
                    })
                  }
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <UsersAccessSettings
            search={accessSearch}
            onSearch={(next) => {
              void navigate({ search: { ...next, tab: "roles" }, replace: true });
            }}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              See the full{" "}
              <a className="text-primary underline" href="/audit-logs">
                Audit Logs
              </a>{" "}
              page for filtering and export.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
