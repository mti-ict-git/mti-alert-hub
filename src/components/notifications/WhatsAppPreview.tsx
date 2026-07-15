import type { Priority } from "@/types";
import { MarkdownText } from "@/components/common/MarkdownText";
import { cn } from "@/lib/utils";

export function WhatsAppPreview({
  title,
  priority,
  site,
  instruction,
}: {
  title: string;
  priority: Priority;
  site?: string;
  instruction?: string;
}) {
  return (
    <div className="rounded-lg border bg-[#0b141a] p-3 text-[13px] text-[#e9edef]">
      <div className="mb-2 text-xs text-[#8696a0]">WhatsApp preview</div>
      <div className={cn("max-w-[320px] rounded-lg rounded-tl-none bg-[#202c33] p-3 shadow")}>
        <div className="font-semibold text-[#00a884]">🚨 MTI ALERT</div>
        <div className="mt-1">
          <div><span className="text-[#8696a0]">Priority:</span> {priority}</div>
          {site && <div><span className="text-[#8696a0]">Location:</span> {site}</div>}
          <div><span className="text-[#8696a0]">Title:</span> {title || "—"}</div>
          {instruction && (
            <div className="mt-2 rounded-md border border-[#2a3942] bg-[#182229] p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8696a0]">
                Instruction
              </div>
              <MarkdownText
                value={instruction}
                size="sm"
                className="mt-2"
              />
            </div>
          )}
        </div>
        <div className="mt-3 border-t border-[#2a3942] pt-2 text-[12px]">
          Reply:
          <div>1 = Safe</div>
          <div>2 = Need Assistance</div>
          <div>3 = Not in Area</div>
        </div>
        <div className="mt-2 text-right text-[10px] text-[#8696a0]">{new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
