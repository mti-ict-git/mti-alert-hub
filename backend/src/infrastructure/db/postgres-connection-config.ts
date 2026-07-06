import type { BackendEnv } from "../../app/config/env.js";

export type PostgresConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl:
    | false
    | {
        rejectUnauthorized: boolean;
      };
};

export function resolvePostgresConnectionConfig(env: BackendEnv): PostgresConnectionConfig {
  const parsedUrl = new URL(env.POSTGRES_URL);
  const sslEnabled = env.POSTGRES_SSL ?? false;

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
    user: env.POSTGRES_USERNAME ?? decodeURIComponent(parsedUrl.username),
    password: env.POSTGRES_PASSWORD ?? decodeURIComponent(parsedUrl.password),
    database: env.POSTGRES_DATABASE ?? parsedUrl.pathname.replace(/^\//, ""),
    ssl: sslEnabled
      ? {
          rejectUnauthorized: env.POSTGRES_SSL_REJECT_UNAUTHORIZED ?? false,
        }
      : false,
  };
}

export function redactPostgresConnectionConfig(connectionConfig: {
  host: string;
  port: number;
  user: string;
  database: string;
}) {
  return `postgresql://${connectionConfig.user}:***@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`;
}
