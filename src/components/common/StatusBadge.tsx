import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { className: string }> = {
  Sent: { className: "bg-success text-success-foreground" },
  Sending: { className: "bg-info text-info-foreground" },
  Queued: { className: "bg-info text-info-foreground" },
  Active: { className: "bg-success text-success-foreground" },
  Completed: { className: "bg-success text-success-foreground" },
  Scheduled: { className: "bg-warning text-warning-foreground" },
  Draft: { className: "bg-muted text-muted-foreground" },
  Cancelled: { className: "bg-muted text-muted-foreground" },
  Failed: { className: "bg-emergency text-emergency-foreground" },
  Delivered: { className: "bg-success text-success-foreground" },
  Displayed: { className: "bg-info text-info-foreground" },
  Read: { className: "bg-info text-info-foreground" },
  Overdue: { className: "bg-warning text-warning-foreground" },
  Responded: { className: "bg-success text-success-foreground" },
  Pending: { className: "bg-muted text-muted-foreground" },
  Online: { className: "bg-success text-success-foreground" },
  Offline: { className: "bg-muted text-muted-foreground" },
  Stale: { className: "bg-warning text-warning-foreground" },
  Inactive: { className: "bg-muted text-muted-foreground" },
  Safe: { className: "bg-success text-success-foreground" },
  NeedAssistance: { className: "bg-emergency text-emergency-foreground" },
  NotInArea: { className: "bg-warning text-warning-foreground" },
  Acknowledged: { className: "bg-info text-info-foreground" },
  NoResponse: { className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = map[status] ?? { className: "bg-muted text-muted-foreground" };
  const label = status.replace(/([A-Z])/g, " $1").trim();
  return <Badge className={cn("border-transparent hover:opacity-90", m.className, className)}>{label}</Badge>;
}
