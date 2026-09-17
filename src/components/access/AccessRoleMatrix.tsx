import { useState } from "react";
import type { RoleDefinition } from "@/services/access.service";
import { SearchInput } from "@/components/common/SearchInput";
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

const labels: Record<string, string> = {
  "dashboard.read": "View dashboard",
  "reports.read": "View reports",
  "reports.export": "Export reports",
  "reports.recipients.read": "View recipient report details",
  "notifications.read": "View notifications",
  "notifications.draft": "Create and edit drafts",
  "notifications.publish": "Publish notifications",
  "notifications.cancel": "Cancel notifications",
  "notifications.emergency": "Send emergency notifications",
  "wellness.read": "View wellness programs",
  "wellness.manage": "Manage wellness programs",
  "wellness.publish": "Publish wellness programs",
  "templates.read": "View templates",
  "templates.manage": "Manage templates",
  "employees.read": "View employees",
  "devices.read": "View devices",
  "devices.enroll": "Approve or reject enrollment",
  "devices.placement": "Change device placement",
  "devices.revoke": "Revoke device sessions",
  "devices.test": "Send device test",
  "packages.read": "View package registry",
  "packages.import": "Import packages (Global)",
  "packages.delete": "Remove packages",
  "rollouts.preview": "Preview device upgrades",
  "rollouts.apply": "Apply device upgrades",
  "rollouts.read": "View device upgrades",
  "organization.manage": "Manage organization",
  "settings.manage": "Manage settings",
  "channels.manage": "Manage channels",
  "access.read": "View users and roles",
  "access.manage": "Manage user access",
  "audit.read": "View audit logs",
};
export function AccessRoleMatrix({ roles }: { roles: RoleDefinition[] }) {
  const [search, setSearch] = useState(""),
    [mobileRole, setMobileRole] = useState("");
  const active = mobileRole || roles[0]?.id;
  const rows = Object.entries(labels).filter(([, label]) =>
    label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Allowed actions are limited by each user's assigned scope unless marked Global. Built-in
        roles are read-only.
      </p>
      <SearchInput placeholder="Search permissions" value={search} onValueChange={setSearch} />
      <div className="md:hidden">
        <Select value={active} onValueChange={setMobileRole}>
          <SelectTrigger aria-label="Role to compare">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!rows.length ? (
        <p role="status" className="text-muted-foreground">
          No permissions match your search.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                {roles.map((role) => (
                  <TableHead
                    key={role.id}
                    className={role.id === active ? "" : "hidden md:table-cell"}
                  >
                    {role.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([id, label], index) => {
                const group = id.split(".")[0],
                  previous = rows[index - 1]?.[0].split(".")[0];
                return (
                  <TableRow key={id}>
                    <TableCell>
                      {group !== previous && (
                        <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                          {group}
                        </span>
                      )}
                      {label}
                    </TableCell>
                    {roles.map((role) => (
                      <TableCell
                        key={role.id}
                        className={role.id === active ? "" : "hidden md:table-cell"}
                      >
                        {role.permissions.includes(id) ? "Allowed" : "Not allowed"}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
