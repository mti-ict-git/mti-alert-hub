import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAllPages, type ListPage } from "../src/lib/load-all-pages.ts";

function result<T>(items: T[], page: number, total: number): ListPage<T> {
  return {
    items,
    page: { page, pageSize: 200, totalItems: total, totalPages: Math.ceil(total / 200) },
  };
}
for (const total of [0, 200, 201, 451]) {
  test("loads the complete list of " + total, async () => {
    const source = Array.from({ length: total }, (_, i) => ({ id: String(i), online: i >= 200 }));
    const calls: number[] = [];
    const loaded = await loadAllPages(async (page, size) => {
      assert.equal(size, 200);
      calls.push(page);
      return result(source.slice((page - 1) * size, page * size), page, total);
    });
    assert.deepEqual(loaded, source);
    assert.equal(calls.length, Math.max(1, Math.ceil(total / 200)));
    assert.equal(loaded.filter((item) => item.online).length, Math.max(0, total - 200));
  });
}
test("later-page failure rejects rather than exposing the first 200 as complete", async () => {
  await assert.rejects(
    loadAllPages(async (page) => {
      if (page === 2) throw new Error("network failure");
      return result([{ id: "first" }], page, 201);
    }),
    /network failure/,
  );
});
test("deduplicates overlapping IDs during live refresh", async () => {
  const items = await loadAllPages(async (page) =>
    result([{ id: "shared" }, { id: String(page) }], page, 201),
  );
  assert.deepEqual(
    items.map((item) => item.id),
    ["shared", "1", "2"],
  );
});
test("rejects missing pagination metadata instead of silently truncating", async () => {
  await assert.rejects(
    loadAllPages(async () => ({ items: [] }) as unknown as ListPage<{ id: string }>),
    /pagination/,
  );
});
