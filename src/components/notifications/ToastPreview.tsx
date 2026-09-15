import { useState } from "react";

import { X } from "lucide-react";

import { MarkdownText } from "@/components/common/MarkdownText";

import type { ToastRenderer } from "./ToastRendererField";

export function ToastPreview({
  title,
  message,
  instruction,
  priority,
  renderer = "Auto",
  seconds,
}: {
  title: string;
  message: string;
  instruction?: string;
  priority: string;
  renderer?: ToastRenderer;
  seconds?: number | null;
}) {
  const [dark, setDark] = useState(false);

  const native = renderer === "Native" || (renderer === "Auto" && seconds == null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {native ? "Windows native · illustrative preview" : "MTI Connect preview"}
        </span>
        <div className="flex gap-1">
          {["Light", "Dark"].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={dark === (v === "Dark")}
              className="rounded border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setDark(v === "Dark")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div
        className={
          "rounded-xl border p-5 shadow-sm " +
          (dark
            ? "border-slate-700 bg-slate-900 text-slate-100"
            : "border-slate-200 bg-white text-slate-900")
        }
      >
        <div className="flex items-center gap-2">
          <img src="/images/brand/mti-connect-logo/logo-icon.png" alt="" className="h-7 w-7" />
          <div className="flex-1">
            <p className="text-sm font-semibold">MTI Connect</p>
            <p className="text-[11px] opacity-70">Employee Communications</p>
          </div>
          <X className="h-4 w-4 opacity-70" aria-hidden="true" />
        </div>
        <p className="mt-4 text-xs font-semibold">{priority}</p>
        <p className="mt-2 break-words text-lg font-semibold">{title || "Notification title"}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm opacity-80">
          {message || "Your message appears here."}
        </p>
        {!native && instruction && (
          <div className="mt-3 rounded-md border border-current/15 p-3">
            <p className="text-[10px] opacity-70">INSTRUCTION</p>
            <MarkdownText value={instruction} size="sm" className="mt-1 [&_*]:!text-inherit" />
          </div>
        )}
        {!native && (
          <div className="mt-4 flex justify-end gap-3 text-xs">
            <span className="px-3 py-2 opacity-70">Dismiss</span>
            <span className="rounded-md bg-blue-600 px-3 py-2 text-white">Mark as read</span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {native
          ? "Appearance and duration are managed by Windows."
          : "Auto-dismiss after " + (seconds ?? 5) + " seconds. Mark as read is optional."}{" "}
        Preview only; the recipient’s local theme setting controls the actual appearance.
      </p>
    </div>
  );
}
