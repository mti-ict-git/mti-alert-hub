// Simulate network latency for mock services.
// TODO(backend): remove when the real API is wired up.
export const mockDelay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

export const genId = () => Math.random().toString(36).slice(2, 10);
