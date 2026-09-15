import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWindowsAgentAuthoringRules as normalize } from "../src/modules/communications/service/communication-draft-service.js";
const base = {
  priority: "Info" as const,
  channelSelections: ["WindowsAgent" as const],
  instruction: "Save your work",
  windowsAgentPresentation: "Toast" as const,
  toastAutoDismissSeconds: null,
};
test("custom preserves instruction and sets a compatible default duration", () => {
  const r = normalize({ ...base, toastRenderer: "Custom" });
  assert.equal(r.instruction, base.instruction);
  assert.equal(r.toastAutoDismissSeconds, 5);
});
test("native clears custom duration and follows legacy instruction policy", () => {
  const r = normalize({ ...base, toastRenderer: "Native", toastAutoDismissSeconds: 30 });
  assert.equal(r.toastAutoDismissSeconds, null);
  assert.equal(r.instruction, null);
});
test("Auto preserves null or explicit legacy duration", () => {
  for (const duration of [null, 5, 30])
    assert.equal(
      normalize({ ...base, toastRenderer: "Auto", toastAutoDismissSeconds: duration })
        .toastAutoDismissSeconds,
      duration,
    );
});
test("Warning remains modal and non-desktop clears presentation", () => {
  assert.equal(
    normalize({ ...base, priority: "Warning", toastRenderer: "Custom" }).windowsAgentPresentation,
    "Modal",
  );
  assert.equal(
    normalize({ ...base, channelSelections: [], toastRenderer: "Custom" }).windowsAgentPresentation,
    null,
  );
});
