import { Pool, type QueryResultRow } from "pg";

import type { BackendEnv } from "../../app/config/env.js";
import type { Logger } from "../../shared/observability/logger.js";
import {
  redactPostgresConnectionConfig,
  resolvePostgresConnectionConfig,
} from "./postgres-connection-config.js";

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
  const connectionConfig = resolvePostgresConnectionConfig(env);
  const pool = new Pool(connectionConfig);
  const tableExistsCache = new Map<string, boolean>();

  logger.info("database.bootstrap.ready", {
    connectionString: redactPostgresConnectionConfig(connectionConfig),
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
    redactedConnectionString: redactPostgresConnectionConfig(connectionConfig),
  };
}
