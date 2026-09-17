import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/connection.js";
import { createLogger } from "../shared/observability/logger.js";
import { AccessDirectoryService } from "../modules/access/service/access-directory-service.js";
import { AdministratorBootstrapService } from "../modules/access/service/administrator-bootstrap-service.js";
import { userInfo } from "node:os";

async function main() {
  const [username, mode, reason] = process.argv.slice(2);
  if (
    !username ||
    !["--check", "--apply"].includes(mode ?? "") ||
    (mode === "--apply" && (!reason || reason.trim().length < 5))
  ) {
    throw Error("Usage: bootstrap-access-admin.ts <exact AD username> --check | --apply <reason>");
  }
  const env = loadEnv();
  const entries = await new AccessDirectoryService(env).search(
    "server-operator-bootstrap",
    username,
  );
  const matches = entries.filter((i) => i.username.toLowerCase() === username.toLowerCase());
  if (matches.length !== 1)
    throw Error("Exactly one eligible AD identity must match the requested username.");
  const identity = matches[0]!;
  if (mode === "--check") {
    console.log(JSON.stringify({ username: identity.username, verified: true, applied: false }));
    return;
  }
  const database = bootstrapDatabase(env, createLogger("error"));
  try {
    console.log(
      JSON.stringify(
        await new AdministratorBootstrapService(database.client).apply(
          identity,
          userInfo().username,
          reason!,
        ),
      ),
    );
  } finally {
    await database.close();
  }
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "failed",
      code: error.code ?? "BOOTSTRAP_FAILED",
      message: error.code
        ? error.message
        : "Administrator bootstrap could not complete. Check directory connectivity and arguments.",
    }),
  );
  process.exitCode = 1;
});
