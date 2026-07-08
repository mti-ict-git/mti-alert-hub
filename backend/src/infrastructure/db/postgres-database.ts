import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type { BackendEnv } from "../../app/config/env.js";
import type { Logger } from "../../shared/observability/logger.js";
import {
  redactPostgresConnectionConfig,
  resolvePostgresConnectionConfig,
} from "./postgres-connection-config.js";

type QueryableDatabaseClient = {
  query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  maybeQuery<T extends QueryResultRow>(
    tableName: string,
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  tableExists(tableName: string): Promise<boolean>;
  ping(): Promise<void>;
};

export type TransactionClient = QueryableDatabaseClient;

export type DatabaseClient = QueryableDatabaseClient & {
  withTransaction<T>(run: (client: TransactionClient) => Promise<T>): Promise<T>;
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

  const createQueryableClient = (
    queryExecutor: Pick<Pool, "query"> | Pick<PoolClient, "query">,
  ): QueryableDatabaseClient => ({
    async query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
      const result = await queryExecutor.query<T>(sql, params);
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

      const result = await queryExecutor.query<T>(sql, params);
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
      await queryExecutor.query("select 1");
    },
  });

  const client: DatabaseClient = {
    ...createQueryableClient(pool),
    async withTransaction<T>(run: (transactionClient: TransactionClient) => Promise<T>) {
      const transaction = await pool.connect();
      try {
        await transaction.query("begin");
        const transactionClient = createQueryableClient(transaction);
        const result = await run(transactionClient);
        await transaction.query("commit");
        return result;
      } catch (error) {
        await transaction.query("rollback");
        throw error;
      } finally {
        transaction.release();
      }
    },
  };

  return {
    client,
    redactedConnectionString: redactPostgresConnectionConfig(connectionConfig),
  };
}
