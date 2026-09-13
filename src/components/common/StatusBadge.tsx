import { CheckCircle2, Clock3, CircleAlert, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { className: string }> = {
  Sent: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Sending: { className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]" },
  Queued: { className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]" },
  Active: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Completed: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Scheduled: {
    className: "bg-warning/15 text-[color-mix(in_oklab,var(--warning),var(--foreground)_50%)]",
  },
  Draft: { className: "bg-muted text-muted-foreground" },
  Cancelled: { className: "bg-muted text-muted-foreground" },
  Failed: { className: "bg-emergency text-emergency-foreground" },
  Delivered: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Displayed: {
    className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]",
  },
  Read: { className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]" },
  Triggered: {
    className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]",
  },
  Started: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Snoozed: {
    className: "bg-warning/15 text-[color-mix(in_oklab,var(--warning),var(--foreground)_50%)]",
  },
  StepAdvanced: {
    className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]",
  },
  TimedOut: { className: "bg-emergency text-emergency-foreground" },
  Overdue: {
    className: "bg-warning/15 text-[color-mix(in_oklab,var(--warning),var(--foreground)_50%)]",
  },
  Responded: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Pending: { className: "bg-muted text-muted-foreground" },
  Online: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  Offline: { className: "bg-muted text-muted-foreground" },
  Stale: {
    className: "bg-warning/15 text-[color-mix(in_oklab,var(--warning),var(--foreground)_50%)]",
  },
  Inactive: { className: "bg-muted text-muted-foreground" },
  Safe: {
    className: "bg-success/15 text-[color-mix(in_oklab,var(--success),var(--foreground)_50%)]",
  },
  NeedAssistance: { className: "bg-emergency text-emergency-foreground" },
  NotInArea: {
    className: "bg-warning/15 text-[color-mix(in_oklab,var(--warning),var(--foreground)_50%)]",
  },
  Acknowledged: {
    className: "bg-info/15 text-[color-mix(in_oklab,var(--info),var(--foreground)_50%)]",
  },
  NoResponse: { className: "bg-muted text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = map[status] ?? { className: "bg-muted text-muted-foreground" };
  const Icon = ["Failed", "TimedOut", "NeedAssistance"].includes(status)
    ? CircleAlert
    : [
          "Sent",
          "Active",
          "Completed",
          "Delivered",
          "Started",
          "Responded",
          "Online",
          "Safe",
          "Acknowledged",
        ].includes(status)
      ? CheckCircle2
      : ["Scheduled", "Queued", "Sending", "Pending", "Snoozed", "Overdue"].includes(status)
        ? Clock3
        : Circle;
  const label = status.replace(/([A-Z])/g, " $1").trim();
  return (
    <Badge
      className={cn(
        "rounded-full border-transparent px-2.5 py-1 text-xs font-medium",
        m.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="mr-1 h-3 w-3 shrink-0" />
      {label}
    </Badge>
  );
}
