import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { templatesService } from "@/services/templates.service";
import type { Channel, Priority, Template } from "@/types";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/templates")({
  component: TemplatesPage,
});

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "DesktopAgent", label: "Desktop Agent" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Email", label: "Email" },
  { key: "DigitalSignage", label: "Digital Signage" },
];

const EMPTY: Omit<Template, "id"> = {
  name: "", category: "General", priority: "Info",
  defaultMessage: "", defaultInstruction: "", defaultChannels: ["DesktopAgent"], requireAck: false,
};

function TemplatesPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["templates"], queryFn: templatesService.list });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<Omit<Template, "id">>(EMPTY);

  const upsert = useMutation({
    mutationFn: async () => (editing ? templatesService.update(editing.id, form) : templatesService.create(form)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); setOpen(false); toast.success("Saved"); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => templatesService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Deleted"); },
  });

  const toggleChannel = (c: Channel) =>
    setForm((f) => ({ ...f, defaultChannels: f.defaultChannels.includes(c) ? f.defaultChannels.filter((x) => x !== c) : [...f.defaultChannels, c] }));

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Reusable notification templates for common scenarios."
        actions={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button onClick={() => { setEditing(null); setForm(EMPTY); }}><Plus className="mr-1 h-4 w-4" /> Create Template</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader><SheetTitle>{editing ? "Edit Template" : "Create Template"}</SheetTitle></SheetHeader>
              <div className="space-y-3 p-4">
                <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Info", "Warning", "Emergency"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Template["category"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["IT", "OHSE", "Security", "Operation", "HR", "General"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Default Message</Label><Textarea rows={3} value={form.defaultMessage} onChange={(e) => setForm({ ...form, defaultMessage: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Default Instruction</Label><Textarea rows={2} value={form.defaultInstruction} onChange={(e) => setForm({ ...form, defaultInstruction: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Default Channels</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHANNELS.map((c) => (
                      <Label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                        <Checkbox checked={form.defaultChannels.includes(c.key)} onCheckedChange={() => toggleChannel(c.key)} /> {c.label}
                      </Label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>Require Acknowledgement</Label>
                  <Switch checked={form.requireAck} onCheckedChange={(v) => setForm({ ...form, requireAck: v })} />
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>Save</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Priority</TableHead><TableHead>Channels</TableHead><TableHead>Require Ack</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.defaultChannels.join(", ")}</TableCell>
                  <TableCell>{t.requireAck ? "Yes" : "No"}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => nav({ to: "/notifications/new", search: { template: t.id } })}>
                      <Play className="mr-1 h-3 w-3" /> Use
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); const { id: _id, ...rest } = t; setForm(rest); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
