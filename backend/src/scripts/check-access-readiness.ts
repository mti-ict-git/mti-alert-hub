import { loadEnv } from "../app/config/env.js";
import { bootstrapDatabase } from "../infrastructure/db/connection.js";
import { createLogger } from "../shared/observability/logger.js";
import { checkAccessReadiness } from "../modules/access/service/access-readiness.js";
const db = bootstrapDatabase(loadEnv(), createLogger("error"));
try {
  console.log(JSON.stringify(await checkAccessReadiness(db.client), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Access readiness failed.");
  process.exitCode = 1;
} finally {
  await db.close();
}
