import { PermissionAction } from "@/components/access/PermissionAction";
import { RecipientReportDialog } from "@/components/access/RecipientReportDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { sessionService } from "@/services/session.service";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { UsersAccessSettings, type AccessSearch } from "@/components/access/UsersAccessSettings";
import {
  roleLabels,
  rolePermissions,
  accessRole,
} from "../../backend/src/modules/access/model/permission-catalog";
import "@/styles.css";
const id = "11111111-1111-4111-8111-111111111111";
const users = [
  {
    id,
    username: "preview.pending",
    fullName: "Preview Pending User",
    email: null,
    status: "Pending",
    roleId: null,
    revision: 1,
    authorizationVersion: 1,
    lastLoginAt: null,
    scopes: [],
  },
];
users.push({
  ...users[0],
  id: "44444444-4444-4444-8444-444444444444",
  username: "preview.viewer",
  fullName: "Preview Active Viewer",
  status: "Active",
  roleId: "ManagementViewer",
  scopes: [{ scopeType: "Global", scopeValue: "*" }],
} as (typeof users)[number]);
let mode = "normal";
const results = new Map();
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin),
    p = url.pathname.replace("/api", "");
  await new Promise((r) => setTimeout(r, 250));
  if (mode === "forbidden")
    return response({ message: "You do not have permission to manage user access." }, 403);
  if (mode === "error") return response({ message: "Preview network failure" }, 503);
  if (p.startsWith("/communications/") && p.endsWith("/deliveries"))
    return response({
      items:
        mode === "empty"
          ? []
          : [
              {
                deliveryJobId: "fixture",
                recipientName: "Synthetic recipient",
                siteName: "Site A",
                areaName: "Area A",
                channel: "WindowsAgent",
                jobStatus: "Delivered",
              },
            ],
      page: { totalItems: mode === "empty" ? 0 : 1, totalPages: 1 },
    });
  if (p === "/access/roles")
    return response({
      items: accessRole.options.map((id) => ({
        id,
        label: roleLabels[id],
        permissions: rolePermissions[id],
      })),
    });
  if (p === "/reference/organization")
    return response({
      sites: [{ id: "22222222-2222-4222-8222-222222222222", name: "Morowali", code: "MRW" }],
      areas: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Acid Plant",
          siteId: "22222222-2222-4222-8222-222222222222",
        },
      ],
      departments: [],
      sections: [],
    });
  if (p === "/access/directory-users")
    return response({
      items: [
        {
          directoryId: "preview",
          directorySubjectId: id,
          username: "preview.new",
          fullName: "Preview Directory User",
          email: null,
        },
      ],
    });
  if (p === "/access/users" && !init?.method) {
    const items =
      mode === "empty"
        ? []
        : users.filter(
            (u) =>
              (!url.searchParams.get("status") || u.status === url.searchParams.get("status")) &&
              (!url.searchParams.get("roleId") || u.roleId === url.searchParams.get("roleId")) &&
              (!url.searchParams.get("search") ||
                u.fullName.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())),
          );
    return response({ items, total: items.length, page: 1, pageSize: 25 });
  }
  if (init?.method) {
    const key = new Headers(init.headers).get("Idempotency-Key");
    if (results.has(key)) return response(results.get(key));
    if (mode === "conflict")
      return response(
        { code: "STALE_REVISION", message: "Access was changed by another administrator." },
        409,
      );
    const data = JSON.parse(String(init.body));
    let target = users.find((u) => p.includes(u.id));
    if (!target) {
      target = {
        ...users[0],
        id: crypto.randomUUID(),
        username: "preview.new",
        fullName: "Preview Directory User",
      };
      users.push(target);
    }
    if (data.roleId) {
      Object.assign(target, {
        roleId: data.roleId,
        scopes: data.scopes,
        status: target.status === "Pending" ? "Active" : target.status,
      });
    }
    if (data.status) target.status = data.status;
    target.revision++;
    target.authorizationVersion++;
    results.set(key, structuredClone(target));
    return response(target);
  }
  return response(
    users.find((u) => p.endsWith(u.id)) ?? { message: "Not found" },
    users.some((u) => p.endsWith(u.id)) ? 200 : 404,
  );
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
function App() {
  const [showReport, setShowReport] = useState(false);
  const [search, setSearch] = useState<AccessSearch>({});
  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-sm">Isolated UI test · synthetic users · no production requests</p>
        <div className="flex flex-wrap gap-2">
          {["normal", "empty", "error", "conflict", "forbidden"].map((m) => (
            <button
              className="rounded border px-3 py-2"
              key={m}
              onClick={() => {
                mode = m;
                void client.invalidateQueries();
              }}
            >
              {m}
            </button>
          ))}
          <button
            className="rounded border px-3 py-2"
            onClick={() => document.documentElement.classList.toggle("dark")}
          >
            Toggle theme
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {accessRole.options.map((role) => (
            <Button
              key={role}
              variant="outline"
              onClick={() =>
                sessionService.setSession({
                  sessionToken: "synthetic-only",
                  user: {
                    id: "fixture-admin",
                    username: "preview",
                    name: "Preview",
                    email: "",
                    role: "Admin",
                    roleId: role,
                    permissions: [...rolePermissions[role]],
                    scopes: [{ scopeType: "Global", scopeValue: "*" }],
                  },
                })
              }
            >
              {roleLabels[role]}
            </Button>
          ))}
        </div>
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            <PermissionAction permission="notifications.publish">
              <Button>Publish notification</Button>
            </PermissionAction>
            <PermissionAction permission="notifications.emergency">
              <Button>Publish emergency</Button>
            </PermissionAction>
            <PermissionAction permission="packages.import">
              <Button>Import package</Button>
            </PermissionAction>
            <Button variant="outline" onClick={() => setShowReport(true)}>
              View recipient report
            </Button>
          </div>
        </TooltipProvider>
        {showReport && (
          <RecipientReportDialog id="synthetic" onClose={() => setShowReport(false)} />
        )}
        <UsersAccessSettings search={search} onSearch={setSearch} />
      </div>
      <Toaster />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <App />
  </QueryClientProvider>,
);
