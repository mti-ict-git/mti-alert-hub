import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/types";
import { AlertTriangle, Info, TriangleAlert } from "lucide-react";

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "Emergency" || priority === "Critical") {
    return (
      <Badge className="gap-1 rounded-full border-transparent bg-emergency px-[9px] py-[3px] text-xs font-normal leading-4 text-emergency-foreground hover:bg-emergency">
        <AlertTriangle className="h-3 w-3" /> {priority === "Critical" ? "Critical" : "Emergency"}
      </Badge>
    );
  }
  if (priority === "Warning") {
    return (
      <Badge className="gap-1 rounded-full border-transparent bg-warning px-[9px] py-[3px] text-xs font-normal leading-4 text-warning-foreground hover:bg-warning">
        <TriangleAlert className="h-3 w-3" /> Warning
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 rounded-full border-transparent bg-info px-[9px] py-[3px] text-xs font-normal leading-4 text-info-foreground hover:bg-info">
      <Info className="h-3 w-3" /> Info
    </Badge>
  );
}
