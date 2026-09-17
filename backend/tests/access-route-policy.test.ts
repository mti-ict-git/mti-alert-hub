import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppRoute, AppRouteHandlerContext } from "../src/app/http/create-server.js";
import {
  protectAdministrativeRoutes,
  administrativeRoutePolicies,
  nonAdministrativeRoutes,
} from "../src/modules/access/service/administrative-route-policy.js";
import { accessRole, rolePermissions } from "../src/modules/access/model/permission-catalog.js";
import { registerAccessRoutes } from "../src/modules/access/controller/register-access-routes.js";
import { registerAgentRoutes } from "../src/modules/agent/controller/register-agent-routes.js";
import { registerAuditRoutes } from "../src/modules/audit/controller/register-audit-routes.js";
import { registerAuthRoutes } from "../src/modules/auth/controller/register-auth-routes.js";
import { registerCommunicationRoutes } from "../src/modules/communications/controller/register-communication-routes.js";
import { registerDashboardRoutes } from "../src/modules/dashboard/controller/register-dashboard-routes.js";
import { registerDeviceRoutes } from "../src/modules/devices/controller/register-device-routes.js";
import { registerHealthRoutes } from "../src/modules/health/controller/register-health-routes.js";
import { registerOrganizationRoutes } from "../src/modules/organization/controller/register-organization-routes.js";
import { registerWorkflowRoutes } from "../src/modules/workflows/controller/register-workflow-routes.js";

const factories = [
  registerAccessRoutes,
  registerAgentRoutes,
  registerAuditRoutes,
  registerAuthRoutes,
  registerCommunicationRoutes,
  registerDashboardRoutes,
  registerDeviceRoutes,
  registerHealthRoutes,
  registerOrganizationRoutes,
  registerWorkflowRoutes,
];

test("Every actual route, including dynamic factories, has an explicit reviewed policy", () => {
  const routes = factories.flatMap((factory) => factory({} as never));
  const keys = routes.map((r) => `${r.method} ${r.path}`);
  assert.equal(new Set(keys).size, keys.length, "Duplicate route definitions");
  const mapped = [...Object.keys(administrativeRoutePolicies), ...nonAdministrativeRoutes];
  assert.deepEqual([...keys].sort(), mapped.sort(), "Route and policy inventories drifted");
  assert.equal(
    protectAdministrativeRoutes(routes, (_, __, ___, run) => run()).length,
    routes.length,
  );
});

test("Unmapped routes cannot bypass authorization by marking themselves anonymous", () => {
  for (const path of ["/unmapped", "/agent/new-administration", "/auth/new-administration"]) {
    assert.throws(
      () =>
        protectAdministrativeRoutes(
          [{ method: "GET", path, allowAnonymous: true, handler: () => ({ statusCode: 200 }) }],
          (_, __, ___, run) => run(),
        ),
      /no access policy/,
    );
  }
});

test("Every mapped route checks all five roles before resource enforcement or handler execution", async () => {
  for (const [key, policy] of Object.entries(administrativeRoutePolicies)) {
    for (const role of accessRole.options) {
      let enforced = false,
        executed = false;
      const [method, path] = key.split(" ");
      const [route] = protectAdministrativeRoutes(
        [
          {
            method: method as AppRoute["method"],
            path: path!,
            requiredRoles: ["CentralAdmin"],
            handler: () => {
              executed = true;
              return { statusCode: 200 };
            },
          },
        ],
        (resource, _, __, run) => {
          assert.equal(resource, policy.resource);
          enforced = true;
          return run();
        },
      );
      const context = {
        auth: {
          session: {
            authorizationVersion: 1,
            permissions: rolePermissions[role],
            accessProfile: { roleType: role, scopes: [{ scopeType: "Global", scopeValue: "*" }] },
          },
        },
      } as AppRouteHandlerContext;
      const allowed = !policy.permission || rolePermissions[role].includes(policy.permission);
      if (allowed) await route!.handler(context);
      else await assert.rejects(async () => route!.handler(context), { code: "FORBIDDEN" });
      assert.equal(executed, allowed, `${key} / ${role}`);
      assert.equal(enforced, allowed, `${key} / ${role}`);
    }
  }
});

test("Legacy sessions cannot enter the managed policy layer", async () => {
  const [route] = protectAdministrativeRoutes(
    [
      {
        method: "GET",
        path: "/devices",
        handler: () => {
          throw Error("Must not execute");
        },
      },
    ],
    () => {
      throw Error("Must not enforce resource");
    },
  );
  await assert.rejects(
    async () =>
      route!.handler({
        auth: { session: { accessProfile: { roleType: "CentralAdmin" } } },
      } as AppRouteHandlerContext),
    { code: "ACCESS_CHANGED" },
  );
});

test("Resource denial prevents handlers even when the feature permission is granted", async () => {
  const [route] = protectAdministrativeRoutes(
    [
      {
        method: "GET",
        path: "/devices",
        handler: () => {
          throw Error("Data leaked");
        },
      },
    ],
    () => {
      throw Object.assign(Error("Outside scope"), { code: "NOT_FOUND" });
    },
  );
  await assert.rejects(
    async () =>
      route!.handler({
        auth: {
          session: {
            authorizationVersion: 1,
            permissions: rolePermissions.ITOperator,
            accessProfile: { roleType: "ITOperator" },
          },
        },
      } as AppRouteHandlerContext),
    { code: "NOT_FOUND" },
  );
});

test("Policy application is a device route and still requires an agent session", async () => {
  const now = new Date().toISOString();
  const payload = {
    protocolVersion: 1,
    scheduleVersion: 1,
    appliedAt: now,
    reportedAt: now,
    state: "WaitingForSession",
    nextRunAt: null,
    agentVersion: "1.0.18",
  };
  let calls = 0;
  const original = registerAgentRoutes({
    agentService: {
      async reportPolicyApplication(token: string, policyId: string, report: unknown) {
        calls++;
        if (token !== "valid-device-session")
          throw Object.assign(new Error("Invalid agent session"), { code: "UNAUTHORIZED" });
        assert.equal(policyId, "policy-fixture");
        assert.deepEqual(report, payload);
      },
    },
  } as never).find((route) => route.path === "/agent/reminder-policies/{policyId}/application")!;
  assert.ok(original);
  const [route] = protectAdministrativeRoutes([original], () => {
    throw Error("Device route entered administrator policy");
  });
  assert.equal(route, original);
  const context = (authorization?: string) =>
    ({
      request: { headers: { authorization } },
      params: { policyId: "policy-fixture" },
      json: async () => payload,
    }) as unknown as AppRouteHandlerContext;
  for (const header of [undefined, "Basic credentials", "Bearer"]) {
    await assert.rejects(async () => route!.handler(context(header)), { code: "UNAUTHORIZED" });
  }
  assert.equal(calls, 0, "Missing bearer token must fail before service execution");
  await assert.rejects(async () => route!.handler(context("Bearer invalid-device-session")), {
    code: "UNAUTHORIZED",
  });
  assert.equal(calls, 1, "Bearer tokens must reach device-session validation");
  assert.deepEqual(await route!.handler(context("Bearer valid-device-session")), {
    statusCode: 204,
  });
  assert.equal(calls, 2);
});
