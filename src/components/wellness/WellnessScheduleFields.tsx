import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  WELLNESS_RECURRENCE_PRESETS,
  buildWellnessRecurrenceRule,
  formatWellnessRecurrenceSummary,
  type WellnessRecurrenceUnit,
} from "@/lib/wellness-authoring";
import { UTC_OFFSET_TIME_ZONE_OPTIONS, normalizeUtcOffsetTimeZone } from "@/lib/timezone-options";
import type { WellnessDistributionMode } from "@/types";

type WellnessScheduleFieldsProps = {
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  validUntil: string;
  onValidUntilChange: (value: string) => void;
  timezone: string;
  onTimezoneChange: (value: string) => void;
  recurrenceInterval: string;
  onRecurrenceIntervalChange: (value: string) => void;
  recurrenceUnit: WellnessRecurrenceUnit;
  onRecurrenceUnitChange: (value: WellnessRecurrenceUnit) => void;
  neverExpires: boolean;
  onNeverExpiresChange: (checked: boolean) => void;
  distributionMode: WellnessDistributionMode;
  onDistributionModeChange: (value: WellnessDistributionMode) => void;
  staggerWindowMinutes: string;
  onStaggerWindowMinutesChange: (value: string) => void;
  showExecutionMode?: boolean;
};

export function WellnessScheduleFields(props: WellnessScheduleFieldsProps) {
  const timezoneId = useId();
  const recurrenceSummary = formatWellnessRecurrenceSummary(
    buildWellnessRecurrenceRule({
      interval: Number.parseInt(props.recurrenceInterval || "1", 10) || 1,
      unit: props.recurrenceUnit,
    }),
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-slate-900">Recurrence Builder</div>
            <p className="mt-1 text-xs text-slate-600">
              Set the cadence in operator language. The app will generate the recurrence rule for
              the backend contract.
            </p>
          </div>
          <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700">
            {recurrenceSummary}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {WELLNESS_RECURRENCE_PRESETS.map((preset) => {
            const isActive =
              preset.interval.toString() === props.recurrenceInterval &&
              preset.unit === props.recurrenceUnit;

            return (
              <Button
                key={preset.label}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => {
                  props.onRecurrenceIntervalChange(preset.interval.toString());
                  props.onRecurrenceUnitChange(preset.unit);
                }}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label>Every</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={props.recurrenceInterval}
              onChange={(event) => props.onRecurrenceIntervalChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select
              value={props.recurrenceUnit}
              onValueChange={(value) =>
                props.onRecurrenceUnitChange(value as WellnessRecurrenceUnit)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Minute">Minute</SelectItem>
                <SelectItem value="Hour">Hour</SelectItem>
                <SelectItem value="Day">Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>First Occurrence</Label>
          <Input
            type="datetime-local"
            value={props.scheduledAt}
            onChange={(event) => props.onScheduledAtChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Leave empty to let the routine start as soon as it is published.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
            <div>
              <div className="text-sm font-medium">Never Expires</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep the policy active until an operator deactivates it from the server.
              </p>
            </div>
            <Switch checked={props.neverExpires} onCheckedChange={props.onNeverExpiresChange} />
          </div>

          {!props.neverExpires && (
            <>
              <Label>Valid Until</Label>
              <Input
                type="datetime-local"
                value={props.validUntil}
                onChange={(event) => props.onValidUntilChange(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The routine stops generating new occurrences after this time.
              </p>
            </>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${props.showExecutionMode ? "md:grid-cols-2" : ""}`}>
        <div className="space-y-2">
          <Label htmlFor={timezoneId}>Timezone</Label>
          <Select
            value={normalizeUtcOffsetTimeZone(props.timezone)}
            onValueChange={props.onTimezoneChange}
          >
            <SelectTrigger id={timezoneId}>
              <SelectValue placeholder="Select UTC offset" />
            </SelectTrigger>
            <SelectContent className="w-[var(--radix-select-trigger-width)]">
              {UTC_OFFSET_TIME_ZONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Fixed UTC offset used for every device in this wellness schedule.
          </p>
        </div>

        {props.showExecutionMode && (
          <div className="space-y-2">
            <Label>Execution Mode</Label>
            <Input value="AgentLocalRoutine" disabled />
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div>
          <div className="text-sm font-medium">Distribution Mode</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Control whether all selected devices share the same first occurrence or receive a
            staggered local start window.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Distribution</Label>
            <Select
              value={props.distributionMode}
              onValueChange={(value) =>
                props.onDistributionModeChange(value as WellnessDistributionMode)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Synchronized">Synchronized</SelectItem>
                <SelectItem value="Staggered">Staggered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {props.distributionMode === "Staggered" && (
            <div className="space-y-2">
              <Label>Stagger Window (minutes)</Label>
              <Input
                type="number"
                min={5}
                max={720}
                step={5}
                value={props.staggerWindowMinutes}
                onChange={(event) => props.onStaggerWindowMinutesChange(event.target.value)}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {props.distributionMode === "Synchronized"
            ? "All selected devices follow the same schedule anchor."
            : "Each selected device receives a deterministic offset inside the stagger window to avoid simultaneous prompts."}
        </p>
      </div>
    </div>
  );
}
