import type { Priority, WellnessProgram } from "@/types";
import { Siren, TriangleAlert, Info } from "lucide-react";
import { MarkdownText } from "@/components/common/MarkdownText";
import { cn } from "@/lib/utils";

export function DesktopPreview({
  title,
  message,
  priority,
  instruction,
  presentation = "Modal",
  toastAutoDismissSeconds,
  wellnessProgram,
}: {
  title: string;
  message: string;
  priority: Priority;
  instruction?: string;
  presentation?: "Toast" | "Modal" | "Fullscreen";
  toastAutoDismissSeconds?: number | null;
  wellnessProgram?: WellnessProgram | null;
}) {
  if (wellnessProgram) {
    const accent =
      wellnessProgram.theme === "Blue"
        ? "from-sky-500/15 via-sky-200/50 to-white border-sky-300"
        : "from-emerald-500/15 via-emerald-200/50 to-white border-emerald-300";
    const primaryButtonClass =
      wellnessProgram.theme === "Blue" ? "bg-sky-600 text-white" : "bg-emerald-600 text-white";

    return (
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="mb-2 text-xs text-muted-foreground">Windows Agent wellness preview</div>
        <div className={cn("overflow-hidden rounded-[24px] border bg-gradient-to-br shadow-lg", accent)}>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span>{wellnessProgram.programType}</span>
              <span>{wellnessProgram.theme}</span>
            </div>
            <div>
              <div className="text-xl font-semibold text-foreground">{title || "Wellness Program Title"}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {message || "Short reminder body will appear here for the wellness surface."}
              </p>
            </div>
            {wellnessProgram.layoutVariant === "CountdownCard" && (
              <div className="rounded-2xl bg-background/80 p-4 text-center shadow-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Countdown</div>
                <div className="mt-2 text-3xl font-semibold">
                  {wellnessProgram.countdownSeconds ?? 20}s
                </div>
              </div>
            )}
            {wellnessProgram.layoutVariant === "OverviewCard" && (
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-background/80 p-4 text-center shadow-sm">
                <div>
                  <div className="text-2xl font-semibold">20</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Minutes</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">20</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Feet</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">{wellnessProgram.countdownSeconds ?? 20}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Seconds</div>
                </div>
              </div>
            )}
            {wellnessProgram.programType === "GuidedRoutine" && (wellnessProgram.steps?.length ?? 0) > 0 && (
              <div className="rounded-2xl bg-background/80 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Guided Steps
                </div>
                <div className="mt-3 space-y-2">
                  {(wellnessProgram.steps ?? []).slice(0, 3).map((step) => (
                    <div key={step.stepKey} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-semibold">
                        {step.sortOrder}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{step.title}</div>
                        {step.description && (
                          <div className="text-xs text-muted-foreground">{step.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {instruction && (
              <div className="rounded-2xl bg-background/80 p-4 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Instruction
                </div>
                <MarkdownText value={instruction} size="sm" className="mt-2" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {wellnessProgram.actions.slice(0, 2).map((action, index) => (
                <button
                  key={action.actionKey}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium shadow-sm",
                    index === 0 ? primaryButtonClass : "border bg-background/80 text-foreground",
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCritical = priority === "Emergency" || priority === "Critical";
  const isToast = presentation === "Toast";
  const Icon = isCritical ? Siren : priority === "Warning" ? TriangleAlert : Info;
  const border =
    isCritical ? "border-emergency" : priority === "Warning" ? "border-warning" : "border-info";
  const bar =
    isCritical ? "bg-emergency" : priority === "Warning" ? "bg-warning" : "bg-info";
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="mb-2 text-xs text-muted-foreground">Desktop Agent popup preview</div>
      <div className={cn("relative overflow-hidden rounded-md border-2 bg-card shadow-lg", border, isToast ? "max-w-[22rem]" : "max-w-sm")}>
        <div className={cn("h-1 w-full", bar)} />
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-md p-1.5 text-white", bar)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              MTI Alert · {priority} · {presentation}
            </div>
          </div>
          <div className="mt-3 text-sm font-semibold">{title || "—"}</div>
          <p className="mt-1 text-sm text-muted-foreground">{message || "Notification message will appear here."}</p>
          {instruction && (
            <div className="mt-3 rounded-md bg-muted p-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Instruction
              </div>
              <MarkdownText value={instruction} size="sm" className="mt-2" />
            </div>
          )}
          {isToast ? (
            <div className="mt-4 text-xs text-muted-foreground">
              Auto-dismiss preview without action buttons after {toastAutoDismissSeconds ?? 5}s.
            </div>
          ) : (
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button className="rounded-md border px-3 py-1">Dismiss</button>
              <button className={cn("rounded-md px-3 py-1 text-white", bar)}>Acknowledge</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
