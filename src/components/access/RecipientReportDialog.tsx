import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/common/ListPagination";
import { useAuth } from "@/hooks/useAuth";
import { can } from "@/lib/access";
type Row = {
  deliveryJobId: string;
  recipientName: string;
  channel: string;
  jobStatus: string;
  siteName: string | null;
  areaName: string | null;
};
type Result = { items: Row[]; page: { totalItems: number; totalPages: number } };
export function RecipientReportDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const returnFocus = useRef(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25);
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["scoped-recipient-report", id, page, pageSize],
    queryFn: () =>
      apiClient.get<Result>(
        `/communications/${encodeURIComponent(id)}/deliveries?page=${page}&pageSize=${pageSize}`,
      ),
    retry: false,
  });
  const exportPage = () => {
    const cell = (value: string | null) =>
      '"' +
      String(value ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      ["Recipient", "Site", "Area", "Channel", "Status"],
      ...(query.data?.items ?? []).map((row) => [
        row.recipientName,
        row.siteName,
        row.areaName,
        row.channel,
        row.jobStatus,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `recipient-report-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Recipient report</DialogTitle>
          <DialogDescription>
            Delivery records and totals include only recipients within your current access scope.
            Historical location snapshots determine visibility.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={
              !can(user, "reports.export") ||
              !query.data?.items.length ||
              query.isFetching ||
              query.isError
            }
            onClick={exportPage}
          >
            Export current page
          </Button>
        </div>
        {query.isError ? (
          <div role="alert" className="space-y-3 text-sm">
            <p>
              {query.error instanceof Error && query.error.message
                ? query.error.message
                : "Unable to load recipient records."}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="min-h-48 overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Recipient", "Site", "Area", "Channel", "Status"].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  <TableRow>
                    <TableCell colSpan={5} role="status">
                      Loading recipient records…
                    </TableCell>
                  </TableRow>
                ) : !query.data?.items.length ? (
                  <TableRow>
                    <TableCell colSpan={5}>No delivery records in your scope.</TableCell>
                  </TableRow>
                ) : (
                  query.data.items.map((row) => (
                    <TableRow key={row.deliveryJobId}>
                      <TableCell>{row.recipientName}</TableCell>
                      <TableCell>{row.siteName ?? "—"}</TableCell>
                      <TableCell>{row.areaName ?? "—"}</TableCell>
                      <TableCell>{row.channel}</TableCell>
                      <TableCell>{row.jobStatus}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {!query.isError && (
          <ListPagination
            page={page}
            pageSize={pageSize}
            pageCount={Math.max(1, query.data?.page.totalPages ?? 1)}
            total={query.data?.page.totalItems ?? 0}
            busy={query.isFetching}
            serverTotal
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
