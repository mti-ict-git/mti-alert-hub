import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ActiveFilter = { label: string; value: string; onRemove: () => void; active?: boolean };
export function FilterChips({
  filters,
  count,
  busy = false,
}: {
  filters: ActiveFilter[];
  count: number;
  busy?: boolean;
}) {
  const active = filters.filter((f) => f.active ?? (f.value !== "all" && f.value !== ""));
  return (
    <div className="mb-3 flex min-h-10 flex-wrap items-center gap-2" aria-label="Active filters">
      <span role="status" className="mr-auto text-xs text-muted-foreground">
        {busy ? "Updating results…" : `${count} matching loaded result${count === 1 ? "" : "s"}`}
      </span>
      {active.map((f) => (
        <button
          key={f.label}
          type="button"
          aria-label={`Remove ${f.label} filter: ${f.value}`}
          onClick={f.onRemove}
          className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border bg-primary/5 px-3 py-1.5 text-xs text-foreground hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="truncate">
            {f.label}: {f.value}
          </span>
          <X aria-hidden="true" className="h-3 w-3 shrink-0" />
        </button>
      ))}
      {active.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => active.forEach((f) => f.onRemove())}
        >
          Reset filters
        </Button>
      )}
    </div>
  );
}
