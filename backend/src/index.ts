import { createBackendApp } from "./app/bootstrap/create-backend-app.js";

async function main() {
  const app = await createBackendApp();

  app.server.listen(app.env.BACKEND_PORT, () => {
    app.logger.info("backend.server.started", {
      appName: app.env.APP_NAME,
      port: app.env.BACKEND_PORT,
      environment: app.env.NODE_ENV,
      startedAt: app.startedAt.toISOString(),
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
