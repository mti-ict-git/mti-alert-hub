const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const out = process.env.LOGIN_QA_OUTPUT || ".tmp/live-theme";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let mode = "error",
      requests = 0;
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://127.0.0.1:4019/**", async (route) => {
      const url = new URL(route.request().url());
      let body = { items: [] },
        status = 200;
      if (url.pathname === "/auth/login") {
        requests++;
        await new Promise((r) => setTimeout(r, 800));
        if (mode === "error") {
          status = 401;
          body = { message: "Invalid credentials" };
        } else
          body = {
            sessionToken: "login-ui-fixture",
            user: {
              id: "review",
              username: "review",
              fullName: "UI Reviewer",
              roleType: "CentralAdmin",
            },
          };
      }
      if (url.pathname === "/dashboard/overview")
        body = {
          activeCommunications: 0,
          recipientsPending: 0,
          deliveredCount: 0,
          respondedCount: 0,
          failedCount: 0,
          overdueResponses: 0,
        };
      await route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
        body: JSON.stringify(body),
      });
    });
    await page.goto("http://127.0.0.1:4198/login", { timeout: 120000 });
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
    await page
      .locator('section[aria-label="Site photos"] > div > img')
      .evaluate((img) => img.decode());
    await page.screenshot({ path: out + "/services-login-desktop.png", fullPage: true });
    await page.getByRole("button", { name: "Show operations", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Show operations", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.getByRole("button", { name: "Show camp facilities", exact: true }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    assert.equal(await page.locator("#u").evaluate((el) => el === document.activeElement), true);
    assert.equal(requests, 0);
    await page.getByLabel("Username", { exact: true }).fill("fixture-review");
    await page.getByLabel("Password", { exact: true }).fill("fixture-only-password");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    assert.equal(await page.locator("#p").getAttribute("type"), "text");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await page.locator("#p").press("Enter");
    await page.locator("#p").press("Enter");
    await page.getByText("Unable to sign in.", { exact: false }).waitFor();
    assert.equal(requests, 1);
    assert.equal(await page.locator("#u").inputValue(), "fixture-review");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: out + "/services-login-mobile.png", fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    mode = "success";
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Control Room", exact: true }).waitFor();
    assert.equal(requests, 2);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      out + "/login-results.json",
      JSON.stringify(
        {
          passed: [
            "desktop rendering",
            "photo selection",
            "required fields and focus",
            "password visibility",
            "duplicate submit guard",
            "failure retains values",
            "mobile overflow",
            "successful login redirect",
          ],
          isolatedFixtures: true,
          errors,
        },
        null,
        2,
      ),
    );
    console.log("PASS: 8 login checks; 0 uncaught exceptions; all login requests intercepted.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
