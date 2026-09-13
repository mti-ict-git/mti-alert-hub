import * as React from "react";

import { Rows3, Columns3 } from "lucide-react";
import { useTableDensity } from "@/hooks/useTableDensity";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TableWorkspace = {
  label: string;
  columns: string[];
  /** Zero-based identifying column; preceding selection columns stay visible too. */
  identityColumn?: 0 | 1;
  leadingColumnWidth?: string;
};

type TableProps = React.HTMLAttributes<HTMLTableElement> & { workspace?: TableWorkspace };

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, workspace, style, ...props }, ref) => {
    const id = `table-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const [hidden, setHidden] = React.useState<number[]>([]);
    const { density, toggleDensity } = useTableDensity();
    const identity = workspace?.identityColumn ?? 0;
    const hiddenRules = hidden
      .map((i) => `#${id} tr > :nth-child(${i + 1}):not([colspan]){display:none}`)
      .join("\n");
    return (
      <div className="min-w-0">
        {workspace && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Scroll the table to see more columns
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={toggleDensity}
                aria-pressed={density === "compact"}
                aria-label="Compact table view"
              >
                <Rows3 aria-hidden="true" />
                {density === "compact" ? "Compact" : "Comfortable"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    <Columns3 aria-hidden="true" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  {workspace.columns.map((label, i) => (
                    <DropdownMenuCheckboxItem
                      key={label}
                      checked={!hidden.includes(i)}
                      disabled={
                        i <= identity ||
                        ["Status", "Priority", "Actions", "Quick Actions"].includes(label)
                      }
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) =>
                        setHidden((current) =>
                          checked ? current.filter((n) => n !== i) : [...current, i],
                        )
                      }
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setHidden([])}>
                    Show all columns
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
        <div
          role={workspace ? "region" : undefined}
          aria-label={workspace?.label}
          tabIndex={workspace ? 0 : undefined}
          className={cn(
            "relative w-full overflow-auto rounded-lg",
            workspace &&
              "max-h-[min(65vh,44rem)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          )}
        >
          {workspace && <style>{hiddenRules}</style>}
          <table
            id={id}
            ref={ref}
            data-workspace={workspace ? "true" : undefined}
            data-density={workspace ? density : undefined}
            data-identity={identity}
            aria-label={workspace?.label}
            style={
              {
                "--table-leading-width": workspace?.leadingColumnWidth ?? "2.5rem",
                ...style,
              } as React.CSSProperties
            }
            className={cn("w-full caption-bottom text-[13px]", className)}
            {...props}
          />
        </div>
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-muted/25 [&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-semibold text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
