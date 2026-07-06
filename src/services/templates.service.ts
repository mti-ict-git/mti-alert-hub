// TODO(backend): CRUD /api/templates
import type { Template } from "@/types";
import { mockDelay, genId } from "@/lib/mock-delay";
import { templates as seed } from "@/data/misc";

const store: Template[] = [...seed];

export const templatesService = {
  async list() {
    await mockDelay();
    return [...store];
  },
  async create(input: Omit<Template, "id">) {
    await mockDelay();
    const t = { ...input, id: `tpl-${genId()}` };
    store.unshift(t);
    return t;
  },
  async update(id: string, patch: Partial<Template>) {
    await mockDelay();
    const idx = store.findIndex((t) => t.id === id);
    if (idx === -1) return;
    store[idx] = { ...store[idx], ...patch };
    return store[idx];
  },
  async remove(id: string) {
    await mockDelay();
    const idx = store.findIndex((t) => t.id === id);
    if (idx !== -1) store.splice(idx, 1);
  },
};
