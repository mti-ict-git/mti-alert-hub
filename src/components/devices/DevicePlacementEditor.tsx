import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { referenceService } from "@/services/reference.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Device } from "@/types";
type Placement = {
  siteId: string;
  areaId: string | null;
  locationLabel: string | null;
  ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
};
type Snapshot = Placement & { id: string; hostname: string; department: string | null };
export function DevicePlacementEditor({
  targets,
  onClose,
}: {
  targets: Device[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [site, setSite] = useState("keep");
  const [area, setArea] = useState("keep");
  const [ownership, setOwnership] = useState("keep");
  const [labelMode, setLabelMode] = useState("keep");
  const [label, setLabel] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [results, setResults] = useState<{ hostname: string; ok: boolean; error?: string }[]>([]);
  const query = useQuery({
    queryKey: ["device-placement", targets.map((t) => t.id)],
    queryFn: () =>
      Promise.all(targets.map((t) => apiClient.get<Snapshot>(`/devices/${t.id}/placement`))),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const reference = useQuery({
    queryKey: ["reference", "organization"],
    queryFn: referenceService.getOrganizationReference,
  });
  const rows = query.data ?? [];
  const refs = reference.data;
  const effectiveSite =
    site !== "keep"
      ? site
      : rows.length && rows.every((r) => r.siteId === rows[0].siteId)
        ? rows[0].siteId
        : null;
  const changes: Partial<Placement> = {
    ...(site !== "keep" ? { siteId: site } : {}),
    ...(area !== "keep" ? { areaId: area === "none" ? null : area } : {}),
    ...(ownership !== "keep" ? { ownershipMode: ownership as Placement["ownershipMode"] } : {}),
    ...(labelMode !== "keep" ? { locationLabel: labelMode === "clear" ? null : label.trim() } : {}),
  };
  const dirty = Object.keys(changes).length > 0;
  function close() {
    if (busy) return;
    if (dirty && !results.length) setDiscard(true);
    else onClose();
  }
  const siteName = (id: string) => refs?.sites.find((s) => s.id === id)?.name ?? id;
  const areaName = (id: string | null) =>
    id ? (refs?.areas.find((a) => a.id === id)?.name ?? id) : "No area";
  async function save() {
    if (busy || !review || !dirty || results.length) return;
    setBusy(true);
    const output: typeof results = [];
    for (const row of rows) {
      const { siteId, areaId, locationLabel, ownershipMode } = row;
      try {
        await apiClient.patch(`/devices/${row.id}/placement`, {
          expected: { siteId, areaId, locationLabel, ownershipMode },
          changes,
        });
        output.push({ hostname: row.hostname, ok: true });
      } catch (e) {
        output.push({
          hostname: row.hostname,
          ok: false,
          error: e instanceof Error ? e.message : "Change could not be confirmed.",
        });
      }
      setResults([...output]);
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ["devices"] });
  }
  return (
    <>
      <Sheet
        open
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {targets.length === 1
                ? `Edit placement · ${targets[0].hostname}`
                : `Change placement · ${targets.length} devices`}
            </SheetTitle>
            <SheetDescription>
              Change device location and ownership. Department comes from the latest AD login and is
              read-only. Section is not used.
            </SheetDescription>
          </SheetHeader>
          {query.isPending || reference.isPending ? (
            <p className="py-6" role="status">
              Loading current placements…
            </p>
          ) : query.isError || reference.isError ? (
            <div role="alert" className="space-y-3 py-6">
              <p>Could not load placement data.</p>
              <Button
                onClick={() => {
                  void query.refetch();
                  void reference.refetch();
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-5 py-5">
              <div className="max-h-48 overflow-auto rounded-md border p-3 space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="text-sm">
                    <p className="font-medium">{r.hostname}</p>
                    <p className="text-muted-foreground">
                      {siteName(r.siteId)} / {areaName(r.areaId)} · {r.locationLabel || "No label"}{" "}
                      · {r.ownershipMode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Department (AD): {r.department || "Not reported"}
                    </p>
                  </div>
                ))}
              </div>
              {!review && !results.length && (
                <fieldset disabled={busy} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Select
                      value={site}
                      onValueChange={(v) => {
                        setSite(v);
                        setArea(v === "keep" ? "keep" : "none");
                      }}
                    >
                      <SelectTrigger aria-label="Placement site">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep">Do not change</SelectItem>
                        {refs?.sites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Area</Label>
                    <Select value={area} onValueChange={setArea}>
                      <SelectTrigger aria-label="Placement area">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {site === "keep" && <SelectItem value="keep">Do not change</SelectItem>}
                        <SelectItem value="none">No area (clear)</SelectItem>
                        {refs?.areas
                          .filter((a) => a.siteId === effectiveSite)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {effectiveSite
                        ? "Changing site clears the old area. Select an area for the new site if needed."
                        : "Selected devices span sites. Choose a common site to assign an area."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Location label</Label>
                    <Select value={labelMode} onValueChange={setLabelMode}>
                      <SelectTrigger aria-label="Location label action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep">Do not change</SelectItem>
                        <SelectItem value="set">Set label</SelectItem>
                        <SelectItem value="clear">Clear label</SelectItem>
                      </SelectContent>
                    </Select>
                    {labelMode === "set" && (
                      <Input
                        aria-label="New location label"
                        value={label}
                        maxLength={160}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Ownership</Label>
                    <Select value={ownership} onValueChange={setOwnership}>
                      <SelectTrigger aria-label="Placement ownership">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep">Do not change</SelectItem>
                        <SelectItem value="LocationOwned">Location owned</SelectItem>
                        <SelectItem value="EmployeeAssigned">Employee assigned</SelectItem>
                        <SelectItem value="Mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The assigned employee and AD profile are not changed.
                    </p>
                  </div>
                </fieldset>
              )}
              {review && (
                <div className="space-y-3">
                  <h3 className="font-medium">Review changes</h3>
                  {rows.map((r) => (
                    <div key={r.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{r.hostname}</p>
                      {changes.siteId !== undefined && (
                        <p>
                          Site: {siteName(r.siteId)} → {siteName(changes.siteId)}
                        </p>
                      )}
                      {changes.areaId !== undefined && (
                        <p>
                          Area: {areaName(r.areaId)} → {areaName(changes.areaId)}
                        </p>
                      )}
                      {changes.locationLabel !== undefined && (
                        <p>
                          Label: {r.locationLabel || "None"} → {changes.locationLabel || "None"}
                        </p>
                      )}
                      {changes.ownershipMode !== undefined && (
                        <p>
                          Ownership: {r.ownershipMode} → {changes.ownershipMode}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-sm text-muted-foreground">
                    This affects future audience resolution. Existing recipient records, delivery
                    history and active reminder policies are not rewritten.
                  </p>
                </div>
              )}
              {results.length > 0 && (
                <div role="status" className="space-y-2">
                  <p className="font-medium">
                    {results.filter((r) => r.ok).length} / {rows.length} saved
                  </p>
                  {results.map((r) => (
                    <p className="text-sm" key={r.hostname}>
                      {r.hostname}: {r.ok ? "Saved" : r.error}
                    </p>
                  ))}
                  {results.some((r) => !r.ok) && (
                    <p className="text-sm">
                      Refresh and review unconfirmed devices before retrying. No automatic retries.
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={close}>
                  {results.length ? "Close" : "Cancel"}
                </Button>
                {!results.length &&
                  (review ? (
                    <>
                      <Button variant="outline" disabled={busy} onClick={() => setReview(false)}>
                        Back
                      </Button>
                      <Button disabled={busy} onClick={() => void save()}>
                        {busy ? "Saving…" : "Save changes"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={!dirty || (labelMode === "set" && !label.trim())}
                      onClick={() => setReview(true)}
                    >
                      Review changes
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard placement changes?</DialogTitle>
            <DialogDescription>These changes have not been saved.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
            <Button onClick={onClose}>Discard changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
