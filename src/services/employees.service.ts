// TODO(backend): GET/POST/PUT /api/employees
import type { Employee } from "@/types";
import { mockDelay, genId } from "@/lib/mock-delay";
import { employees as seed } from "@/data/employees";

const store: Employee[] = [...seed];

export const employeesService = {
  async list(): Promise<Employee[]> {
    await mockDelay();
    return [...store];
  },
  async create(input: Omit<Employee, "id">): Promise<Employee> {
    await mockDelay();
    const e: Employee = { ...input, id: `emp-${genId()}` };
    store.unshift(e);
    return e;
  },
  async update(id: string, patch: Partial<Employee>): Promise<Employee | undefined> {
    await mockDelay();
    const idx = store.findIndex((e) => e.id === id);
    if (idx === -1) return;
    store[idx] = { ...store[idx], ...patch };
    return store[idx];
  },
};
