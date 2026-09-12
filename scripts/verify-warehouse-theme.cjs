const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const output = process.env.THEME_QA_OUTPUT || path.join(process.cwd(), ".tmp/warehouse-theme");
fs.mkdirSync(output, { recursive: true });
const origin = process.env.THEME_QA_URL || "http://127.0.0.1:4198";
const user = {
  id: "theme-review",
  username: "theme.review",
  fullName: "Theme Reviewer",
  email: "review@example.test",
  roleType: "CentralAdmin",
};
const session = { sessionToken: "isolated-theme-fixture", user, expiresAt: "2099-01-01T00:00:00Z" };
const overview = {
  activeCommunications: 12,
  recipientsPending: 48,
  deliveredCount: 1240,
  respondedCount: 986,
  failedCount: 3,
  overdueResponses: 8,
};
const devices = Array.from({ length: 8 }, (_, i) => ({
  id: `device-${i}`,
  deviceIdentifier: `MTI-DEV-${101 + i}`,
  hostname: `MTI-PC-${101 + i}`,
  siteId: "site-1",
  areaId: "area-1",
  locationLabel: "Control room",
  ownershipMode: "LocationOwned",
  agentVersion: "1.4.0",
  status: i < 6 ? "Online" : "Offline",
  lastHeartbeatAt: new Date().toISOString(),
}));
const communications = [
  "Emergency drill briefing",
  "Scheduled power maintenance",
  "Daily operations update",
].map((title, i) => ({
  id: `communication-${i}`,
  communicationType: "OperationalNotice",
  priority: ["Critical", "Warning", "Info"][i],
  title,
  status: "Active",
  category: "Operation",
  channelSelections: ["WindowsAgent"],
  createdAt: new Date().toISOString(),
  recipientsCount: 48,
  ackCount: 32,
}));
const organization = {
  sites: [{ id: "site-1", code: "MTI", name: "MTI Operations" }],
  areas: [{ id: "area-1", siteId: "site-1", name: "Acid Plant" }],
  departments: [],
  sections: [],
};
const checks = [];
const errors = [];
let state = "success";
let mutations = [];
let browser;
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
    if (!url.pathname.startsWith("/api/")) return route.abort();
    const endpoint = url.pathname.slice(4);
    if (!["GET", "OPTIONS"].includes(request.method())) mutations.push(endpoint);
    let body;
    if (endpoint.startsWith("/auth/")) body = session;
    else if (endpoint === "/dashboard/overview") body = overview;
    else if (endpoint === "/communications")
      body = { items: state === "empty" ? [] : communications };
    else if (endpoint === "/devices") body = { items: state === "empty" ? [] : devices };
    else if (endpoint === "/reference/organization") body = organization;
    else if (endpoint === "/devices/pending") body = { items: [] };
    else if (endpoint.includes("rollout-packages")) body = { items: [] };
    else body = { items: [] };
    if (state === "loading" && !endpoint.startsWith("/auth/"))
      await new Promise((r) => setTimeout(r, 1500));
    const status =
      state === "error" &&
      ["/dashboard/overview", "/communications", "/devices", "/devices/pending"].includes(endpoint)
        ? 503
        : 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
      body: JSON.stringify(status === 200 ? body : { message: "Fixture unavailable" }),
    });
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "mti_alert_session",
      JSON.stringify({
        sessionToken: "isolated-theme-fixture",
        expiresAt: "2099-01-01T00:00:00Z",
        user: {
          id: "theme-review",
          username: "theme.review",
          name: "Theme Reviewer",
          role: "Admin",
          email: "review@example.test",
        },
      }),
    ),
  );
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("heading", { name: "Control Room", exact: true }).waitFor();
  await page.getByText("1240", { exact: true }).waitFor();
  await check("Desktop tokens, six metrics, single active menu, no document overflow", async () => {
    assert.equal(await page.locator('[data-sidebar="menu-button"][data-active="true"]').count(), 1);
    assert.equal(
      await page.locator("main").getByText("Overdue Responses", { exact: true }).count(),
      1,
    );
    const actual = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      radius: getComputedStyle(document.querySelector("main .rounded-surface")).borderRadius,
      header: document.querySelector("header").getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    assert.equal(actual.background, "rgb(246, 248, 251)");
    assert.equal(actual.radius, "16px");
    assert.equal(actual.header, 72);
    assert.equal(actual.overflow, false);
  });
  await page.screenshot({ path: path.join(output, "dashboard-desktop.png"), fullPage: true });
  await check("Create Notification uses only its own active menu", async () => {
    await page.getByRole("link", { name: "Create Notification", exact: true }).first().click();
    await page.waitForURL("**/notifications/new");
    assert.equal(await page.locator('[data-sidebar="menu-button"][data-active="true"]').count(), 1);
    assert.match(
      await page.locator('[data-sidebar="menu-button"][data-active="true"]').innerText(),
      /Create Notification/,
    );
  });
  await page.goto(origin + "/devices");
  await page.getByText("MTI-PC-101", { exact: true }).waitFor();
  await check("Devices table remains internally scrollable", async () => {
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.equal(await page.locator("table tbody tr").count(), 8);
  });
  await page.screenshot({ path: path.join(output, "devices-desktop.png"), fullPage: true });
  await check("Pending tab empty state", async () => {
    await page.getByRole("tab", { name: /Pending Approval/ }).click();
    await page.getByText("No pending device approval requests.").waitFor();
  });
  await check("Rollout modal and authored select keyboard operation", async () => {
    await page.getByRole("tab", { name: "Approved Devices", exact: true }).click();
    await page.getByRole("button", { name: "Rollout", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("listbox").waitFor();
    await page.getByRole("option", { name: "Upgrade", exact: true }).waitFor();
    await page.keyboard.press("ArrowDown");
    await page.screenshot({ path: path.join(output, "devices-select.png") });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  });
  await check("Mobile dashboard and drawer navigation", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin);
    await page.getByRole("heading", { name: "Control Room", exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: path.join(output, "dashboard-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Devices", exact: true }).click();
    await page.getByRole("heading", { name: "Desktop Agents" }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: path.join(output, "devices-mobile.png"), fullPage: true });
  });
  await check("Loading, failure/retry, and empty dashboard", async () => {
    state = "loading";
    await page.goto(origin);
    await page.getByText("Loading operational overview…").waitFor();
    await page.getByText("1240", { exact: true }).waitFor();
    state = "error";
    await page.reload();
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor({ timeout: 25000 });
    state = "empty";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByText("No notifications yet.", { exact: true }).waitFor();
  });
  await check("Devices failure and retry to empty state", async () => {
    state = "error";
    await page.goto(origin + "/devices");
    await page.getByRole("button", { name: "Retry device data" }).waitFor({ timeout: 25000 });
    state = "empty";
    await page.getByRole("button", { name: "Retry device data" }).click();
    await page.getByText("No approved devices yet.").waitFor();
  });
  await check("Login appearance, account keyboard menu, reduced motion and dark mode", async () => {
    state = "success";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin);
    await page.getByRole("button", { name: "Open account menu" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(output, "dashboard-dark.png"), fullPage: true });
    await page.goto(origin + "/login");
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, "login-desktop.png"), fullPage: true });
  });
  assert.deepEqual(mutations, [], "No mutation requests during theme QA");
  assert.deepEqual(errors, [], "No uncaught browser exceptions");
  fs.writeFileSync(
    path.join(output, "browser-results.json"),
    JSON.stringify({ checks, errors, mutations, fixtureOnly: true }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, errors, mutations }));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
