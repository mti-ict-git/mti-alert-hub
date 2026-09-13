import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import { ListPagination } from "@/components/common/ListPagination";
import { useListPagination } from "@/hooks/useListPagination";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  organizationService,
  type OrganizationKind,
  type OrganizationEntry,
  type OrganizationInput,
} from "@/services/organization.service";
export const Route = createFileRoute("/_app/organization")({ component: OrganizationPage });
const labels = { sites: "Site", areas: "Area", departments: "Department", sections: "Section" };

function OrganizationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [group, setGroup] = useState("locations");
  const [kind, setKind] = useState<OrganizationKind>("sites");
  const [parent, setParent] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<{
    kind: OrganizationKind;
    entry: OrganizationEntry | null;
  } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [initial, setInitial] = useState("");
  const [form, setForm] = useState<OrganizationInput>({
    name: "",
    code: "",
    parentId: null,
    status: "Active",
  });
  const query = useQuery({
    queryKey: ["organization-management"],
    queryFn: organizationService.list,
    enabled: user?.role === "Admin",
  });
  const data = query.data;
  const parentKind = kind === "sections" ? "departments" : kind === "sites" ? null : "sites";
  const parents = parentKind ? (data?.[parentKind] ?? []) : [];
  const rows = (data?.[kind] ?? []).filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (parent === "all" || (r.parentId ?? "none") === parent) &&
      `${r.name} ${r.code ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pagination = useListPagination(rows, JSON.stringify([kind, parent, search, status]));
  const save = useMutation({
    mutationFn: () => organizationService.save(editor!.kind, editor!.entry?.id ?? null, form),
    onSuccess: async () => {
      setEditor(null);
      toast.success("Organization entry saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["organization-management"] }),
        qc.invalidateQueries({ queryKey: ["reference"] }),
        qc.invalidateQueries({ queryKey: ["devices"] }),
        qc.invalidateQueries({ queryKey: ["employees"] }),
      ]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save entry."),
  });
  function open(entry: OrganizationEntry | null) {
    const next: OrganizationInput = {
      name: entry?.name ?? "",
      code: entry?.code ?? "",
      status: entry?.status ?? "Active",
      parentId: entry?.parentId ?? (parent !== "all" && parent !== "none" ? parent : null),
      ...(entry ? { updatedAt: entry.updatedAt } : {}),
    };
    setForm(next);
    setInitial(JSON.stringify(next));
    setEditor({ kind, entry });
    save.reset();
  }
  function requestClose() {
    if (save.isPending) return;
    if (JSON.stringify(form) !== initial) setDiscardOpen(true);
    else setEditor(null);
  }
  function changeKind(next: OrganizationKind) {
    setKind(next);
    setParent("all");
    setSearch("");
    setStatus("all");
  }
  if (user?.role !== "Admin")
    return <div className="p-6">Organization management is available to administrators.</div>;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Organization"
        description="Manage locations and organization structure used by employees, devices and targeting."
        actions={
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <Tabs
        value={group}
        onValueChange={(v) => {
          setGroup(v);
          changeKind(v === "locations" ? "sites" : "departments");
        }}
      >
        <TabsList>
          <TabsTrigger value="locations">Sites & Areas</TabsTrigger>
          <TabsTrigger value="structure">Departments</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={kind} onValueChange={(v) => changeKind(v as OrganizationKind)}>
              <TabsList>
                {(group === "locations" ? ["sites", "areas"] : ["departments"]).map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {labels[k as OrganizationKind]}s
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button disabled={!data || query.isError} onClick={() => open(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add {labels[kind]}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1 sm:max-w-sm">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder={`Search ${labels[kind].toLowerCase()}s…`}
              />
            </div>
            {parentKind && (
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger
                  className="w-full sm:w-52"
                  aria-label={`Filter by ${labels[parentKind]}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {labels[parentKind].toLowerCase()}s</SelectItem>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {(search || parent !== "all" || status !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setParent("all");
                  setStatus("all");
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Deactivate entries to retain existing assignments and history. External sources are
            read-only.
          </p>
          {query.isError ? (
            <div role="alert" className="rounded-md border p-4">
              Could not load organization data.{" "}
              <Button variant="outline" onClick={() => void query.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  {parentKind && <TableHead>{labels[parentKind]}</TableHead>}
                  <TableHead>Usage</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={parentKind ? 7 : 6}
                      className="h-28 text-center text-muted-foreground"
                    >
                      {query.isPending
                        ? "Loading organization…"
                        : "No entries match. Adjust filters or add an entry."}
                    </TableCell>
                  </TableRow>
                )}
                {pagination.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.code || "—"}</TableCell>
                    {parentKind && (
                      <TableCell>
                        {parents.find((p) => p.id === r.parentId)?.name ?? "Unassigned"}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="whitespace-nowrap">
                        {r.employeeCount} employees · {r.deviceCount} devices
                      </span>
                    </TableCell>
                    <TableCell>{r.sourceSystem || "Local"}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {kind === "sites" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              changeKind(kind === "sites" ? "areas" : "sections");
                              setParent(r.id);
                            }}
                          >
                            {kind === "sites" ? "View areas" : "View sections"}
                          </Button>
                        ) : null}
                        {r.editable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Edit ${r.name}`}
                            onClick={() => open(r)}
                          >
                            <Pencil className="mr-2 h-3 w-3" />
                            Edit
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <LockKeyhole className="h-3 w-3" />
                            Read-only
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ListPagination {...pagination.controls} />
        </CardContent>
      </Card>
      <Dialog
        open={!!editor}
        onOpenChange={(v) => {
          if (!v) requestClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor?.entry ? "Edit" : "Add"} {editor ? labels[editor.kind] : "entry"}
            </DialogTitle>
            <DialogDescription>
              Changes affect shared organization choices. Existing assignments are retained when an
              entry is inactive.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (save.isPending) return;
              if (
                !form.name.trim() ||
                (kind === "sites" && !form.code.trim()) ||
                (kind === "areas" && !form.parentId)
              ) {
                toast.error("Complete the required name, code and parent fields.");
                return;
              }
              save.mutate();
            }}
          >
            <fieldset disabled={save.isPending} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  required
                  maxLength={160}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-code">
                  Code{kind === "sites" ? " (required)" : " (optional)"}
                </Label>
                <Input
                  id="org-code"
                  required={kind === "sites"}
                  maxLength={64}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              {parentKind && (
                <div className="space-y-2">
                  <Label>{labels[parentKind]}</Label>
                  <Select
                    disabled={!!editor?.entry || save.isPending}
                    value={form.parentId ?? "none"}
                    onValueChange={(v) => setForm({ ...form, parentId: v === "none" ? null : v })}
                  >
                    <SelectTrigger aria-label={labels[parentKind]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kind !== "areas" && <SelectItem value="none">Unassigned</SelectItem>}
                      {parents
                        .filter((p) => p.status === "Active" || p.id === form.parentId)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {editor?.entry && (
                    <p className="text-xs text-muted-foreground">
                      Parent placement is fixed to preserve current assignments.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  disabled={save.isPending}
                  onValueChange={(v) => setForm({ ...form, status: v as "Active" | "Inactive" })}
                >
                  <SelectTrigger aria-label="Entry status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.status === "Inactive" && (
                <p className="rounded-md border p-3 text-sm">
                  This entry will disappear from new targeting choices. Existing assignments remain.
                  Active children must be deactivated first.
                </p>
              )}
            </fieldset>
            {save.isError && (
              <p role="alert" className="text-sm text-destructive">
                {save.error.message}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={requestClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  save.isPending ||
                  !form.name.trim() ||
                  (kind === "sites" && !form.code.trim()) ||
                  (kind === "areas" && !form.parentId)
                }
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>Your changes have not been saved.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setDiscardOpen(false);
                setEditor(null);
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
