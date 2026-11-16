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
    default: "bg-primary text-white",
    emergency: "bg-emergency text-white",
    warning: "bg-warning text-white",
    success: "bg-success text-white",
    info: "bg-info text-white",
  };
  return (
    <Card className="relative h-full overflow-hidden rounded-2xl shadow-[0_2px_4px_rgb(0_0_0/7.5%)]">
      <CardContent className="relative p-5">
        <div className="relative flex items-start gap-4">
          <div className={cn("shrink-0 rounded-lg p-2.5", toneMap[tone])}>
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-5 text-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
