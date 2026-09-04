import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCsv, safeCsvFileStem } from "../src/lib/wellness-reporting-export";

describe("wellness reporting CSV", () => {
  test("escapes commas, quotes, and line breaks", () => {
    assert.equal(
      buildCsv(["Name", "Result"], [["Stretch, Office", 'Done "well"\nToday']]),
      'Name,Result\r\n"Stretch, Office","Done ""well""\nToday"',
    );
  });

  test("creates a safe and stable file stem", () => {
    assert.equal(safeCsvFileStem("  OHIH: Stretch / Shift A  "), "ohih-stretch-shift-a");
  });
});
