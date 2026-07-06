import { Badge } from "@/components/ui/badge";
import type { Priority } from "@/types";
import { AlertTriangle, Info, TriangleAlert } from "lucide-react";

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "Emergency") {
    return (
      <Badge className="gap-1 bg-emergency text-emergency-foreground hover:bg-emergency border-transparent">
        <AlertTriangle className="h-3 w-3" /> Emergency
      </Badge>
    );
  }
  if (priority === "Warning") {
    return (
      <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning border-transparent">
        <TriangleAlert className="h-3 w-3" /> Warning
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-info text-info-foreground hover:bg-info border-transparent">
      <Info className="h-3 w-3" /> Info
    </Badge>
  );
}
