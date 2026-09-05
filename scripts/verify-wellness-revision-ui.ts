// Isolated manual browser harness. Run while Vite is serving on localhost:8080.
// No API requests are forwarded; writes only touch the in-memory fixture.
import { createServer } from "node:http";
import { buildWellnessProgramFromSelection } from "../src/lib/wellness-template-catalog";

const user = { id: "qa", username: "qa", fullName: "Isolated QA", roleType: "CentralAdmin" };
const session = { sessionToken: "fixture-only", user };
const program = {
  id: "revision-qa",
  communicationType: "Wellness",
  priority: "Info",
  title: "Eye Break QA",
  body: "Fixture only",
  status: "Scheduled",
  channelSelections: ["WindowsAgent"],
  category: "Wellness",
  wellnessProgram: buildWellnessProgramFromSelection({
    family: "Eye Break",
    variantKeys: ["A1"],
    rotationMode: "Fixed",
  }),
  targets: [{ targetType: "Device", targetValue: "qa-device-1" }],
  schedule: {
    scheduleType: "Recurring",
    recurrenceRule: "FREQ=DAILY;INTERVAL=1",
    timezone: "UTC",
    executionMode: "AgentLocalRoutine",
    distributionMode: "Synchronized",
    scheduleVersion: 3,
    isActive: true,
  },
};
let attempts = 0;
createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://127.0.0.1:8092");
    if (url.pathname.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      const send = (data: unknown) => res.end(JSON.stringify(data));
      if (url.pathname === "/api/auth/me") return send(session);
      if (url.pathname === "/api/reference/organization")
        return send({
          sites: [{ id: "qa-site", name: "QA Site" }],
          areas: [],
          departments: [],
          sections: [],
        });
      if (url.pathname === "/api/employees") return send({ items: [] });
      if (url.pathname === "/api/devices")
        return send({
          items: [1, 2].map((n) => ({
            id: `qa-id-${n}`,
            deviceIdentifier: `qa-device-${n}`,
            hostname: `QA-NB-00${n}`,
            siteId: "qa-site",
            ownershipMode: "LocationOwned",
            status: "Online",
          })),
        });
      if (url.pathname.endsWith("/revise-wellness") && req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const input = JSON.parse(body);
        console.log("REVISION", JSON.stringify(input));
        if (input.expectedScheduleVersion !== 3 || input.confirmedChanges !== true)
          throw new Error("Bad revision contract");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (++attempts === 1) {
          res.statusCode = 409;
          return send({
            code: "WELLNESS_VERSION_CONFLICT",
            message: "QA: Program changed. Reload before applying changes.",
          });
        }
        Object.assign(program, input.changes, {
          schedule: { ...program.schedule, ...input.changes.reminderSchedule, scheduleVersion: 4 },
        });
        return send(program);
      }
      if (url.pathname === "/api/communications/revision-qa") return send(program);
      // Safe empty list responses for post-save navigation. Never proxy APIs.
      return send({ items: [] });
    }
    const upstream = await fetch(`http://localhost:8080${req.url}`, {
      headers: { Accept: req.headers.accept ?? "*/*" },
    });
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", contentType);
    if (/javascript|html/.test(contentType)) {
      let body = (await upstream.text()).replaceAll("http://127.0.0.1:4019", "/api");
      if (contentType.includes("html")) {
        const stored = JSON.stringify({
          ...session,
          user: { id: "qa", username: "qa", name: "Isolated QA", role: "Admin" },
        });
        body = body.replace(
          /<head[^>]*>/,
          (match) =>
            `${match}<script>localStorage.setItem('mti_alert_session',${JSON.stringify(stored)})</script>`,
        );
      }
      res.end(body);
    } else res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end("QA harness failure");
  }
}).listen(8092, "127.0.0.1", () =>
  console.log("Isolated UI QA: http://127.0.0.1:8092/wellness-programs/new?draftId=revision-qa"),
);
