import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

const deliveryChannelValues = ["WindowsAgent", "WhatsApp", "Email", "DigitalSignage"] as const;

const envSchema = z.object({
  APP_NAME: z.string().default("MTI Alert Backend"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  BACKEND_PUBLIC_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLED_DELIVERY_CHANNELS: z.string().default("WindowsAgent"),
  ADMIN_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(8 * 60),
  AGENT_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(8 * 60),
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
  LDAP_ALLOW_INSECURE_URL: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
  LDAP_SKIP_TLS_VERIFY: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export type BackendEnv = z.infer<typeof envSchema>;
export type DeliveryChannel = (typeof deliveryChannelValues)[number];

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

export function resolveEnabledDeliveryChannels(env: BackendEnv): DeliveryChannel[] {
  const parsed = env.ENABLED_DELIVERY_CHANNELS.split(",")
    .map((value) => value.trim())
    .filter((value): value is DeliveryChannel =>
      (deliveryChannelValues as readonly string[]).includes(value),
    );

  return parsed.length > 0 ? [...new Set(parsed)] : ["WindowsAgent"];
}

export function validateSecuritySensitiveEnv(env: BackendEnv) {
  if (!env.LDAP_URL) {
    return;
  }

  const usesPlainLdapUrl = env.LDAP_URL.startsWith("ldap://");
  if (env.NODE_ENV === "production" && usesPlainLdapUrl && !env.LDAP_ALLOW_INSECURE_URL) {
    throw new Error(
      "LDAP_URL must use ldaps:// in production unless LDAP_ALLOW_INSECURE_URL=true is set explicitly.",
    );
  }

  if (env.NODE_ENV === "production" && env.LDAP_SKIP_TLS_VERIFY) {
    throw new Error(
      "LDAP_SKIP_TLS_VERIFY=true is not allowed in production without changing the deployment configuration.",
    );
  }
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
