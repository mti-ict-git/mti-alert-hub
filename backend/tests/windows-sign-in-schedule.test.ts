import assert from "node:assert/strict";
import test from "node:test";
import { validateWindowsSignInSchedule as validate } from "../src/modules/communications/service/windows-sign-in-schedule.js";

test("sign-in schedule accepts bounded minute intervals only for local wellness", () => {
  for (const minutes of [1, 60, 10080]) {
    assert.doesNotThrow(() =>
      validate(
        "FREQ=WINDOWS_SIGNIN;INTERVAL=" + minutes,
        "AgentLocalRoutine",
        "Synchronized",
        true,
      ),
    );
  }
});
test("invalid sign-in rules and incompatible execution are rejected", () => {
  for (const value of ["0", "-1", "1.5", "10081", "NaN", "60;BYHOUR=8", "01"]) {
    assert.throws(() =>
      validate("FREQ=WINDOWS_SIGNIN;INTERVAL=" + value, "AgentLocalRoutine", "Synchronized", true),
    );
  }
  assert.throws(() =>
    validate("FREQ=WINDOWS_SIGNIN;INTERVAL=60", "ServerGenerated", "Synchronized", true),
  );
  assert.throws(() =>
    validate("FREQ=WINDOWS_SIGNIN;INTERVAL=60", "AgentLocalRoutine", "Staggered", true),
  );
  assert.throws(() =>
    validate("FREQ=WINDOWS_SIGNIN;INTERVAL=60", "AgentLocalRoutine", "Synchronized", false),
  );
});
test("existing fixed schedules retain their existing validation", () => {
  assert.doesNotThrow(() =>
    validate("FREQ=DAILY;INTERVAL=1", "ServerGenerated", "Staggered", false),
  );
});
