import path from "node:path";
import { fileURLToPath } from "node:url";
import { runner as pgMigrate } from "node-pg-migrate";

const currentFile = fileURLToPath(import.meta.url);
const apiRoot = path.resolve(path.dirname(currentFile), "../..");
const migrationsDir = path.join(apiRoot, "migrations");

export async function runMigrations({ databaseUrl, direction, count }) {
  await pgMigrate({
    databaseUrl,
    dir: migrationsDir,
    direction,
    count,
    migrationsTable: process.env.MIGRATIONS_TABLE || "pgmigrations",
    log: (message) => {
      if (message) {
        console.log(message);
      }
    }
  });
}
