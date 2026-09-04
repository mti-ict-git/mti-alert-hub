import { describe, expect, test } from "bun:test";
import { buildCsv, safeCsvFileStem } from "../src/lib/wellness-reporting-export";

describe("wellness reporting CSV", () => {
  test("escapes commas, quotes, and line breaks", () => {
    expect(buildCsv(["Name", "Result"], [["Stretch, Office", 'Done "well"\nToday']])).toBe(
      'Name,Result\r\n"Stretch, Office","Done ""well""\nToday"',
    );
  });

  test("creates a safe and stable file stem", () => {
    expect(safeCsvFileStem("  OHIH: Stretch / Shift A  ")).toBe("ohih-stretch-shift-a");
  });
});
