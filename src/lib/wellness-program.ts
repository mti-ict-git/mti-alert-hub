import type {
  WellnessAction,
  WellnessActionKind,
  WellnessLayoutVariant,
  WellnessProgram,
  WellnessProgramType,
  WellnessRotationMode,
  WellnessTheme,
} from "@/types";

export const WELLNESS_PROGRAM_TYPES: WellnessProgramType[] = ["SimpleReminder", "GuidedRoutine"];
export const WELLNESS_THEMES: WellnessTheme[] = ["Blue", "Green"];
export const WELLNESS_LAYOUT_VARIANTS: WellnessLayoutVariant[] = [
  "ReminderCard",
  "CountdownCard",
  "OverviewCard",
  "GuidedRoutine",
  "CompletionCard",
];
export const WELLNESS_ROTATION_MODES: WellnessRotationMode[] = ["Fixed", "Sequential", "Random"];
export const WELLNESS_ACTION_KINDS: WellnessActionKind[] = [
  "GotIt",
  "Done",
  "Start",
  "Next",
  "Close",
  "RemindMeLater",
];
export const WELLNESS_ACTION_STYLES = ["Primary", "Secondary", "Ghost"] as const;

export function getAllowedWellnessLayoutVariants(
  programType: WellnessProgramType,
): WellnessLayoutVariant[] {
  if (programType === "GuidedRoutine") {
    return ["GuidedRoutine"];
  }

  return ["ReminderCard", "CountdownCard", "OverviewCard", "CompletionCard"];
}

export function createDefaultWellnessAction(
  kind: WellnessActionKind,
  index: number,
): WellnessAction {
  return {
    actionKey: `action_${index}`,
    kind,
    label: getDefaultActionLabel(kind),
    style: index === 1 ? "Primary" : "Secondary",
    snoozeMinutes: kind === "RemindMeLater" ? 10 : null,
  };
}

export function createDefaultWellnessProgram(
  programType: WellnessProgramType = "SimpleReminder",
): WellnessProgram {
  if (programType === "GuidedRoutine") {
    return {
      programType,
      theme: "Green",
      layoutVariant: "GuidedRoutine",
      heroAssetUrl: null,
      countdownSeconds: null,
      rotationMode: null,
      actions: [
        createDefaultWellnessAction("Start", 1),
        createDefaultWellnessAction("RemindMeLater", 2),
      ],
      steps: createDefaultStretchingSteps(),
      localizations: [],
    };
  }

  return {
    programType,
    theme: "Blue",
    layoutVariant: "ReminderCard",
    heroAssetUrl: null,
    countdownSeconds: null,
    rotationMode: "Fixed",
    actions: [
      createDefaultWellnessAction("GotIt", 1),
      createDefaultWellnessAction("RemindMeLater", 2),
    ],
    steps: [],
    localizations: [],
  };
}

export function createDefaultWellnessStep(order: number) {
  return {
    stepKey: `step_${order}`,
    title: `Step ${order}`,
    description: "",
    assetUrl: null,
    durationSeconds: 30,
    sortOrder: order,
  };
}

function createDefaultStretchingSteps() {
  return [
    { stepKey: "neck", title: "Relax your neck", description: "", assetUrl: null, durationSeconds: 20, sortOrder: 1 },
    { stepKey: "shoulders", title: "Relax your shoulders", description: "", assetUrl: null, durationSeconds: 20, sortOrder: 2 },
    { stepKey: "back", title: "Loosen your back", description: "", assetUrl: null, durationSeconds: 20, sortOrder: 3 },
    {
      stepKey: "wrists",
      title: "Stretch wrists and hands",
      description: "",
      assetUrl: null,
      durationSeconds: 20,
      sortOrder: 4,
    },
    { stepKey: "move", title: "Stand and move", description: "", assetUrl: null, durationSeconds: 30, sortOrder: 5 },
  ];
}

export function normalizeWellnessProgramDraft(program: WellnessProgram): WellnessProgram {
  const allowedLayouts = getAllowedWellnessLayoutVariants(program.programType);
  const nextLayout = allowedLayouts.includes(program.layoutVariant)
    ? program.layoutVariant
    : allowedLayouts[0];

  return {
    ...program,
    layoutVariant: nextLayout,
    heroAssetUrl: normalizeOptionalText(program.heroAssetUrl),
    countdownSeconds:
      nextLayout === "CountdownCard" && typeof program.countdownSeconds === "number"
        ? program.countdownSeconds
        : nextLayout === "CountdownCard"
          ? 20
          : null,
    rotationMode:
      program.programType === "SimpleReminder" ? program.rotationMode ?? "Fixed" : null,
    actions: program.actions.map((action, index) => ({
      ...action,
      actionKey: action.actionKey.trim() || `action_${index + 1}`,
      label: action.label.trim() || getDefaultActionLabel(action.kind),
      style: action.style ?? (index === 0 ? "Primary" : "Secondary"),
      snoozeMinutes: action.kind === "RemindMeLater" ? action.snoozeMinutes ?? 10 : null,
    })),
    steps:
      program.programType === "GuidedRoutine"
        ? (program.steps ?? []).map((step, index) => ({
            ...step,
            stepKey: step.stepKey.trim() || `step_${index + 1}`,
            title: step.title.trim() || `Step ${index + 1}`,
            description: normalizeOptionalText(step.description),
            assetUrl: normalizeOptionalText(step.assetUrl),
            durationSeconds:
              typeof step.durationSeconds === "number" && step.durationSeconds > 0
                ? step.durationSeconds
                : null,
            sortOrder: index + 1,
          }))
        : [],
    localizations: (program.localizations ?? []).map((localization) => ({
      ...localization,
      locale: localization.locale.trim(),
      title: normalizeOptionalText(localization.title),
      body: normalizeOptionalText(localization.body),
      instruction: normalizeOptionalText(localization.instruction),
    })),
  };
}

export function isValidWellnessProgramDraft(program: WellnessProgram) {
  const normalized = normalizeWellnessProgramDraft(program);
  const actionKeys = new Set<string>();
  for (const action of normalized.actions) {
    if (!action.actionKey || actionKeys.has(action.actionKey)) {
      return false;
    }

    if (!action.label.trim()) {
      return false;
    }

    if (
      action.kind === "RemindMeLater" &&
      action.snoozeMinutes != null &&
      (!Number.isInteger(action.snoozeMinutes) || action.snoozeMinutes <= 0)
    ) {
      return false;
    }

    actionKeys.add(action.actionKey);
  }

  if (normalized.actions.length === 0) {
    return false;
  }

  if (
    normalized.layoutVariant === "CountdownCard" &&
    (!normalized.countdownSeconds ||
      !Number.isInteger(normalized.countdownSeconds) ||
      normalized.countdownSeconds <= 0)
  ) {
    return false;
  }

  if (normalized.programType === "GuidedRoutine") {
    if (normalized.layoutVariant !== "GuidedRoutine") {
      return false;
    }

    if ((normalized.steps?.length ?? 0) === 0) {
      return false;
    }

    const stepKeys = new Set<string>();
    for (const step of normalized.steps ?? []) {
      if (!step.stepKey || stepKeys.has(step.stepKey) || !step.title.trim()) {
        return false;
      }

      if (step.durationSeconds != null && (!Number.isInteger(step.durationSeconds) || step.durationSeconds <= 0)) {
        return false;
      }

      stepKeys.add(step.stepKey);
    }
  }

  if (normalized.programType === "SimpleReminder" && normalized.layoutVariant === "GuidedRoutine") {
    return false;
  }

  return true;
}

function getDefaultActionLabel(kind: WellnessActionKind) {
  switch (kind) {
    case "GotIt":
      return "Got it";
    case "Done":
      return "Done";
    case "Start":
      return "Start";
    case "Next":
      return "Next";
    case "Close":
      return "Close";
    case "RemindMeLater":
      return "Remind me later";
  }
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
