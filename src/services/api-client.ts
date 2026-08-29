import { sessionService } from "@/services/session.service";

const configuredBaseUrl = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env
  .VITE_API_URL;

const BASE_URL = configuredBaseUrl ?? (typeof window !== "undefined" ? "/api" : "http://127.0.0.1:4000");

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = sessionService.getSessionToken();
  const headers = new Headers(init?.headers);
  const body = init?.body;

  if (
    body !== undefined &&
    !headers.has("Content-Type") &&
    !(typeof FormData !== "undefined" && body instanceof FormData) &&
    !(typeof Blob !== "undefined" && body instanceof Blob)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (sessionToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") {
      sessionService.clearSession();

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    const errorPayload = await tryParseErrorPayload(res);
    throw new Error(errorPayload?.message ?? `API ${res.status}: ${res.statusText}`);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

async function tryParseErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  postRaw: <T>(path: string, body?: BodyInit, headers?: HeadersInit) =>
    request<T>(path, { method: "POST", body, headers }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
