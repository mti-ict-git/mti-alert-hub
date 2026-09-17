import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { buildWellnessProgramFromSelection } from "../src/lib/wellness-template-catalog";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER", msg.text().slice(0, 200));
  });
  const permissions = [
    "wellness.read",
    "wellness.manage",
    "wellness.publish",
    "notifications.read",
    "notifications.draft",
    "notifications.publish",
  ];
  const user = {
    id: "qa",
    username: "qa",
    name: "QA",
    fullName: "QA",
    role: "Admin",
    roleType: "CentralAdmin",
    permissions,
  };
  await page.addInitScript(
    ({ user }) =>
      localStorage.setItem("mti_alert_session", JSON.stringify({ sessionToken: "fixture", user })),
    { user },
  );
  const program = {
    id: "publish-qa",
    communicationType: "Wellness",
    priority: "Info",
    title: "Sign-in publish QA",
    body: "Fixture only",
    status: "Draft",
    channelSelections: ["WindowsAgent"],
    targets: [{ targetType: "Device", targetValue: "qa-device" }],
    wellnessProgram: buildWellnessProgramFromSelection({
      family: "Eye Break",
      variantKeys: ["A1"],
      rotationMode: "Fixed",
    }),
    schedule: {
      scheduleType: "Recurring",
      recurrenceRule: "FREQ=WINDOWS_SIGNIN;INTERVAL=120",
      timezone: "Etc/GMT-8",
      executionMode: "AgentLocalRoutine",
      distributionMode: "Synchronized",
      scheduleVersion: 0,
      isActive: false,
    },
  };
  let submitted: Record<string, unknown> = {};
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (
      u.pathname.startsWith("/api/") ||
      /^\/(auth|communications|reference|employees|devices)(\/|$)/.test(u.pathname)
    ) {
      const path = u.pathname.replace(/^\/api/, "");
      let data: unknown = { items: [] };
      if (path === "/auth/me") data = { sessionToken: "fixture", user, permissions };
      else if (path.endsWith("/publish")) {
        submitted = route.request().postDataJSON();
        data = { ...program, status: "Scheduled" };
      } else if (path.endsWith("/audience-preview"))
        data = {
          deviceRecipients: 1,
          recipients: [
            { deviceId: "qa-device", targetType: "Device", availableChannels: ["WindowsAgent"] },
          ],
          previewWarnings: [],
          channelPlan: [],
        };
      else if (path.endsWith("/deliveries"))
        data = { items: [], recipients: [], events: [], page: {} };
      else if (path.endsWith("/reminder-activity")) data = { policies: [], events: [] };
      else if (path.endsWith("/wellness-reporting")) {
        await route.fulfill({ status: 503, json: { message: "Fixture reporting unavailable" } });
        return;
      } else if (path === "/communications/publish-qa") data = program;
      await route.fulfill({ json: data });
      return;
    }
    if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.continue();
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto("http://127.0.0.1:4207/wellness-programs/publish-qa", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page
    .getByRole("button", { name: "Publish Wellness Program", exact: true })
    .click({ timeout: 60000 });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 60000 });
  assert.match(await dialog.innerText(), /After Windows sign-in/);
  assert.match(await dialog.innerText(), /Available from/);
  const inputs = dialog.locator("input[type=number]");
  await inputs.first().fill("169");
  assert.equal(await dialog.getByRole("button", { name: /^Publish/ }).isDisabled(), true);
  await inputs.first().fill("2");
  await dialog.getByRole("button", { name: /^Publish/ }).click();
  await page.waitForTimeout(1000);
  assert.equal(submitted?.recurrenceRule, "FREQ=WINDOWS_SIGNIN;INTERVAL=120");
  assert.equal(submitted.distributionMode, "Synchronized");
  assert.equal(submitted.staggerWindowMinutes, null);
  console.log(
    "PASS: actual publish dialog retains Windows sign-in, validates maximum interval, and submits session rule without stagger. All APIs intercepted.",
  );
} finally {
  await browser.close();
}
