import type { ReactNode } from "react";
import { useRef } from "react";
import { Bold, Code2, Heading2, Italic, List, ListOrdered } from "lucide-react";

import { MarkdownText } from "@/components/common/MarkdownText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  previewEmptyText?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  rows = 4,
  previewEmptyText = "Preview will appear here.",
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function updateValue(nextValue: string, selectionStart?: number, selectionEnd?: number) {
    onChange(nextValue);

    if (selectionStart === undefined || selectionEnd === undefined) {
      return;
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function wrapSelection(prefix: string, suffix = prefix, placeholderText = "text") {
    const textarea = textareaRef.current;
    if (!textarea) {
      const fallbackValue = value
        ? `${value}${prefix}${placeholderText}${suffix}`
        : `${prefix}${placeholderText}${suffix}`;
      onChange(fallbackValue);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);
    const insertedText = selectedText || placeholderText;
    const nextValue = value.slice(0, start) + prefix + insertedText + suffix + value.slice(end);
    const innerStart = start + prefix.length;
    const innerEnd = innerStart + insertedText.length;

    updateValue(nextValue, innerStart, innerEnd);
  }

  function insertHeading() {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value ? `${value}\n## Heading` : "## Heading");
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    if (!selectedText) {
      const insertion = "## Heading";
      const nextValue = value.slice(0, start) + insertion + value.slice(end);
      updateValue(nextValue, start + 3, start + insertion.length);
      return;
    }

    const lines = selectedText.split("\n");
    const prefixed = lines.map((line) => (line.trim() ? `## ${line}` : line)).join("\n");
    const nextValue = value.slice(0, start) + prefixed + value.slice(end);
    updateValue(nextValue, start, start + prefixed.length);
  }

  function prefixLines(mode: "bullet" | "numbered") {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(mode === "bullet" ? "- item" : "1. item");
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      const insertion = mode === "bullet" ? "- item" : "1. item";
      const nextValue = value.slice(0, start) + insertion + value.slice(end);
      updateValue(nextValue, start + (mode === "bullet" ? 2 : 3), start + insertion.length);
      return;
    }

    const selectedText = value.slice(start, end);
    const transformed = selectedText
      .split("\n")
      .map((line, index) => {
        if (!line.trim()) {
          return line;
        }

        return mode === "bullet" ? `- ${line}` : `${index + 1}. ${line}`;
      })
      .join("\n");

    const nextValue = value.slice(0, start) + transformed + value.slice(end);
    updateValue(nextValue, start, start + transformed.length);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ToolbarButton
          label="Bold"
          icon={<Bold className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => wrapSelection("**")}
        />
        <ToolbarButton
          label="Italic"
          icon={<Italic className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => wrapSelection("*")}
        />
        <ToolbarButton
          label="Heading"
          icon={<Heading2 className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={insertHeading}
        />
        <ToolbarButton
          label="Bullet List"
          icon={<List className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => prefixLines("bullet")}
        />
        <ToolbarButton
          label="Numbered List"
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => prefixLines("numbered")}
        />
        <ToolbarButton
          label="Inline Code"
          icon={<Code2 className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => wrapSelection("`")}
        />
      </div>

      <Textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Live Preview
        </div>
        {value.trim() ? (
          <MarkdownText value={value} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{previewEmptyText}</p>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
