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
import { Textarea } from "@/components/ui/textarea";
import {
  WELLNESS_ACTION_KINDS,
  WELLNESS_ACTION_STYLES,
  WELLNESS_PROGRAM_TYPES,
  WELLNESS_ROTATION_MODES,
  WELLNESS_THEMES,
  createDefaultWellnessAction,
  createDefaultWellnessProgram,
  createDefaultWellnessStep,
  getAllowedWellnessLayoutVariants,
  normalizeWellnessProgramDraft,
} from "@/lib/wellness-program";
import type { WellnessActionKind, WellnessProgram } from "@/types";

type Props = {
  value: WellnessProgram;
  onChange: (value: WellnessProgram) => void;
};

export function WellnessProgramEditor({ value, onChange }: Props) {
  const allowedLayouts = getAllowedWellnessLayoutVariants(value.programType);
  const normalizedValue = normalizeWellnessProgramDraft(value);

  function patch(nextValue: WellnessProgram) {
    onChange(normalizeWellnessProgramDraft(nextValue));
  }

  function handleProgramTypeChange(programType: WellnessProgram["programType"]) {
    if (programType === "GuidedRoutine") {
      patch({
        ...normalizedValue,
        ...createDefaultWellnessProgram("GuidedRoutine"),
        theme: normalizedValue.theme === "Blue" ? "Green" : normalizedValue.theme,
      });
      return;
    }

    patch({
      ...normalizedValue,
      ...createDefaultWellnessProgram("SimpleReminder"),
      theme: normalizedValue.theme,
    });
  }

  function handleActionKindChange(index: number, kind: WellnessActionKind) {
    const action = normalizedValue.actions[index];
    const nextActions = normalizedValue.actions.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            kind,
            label: createDefaultWellnessAction(kind, index + 1).label,
            snoozeMinutes: kind === "RemindMeLater" ? item.snoozeMinutes ?? 10 : null,
          }
        : item,
    );

    patch({ ...normalizedValue, actions: nextActions });
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <div className="text-sm font-medium">Wellness Program</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Build a reminder-specialized experience for Windows Agent using the locked MVP
          structure: one or two CTAs, bright theme, and optional guided steps.
        </p>
        {normalizedValue.programType === "SimpleReminder" && (
          <p className="mt-1 text-xs text-muted-foreground">
            `OverviewCard` maps to the English eye-break summary variant (`A4`).
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Program Type</Label>
          <Select
            value={normalizedValue.programType}
            onValueChange={(nextValue) =>
              handleProgramTypeChange(nextValue as WellnessProgram["programType"])
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WELLNESS_PROGRAM_TYPES.map((programType) => (
                <SelectItem key={programType} value={programType}>
                  {programType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Theme</Label>
          <Select
            value={normalizedValue.theme}
            onValueChange={(nextValue) =>
              patch({ ...normalizedValue, theme: nextValue as WellnessProgram["theme"] })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WELLNESS_THEMES.map((theme) => (
                <SelectItem key={theme} value={theme}>
                  {theme}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Layout</Label>
          <Select
            value={normalizedValue.layoutVariant}
            onValueChange={(nextValue) =>
              patch({
                ...normalizedValue,
                layoutVariant: nextValue as WellnessProgram["layoutVariant"],
              })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedLayouts.map((layout) => (
                <SelectItem key={layout} value={layout}>
                  {layout}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {normalizedValue.programType === "SimpleReminder" && (
          <div className="space-y-2">
            <Label>Rotation Mode</Label>
            <Select
              value={normalizedValue.rotationMode ?? "Fixed"}
              onValueChange={(nextValue) =>
                patch({
                  ...normalizedValue,
                  rotationMode: nextValue as WellnessProgram["rotationMode"],
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WELLNESS_ROTATION_MODES.map((rotationMode) => (
                  <SelectItem key={rotationMode} value={rotationMode}>
                    {rotationMode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {normalizedValue.layoutVariant === "CountdownCard" && (
          <div className="space-y-2">
            <Label>Countdown Seconds</Label>
            <Input
              type="number"
              min={1}
              max={3600}
              step={1}
              value={normalizedValue.countdownSeconds ?? ""}
              onChange={(event) =>
                patch({
                  ...normalizedValue,
                  countdownSeconds: parseOptionalNumber(event.target.value),
                })
              }
              placeholder="e.g. 20"
            />
          </div>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label>Hero Asset URL</Label>
          <Input
            value={normalizedValue.heroAssetUrl ?? ""}
            onChange={(event) =>
              patch({
                ...normalizedValue,
                heroAssetUrl: event.target.value,
              })
            }
            placeholder="Optional image URL for future agent rendering"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-dashed p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Visible Actions</div>
            <p className="text-xs text-muted-foreground">
              MVP stays focused on one or two buttons per card.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                ...normalizedValue,
                actions: [
                  ...normalizedValue.actions,
                  createDefaultWellnessAction("Done", normalizedValue.actions.length + 1),
                ],
              })
            }
            disabled={normalizedValue.actions.length >= 2}
          >
            Add Action
          </Button>
        </div>

        {normalizedValue.actions.map((action, index) => (
          <div key={`${action.actionKey}-${index}`} className="rounded-md border p-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select
                  value={action.kind}
                  onValueChange={(nextValue) =>
                    handleActionKindChange(index, nextValue as WellnessActionKind)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WELLNESS_ACTION_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={action.label}
                  onChange={(event) =>
                    patch({
                      ...normalizedValue,
                      actions: normalizedValue.actions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      ),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Style</Label>
                <Select
                  value={action.style ?? "Primary"}
                  onValueChange={(nextValue) =>
                    patch({
                      ...normalizedValue,
                      actions: normalizedValue.actions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, style: nextValue as (typeof WELLNESS_ACTION_STYLES)[number] }
                          : item,
                      ),
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WELLNESS_ACTION_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {style}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Snooze Minutes</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={action.kind === "RemindMeLater" ? action.snoozeMinutes ?? "" : ""}
                  onChange={(event) =>
                    patch({
                      ...normalizedValue,
                      actions: normalizedValue.actions.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, snoozeMinutes: parseOptionalNumber(event.target.value) }
                          : item,
                      ),
                    })
                  }
                  disabled={action.kind !== "RemindMeLater"}
                  placeholder={action.kind === "RemindMeLater" ? "10" : "Only for RemindMeLater"}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch({
                    ...normalizedValue,
                    actions: normalizedValue.actions.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
                disabled={normalizedValue.actions.length === 1}
              >
                Remove Action
              </Button>
            </div>
          </div>
        ))}
      </div>

      {normalizedValue.programType === "GuidedRoutine" && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Guided Steps</div>
              <p className="text-xs text-muted-foreground">
                Keep the MVP narrow: ordered steps with short descriptions and optional duration.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patch({
                  ...normalizedValue,
                  steps: [
                    ...(normalizedValue.steps ?? []),
                    createDefaultWellnessStep((normalizedValue.steps?.length ?? 0) + 1),
                  ],
                })
              }
            >
              Add Step
            </Button>
          </div>

          {(normalizedValue.steps ?? []).map((step, index) => (
            <div key={`${step.stepKey}-${index}`} className="rounded-md border p-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Step Title</Label>
                  <Input
                    value={step.title}
                    onChange={(event) =>
                      patch({
                        ...normalizedValue,
                        steps: (normalizedValue.steps ?? []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration Seconds</Label>
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    step={1}
                    value={step.durationSeconds ?? ""}
                    onChange={(event) =>
                      patch({
                        ...normalizedValue,
                        steps: (normalizedValue.steps ?? []).map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, durationSeconds: parseOptionalNumber(event.target.value) }
                            : item,
                        ),
                      })
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Asset URL</Label>
                  <Input
                    value={step.assetUrl ?? ""}
                    onChange={(event) =>
                      patch({
                        ...normalizedValue,
                        steps: (normalizedValue.steps ?? []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, assetUrl: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={step.description ?? ""}
                  onChange={(event) =>
                    patch({
                      ...normalizedValue,
                      steps: (normalizedValue.steps ?? []).map((item, itemIndex) =>
                        itemIndex === index ? { ...item, description: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="Short stretch instruction"
                />
              </div>

              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>Step order #{index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patch({
                      ...normalizedValue,
                      steps: (normalizedValue.steps ?? []).filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                  disabled={(normalizedValue.steps?.length ?? 0) === 1}
                >
                  Remove Step
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : null;
}
