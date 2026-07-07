import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { templatesService } from "@/services/templates.service";
import { Play } from "lucide-react";

export const Route = createFileRoute("/_app/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const nav = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["templates"], queryFn: templatesService.list });

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Policy-driven communication templates available for authoring in this phase."
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Priority</TableHead><TableHead>Channels</TableHead><TableHead>Require Ack</TableHead><TableHead>Locked Fields</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Loading templates...
                  </TableCell>
                </TableRow>
              )}
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.defaultChannels.join(", ")}</TableCell>
                  <TableCell>{t.requireAck ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.lockedFields?.length ? t.lockedFields.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => nav({ to: "/notifications/new", search: { template: t.id } })}>
                      <Play className="mr-1 h-3 w-3" /> Use
                    </Button>
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
