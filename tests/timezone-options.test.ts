import assert from "node:assert/strict";
import test from "node:test";

import {
  UTC_OFFSET_TIME_ZONE_OPTIONS,
  formatUtcOffsetTimeZone,
  normalizeUtcOffsetTimeZone,
} from "../src/lib/timezone-options";

test("UTC offset choices are complete, operator-friendly, and valid IANA zones", () => {
  assert.equal(UTC_OFFSET_TIME_ZONE_OPTIONS.length, 27);
  assert.equal(UTC_OFFSET_TIME_ZONE_OPTIONS[0]?.label, "UTC-12");
  assert.equal(UTC_OFFSET_TIME_ZONE_OPTIONS.at(-1)?.label, "UTC+14");

  for (const option of UTC_OFFSET_TIME_ZONE_OPTIONS) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: option.value }));
  }
});

test("legacy regional zones are presented as fixed UTC offsets", () => {
  assert.equal(normalizeUtcOffsetTimeZone("Asia/Jakarta"), "Etc/GMT-7");
  assert.equal(normalizeUtcOffsetTimeZone("Asia/Makassar"), "Etc/GMT-8");
  assert.equal(normalizeUtcOffsetTimeZone("Asia/Jayapura"), "Etc/GMT-9");
  assert.equal(formatUtcOffsetTimeZone("Asia/Makassar"), "UTC+8");
});
