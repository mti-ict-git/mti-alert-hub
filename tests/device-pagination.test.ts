import assert from "node:assert/strict";
import { test } from "node:test";
import { apiClient } from "../src/services/api-client.ts";
import { referenceService } from "../src/services/reference.service.ts";
import { devicesService } from "../src/services/devices.service.ts";

for (const [method, endpoint] of [
  ["list", "/devices"],
  ["targetList", "/reference/devices"],
  ["listPending", "/devices/pending"],
] as const) {
  test(method + " loads device 451 through the real service mapping", async (context) => {
    const requested: number[] = [];
    context.mock.method(referenceService, "getOrganizationReference", async () => ({
      sites: [],
      areas: [],
      departments: [],
      sections: [],
    }));
    context.mock.method(referenceService, "listEmployees", async () => []);
    context.mock.method(apiClient, "get", async (path: string) => {
      const url = new URL(path, "http://fixture");
      assert.equal(url.pathname, endpoint);
      const page = Number(url.searchParams.get("page"));
      assert.equal(url.searchParams.get("pageSize"), "200");
      requested.push(page);
      const start = (page - 1) * 200;
      const items = Array.from({ length: Math.min(200, 451 - start) }, (_, index) => ({
        id: String(start + index),
        hostname: "Device-" + (start + index),
        deviceIdentifier: "Device-" + (start + index),
        siteId: "site",
        ownershipMode: "LocationOwned",
        status: "Online",
        requestStatus: "Pending",
        requestCount: 1,
      }));
      return { items, page: { page, pageSize: 200, totalItems: 451, totalPages: 3 } };
    });
    const devices = await devicesService[method]();
    assert.equal(devices.length, 451);
    assert.equal(devices[450].hostname, "Device-450");
    assert.deepEqual(requested, [1, 2, 3]);
  });
}
