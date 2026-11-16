import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ListPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  busy = false,
  serverTotal = false,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  busy?: boolean;
  serverTotal?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <nav
      aria-label="Table pages"
      className="flex flex-wrap items-center justify-between gap-3 px-3 pb-3 pt-4 text-xs text-muted-foreground"
    >
      <span role="status">
        {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}{" "}
        {serverTotal ? "results" : "loaded results"}
      </span>
      <div className="flex items-center gap-2">
        <Select
          disabled={busy}
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger aria-label="Rows per page" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md bg-sidebar-border text-muted-foreground hover:bg-sidebar-border/70"
          aria-label="Previous page"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="flex items-center gap-1.5 tabular-nums">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-(--brand-500) px-1.5 text-white">
            {page}
          </span>
          / {pageCount}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md bg-sidebar-border text-muted-foreground hover:bg-sidebar-border/70"
          aria-label="Next page"
          disabled={busy || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
