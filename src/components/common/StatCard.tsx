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
      <CardContent className="relative p-6">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 text-muted-foreground/5"
          strokeWidth={1}
        />
        <div className="relative flex items-start gap-4">
          <div className={cn("shrink-0 rounded-xl p-3", toneMap[tone])}>
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
