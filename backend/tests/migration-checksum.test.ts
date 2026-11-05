import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { matchesMigrationChecksum } from "../src/infrastructure/db/migration-checksum.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

test("historical LF and CRLF migration checksums are accepted in both checkout formats", () => {
  const lf = "alter table example\n  add column value text;\n";
  const crlf = lf.replace(/\n/g, "\r\n");
  for (const source of [lf, crlf])
    for (const stored of [lf, crlf]) assert.equal(matchesMigrationChecksum(source, hash(stored)), true);
});
test("SQL edits, whitespace changes, BOM and missing final newline still fail checksum validation", () => {
  const sql = "select 1;\n";
  for (const changed of ["select 2;\n", "select  1;\n", "\ufeff" + sql, "select 1;"])
    assert.equal(matchesMigrationChecksum(changed, hash(sql)), false);
});
test("invalid and unrelated hashes remain rejected", () => {
  assert.equal(matchesMigrationChecksum("select 1;\n", "invalid"), false);
  assert.equal(matchesMigrationChecksum("select 1;\n", hash("drop table example;\n")), false);
});
