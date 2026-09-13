import { FilterChips } from "@/components/common/FilterChips";
import { ListPagination } from "@/components/common/ListPagination";
import { useListPagination } from "@/hooks/useListPagination";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employeesService } from "@/services/employees.service";
import { referenceService } from "@/services/reference.service";
import type { Employee } from "@/types";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ["employees"], queryFn: employeesService.list });
  const { data: organizationReference } = useQuery({
    queryKey: ["organization-reference"],
    queryFn: referenceService.getOrganizationReference,
  });

  const [site, setSite] = useState("all");
  const [area, setArea] = useState("all");
  const [dept, setDept] = useState("all");
  const [sec, setSec] = useState("all");
  const [windowsAgentFilter, setWindowsAgentFilter] = useState("all");
  const [whatsappFilter, setWhatsappFilter] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [q, setQ] = useState("");
  const sites = organizationReference?.sites ?? [];
  const areas = useMemo(() => organizationReference?.areas ?? [], [organizationReference?.areas]);
  const departments = useMemo(
    () => organizationReference?.departments ?? [],
    [organizationReference?.departments],
  );
  const sections = useMemo(
    () => organizationReference?.sections ?? [],
    [organizationReference?.sections],
  );
  const filteredAreas = useMemo(
    () => areas.filter((item) => site === "all" || item.siteId === site),
    [areas, site],
  );
  const filteredDepartments = useMemo(
    () => departments.filter((item) => site === "all" || item.siteId === site),
    [departments, site],
  );
  const filteredSections = useMemo(
    () => sections.filter((item) => dept === "all" || item.departmentId === dept),
    [dept, sections],
  );

  const filtered = useMemo(
    () =>
      data.filter(
        (e) =>
          (site === "all" || e.siteId === site) &&
          (area === "all" || e.areaId === area) &&
          (dept === "all" || e.departmentId === dept) &&
          (sec === "all" || e.sectionId === sec) &&
          (windowsAgentFilter === "all" ||
            String(e.preferredChannels.includes("WindowsAgent")) === windowsAgentFilter) &&
          (whatsappFilter === "all" ||
            String(e.preferredChannels.includes("WhatsApp")) === whatsappFilter) &&
          (statusF === "all" || e.status === statusF) &&
          (!q ||
            e.name.toLowerCase().includes(q.toLowerCase()) ||
            e.employeeId.toLowerCase().includes(q.toLowerCase()) ||
            (e.email ?? "").toLowerCase().includes(q.toLowerCase())),
      ),
    [data, site, area, dept, sec, windowsAgentFilter, whatsappFilter, statusF, q],
  );

  const pagination = useListPagination(
    filtered,
    JSON.stringify([q, site, area, dept, sec, windowsAgentFilter, whatsappFilter, statusF]),
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Search employees by site, department, and communication channel."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                toast.info("CSV import stays pending until the HR sync contract is implemented.")
              }
            >
              <Upload className="mr-1 h-4 w-4" /> Import CSV
            </Button>
            <Button
              onClick={() =>
                toast.info(
                  "Employee create/edit stays disabled because Phase 1 only exposes read endpoints.",
                )
              }
            >
              Add Employee
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <SearchInput placeholder="Search…" value={q} onValueChange={setQ} />
            <Select
              value={site}
              onValueChange={(value) => {
                setSite(value);
                setArea("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {sites.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={area} onValueChange={setArea} disabled={site === "all"}>
              <SelectTrigger>
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {filteredAreas.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={dept}
              onValueChange={(value) => {
                setDept(value);
                setSec("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {filteredDepartments.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sec} onValueChange={setSec} disabled={dept === "all"}>
              <SelectTrigger>
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {filteredSections.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={windowsAgentFilter} onValueChange={setWindowsAgentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Windows Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Windows Agent: any</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
            <Select value={whatsappFilter} onValueChange={setWhatsappFilter}>
              <SelectTrigger>
                <SelectValue placeholder="WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">WhatsApp: any</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FilterChips
            count={filtered.length}
            busy={isPending}
            filters={[
              {
                label: "Search",
                value: q,
                active: q !== "",
                onRemove: () => setQ(""),
              },
              {
                label: "Site",
                value: sites.find((item) => item.id === site)?.name ?? site,
                active: site !== "all" && site !== "",
                onRemove: () => {
                  setSite("all");
                  setArea("all");
                },
              },
              {
                label: "Area",
                value: areas.find((item) => item.id === area)?.name ?? area,
                active: area !== "all" && area !== "",
                onRemove: () => setArea("all"),
              },
              {
                label: "Department",
                value: departments.find((item) => item.id === dept)?.name ?? dept,
                active: dept !== "all" && dept !== "",
                onRemove: () => {
                  setDept("all");
                  setSec("all");
                },
              },
              {
                label: "Section",
                value: sections.find((item) => item.id === sec)?.name ?? sec,
                active: sec !== "all" && sec !== "",
                onRemove: () => setSec("all"),
              },
              {
                label: "Desktop",
                value: windowsAgentFilter === "true" ? "Yes" : "No",
                active: windowsAgentFilter !== "all" && windowsAgentFilter !== "",
                onRemove: () => setWindowsAgentFilter("all"),
              },
              {
                label: "WhatsApp",
                value: whatsappFilter === "true" ? "Yes" : "No",
                active: whatsappFilter !== "all" && whatsappFilter !== "",
                onRemove: () => setWhatsappFilter("all"),
              },
              {
                label: "Status",
                value: statusF,
                active: statusF !== "all" && statusF !== "",
                onRemove: () => setStatusF("all"),
              },
            ]}
          />
          <div className="overflow-x-auto rounded-md border">
            <Table
              workspace={{
                label: "Employees",
                columns: [
                  "Employee ID",
                  "Name",
                  "Site",
                  "Area",
                  "Department",
                  "Section",
                  "Phone",
                  "Email",
                  "Preferred Channels",
                  "Status",
                ],
                identityColumn: 0,
              }}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Preferred Channels</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isPending || isError || !filtered.length) && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      {isPending ? (
                        "Loading employees…"
                      ) : isError ? (
                        <span role="alert">
                          Could not load employees.{" "}
                          <Button variant="outline" size="sm" onClick={() => void refetch()}>
                            Retry
                          </Button>
                        </span>
                      ) : (
                        "No employees match these filters."
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {pagination.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.employeeId}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.siteName ?? "-"}</TableCell>
                    <TableCell>{e.areaName ?? "-"}</TableCell>
                    <TableCell>{e.departmentName ?? "-"}</TableCell>
                    <TableCell>{e.sectionName ?? "-"}</TableCell>
                    <TableCell className="text-xs">{e.phone ?? "-"}</TableCell>
                    <TableCell className="text-xs">{e.email ?? "-"}</TableCell>
                    <TableCell className="text-xs">
                      {e.preferredChannels.join(", ") || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPagination {...pagination.controls} />
        </CardContent>
      </Card>
    </div>
  );
}
