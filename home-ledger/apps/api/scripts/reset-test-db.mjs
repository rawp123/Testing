import pg from "pg";
import { requireTestDatabaseUrl } from "./lib/db-env.mjs";
import { runMigrations } from "./lib/migration-runner.mjs";

const databaseUrl = requireTestDatabaseUrl();
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
} finally {
  await client.end();
}

await runMigrations({ databaseUrl, direction: "up" });
console.log("Test database reset and migrated.");
