import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().default("MTI Alert Backend"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  BACKEND_PUBLIC_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  POSTGRES_URL: z.string().min(1, "POSTGRES_URL is required for backend startup."),
  POSTGRES_USERNAME: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DATABASE: z.string().optional(),
  POSTGRES_SSL: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
  POSTGRES_SSL_REJECT_UNAUTHORIZED: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_PASSWORD: z.string().optional(),
  LDAP_BASE_DN: z.string().optional(),
  LDAP_SEARCH_BASE: z.string().optional(),
  LDAP_ALLOWED_GROUPS: z.string().optional(),
});

export type BackendEnv = z.infer<typeof envSchema>;

let cachedEnv: BackendEnv | undefined;

export function loadEnv(): BackendEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const mergedEnv = {
    ...loadDotEnvFile(path.resolve(process.cwd(), ".env")),
    ...process.env,
  };

  cachedEnv = envSchema.parse(mergedEnv);
  return cachedEnv;
}

function loadDotEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const contents = readFileSync(filePath, "utf8");
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = stripWrappingQuotes(value);
  }

  return values;
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
