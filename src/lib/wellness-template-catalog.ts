import type { WellnessProgram } from "@/types";
import type { WellnessRecurrenceUnit, WellnessRotationMode } from "@/lib/wellness-authoring";

export type WellnessTemplateKey = "A1" | "A2" | "A3" | "A4" | "B1" | "B2";
export type WellnessFamily = "Eye Break" | "Office Stretching";

export type WellnessTemplateDefinition = {
  key: WellnessTemplateKey;
  label: string;
  family: WellnessFamily;
  description: string;
  title: string;
  message: string;
  instruction: string;
  wellnessProgram: WellnessProgram;
};

export type WellnessFamilyDefinition = {
  key: WellnessFamily;
  label: string;
  description: string;
  title: string;
  message: string;
  instruction: string;
  recommendedInterval: number;
  recommendedUnit: WellnessRecurrenceUnit;
  variantKeys: WellnessTemplateKey[];
};

const STRETCHING_STEPS = [
  {
    stepKey: "neck",
    title: "Leher (Neck Stretch)",
    description: "Miringkan kepala ke samping. Tahan perlahan dan rasakan peregangan.",
    assetUrl: null,
    durationSeconds: 20,
    sortOrder: 1,
  },
  {
    stepKey: "shoulders",
    title: "Bahu",
    description: "Angkat siku dan rilekskan area bahu perlahan.",
    assetUrl: null,
    durationSeconds: 20,
    sortOrder: 2,
  },
  {
    stepKey: "upper-back",
    title: "Punggung Atas",
    description: "Rentangkan lengan ke depan untuk meregangkan punggung atas.",
    assetUrl: null,
    durationSeconds: 20,
    sortOrder: 3,
  },
  {
    stepKey: "lower-back",
    title: "Punggung Bawah",
    description: "Condongkan badan dan jaga punggung bawah tetap nyaman.",
    assetUrl: null,
    durationSeconds: 20,
    sortOrder: 4,
  },
  {
    stepKey: "wrists",
    title: "Pergelangan Tangan",
    description: "Luruskan lengan dan putar pergelangan tangan dengan lembut.",
    assetUrl: null,
    durationSeconds: 20,
    sortOrder: 5,
  },
  {
    stepKey: "move",
    title: "Berdiri & Bergerak",
    description: "Berdiri sejenak lalu gerakkan kaki secara bergantian.",
    assetUrl: null,
    durationSeconds: 30,
    sortOrder: 6,
  },
] as const;

function createEyeBreakProgram(
  layoutVariant: "ReminderCard" | "CountdownCard" | "OverviewCard" | "CompletionCard",
): WellnessProgram {
  return {
    programType: "SimpleReminder",
    theme: "Blue",
    layoutVariant,
    variantKeys: [inferEyeBreakVariantKey(layoutVariant)],
    heroAssetUrl: null,
    countdownSeconds: 20,
    rotationMode: "Fixed",
    actions: [
      {
        actionKey: "done",
        kind: layoutVariant === "CompletionCard" ? "Done" : "GotIt",
        label:
          layoutVariant === "CountdownCard"
            ? "OK, I'll do it"
            : layoutVariant === "CompletionCard"
              ? "Done"
              : "Got it",
        style: "Primary",
        snoozeMinutes: null,
      },
      {
        actionKey: "remind-later",
        kind: "RemindMeLater",
        label: "Remind me in 10 min",
        style: "Secondary",
        snoozeMinutes: 10,
      },
    ],
    steps: [],
    localizations: [],
  };
}

function createStretchingProgram(variant: "B1" | "B2"): WellnessProgram {
  const isCompactOverview = variant === "B2";

  return {
    programType: "GuidedRoutine",
    theme: "Green",
    layoutVariant: "OverviewCard",
    variantKeys: [variant],
    heroAssetUrl: null,
    countdownSeconds: null,
    rotationMode: "Fixed",
    actions: [
      {
        actionKey: isCompactOverview ? "start-stretching-overview" : "start-stretching",
        kind: "Start",
        label: isCompactOverview ? "Mulai" : "Start Stretching",
        style: "Primary",
        snoozeMinutes: null,
      },
      {
        actionKey: "remind-later",
        kind: "RemindMeLater",
        label: "Remind me in 10 min",
        style: "Secondary",
        snoozeMinutes: 10,
      },
    ],
    steps: STRETCHING_STEPS.map((step) => ({ ...step })),
    localizations: [],
  };
}

const FAMILY_CATALOG: Record<WellnessFamily, WellnessFamilyDefinition> = {
  "Eye Break": {
    key: "Eye Break",
    label: "20-20-20 Rule",
    description:
      "Short eye-rest reminders with higher cadence. Best used for individual micro-breaks during screen work.",
    title: "Eye Break Time!",
    message: "Follow the 20-20-20 rule to reduce eye strain and keep your vision comfortable.",
    instruction: "Look away from your screen and focus on a distant object for 20 seconds.",
    recommendedInterval: 20,
    recommendedUnit: "Minute",
    variantKeys: ["A1", "A2", "A3", "A4"],
  },
  "Office Stretching": {
    key: "Office Stretching",
    label: "Office Stretching",
    description:
      "Longer guided stretching routines for posture resets. Best used less often than eye breaks.",
    title: "Office Stretching",
    message: "Take 2 - 3 minutes to stretch and reset your posture.",
    instruction: "Lakukan perlahan dan nyaman. Jangan sampai menimbulkan nyeri.",
    recommendedInterval: 2,
    recommendedUnit: "Hour",
    variantKeys: ["B1", "B2"],
  },
};

const TEMPLATE_CATALOG: Record<WellnessTemplateKey, WellnessTemplateDefinition> = {
  A1: {
    key: "A1",
    label: "A1 - Eye Break Reminder",
    family: "Eye Break",
    description: "Blue eye-break card with the first reminder layout.",
    title: "Eye Break Reminder",
    message:
      "It has been 20 minutes. Please look away from the screen and focus on an object about 6 meters away for 20 seconds.",
    instruction: "Look at a distant object for 20 seconds before returning to work.",
    wellnessProgram: createEyeBreakProgram("ReminderCard"),
  },
  A2: {
    key: "A2",
    label: "A2 - Eye Break Countdown",
    family: "Eye Break",
    description: "Blue eye-break card with the countdown treatment.",
    title: "Time for Your Eye Break!",
    message: "Take a short break to reduce eye strain and keep your vision comfortable.",
    instruction: "Look away from your screen and focus on a distant object for 20 seconds.",
    wellnessProgram: createEyeBreakProgram("CountdownCard"),
  },
  A3: {
    key: "A3",
    label: "A3 - Eye Break Completion",
    family: "Eye Break",
    description: "Blue completion card that closes the eye-break flow with a simple confirmation state.",
    title: "Give Your Eyes a Break",
    message: "Look away from your screen.",
    instruction: "Blink, relax, and refresh before you continue working.",
    wellnessProgram: createEyeBreakProgram("CompletionCard"),
  },
  A4: {
    key: "A4",
    label: "A4 - Eye Break Overview",
    family: "Eye Break",
    description: "Blue overview card that summarizes the 20-20-20 rule.",
    title: "Eye Break Time!",
    message: "Follow the 20-20-20 rule to reduce eye strain.",
    instruction: "A short eye break helps you stay focused.",
    wellnessProgram: createEyeBreakProgram("OverviewCard"),
  },
  B1: {
    key: "B1",
    label: "B1 - Office Stretching Hero Start Card",
    family: "Office Stretching",
    description: "Green hero-led stretching start card with the richer checklist-style overview shell.",
    title: "Office Stretching",
    message: "2 - 3 Menit",
    instruction: "Lakukan perlahan dan nyaman. Jangan sampai menimbulkan nyeri.",
    wellnessProgram: createStretchingProgram("B1"),
  },
  B2: {
    key: "B2",
    label: "B2 - Office Stretching Start Card",
    family: "Office Stretching",
    description: "Green stretching entry card that invites the device user to start the guided routine.",
    title: "Office Stretching",
    message: "2 - 3 Menit",
    instruction: "Lakukan perlahan dan nyaman. Jangan sampai menimbulkan nyeri.",
    wellnessProgram: createStretchingProgram("B2"),
  },
};

export const WELLNESS_TEMPLATE_KEYS = ["A1", "A2", "A3", "A4", "B1", "B2"] as const satisfies readonly WellnessTemplateKey[];

export function getWellnessTemplate(key: WellnessTemplateKey): WellnessTemplateDefinition {
  const template = TEMPLATE_CATALOG[key];
  return {
    ...template,
    wellnessProgram: {
      ...template.wellnessProgram,
      variantKeys: [...(template.wellnessProgram.variantKeys ?? [])],
      actions: template.wellnessProgram.actions.map((action) => ({ ...action })),
      steps: template.wellnessProgram.steps?.map((step) => ({ ...step })) ?? [],
      localizations: template.wellnessProgram.localizations?.map((item) => ({ ...item })) ?? [],
    },
  };
}

export function listWellnessTemplates(): WellnessTemplateDefinition[] {
  return WELLNESS_TEMPLATE_KEYS.map((key) => getWellnessTemplate(key));
}

export function listWellnessFamilies(): WellnessFamilyDefinition[] {
  return [getWellnessFamily("Eye Break"), getWellnessFamily("Office Stretching")];
}

export function getWellnessFamily(family: WellnessFamily): WellnessFamilyDefinition {
  return {
    ...FAMILY_CATALOG[family],
    variantKeys: [...FAMILY_CATALOG[family].variantKeys],
  };
}

export function listWellnessTemplatesByFamily(family: WellnessFamily) {
  return FAMILY_CATALOG[family].variantKeys.map((key) => getWellnessTemplate(key));
}

export function buildWellnessProgramFromSelection(input: {
  family: WellnessFamily;
  variantKeys: WellnessTemplateKey[];
  rotationMode: WellnessRotationMode;
}) {
  const family = getWellnessFamily(input.family);
  const normalizedVariantKeys = input.variantKeys.filter((key) => family.variantKeys.includes(key));
  const selectedVariantKeys = normalizedVariantKeys.length > 0 ? normalizedVariantKeys : [family.variantKeys[0]];
  const baseTemplate = getWellnessTemplate(selectedVariantKeys[0]);

  return {
    ...baseTemplate.wellnessProgram,
    variantKeys: selectedVariantKeys,
    rotationMode: selectedVariantKeys.length > 1 ? input.rotationMode : "Fixed",
  } satisfies WellnessProgram;
}

export function inferWellnessFamily(input: {
  wellnessProgram?: WellnessProgram | null;
}): WellnessFamily | null {
  const program = input.wellnessProgram;
  if (!program) {
    return null;
  }

  if (program.programType === "SimpleReminder" && program.theme === "Blue") {
    return "Eye Break";
  }

  if (program.programType === "GuidedRoutine" && program.theme === "Green") {
    return "Office Stretching";
  }

  return null;
}

export function inferWellnessVariantKeys(input: {
  wellnessProgram?: WellnessProgram | null;
}): WellnessTemplateKey[] {
  const program = input.wellnessProgram;
  if (!program) {
    return [];
  }

  const variantKeys = (program.variantKeys ?? []).filter((key): key is WellnessTemplateKey =>
    WELLNESS_TEMPLATE_KEYS.includes(key as WellnessTemplateKey),
  );

  if (variantKeys.length > 0) {
    return [...new Set(variantKeys)];
  }

  const inferred = inferWellnessTemplateKey(input);
  return inferred ? [inferred] : [];
}

export function inferWellnessTemplateKey(input: {
  title?: string | null;
  message?: string | null;
  instruction?: string | null;
  wellnessProgram?: WellnessProgram | null;
}): WellnessTemplateKey | null {
  const program = input.wellnessProgram;
  if (!program) {
    return null;
  }

  if (program.programType === "SimpleReminder" && program.theme === "Blue") {
    if (program.layoutVariant === "ReminderCard") {
      return "A1";
    }

    if (program.layoutVariant === "CountdownCard") {
      return "A2";
    }

    if (program.layoutVariant === "CompletionCard") {
      return "A3";
    }

    if (program.layoutVariant === "OverviewCard") {
      return "A4";
    }
  }

  if (
    program.programType === "GuidedRoutine" &&
    program.theme === "Green" &&
    program.layoutVariant === "OverviewCard"
  ) {
    const primaryActionKey = program.actions[0]?.actionKey;
    return primaryActionKey === "start-stretching-overview" ? "B2" : "B1";
  }

  return null;
}

function inferEyeBreakVariantKey(layoutVariant: "ReminderCard" | "CountdownCard" | "OverviewCard" | "CompletionCard"): WellnessTemplateKey {
  switch (layoutVariant) {
    case "ReminderCard":
      return "A1";
    case "CountdownCard":
      return "A2";
    case "CompletionCard":
      return "A3";
    default:
      return "A4";
  }
}
