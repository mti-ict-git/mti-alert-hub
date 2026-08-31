import type { WellnessProgram } from "@/types";

export type WellnessTemplateKey = "A1" | "A2" | "A4" | "B1" | "B2";

export type WellnessTemplateDefinition = {
  key: WellnessTemplateKey;
  label: string;
  family: "Eye Break" | "Office Stretching";
  description: string;
  title: string;
  message: string;
  instruction: string;
  wellnessProgram: WellnessProgram;
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

function createEyeBreakProgram(layoutVariant: "ReminderCard" | "CountdownCard" | "OverviewCard"): WellnessProgram {
  return {
    programType: "SimpleReminder",
    theme: "Blue",
    layoutVariant,
    heroAssetUrl: null,
    countdownSeconds: 20,
    rotationMode: "Fixed",
    actions: [
      {
        actionKey: "done",
        kind: "GotIt",
        label: layoutVariant === "CountdownCard" ? "OK, I'll do it" : "Got it",
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

function createStretchingProgram(layoutVariant: "GuidedRoutine" | "OverviewCard"): WellnessProgram {
  return {
    programType: "GuidedRoutine",
    theme: "Green",
    layoutVariant,
    heroAssetUrl: null,
    countdownSeconds: null,
    rotationMode: "Fixed",
    actions: [
      {
        actionKey: layoutVariant === "OverviewCard" ? "start-stretching-overview" : "start-stretching",
        kind: "Start",
        label: layoutVariant === "OverviewCard" ? "Start Stretching" : "Mulai",
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
    label: "B1 - Office Stretching Exercise Step",
    family: "Office Stretching",
    description: "Internal guided exercise step that appears after the user starts stretching.",
    title: "Leher (Neck Stretch)",
    message: "2 - 3 Menit",
    instruction: "Miringkan kepala ke samping. Tahan perlahan dan rasakan peregangan.",
    wellnessProgram: createStretchingProgram("GuidedRoutine"),
  },
  B2: {
    key: "B2",
    label: "B2 - Office Stretching Start Card",
    family: "Office Stretching",
    description: "Green stretching entry card that invites the device user to start the guided routine.",
    title: "Office Stretching",
    message: "2 - 3 Menit",
    instruction: "Lakukan perlahan dan nyaman. Jangan sampai menimbulkan nyeri.",
    wellnessProgram: createStretchingProgram("OverviewCard"),
  },
};

export const WELLNESS_TEMPLATE_KEYS = ["A1", "A2", "A4", "B2"] as const satisfies readonly WellnessTemplateKey[];

export function getWellnessTemplate(key: WellnessTemplateKey): WellnessTemplateDefinition {
  const template = TEMPLATE_CATALOG[key];
  return {
    ...template,
    wellnessProgram: {
      ...template.wellnessProgram,
      actions: template.wellnessProgram.actions.map((action) => ({ ...action })),
      steps: template.wellnessProgram.steps?.map((step) => ({ ...step })) ?? [],
      localizations: template.wellnessProgram.localizations?.map((item) => ({ ...item })) ?? [],
    },
  };
}

export function listWellnessTemplates(): WellnessTemplateDefinition[] {
  return WELLNESS_TEMPLATE_KEYS.map((key) => getWellnessTemplate(key));
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

    if (program.layoutVariant === "OverviewCard") {
      return "A4";
    }
  }

  if (program.programType === "GuidedRoutine" && program.theme === "Green") {
    if (program.layoutVariant === "GuidedRoutine") {
      return "B1";
    }

    if (program.layoutVariant === "OverviewCard") {
      return "B2";
    }
  }

  return null;
}
