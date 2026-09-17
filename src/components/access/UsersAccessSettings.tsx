import { ListPagination } from "@/components/common/ListPagination";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  accessService,
  type AccessUser,
  type AccessRole,
  type AccessScope,
  type DirectoryUser,
} from "@/services/access.service";
import { referenceService } from "@/services/reference.service";
import { ApiError } from "@/services/api-client";
import { sessionService } from "@/services/session.service";
import { useAuth } from "@/hooks/useAuth";
import { AccessScopePicker } from "./AccessScopePicker";
import { AccessRoleMatrix } from "./AccessRoleMatrix";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/common/SearchInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";

export type AccessSearch = {
  accessTab?: string;
  accessSearch?: string;
  accessStatus?: string;
  accessRole?: string;
  accessSite?: string;
  accessPage?: number;
  accessPageSize?: number;
};
type Props = { search: AccessSearch; onSearch: (next: AccessSearch) => void };
const descriptions: Record<string, string> = {
  CentralAdmin: "Administrators manage the entire application.",
  ITOperator:
    "Package imports are global. Device upgrades remain limited to the selected locations.",
  CommunicationOperator:
    "Create and publish communications and wellness programs within the selected locations.",
  EmergencyOfficer: "Can publish emergency notifications after preview and confirmation.",
  ManagementViewer:
    "Read dashboards and recipient-level reports, and export within the selected locations.",
};
function Choice({
  label,
  value,
  onChange,
  items,
  placeholder = "Choose an option",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { id: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Search({
  label,
  value,
  onChange,
  onCompositionChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCompositionChange?: (v: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <SearchInput
        placeholder={label}
        value={value}
        onValueChange={onChange}
        onCompositionChange={onCompositionChange}
      />
    </div>
  );
}
export function UsersAccessSettings({ search, onSearch }: Props) {
  const qc = useQueryClient(),
    { user } = useAuth();
  const [typed, setTyped] = useState(search.accessSearch ?? ""),
    [composing, setComposing] = useState(false);
  const [editor, setEditor] = useState<"grant" | AccessUser | null>(null);
  const page = search.accessPage ?? 1,
    pageSize = search.accessPageSize ?? 25;
  const roles = useQuery({
    queryKey: ["access", "roles"],
    queryFn: accessService.roles,
    retry: false,
  });
  const org = useQuery({
    queryKey: ["access", "locations"],
    queryFn: referenceService.getOrganizationReference,
    retry: false,
  });
  const list = useQuery({
    queryKey: ["access", "users", search],
    queryFn: () =>
      accessService.list({
        page,
        pageSize,
        search: search.accessSearch,
        status: search.accessStatus,
        roleId: search.accessRole,
        siteId: search.accessSite,
      }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  useEffect(() => setTyped(search.accessSearch ?? ""), [search.accessSearch]);
  useEffect(() => {
    if (composing || typed === (search.accessSearch ?? "")) return;
    const timer = setTimeout(
      () => onSearch({ ...search, accessSearch: typed || undefined, accessPage: 1 }),
      typed ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [typed, composing, search, onSearch]);
  useEffect(() => {
    if (
      list.data &&
      !list.isPlaceholderData &&
      page > Math.max(1, Math.ceil(list.data.total / pageSize))
    )
      onSearch({ ...search, accessPage: Math.max(1, Math.ceil(list.data.total / pageSize)) });
  }, [list.data, list.isPlaceholderData, page, pageSize, search, onSearch]);
  const names = (scope: AccessScope) =>
    scope.scopeType === "Global"
      ? "Global"
      : ((scope.scopeType === "Site" ? org.data?.sites : org.data?.areas)?.find(
          (i) => i.id === scope.scopeValue,
        )?.name ?? "Unavailable location");
  const forbidden = [list.error, roles.error].some(
    (e) => e instanceof ApiError && e.status === 403,
  );
  if (forbidden)
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <p>You do not have permission to manage user access.</p>
          <a href="/" className="text-primary underline">
            Return to dashboard
          </a>
        </CardContent>
      </Card>
    );
  const filter = (key: keyof AccessSearch, value: string) =>
    onSearch({ ...search, [key]: value === "all" ? undefined : value, accessPage: 1 });
  const open = async (id: string) => {
    try {
      setEditor(await accessService.detail(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to load user.");
    }
  };
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Users &amp; Access</h2>
            <p className="text-sm text-muted-foreground">
              Assign one role and the locations each person can access.
            </p>
          </div>
          <Button data-access-return disabled={!roles.data} onClick={() => setEditor("grant")}>
            Grant access
          </Button>
        </div>
        <div className="flex gap-2" aria-label="Access views">
          {["users", "roles"].map((t) => (
            <Button
              key={t}
              variant={(search.accessTab ?? "users") === t ? "secondary" : "ghost"}
              aria-pressed={(search.accessTab ?? "users") === t}
              onClick={() => onSearch({ ...search, accessTab: t })}
            >
              {t === "users" ? "Users" : "Roles"}
            </Button>
          ))}
        </div>
        {search.accessTab === "roles" ? (
          roles.data ? (
            <AccessRoleMatrix roles={roles.data.items} />
          ) : (
            <p role="status">Loading roles…</p>
          )
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Search
                label="Search name or username"
                value={typed}
                onChange={setTyped}
                onCompositionChange={setComposing}
              />
              <Choice
                label="Status"
                value={search.accessStatus ?? "all"}
                onChange={(v) => filter("accessStatus", v)}
                items={["all", "Pending", "Active", "Disabled"].map((id) => ({
                  id,
                  label: id === "all" ? "All statuses" : id,
                }))}
              />
              <Choice
                label="Role"
                value={search.accessRole ?? "all"}
                onChange={(v) => filter("accessRole", v)}
                items={[{ id: "all", label: "All roles" }, ...(roles.data?.items ?? [])]}
              />
              <Choice
                label="Site"
                value={search.accessSite ?? "all"}
                onChange={(v) => filter("accessSite", v)}
                items={[
                  { id: "all", label: "All sites" },
                  ...(org.data?.sites ?? []).map((s) => ({ id: s.id, label: s.name })),
                ]}
              />
            </div>
            <div className="flex justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setTyped("");
                  onSearch({ accessTab: "users", accessPageSize: pageSize });
                }}
              >
                Reset filters
              </Button>
              <span role="status" className="text-sm text-muted-foreground">
                {list.isFetching ? "Refreshing users…" : ""}
              </span>
            </div>
            {list.error ? (
              <div role="alert" className="space-y-3 rounded-md border p-5">
                <p>Unable to load users.</p>
                <p className="text-sm text-muted-foreground">{list.error.message}</p>
                <Button variant="outline" onClick={() => void list.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Name / Username", "Role", "Scope", "Status", "Last login", "Actions"].map(
                      (h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        Loading users…
                      </TableCell>
                    </TableRow>
                  ) : !list.data?.items.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        {search.accessStatus === "Pending"
                          ? "No users are waiting for access."
                          : search.accessSearch ||
                              search.accessStatus ||
                              search.accessRole ||
                              search.accessSite
                            ? "No users match these filters."
                            : "No application users yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.data.items.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground">{u.username}</div>
                        </TableCell>
                        <TableCell>
                          {roles.data?.items.find((r) => r.id === u.roleId)?.label ??
                            (u.roleId ? "Needs review" : "Not assigned")}
                        </TableCell>
                        <TableCell>
                          <details>
                            <summary className="cursor-pointer">
                              {u.scopes.slice(0, 2).map(names).join(", ") || "Not assigned"}
                              {u.scopes.length > 2 ? " +" + (u.scopes.length - 2) + " more" : ""}
                            </summary>
                            <ul>
                              {u.scopes.map((s) => (
                                <li key={s.scopeType + s.scopeValue}>{names(s)}</li>
                              ))}
                            </ul>
                          </details>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleString("en-GB")
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => void open(u.id)}>
                            View access
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
            {list.data && !list.isError && (
              <ListPagination
                page={page}
                pageCount={Math.max(1, Math.ceil(list.data.total / pageSize))}
                pageSize={pageSize}
                total={list.data.total}
                serverTotal
                busy={list.isFetching}
                onPageChange={(next) => onSearch({ ...search, accessPage: next })}
                onPageSizeChange={(next) =>
                  onSearch({ ...search, accessPageSize: next, accessPage: 1 })
                }
              />
            )}
          </>
        )}
        {roles.error && (
          <p role="alert">
            Unable to load roles.{" "}
            <Button variant="link" onClick={() => void roles.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {editor && (
          <AccessEditor
            initial={editor}
            currentUserId={user?.id}
            roles={roles.data?.items ?? []}
            locations={org.data}
            locationError={org.error?.message}
            retryLocations={() => void org.refetch()}
            names={names}
            onClose={() => setEditor(null)}
            onSaved={() => {
              setEditor(null);
              void qc.invalidateQueries({ queryKey: ["access", "users"] });
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
type EditorProps = {
  initial: "grant" | AccessUser;
  currentUserId?: string;
  roles: import("@/services/access.service").RoleDefinition[];
  locations?: Awaited<ReturnType<typeof referenceService.getOrganizationReference>>;
  locationError?: string;
  retryLocations: () => void;
  names: (s: AccessScope) => string;
  onClose: () => void;
  onSaved: () => void;
};
function AccessEditor({
  initial,
  currentUserId,
  roles,
  locations,
  locationError,
  retryLocations,
  names,
  onClose,
  onSaved,
}: EditorProps) {
  const [record, setRecord] = useState<AccessUser | null>(initial === "grant" ? null : initial);
  const [step, setStep] = useState(initial === "grant" ? "user" : "view");
  const [identity, setIdentity] = useState<DirectoryUser | null>(null),
    [directorySearch, setDirectorySearch] = useState(""),
    [committed, setCommitted] = useState(""),
    [composing, setComposing] = useState(false);
  const [role, setRole] = useState<AccessRole | "">(
    initial === "grant" ? "" : (initial.roleId ?? ""),
  );
  const [scopes, setScopes] = useState<AccessScope[]>(initial === "grant" ? [] : initial.scopes);
  const [scopeMode, setScopeMode] = useState(
    initial === "grant"
      ? ""
      : initial.scopes.some((s) => s.scopeType === "Global")
        ? "global"
        : "locations",
  );
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [errorCode, setErrorCode] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "global" | null>(null),
    [action, setAction] = useState<"disable" | "revoke" | "enable" | null>(null);
  const request = useRef<{ payload: string; key: string } | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(() => setCommitted(directorySearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [directorySearch, composing]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const directory = useQuery({
    queryKey: ["access-directory", committed],
    queryFn: () => accessService.searchDirectory(committed),
    enabled: step === "user" && committed.length >= 3 && committed === directorySearch.trim(),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const close = () => {
    if (busy) return;
    if (dirty) setConfirm("discard");
    else onClose();
  };
  const begin = () => {
    setAction(null);
    setError("");
    setStep("access");
  };
  const title =
    action === "disable"
      ? "Disable access"
      : action === "revoke"
        ? "Sign out all sessions"
        : action === "enable"
          ? "Enable access"
          : record?.status === "Active"
            ? "Edit access"
            : "Grant access";
  const choose = async (candidate: DirectoryUser) => {
    setError("");
    setIdentity(candidate);
    setDirty(true);
    if (candidate.existingUserId) {
      try {
        const latest = await accessService.detail(candidate.existingUserId);
        setRecord(latest);
        setRole(latest.roleId ?? "");
        setScopes(latest.scopes);
        setScopeMode(
          latest.scopes.some((s) => s.scopeType === "Global")
            ? "global"
            : latest.scopes.length
              ? "locations"
              : "",
        );
        setStep(latest.status === "Pending" ? "access" : "view");
        setDirty(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load user.");
      }
    } else {
      setRecord(null);
      setStep("access");
    }
  };
  const validate = () => {
    if (!role) {
      setError("Choose one role.");
      document.querySelector<HTMLElement>('[role="dialog"] [aria-label="Role"]')?.focus();
      return false;
    }
    if (!scopes.length) {
      setError("Choose Global or at least one location.");
      document.querySelector<HTMLElement>('[role="dialog"] [aria-label="Scope"]')?.focus();
      return false;
    }
    if (reason.trim().length < 5 || reason.trim().length > 500) {
      setError("Enter a reason between 5 and 500 characters.");
      document.getElementById("access-reason")?.focus();
      return false;
    }
    if (
      record &&
      record.status !== "Pending" &&
      role === record.roleId &&
      JSON.stringify(scopes) === JSON.stringify(record.scopes)
    ) {
      setError("Change the role or scope before saving.");
      return false;
    }
    setError("");
    return true;
  };
  const save = async () => {
    if (busy) return;
    const payload =
      action === "disable" || action === "enable"
        ? {
            status: action === "disable" ? "Disabled" : "Active",
            expectedRevision: record?.revision,
            reason: reason.trim(),
          }
        : action === "revoke"
          ? { expectedRevision: record?.revision, reason: reason.trim() }
          : record
            ? { roleId: role, scopes, reason: reason.trim(), expectedRevision: record.revision }
            : {
                directoryId: identity?.directoryId,
                directorySubjectId: identity?.directorySubjectId,
                roleId: role,
                scopes,
                reason: reason.trim(),
              };
    const signature = JSON.stringify({ id: record?.id, action, payload });
    if (request.current?.payload !== signature)
      request.current = { payload: signature, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    setErrorCode("");
    try {
      const saved = record
        ? await accessService.change(
            record.id,
            action === "revoke"
              ? "revoke"
              : action === "disable" || action === "enable"
                ? "status"
                : "assignment",
            payload,
            request.current.key,
          )
        : await accessService.grant(payload, request.current.key);
      toast.success(
        action === "disable"
          ? "Access disabled."
          : action === "revoke"
            ? "Sessions revoked."
            : action === "enable"
              ? "Access enabled. The user can sign in again."
              : "Access saved for " + saved.fullName + ".",
      );
      if (saved.id === currentUserId) {
        sessionService.clearSession();
        window.location.assign("/login");
      }
      onSaved();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "The result could not be confirmed. Check this user's access before retrying.",
      );
      setErrorCode(e instanceof ApiError ? (e.code ?? "") : "");
      if (e instanceof ApiError && e.status === 422 && !action) setStep("access");
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    if (!record) return;
    try {
      const latest = await accessService.detail(record.id);
      setRecord(latest);
      setRole(latest.roleId ?? "");
      setScopes(latest.scopes);
      setScopeMode(latest.scopes.some((s) => s.scopeType === "Global") ? "global" : "locations");
      setError("");
      setErrorCode("");
      setAction(null);
      setStep("access");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to reload access.");
    }
  };
  return (
    <>
      <Sheet
        open
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <SheetContent
          className="flex w-full flex-col overflow-y-auto sm:max-w-xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>("button[data-access-return]")?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>{step === "view" ? "User access" : title}</SheetTitle>
            <SheetDescription>
              {record?.fullName ??
                identity?.fullName ??
                "Choose a directory user and review their access."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 py-5">
            <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
              {step === "user"
                ? "1. User"
                : step === "access"
                  ? "2. Access"
                  : step === "review"
                    ? "3. Review"
                    : step === "confirm"
                      ? "Review action"
                      : "Account details"}
            </h3>
            {error && (
              <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
                <p>{error}</p>
                {errorCode === "STALE_REVISION" && (
                  <Button variant="outline" onClick={() => void reload()}>
                    Reload latest
                  </Button>
                )}
              </div>
            )}
            {step === "user" && (
              <>
                <Search
                  label="AD user"
                  value={directorySearch}
                  onChange={setDirectorySearch}
                  onCompositionChange={setComposing}
                />
                <p className="text-sm text-muted-foreground">
                  Search by name or corporate username. Enter at least 3 characters.
                </p>
                {directorySearch.trim().length >= 3 &&
                  (committed !== directorySearch.trim() || directory.isFetching ? (
                    <p role="status">Searching directory…</p>
                  ) : directory.error ? (
                    <div role="alert">
                      <p>Directory lookup is unavailable. Try again.</p>
                      <Button variant="outline" onClick={() => void directory.refetch()}>
                        Retry
                      </Button>
                    </div>
                  ) : !directory.data?.items.length ? (
                    <p>No directory users found. Check the name or username.</p>
                  ) : (
                    <ul className="space-y-2">
                      {directory.data.items.map((i) => (
                        <li key={i.directorySubjectId}>
                          <Button
                            variant="outline"
                            className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                            onClick={() => void choose(i)}
                          >
                            <span>
                              <span className="block">{i.fullName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {i.username}
                                {i.existingUserId ? " · Already has an application record" : ""}
                              </span>
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ))}
              </>
            )}
            {step === "view" && record && (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <dt>Username</dt>
                  <dd>{record.username}</dd>
                  <dt>Status</dt>
                  <dd>{record.status}</dd>
                  <dt>Role</dt>
                  <dd>{roles.find((r) => r.id === record.roleId)?.label ?? "Not assigned"}</dd>
                  <dt>Scope</dt>
                  <dd>{record.scopes.map(names).join(", ") || "Not assigned"}</dd>
                  <dt>Last login</dt>
                  <dd>
                    {record.lastLoginAt
                      ? new Date(record.lastLoginAt).toLocaleString("en-GB")
                      : "Never"}
                  </dd>
                </dl>
                {!!record.legacyScopes?.length && (
                  <p role="status">Legacy locations need review before enabling access.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={begin}>
                    {record.status === "Pending" ? "Grant access" : "Edit access"}
                  </Button>
                  {record.isLastAdministrator && (
                    <p className="text-sm">
                      Keep at least one active Administrator with Global access.
                    </p>
                  )}
                  {record.status === "Active" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAction("revoke");
                          setReason("");
                          setStep("confirm");
                        }}
                      >
                        Sign out all sessions
                      </Button>
                      <Button
                        variant="outline"
                        disabled={record.isLastAdministrator}
                        onClick={() => {
                          setAction("disable");
                          setReason("");
                          setStep("confirm");
                        }}
                      >
                        Disable access
                      </Button>
                    </>
                  )}
                  {record.status === "Disabled" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAction("enable");
                        setReason("");
                        setStep("confirm");
                      }}
                    >
                      Enable access
                    </Button>
                  )}
                </div>
              </>
            )}
            {step === "access" && (
              <>
                <Choice
                  label="Role"
                  disabled={record?.isLastAdministrator}
                  value={role}
                  onChange={(v) => {
                    setRole(v as AccessRole);
                    setScopeMode(v === "CentralAdmin" ? "global" : "");
                    setScopes(
                      v === "CentralAdmin" ? [{ scopeType: "Global", scopeValue: "*" }] : [],
                    );
                    setDirty(true);
                  }}
                  items={roles}
                />
                {role && (
                  <p className="rounded-md border bg-muted/40 p-3 text-sm">{descriptions[role]}</p>
                )}
                <Choice
                  label="Scope"
                  value={scopeMode}
                  disabled={role === "CentralAdmin"}
                  onChange={(v) => {
                    setDirty(true);
                    if (v === "global" && scopes.some((s) => s.scopeType !== "Global")) {
                      setConfirm("global");
                      return;
                    }
                    setScopeMode(v);
                    setScopes(v === "global" ? [{ scopeType: "Global", scopeValue: "*" }] : []);
                  }}
                  items={[
                    { id: "global", label: "Global — all locations" },
                    { id: "locations", label: "Selected locations" },
                  ]}
                />
                {scopeMode === "global" && (
                  <p className="text-sm">
                    Review carefully: this grants access across every location.
                  </p>
                )}
                {scopeMode === "locations" &&
                  (locations ? (
                    <AccessScopePicker
                      sites={locations.sites}
                      areas={locations.areas}
                      value={scopes}
                      onChange={(v) => {
                        setScopes(v);
                        setDirty(true);
                      }}
                    />
                  ) : locationError ? (
                    <div role="alert">
                      Unable to load locations.{" "}
                      <Button variant="outline" onClick={retryLocations}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <p role="status">Loading locations…</p>
                  ))}
                {scopes
                  .filter((s) => s.scopeType !== "Global")
                  .map((s) => (
                    <Button
                      key={s.scopeType + s.scopeValue}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setScopes(scopes.filter((g) => g !== s));
                        setDirty(true);
                      }}
                      aria-label={"Remove " + names(s)}
                    >
                      {names(s)} ×
                    </Button>
                  ))}
              </>
            )}
            {(step === "access" || step === "confirm") && (
              <>
                <Label htmlFor="access-reason">Reason for change</Label>
                <Textarea
                  id="access-reason"
                  className="min-h-28 resize-none"
                  value={reason}
                  maxLength={500}
                  aria-invalid={Boolean(error && reason.trim().length < 5)}
                  aria-describedby="access-reason-help"
                  onChange={(e) => {
                    setReason(e.target.value);
                    setDirty(true);
                  }}
                />
                <p id="access-reason-help" className="text-xs text-muted-foreground">
                  {reason.trim().length}/500 characters. At least 5 required.
                </p>
              </>
            )}
            {step === "review" && (
              <>
                <div className="rounded-md border p-4 space-y-3">
                  <p className="font-medium">{record?.fullName ?? identity?.fullName}</p>
                  <p>{record?.username ?? identity?.username}</p>
                  <p>Role: {roles.find((r) => r.id === role)?.label}</p>
                  <p>{descriptions[role]}</p>
                  <p>Scope: {scopes.map(names).join(", ")}</p>
                  {record && (
                    <>
                      <p>
                        Previous role:{" "}
                        {roles.find((r) => r.id === record.roleId)?.label ?? "Not assigned"}
                      </p>
                      <p>
                        Added:{" "}
                        {scopes
                          .filter(
                            (s) =>
                              !record.scopes.some(
                                (g) => g.scopeType === s.scopeType && g.scopeValue === s.scopeValue,
                              ),
                          )
                          .map(names)
                          .join(", ") || "None"}
                      </p>
                      <p>
                        Removed:{" "}
                        {record.scopes
                          .filter(
                            (s) =>
                              !scopes.some(
                                (g) => g.scopeType === s.scopeType && g.scopeValue === s.scopeValue,
                              ),
                          )
                          .map(names)
                          .join(", ") || "None"}
                      </p>
                    </>
                  )}
                  <p className="whitespace-pre-wrap">Reason: {reason}</p>
                </div>
                <p className="text-sm">
                  Saving will sign this user out of all active sessions. They must sign in again.
                </p>
                {record?.id === currentUserId && <p>This change will sign you out.</p>}
              </>
            )}
            {step === "confirm" && (
              <div className="space-y-3">
                <p className="text-sm">
                  Role: {roles.find((r) => r.id === record?.roleId)?.label ?? "Not assigned"}
                </p>
                <p className="text-sm">
                  Scope: {record?.scopes.map(names).join(", ") || "Not assigned"}
                </p>
                <p className="text-sm">
                  {action === "disable"
                    ? "They will be signed out and cannot use MTI Connect. Their AD account will not be changed."
                    : action === "revoke"
                      ? "All current sessions will end. Their role and scope will stay the same, and they can sign in again."
                      : "The retained role and locations will be validated. Old sessions will remain signed out."}
                </p>
              </div>
            )}
          </div>
          <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" disabled={busy} onClick={close}>
              Close
            </Button>
            {step === "access" && (
              <Button
                onClick={() => {
                  if (validate()) setStep("review");
                }}
              >
                Review access
              </Button>
            )}
            {step === "review" && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setStep("access")}>
                  Back
                </Button>
                <Button disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : record?.status === "Active" ? "Save access" : "Grant access"}
                </Button>
              </>
            )}
            {step === "confirm" && (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setAction(null);
                    setStep("view");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant={action === "disable" ? "destructive" : "default"}
                  disabled={busy || reason.trim().length < 5}
                  onClick={() => void save()}
                >
                  {busy ? "Saving…" : title}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "discard" ? "Discard access changes?" : "Grant Global access?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "discard"
                ? "Your unsaved changes will be lost."
                : "Global access covers every location and replaces the selected location grants."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirm === "discard" ? "Keep editing" : "Keep locations"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "discard") onClose();
                else {
                  setScopeMode("global");
                  setScopes([{ scopeType: "Global", scopeValue: "*" }]);
                }
                setConfirm(null);
              }}
            >
              {confirm === "discard" ? "Discard" : "Use Global"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
