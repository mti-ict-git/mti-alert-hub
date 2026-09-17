import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseClient, TransactionClient } from "./connection.js";

const commitSchedulers = new WeakMap<
  DatabaseClient,
  (task: () => Promise<void>) => Promise<void>
>();
export function afterCommit(database: DatabaseClient, task: () => Promise<void>) {
  return commitSchedulers.get(database)?.(task) ?? task();
}

/** One atomic unit of work across existing collaborating services, without sharing requests. */
export function createContextualDatabase(base: DatabaseClient) {
  const storage = new AsyncLocalStorage<{
    client: TransactionClient;
    closed: boolean;
    afterCommit: Array<() => Promise<void>>;
  }>();
  const current = () => {
    const context = storage.getStore();
    if (context?.closed) throw Error("Database work outlived its authorization transaction");
    return context?.client ?? base;
  };
  const client: DatabaseClient = {
    query: (sql, params) => current().query(sql, params),
    maybeQuery: (table, sql, params) => current().maybeQuery(table, sql, params),
    tableExists: (table) => current().tableExists(table),
    ping: () => current().ping(),
    async withTransaction(run) {
      const context = storage.getStore();
      if (context) return run(current());
      const afterCommitTasks: Array<() => Promise<void>> = [];
      const result = await base.withTransaction((tx) => {
        const state = { client: tx, closed: false, afterCommit: afterCommitTasks };
        return storage.run(state, async () => {
          try {
            return await run(tx);
          } finally {
            state.closed = true;
          }
        });
      });
      for (const task of afterCommitTasks) await task();
      return result;
    },
  };
  commitSchedulers.set(client, async (task) => {
    const state = storage.getStore();
    if (state?.closed) throw Error("Dispatch outlived its authorization transaction");
    if (state) state.afterCommit.push(task);
    else await task();
  });
  return client;
}
