import { requireDatabaseUrl } from "./lib/db-env.mjs";
import { runMigrations } from "./lib/migration-runner.mjs";

const direction = process.argv[2];

if (!["up", "down"].includes(direction)) {
  console.error("Usage: node scripts/migrate.mjs <up|down>");
  process.exit(1);
}

await runMigrations({
  databaseUrl: requireDatabaseUrl(),
  direction,
  count: direction === "down" ? 1 : undefined
});
