import assert from "node:assert/strict";
import test from "node:test";
import { comparePublishedPackages } from "../src/modules/devices/service/package-order.js";

const item = (
  version: string | null,
  fileName: string,
  lastModifiedAt = "2026-09-16T00:00:00Z",
) => ({
  version,
  fileName,
  lastModifiedAt,
});
test("canonical old upload does not outrank a newer relay package", () => {
  const packages = [
    item("1.0.15", "MTI.Alert.Agent.Setup.msi", "2026-09-17T00:00:00Z"),
    item("1.0.16", "MTI.Alert.Agent.Setup-1.0.16.msi"),
    item("1.0.17", "MTI.Alert.Agent.Setup-1.0.17.msi"),
  ].sort(comparePublishedPackages);
  assert.deepEqual(
    packages.map((p) => p.version),
    ["1.0.17", "1.0.16", "1.0.15"],
  );
});
test("version segments are numeric, including major/minor and fourth segment", () => {
  const versions = ["1.0.9", "1.0.10", "1.2.0", "1.10.0", "2.0.0", "1.0.10.1"];
  assert.deepEqual(
    versions
      .map((v) => item(v, v))
      .sort(comparePublishedPackages)
      .map((p) => p.version),
    ["2.0.0", "1.10.0", "1.2.0", "1.0.10.1", "1.0.10", "1.0.9"],
  );
});
test("missing or malformed metadata follows valid versions; timestamps resolve ties", () => {
  const packages = [
    item(null, "unknown.msi"),
    item("broken", "malformed.msi", "invalid"),
    item("1.0.17", "older.msi", "2026-09-15T00:00:00Z"),
    item("1.0.17", "newer.msi"),
  ].sort(comparePublishedPackages);
  assert.deepEqual(
    packages.map((p) => p.fileName),
    ["newer.msi", "older.msi", "unknown.msi", "malformed.msi"],
  );
});
test("equal versions and timestamps have deterministic filename ordering", () => {
  assert.ok(comparePublishedPackages(item("1.0.17", "a.msi"), item("1.0.17.0", "b.msi")) < 0);
  assert.equal(comparePublishedPackages(item(null, "a.msi"), item(null, "a.msi")), 0);
});
