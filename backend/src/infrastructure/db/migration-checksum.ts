import { createHash } from "node:crypto";

/** Accept only byte-identical SQL or its equivalent Windows/Unix line endings. */
export function matchesMigrationChecksum(sql: string, expected: string): boolean {
  const lf = sql.replace(/\r\n/g, "\n");
  return [sql, lf, lf.replace(/\n/g, "\r\n")].some(
    (value) => createHash("sha256").update(value).digest("hex") === expected,
  );
}
