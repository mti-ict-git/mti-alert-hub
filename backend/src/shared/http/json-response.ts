import type { ServerResponse } from "node:http";

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function sendNoContent(response: ServerResponse): void {
  response.statusCode = 204;
  response.end();
}
