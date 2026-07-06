import type { Priority } from "@/types";
import { Siren, TriangleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function DesktopPreview({
  title,
  message,
  priority,
  instruction,
}: {
  title: string;
  message: string;
  priority: Priority;
  instruction?: string;
}) {
  const Icon = priority === "Emergency" ? Siren : priority === "Warning" ? TriangleAlert : Info;
  const border =
    priority === "Emergency" ? "border-emergency" : priority === "Warning" ? "border-warning" : "border-info";
  const bar =
    priority === "Emergency" ? "bg-emergency" : priority === "Warning" ? "bg-warning" : "bg-info";
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="mb-2 text-xs text-muted-foreground">Desktop Agent popup preview</div>
      <div className={cn("relative max-w-sm overflow-hidden rounded-md border-2 bg-card shadow-lg", border)}>
        <div className={cn("h-1 w-full", bar)} />
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-md p-1.5 text-white", bar)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MTI Alert · {priority}</div>
          </div>
          <div className="mt-3 text-sm font-semibold">{title || "—"}</div>
          <p className="mt-1 text-sm text-muted-foreground">{message || "Notification message will appear here."}</p>
          {instruction && (
            <div className="mt-3 rounded-md bg-muted p-2 text-xs">
              <span className="font-medium">Instruction:</span> {instruction}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2 text-xs">
            <button className="rounded-md border px-3 py-1">Dismiss</button>
            <button className={cn("rounded-md px-3 py-1 text-white", bar)}>Acknowledge</button>
          </div>
        </div>
      </div>
    </div>
  );
}
