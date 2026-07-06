import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/common/StatusBadge";
import { employeesService } from "@/services/employees.service";
import { DEPARTMENTS, POSITIONS, SECTIONS, SITES } from "@/data/reference";
import type { Employee } from "@/types";
import { Plus, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/employees")({
  component: EmployeesPage,
});

const EMPTY: Omit<Employee, "id"> = {
  employeeId: "", name: "", department: "ICT", section: "Infrastructure", position: "Engineer",
  site: "Acid Plant", phone: "", email: "", adUsername: "", hasPc: true, fieldOfficer: false, status: "Active",
};

function EmployeesPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["employees"], queryFn: employeesService.list });

  const [site, setSite] = useState("all");
  const [dept, setDept] = useState("all");
  const [sec, setSec] = useState("all");
  const [pcFilter, setPcFilter] = useState("all");
  const [foFilter, setFoFilter] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Omit<Employee, "id">>(EMPTY);

  const filtered = useMemo(
    () =>
      data.filter(
        (e) =>
          (site === "all" || e.site === site) &&
          (dept === "all" || e.department === dept) &&
          (sec === "all" || e.section === sec) &&
          (pcFilter === "all" || String(e.hasPc) === pcFilter) &&
          (foFilter === "all" || String(e.fieldOfficer) === foFilter) &&
          (statusF === "all" || e.status === statusF) &&
          (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.employeeId.includes(q)),
      ),
    [data, site, dept, sec, pcFilter, foFilter, statusF, q],
  );

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) return employeesService.update(editing.id, form);
      return employeesService.create(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      toast.success(editing ? "Employee updated" : "Employee added");
    },
  });

  function startAdd() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function startEdit(e: Employee) { setEditing(e); const { id: _id, ...rest } = e; setForm(rest); setOpen(true); }

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Directory of MTI officers and field personnel."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Import CSV — backend required")}><Upload className="mr-1 h-4 w-4" /> Import CSV</Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild><Button onClick={startAdd}><Plus className="mr-1 h-4 w-4" /> Add Employee</Button></SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{editing ? "Edit Employee" : "Add Employee"}</SheetTitle>
                  <SheetDescription>Employee record used for targeting notifications.</SheetDescription>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-3 p-4">
                  <Field label="Employee ID"><Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></Field>
                  <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label="AD Username"><Input value={form.adUsername} onChange={(e) => setForm({ ...form, adUsername: e.target.value })} /></Field>
                  <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="Position">
                    <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Site">
                    <Select value={form.site} onValueChange={(v) => setForm({ ...form, site: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SITES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Department">
                    <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v, section: SECTIONS[v]?.[0] ?? "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Section">
                    <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(SECTIONS[form.department] ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Employee["status"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <div className="col-span-2 flex items-center justify-between rounded-md border p-3">
                    <Label>Has PC</Label>
                    <Switch checked={form.hasPc} onCheckedChange={(v) => setForm({ ...form, hasPc: v })} />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-md border p-3">
                    <Label>Field Officer</Label>
                    <Switch checked={form.fieldOfficer} onCheckedChange={(v) => setForm({ ...form, fieldOfficer: v })} />
                  </div>
                </div>
                <SheetFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{editing ? "Save" : "Add"}</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={site} onValueChange={setSite}><SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger><SelectContent><SelectItem value="all">All sites</SelectItem>{SITES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={dept} onValueChange={(v) => { setDept(v); setSec("all"); }}><SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
            <Select value={sec} onValueChange={setSec} disabled={dept === "all"}><SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger><SelectContent><SelectItem value="all">All sections</SelectItem>{(dept !== "all" ? SECTIONS[dept] ?? [] : []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={pcFilter} onValueChange={setPcFilter}><SelectTrigger><SelectValue placeholder="Has PC" /></SelectTrigger><SelectContent><SelectItem value="all">Has PC: any</SelectItem><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select>
            <Select value={foFilter} onValueChange={setFoFilter}><SelectTrigger><SelectValue placeholder="Field Officer" /></SelectTrigger><SelectContent><SelectItem value="all">Field officer: any</SelectItem><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select>
            <Select value={statusF} onValueChange={setStatusF}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Section</TableHead><TableHead>Position</TableHead><TableHead>Site</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>AD</TableHead><TableHead>PC</TableHead><TableHead>Field</TableHead><TableHead>Status</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.employeeId}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.department}</TableCell>
                    <TableCell>{e.section}</TableCell>
                    <TableCell>{e.position}</TableCell>
                    <TableCell>{e.site}</TableCell>
                    <TableCell className="text-xs">{e.phone}</TableCell>
                    <TableCell className="text-xs">{e.email}</TableCell>
                    <TableCell className="text-xs">{e.adUsername}</TableCell>
                    <TableCell>{e.hasPc ? "Yes" : "No"}</TableCell>
                    <TableCell>{e.fieldOfficer ? "Yes" : "No"}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
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
