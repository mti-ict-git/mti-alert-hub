import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { devicesService } from "@/services/devices.service";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/devices")({
  component: DevicesPage,
});

function DevicesPage() {
  const { data = [] } = useQuery({ queryKey: ["devices"], queryFn: devicesService.list, refetchInterval: 8000 });

  const online = data.filter((d) => d.status === "Online").length;

  return (
    <div>
      <PageHeader title="Desktop Agents" description={`${online} of ${data.length} agents online.`} />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead><TableHead>Device ID</TableHead><TableHead>Hostname</TableHead><TableHead>Site</TableHead><TableHead>Area</TableHead><TableHead>Location</TableHead><TableHead>Ownership</TableHead><TableHead>Assigned Employee</TableHead><TableHead>Version</TableHead><TableHead>Last Seen</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${d.status === "Online" ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                        <StatusBadge status={d.status} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.deviceId}</TableCell>
                    <TableCell className="font-medium">{d.hostname}</TableCell>
                    <TableCell className="text-sm">{d.siteName ?? d.siteId}</TableCell>
                    <TableCell className="text-sm">{d.areaName ?? "-"}</TableCell>
                    <TableCell className="text-sm">{d.locationLabel ?? "-"}</TableCell>
                    <TableCell className="text-sm">{d.ownershipMode}</TableCell>
                    <TableCell className="text-sm">{d.primaryEmployeeName ?? "-"}</TableCell>
                    <TableCell className="text-xs">{d.agentVersion ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {d.lastSeen
                        ? formatDistanceToNow(new Date(d.lastSeen), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await devicesService.sendTest(d.id);
                            toast.success(`Test sent to ${d.hostname}`);
                          } catch (error) {
                            toast.info(
                              error instanceof Error
                                ? error.message
                                : "Device test action is not available yet.",
                            );
                          }
                        }}
                      >
                        <Send className="mr-1 h-3 w-3" /> Test
                      </Button>
                    </TableCell>
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
