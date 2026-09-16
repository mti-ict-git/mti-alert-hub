import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWellnessRecurrenceRule,
  parseWellnessRecurrenceRule,
  formatWellnessRecurrenceSummary,
} from "../src/lib/wellness-authoring.ts";

test("sign-in schedule survives create/edit roundtrip with minute and hour units", () => {
  for (const [interval, unit] of [
    [20, "Minute"],
    [2, "Hour"],
    [7, "Day"],
  ] as const) {
    const rule = buildWellnessRecurrenceRule({ interval, unit, basis: "WindowsSignIn" });
    const parsed = parseWellnessRecurrenceRule(rule);
    assert.ok(parsed);
    assert.equal(parsed.basis, "WindowsSignIn");
    assert.equal(buildWellnessRecurrenceRule(parsed), rule);
    assert.match(formatWellnessRecurrenceSummary(rule), /After Windows sign-in/);
  }
});
test("fixed recurrence remains the default", () => {
  assert.equal(
    buildWellnessRecurrenceRule({ interval: 2, unit: "Hour" }),
    "FREQ=HOURLY;INTERVAL=2",
  );
  assert.equal(formatWellnessRecurrenceSummary("FREQ=HOURLY;INTERVAL=2"), "Every 2 hours");
});
test("out of range session intervals cannot be parsed as valid schedules", () => {
  for (const value of ["0", "-1", "1.5", "10081"]) {
    assert.equal(parseWellnessRecurrenceRule("FREQ=WINDOWS_SIGNIN;INTERVAL=" + value), null);
  }
});
