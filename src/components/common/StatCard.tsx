import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "emergency" | "warning" | "success" | "info";
  hint?: string;
}) {
  const toneMap: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    emergency: "bg-emergency/10 text-emergency",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
  };
  return (
    <Card className="relative h-full overflow-hidden">
      <CardContent className="relative p-5">
        <div className="relative flex items-start gap-4">
          <div className={cn("shrink-0 rounded-lg border border-current/15 p-3", toneMap[tone])}>
            <Icon aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
