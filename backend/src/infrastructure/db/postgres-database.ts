import { Pool, type QueryResultRow } from "pg";

import type { BackendEnv } from "../../app/config/env.js";
import type { Logger } from "../../shared/observability/logger.js";

export type DatabaseClient = {
  query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  maybeQuery<T extends QueryResultRow>(
    tableName: string,
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  tableExists(tableName: string): Promise<boolean>;
  ping(): Promise<void>;
};

export type DatabaseBootstrap = {
  client: DatabaseClient;
  redactedConnectionString: string;
};

export function bootstrapDatabase(env: BackendEnv, logger: Logger): DatabaseBootstrap {
  const connectionConfig = resolveConnectionConfig(env);
  const pool = new Pool(connectionConfig);
  const tableExistsCache = new Map<string, boolean>();

  logger.info("database.bootstrap.ready", {
    connectionString: redactConnectionConfig(connectionConfig),
  });

  const client: DatabaseClient = {
    async query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await pool.query<T>(sql, params);
      return result.rows;
    },
    async maybeQuery<T extends QueryResultRow>(
      tableName: string,
      sql: string,
      params: unknown[] = [],
    ) {
      const exists = await this.tableExists(tableName);
      if (!exists) {
        return [];
      }

      const result = await pool.query<T>(sql, params);
      return result.rows;
    },
    async tableExists(tableName: string) {
      if (tableExistsCache.has(tableName)) {
        return tableExistsCache.get(tableName) ?? false;
      }

      const result = await pool.query<{ exists: boolean }>(
        `
          select exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = $1
          ) as "exists"
        `,
        [tableName],
      );

      const exists = result.rows[0]?.exists ?? false;
      tableExistsCache.set(tableName, exists);
      return exists;
    },
    async ping() {
      await pool.query("select 1");
    },
  };

  return {
    client,
    redactedConnectionString: redactConnectionConfig(connectionConfig),
  };
}

function resolveConnectionConfig(env: BackendEnv) {
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

function redactConnectionConfig(connectionConfig: {
  host: string;
  port: number;
  user: string;
  database: string;
}) {
  return `postgresql://${connectionConfig.user}:***@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`;
}
