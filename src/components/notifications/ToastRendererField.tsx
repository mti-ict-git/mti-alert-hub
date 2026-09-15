import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export type ToastRenderer = "Auto" | "Native" | "Custom";
export function ToastRendererField({
  value,
  onChange,
}: {
  value: ToastRenderer;
  onChange: (value: ToastRenderer) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Toast style</Label>
      <Select value={value} onValueChange={(v) => onChange(v as ToastRenderer)}>
        <SelectTrigger aria-label="Toast style">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Custom">MTI Connect</SelectItem>
          <SelectItem value="Native">Windows native</SelectItem>
          <SelectItem value="Auto">Auto (legacy behavior)</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {value === "Custom"
          ? "MTI Connect design with optional instructions and Mark as read. Requires an updated agent."
          : value === "Native"
            ? "Windows controls the appearance and duration. Uses MTI Connect if Windows toast fails."
            : "Preserves existing behavior: an empty duration uses Windows native; an explicit duration uses MTI Connect."}
      </p>
    </div>
  );
}
