import type { Priority, WellnessProgram } from "@/types";
import {
  Siren,
  TriangleAlert,
  Info,
  Heart,
  CircleCheckBig,
  StretchHorizontal,
  X,
} from "lucide-react";
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
            {wellnessProgram.programType === "GuidedRoutine" && (
              <div className="rounded-[22px] border border-emerald-200/80 bg-white/85 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <StretchHorizontal className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[1.35rem] font-semibold leading-tight text-emerald-700">
                          {title || "Time to Stretch!"}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-700">
                          {message || "You have been sitting for 2 hours."}
                        </div>
                      </div>
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-800">
                      {instruction || "Take 2-3 minutes to:"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[7.5rem_1fr] gap-4">
                  <div className="overflow-hidden rounded-[18px] border border-emerald-100 bg-gradient-to-b from-emerald-50 via-white to-emerald-50 px-2 py-3">
                    <div className="relative mx-auto h-36 w-24">
                      <div className="absolute left-7 top-1 h-5 w-5 rounded-full bg-[#F2C19B]" />
                      <div className="absolute left-[1.55rem] top-5 h-10 w-6 rounded-[12px] bg-emerald-500" />
                      <div className="absolute left-1 top-5 h-2 w-12 origin-bottom-left rotate-[-58deg] rounded-full bg-emerald-500" />
                      <div className="absolute left-[2.45rem] top-4 h-2 w-10 origin-bottom-left rotate-[-120deg] rounded-full bg-emerald-500" />
                      <div className="absolute left-[1.7rem] top-[3.75rem] h-11 w-2 origin-top rotate-[4deg] rounded-full bg-slate-700" />
                      <div className="absolute left-[2.55rem] top-[3.8rem] h-11 w-2 origin-top rotate-[-18deg] rounded-full bg-slate-700" />
                      <div className="absolute left-0 top-[5.2rem] h-6 w-5 rounded-t-md bg-emerald-200" />
                      <div className="absolute left-[0.55rem] top-[4rem] h-5 w-1 rounded-full bg-slate-400" />
                      <div className="absolute left-[3.7rem] top-[4.4rem] h-2 w-7 rounded-full bg-slate-500" />
                      <div className="absolute left-[4.55rem] top-[5.05rem] h-8 w-1 rounded-full bg-slate-500" />
                      <div className="absolute left-[3.35rem] top-[5rem] h-8 w-1 rounded-full bg-slate-500" />
                      <div className="absolute left-[4rem] top-[3.55rem] h-3 w-5 rounded-md border border-slate-300 bg-sky-100" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(wellnessProgram.steps ?? []).slice(0, 5).map((step) => (
                      <div key={step.stepKey} className="flex items-start gap-2">
                        <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="text-[0.92rem] font-medium leading-5 text-slate-800">
                          {step.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Heart className="h-4 w-4 fill-current" />
                  </div>
                  <div className="text-sm font-medium leading-5 text-slate-700">
                    Small movement today helps prevent pain later.
                  </div>
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
